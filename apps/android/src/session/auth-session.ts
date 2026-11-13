import {
	type ApiClientOptions,
	login,
	logout,
	me,
	refresh,
} from "@finance-application/api-client";
import type { UserResponse } from "@finance-application/schemas";

import type { CookieJar, SessionCookies } from "./cookie-jar";

/**
 * Wires the shared api-client auth endpoints to the mobile cookie jar:
 * requests carry the stored cookies, and Set-Cookie values from login and
 * refresh responses are captured and persisted. Endpoint logic stays
 * single-sourced in `@finance-application/api-client`.
 */
export class AuthSession {
	private loadAttempted = false;

	constructor(
		private readonly jar: CookieJar,
		private readonly baseUrl: string,
	) {}

	/** Request options carrying the API base URL, cookie capture, and the current Cookie header. */
	async optionsForRequest(): Promise<ApiClientOptions> {
		if (!this.loadAttempted) {
			this.loadAttempted = true;
			await this.jar.load();
		}
		const cookieHeader = this.jar.headerValue();
		return {
			baseUrl: this.baseUrl,
			onResponse: (res: Response) => this.jar.capture(res.headers),
			headers: cookieHeader === null ? undefined : { cookie: cookieHeader },
		};
	}

	/** Restores stored cookies (null when none); storage failures throw SessionStorageError. */
	async loadCookies(): Promise<SessionCookies | null> {
		return this.jar.load();
	}

	/** Signs in, captures the issued session cookies, and persists them. */
	async signIn(email: string, password: string): Promise<UserResponse> {
		const user = await login(
			{ email, password },
			await this.optionsForRequest(),
		);
		await this.jar.persist();
		return user;
	}

	/** Fetches the current user with the stored session; throws ApiError 401 when unauthenticated. */
	async currentUser(): Promise<UserResponse> {
		return me(await this.optionsForRequest());
	}

	/** Rotates the session via the refresh endpoint and persists the fresh cookies. */
	async refreshSession(): Promise<UserResponse> {
		const user = await refresh(await this.optionsForRequest());
		await this.jar.persist();
		return user;
	}

	/** Revokes the session server-side (best effort) and clears the local cookies. */
	async signOut(): Promise<void> {
		try {
			await logout(await this.optionsForRequest());
		} catch {
			// The local session must go regardless; a network failure here must
			// not keep the user signed in on this device.
		}
		await this.jar.clear();
	}

	/** Clears the local cookies without a server round-trip (dead refresh token). */
	async clearLocal(): Promise<void> {
		await this.jar.clear();
	}
}
