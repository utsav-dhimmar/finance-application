import {
	ApiError,
	type ApiClientOptions,
} from "@finance-application/api-client";
import type { UserResponse } from "@finance-application/schemas";

import type { AuthSession } from "./auth-session";

export type SessionState =
	| { status: "restoring" }
	| { status: "signed-out"; error?: string }
	| { status: "signed-in"; user: UserResponse };

const GENERIC_INVALID_CREDENTIALS = "Invalid email or password.";
const NETWORK_ERROR = "Could not reach the server. Check the API URL and your connection.";
const STORAGE_ERROR =
	"Secure storage is unavailable, so the session could not be kept.";

function errorMessage(error: unknown, fallback: string): string {
	if (error instanceof ApiError && error.message.length > 0) {
		return error.message;
	}
	return fallback;
}

/**
 * Owns the signed-in/signed-out state for the app: restores the session at
 * boot, performs single-flight refreshes shared by concurrent 401s, and
 * never crashes on storage failures — those surface as a signed-out state
 * with an error message. React binds to it through useSyncExternalStore.
 */
export class SessionMachine {
	private state: SessionState = { status: "restoring" };
	private readonly listeners = new Set<(state: SessionState) => void>();
	private refreshInFlight: Promise<UserResponse> | null = null;

	constructor(private readonly auth: AuthSession) {}

	subscribe(listener: (state: SessionState) => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	getState(): SessionState {
		return this.state;
	}

	private set(next: SessionState): void {
		this.state = next;
		for (const listener of this.listeners) {
			listener(next);
		}
	}

	/** Restores the session at boot: stored cookies → verify with me() → refresh if rejected. */
	async restore(): Promise<void> {
		this.set({ status: "restoring" });
		try {
			const cookies = await this.auth.loadCookies();
			if (cookies === null) {
				this.set({ status: "signed-out" });
				return;
			}
		} catch {
			this.set({ status: "signed-out", error: STORAGE_ERROR });
			return;
		}
		try {
			this.set({ status: "signed-in", user: await this.auth.currentUser() });
			return;
		} catch (error) {
			if (!(error instanceof ApiError) || error.status !== 401) {
				// Unreachable API or unexpected failure: keep the stored session
				// (cookies persist) and let the user retry rather than clearing.
				this.set({ status: "signed-out", error: errorMessage(error, NETWORK_ERROR) });
				return;
			}
		}
		try {
			const user = await this.refreshOnce();
			this.set({ status: "signed-in", user });
		} catch (error) {
			if (error instanceof ApiError && error.status === 401) {
				await this.auth.clearLocal();
				this.set({ status: "signed-out" });
				return;
			}
			this.set({ status: "signed-out", error: errorMessage(error, NETWORK_ERROR) });
		}
	}

	/** Signs in with credentials; failures land back in signed-out with a message. */
	async signIn(email: string, password: string): Promise<void> {
		try {
			const user = await this.auth.signIn(email, password);
			this.set({ status: "signed-in", user });
		} catch (error) {
			this.set({
				status: "signed-out",
				error: errorMessage(error, GENERIC_INVALID_CREDENTIALS),
			});
		}
	}

	/** Signs out: revokes server-side (best effort) and clears local state. */
	async signOut(): Promise<void> {
		try {
			await this.auth.signOut();
		} finally {
			this.set({ status: "signed-out" });
		}
	}

	/**
	 * Runs an authenticated request, retrying once after a shared single-flight
	 * refresh when the first attempt is rejected with 401 UNAUTHENTICATED.
	 */
	async run<T>(operation: (options: ApiClientOptions) => Promise<T>): Promise<T> {
		const first = await operation(await this.auth.optionsForRequest()).then(
			(value: T): { ok: true; value: T } | { ok: false; error: unknown } => ({
				ok: true,
				value,
			}),
			(error: unknown): { ok: false; error: unknown } => ({
				ok: false,
				error,
			}),
		);
		if (first.ok) {
			return first.value;
		}
		if (!(first.error instanceof ApiError) || first.error.status !== 401) {
			throw first.error;
		}
		try {
			const user = await this.refreshOnce();
			this.set({ status: "signed-in", user });
		} catch (error) {
			if (error instanceof ApiError && error.status === 401) {
				await this.auth.clearLocal();
				this.set({ status: "signed-out" });
			}
			throw error;
		}
		return operation(await this.auth.optionsForRequest());
	}

	/** Single-flight refresh: concurrent callers share one request. */
	private refreshOnce(): Promise<UserResponse> {
		this.refreshInFlight ??= this.auth
			.refreshSession()
			.finally(() => {
				this.refreshInFlight = null;
			});
		return this.refreshInFlight;
	}
}
