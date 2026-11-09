import { parseSetCookie } from "./cookies";

export const ACCESS_COOKIE = "__Host-access_token";
export const REFRESH_COOKIE = "__Secure-refresh_token";

/** The two session cookies the API issues; values only, names are fixed. */
export interface SessionCookies {
	accessToken: string;
	refreshToken: string;
}

/**
 * Persistence contract for the session cookies. The app wires this to the
 * platform secure storage (device keystore/keychain); tests use in-memory
 * fakes. Implementations may throw on storage failure — callers surface
 * that as a signed-out-with-error state instead of crashing.
 */
export interface CookieStore {
	load(): Promise<SessionCookies | null>;
	save(cookies: SessionCookies): Promise<void>;
	clear(): Promise<void>;
}

/** Raised when secure storage itself fails (unavailable keystore, I/O error). */
export class SessionStorageError extends Error {
	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = "SessionStorageError";
	}
}

/**
 * In-memory session cookie jar: captures Set-Cookie values from API
 * responses, exposes them for the `Cookie` request header, and persists
 * through the injected store. Cookie values never appear in log or error
 * output produced here.
 */
export class CookieJar {
	private current: SessionCookies | null = null;

	constructor(private readonly store: CookieStore) {}

	/** Restores cookies from storage. Returns the cookies or null; rethrows storage failures as SessionStorageError. */
	async load(): Promise<SessionCookies | null> {
		try {
			this.current = await this.store.load();
		} catch (error) {
			this.current = null;
			throw new SessionStorageError(
				"Could not read the stored session from secure storage.",
				{ cause: error },
			);
		}
		return this.current;
	}

	get(): SessionCookies | null {
		return this.current;
	}

	/** Reads Set-Cookie values off a response and updates the known session cookies. */
	capture(headers: Headers): void {
		const raw =
			typeof headers.getSetCookie === "function"
				? headers.getSetCookie()
				: [headers.get("set-cookie") ?? ""].filter(
						(value) => value.length > 0,
					);
		const cookies = parseSetCookie(raw);
		let accessToken = this.current?.accessToken ?? "";
		let refreshToken = this.current?.refreshToken ?? "";
		for (const cookie of cookies) {
			if (cookie.name === ACCESS_COOKIE) {
				accessToken = cookie.value;
			} else if (cookie.name === REFRESH_COOKIE) {
				refreshToken = cookie.value;
			}
		}
		if (accessToken.length > 0) {
			this.current = { accessToken, refreshToken };
		}
	}

	/** Persists the current cookies; storage failures surface as SessionStorageError. */
	async persist(): Promise<void> {
		if (this.current === null) {
			return;
		}
		try {
			await this.store.save(this.current);
		} catch (error) {
			throw new SessionStorageError(
				"Could not store the session in secure storage.",
				{ cause: error },
			);
		}
	}

	/** Drops the cookies from memory and storage. */
	async clear(): Promise<void> {
		this.current = null;
		try {
			await this.store.clear();
		} catch (error) {
			throw new SessionStorageError(
				"Could not clear the stored session from secure storage.",
				{ cause: error },
			);
		}
	}

	/** The `Cookie` header value for API requests, or null with no session. */
	headerValue(): string | null {
		const current = this.current;
		if (current === null || current.accessToken.length === 0) {
			return null;
		}
		const pairs = [`__Host-access_token=${current.accessToken}`];
		if (current.refreshToken.length > 0) {
			pairs.push(`__Secure-refresh_token=${current.refreshToken}`);
		}
		return pairs.join("; ");
	}
}
