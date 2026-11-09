import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@finance-application/api-client";

import { AuthSession } from "./auth-session";
import {
	ACCESS_COOKIE,
	CookieJar,
	REFRESH_COOKIE,
	SessionStorageError,
	type CookieStore,
	type SessionCookies,
} from "./cookie-jar";
import {
	API_BASE,
	errorEnvelope,
	jsonResponse,
	stubFetchRouter,
	user,
} from "./fetch-mock";

const ACCESS = "access-value-123";
const REFRESH = "refresh-value-456";

class MemoryStore implements CookieStore {
	data: SessionCookies | null = null;
	saves = 0;
	clears = 0;
	loadError: Error | null = null;

	async load(): Promise<SessionCookies | null> {
		if (this.loadError !== null) {
			throw this.loadError;
		}
		return this.data;
	}

	async save(cookies: SessionCookies): Promise<void> {
		this.saves += 1;
		this.data = cookies;
	}

	async clear(): Promise<void> {
		this.clears += 1;
		this.data = null;
	}
}

function lastRequestInit(): RequestInit | undefined {
	return vi.mocked(fetch).mock.calls.at(-1)?.[1];
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("AuthSession", () => {
	it("sends the stored cookies as a Cookie header on requests", async () => {
		const store = new MemoryStore();
		store.data = { accessToken: ACCESS, refreshToken: REFRESH };
		vi.stubGlobal(
			"fetch",
			stubFetchRouter({
				"GET /api/auth/me": () => jsonResponse(200, user),
			}),
		);
		const auth = new AuthSession(new CookieJar(store), API_BASE);
		await expect(auth.currentUser()).resolves.toEqual(user);
		const headers = new Headers(lastRequestInit()?.headers);
		expect(headers.get("cookie")).toBe(
			`__Host-access_token=${ACCESS}; __Secure-refresh_token=${REFRESH}`,
		);
	});

	it("establishes the session from the login response and persists it", async () => {
		const store = new MemoryStore();
		vi.stubGlobal(
			"fetch",
			stubFetchRouter({
				"POST /api/auth/login": () =>
					jsonResponse(200, user, {
						"set-cookie": `${ACCESS_COOKIE}=${ACCESS}; Path=/, ${REFRESH_COOKIE}=${REFRESH}; Path=/api/auth`,
					}),
			}),
		);
		const auth = new AuthSession(new CookieJar(store), API_BASE);
		await expect(
			auth.signIn("user@example.com", "long-enough"),
		).resolves.toEqual(user);
		expect(store.data).toEqual({
			accessToken: ACCESS,
			refreshToken: REFRESH,
		});
		expect(store.saves).toBe(1);
	});

	it("captures rotated cookies on refresh and persists them", async () => {
		const store = new MemoryStore();
		store.data = { accessToken: ACCESS, refreshToken: REFRESH };
		vi.stubGlobal(
			"fetch",
			stubFetchRouter({
				"POST /api/auth/refresh": () =>
					jsonResponse(200, user, {
						"set-cookie": `${ACCESS_COOKIE}=fresh-access; Path=/, ${REFRESH_COOKIE}=fresh-refresh; Path=/api/auth`,
					}),
			}),
		);
		const auth = new AuthSession(new CookieJar(store), API_BASE);
		await expect(auth.refreshSession()).resolves.toEqual(user);
		expect(store.data).toEqual({
			accessToken: "fresh-access",
			refreshToken: "fresh-refresh",
		});
	});

	it("keeps cookie values out of error messages", async () => {
		const store = new MemoryStore();
		store.data = { accessToken: ACCESS, refreshToken: REFRESH };
		vi.stubGlobal(
			"fetch",
			stubFetchRouter({
				"GET /api/auth/me": () =>
					errorEnvelope(401, "UNAUTHENTICATED", "No session"),
			}),
		);
		const auth = new AuthSession(new CookieJar(store), API_BASE);
		const error = await auth.currentUser().catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(ApiError);
		if (error instanceof ApiError) {
			expect(error.message).not.toContain(ACCESS);
			expect(error.message).not.toContain(REFRESH);
		}
	});

	it("clears the local session even when logout fails", async () => {
		const store = new MemoryStore();
		store.data = { accessToken: ACCESS, refreshToken: REFRESH };
		vi.stubGlobal(
			"fetch",
			stubFetchRouter({
				"POST /api/auth/logout": () => {
					throw new TypeError("Network request failed");
				},
			}),
		);
		const auth = new AuthSession(new CookieJar(store), API_BASE);
		await expect(auth.signOut()).resolves.toBeUndefined();
		expect(store.data).toBeNull();
		expect(store.clears).toBe(1);
	});

	it("raises storage failures as SessionStorageError", async () => {
		const store = new MemoryStore();
		store.loadError = new Error("keystore unavailable");
		vi.stubGlobal("fetch", stubFetchRouter({}));
		const auth = new AuthSession(new CookieJar(store), API_BASE);
		await expect(auth.loadCookies()).rejects.toBeInstanceOf(SessionStorageError);
	});
});
