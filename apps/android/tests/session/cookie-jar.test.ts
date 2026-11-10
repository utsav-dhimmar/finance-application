import { describe, expect, it, vi } from "vitest";

import {
	ACCESS_COOKIE,
	CookieJar,
	type CookieStore,
	REFRESH_COOKIE,
	type SessionCookies,
	SessionStorageError,
} from "@/session/cookie-jar";

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

function responseWithCookies(entries: string[]): Response {
	return new Response(null, {
		status: 200,
		headers: entries.map((value): [string, string] => ["set-cookie", value]),
	});
}

describe("CookieJar", () => {
	it("captures cookies from getSetCookie-style responses", () => {
		const jar = new CookieJar(new MemoryStore());
		jar.capture(
			responseWithCookies([
				`${ACCESS_COOKIE}=${ACCESS}; Path=/; HttpOnly; Secure`,
				`${REFRESH_COOKIE}=${REFRESH}; Path=/api/auth; HttpOnly; Secure`,
			]).headers,
		);
		expect(jar.get()).toEqual({ accessToken: ACCESS, refreshToken: REFRESH });
	});

	it("captures cookies from a joined set-cookie header", () => {
		const jar = new CookieJar(new MemoryStore());
		const headers = new Headers({
			"set-cookie": `${ACCESS_COOKIE}=${ACCESS}; Path=/, ${REFRESH_COOKIE}=${REFRESH}; Path=/api/auth`,
		});
		jar.capture(headers);
		expect(jar.get()).toEqual({ accessToken: ACCESS, refreshToken: REFRESH });
	});

	it("replaces an existing access token on rotation", () => {
		const jar = new CookieJar(new MemoryStore());
		jar.capture(
			responseWithCookies([
				`${ACCESS_COOKIE}=${ACCESS}; Path=/`,
				`${REFRESH_COOKIE}=${REFRESH}; Path=/api/auth`,
			]).headers,
		);
		jar.capture(responseWithCookies([`${ACCESS_COOKIE}=new; Path=/`]).headers);
		expect(jar.get()).toEqual({ accessToken: "new", refreshToken: REFRESH });
	});

	it("ignores unrelated cookies", () => {
		const jar = new CookieJar(new MemoryStore());
		jar.capture(responseWithCookies(["other=cookie; Path=/"]).headers);
		expect(jar.get()).toBeNull();
	});

	it("builds the Cookie header value from captured cookies", () => {
		const jar = new CookieJar(new MemoryStore());
		jar.capture(
			responseWithCookies([
				`${ACCESS_COOKIE}=${ACCESS}; Path=/`,
				`${REFRESH_COOKIE}=${REFRESH}; Path=/api/auth`,
			]).headers,
		);
		expect(jar.headerValue()).toBe(
			`__Host-access_token=${ACCESS}; __Secure-refresh_token=${REFRESH}`,
		);
		expect(jar.headerValue()).not.toContain("\n");
	});

	it("returns a null header with no session", () => {
		const jar = new CookieJar(new MemoryStore());
		expect(jar.headerValue()).toBeNull();
	});

	it("round-trips through storage (save, load, clear)", async () => {
		const store = new MemoryStore();
		const jar = new CookieJar(store);
		jar.capture(
			responseWithCookies([
				`${ACCESS_COOKIE}=${ACCESS}; Path=/`,
				`${REFRESH_COOKIE}=${REFRESH}; Path=/api/auth`,
			]).headers,
		);
		await jar.persist();
		expect(store.saves).toBe(1);

		const restored = new CookieJar(store);
		expect(await restored.load()).toEqual({
			accessToken: ACCESS,
			refreshToken: REFRESH,
		});
		expect(restored.get()).toEqual({
			accessToken: ACCESS,
			refreshToken: REFRESH,
		});

		await restored.clear();
		expect(store.clears).toBe(1);
		expect(await store.load()).toBeNull();
	});

	it("surfaces storage load failures as SessionStorageError, not a crash", async () => {
		const store = new MemoryStore();
		store.loadError = new Error("keystore unavailable");
		const jar = new CookieJar(store);
		await expect(jar.load()).rejects.toBeInstanceOf(SessionStorageError);
		expect(jar.get()).toBeNull();
	});

	it("surfaces storage save failures as SessionStorageError", async () => {
		const store = new MemoryStore();
		vi.spyOn(store, "save").mockRejectedValue(new Error("disk full"));
		const jar = new CookieJar(store);
		jar.capture(responseWithCookies([`${ACCESS_COOKIE}=${ACCESS}`]).headers);
		await expect(jar.persist()).rejects.toBeInstanceOf(SessionStorageError);
	});

	it("keeps cookie values out of storage-error messages", async () => {
		const store = new MemoryStore();
		store.loadError = new Error(`leak? ${ACCESS} ${REFRESH}`);
		const jar = new CookieJar(store);
		let message = "";
		try {
			await jar.load();
		} catch (error) {
			message = error instanceof Error ? error.message : "";
		}
		expect(message).not.toContain(ACCESS);
		expect(message).not.toContain(REFRESH);
		expect(message).toBe(
			"Could not read the stored session from secure storage.",
		);
	});
});
