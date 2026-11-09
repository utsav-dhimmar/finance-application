import { afterEach, describe, expect, it, vi } from "vitest";

import { apiFetch, type ApiClientOptions } from "@finance-application/api-client";

import { AuthSession } from "./auth-session";
import {
	ACCESS_COOKIE,
	CookieJar,
	REFRESH_COOKIE,
	type CookieStore,
	type SessionCookies,
} from "./cookie-jar";
import {
	API_BASE,
	errorEnvelope,
	jsonResponse,
	stubFetchRouter,
	user,
	type FetchHandler,
} from "./fetch-mock";
import { SessionMachine } from "./session-machine";

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

function makeMachine(
	handlers: Record<string, FetchHandler>,
	store: MemoryStore = new MemoryStore(),
): SessionMachine {
	vi.stubGlobal("fetch", stubFetchRouter(handlers));
	const auth = new AuthSession(new CookieJar(store), API_BASE);
	return new SessionMachine(auth);
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("SessionMachine.restore", () => {
	it("lands signed-out with no stored session", async () => {
		const machine = makeMachine({});
		await machine.restore();
		expect(machine.getState()).toEqual({ status: "signed-out" });
	});

	it("lands signed-in when the stored access token is valid", async () => {
		const store = new MemoryStore();
		store.data = { accessToken: ACCESS, refreshToken: REFRESH };
		const machine = makeMachine(
			{ "GET /api/auth/me": () => jsonResponse(200, user) },
			store,
		);
		await machine.restore();
		expect(machine.getState()).toEqual({ status: "signed-in", user });
		expect(store.clears).toBe(0);
	});

	it("refreshes and lands signed-in when the access token expired", async () => {
		const store = new MemoryStore();
		store.data = { accessToken: ACCESS, refreshToken: REFRESH };
		const machine = makeMachine(
			{
				"GET /api/auth/me": () =>
					errorEnvelope(401, "UNAUTHENTICATED", "No session"),
				"POST /api/auth/refresh": () =>
					jsonResponse(200, user, {
						"set-cookie": `${ACCESS_COOKIE}=fresh-access; Path=/, ${REFRESH_COOKIE}=fresh-refresh; Path=/api/auth`,
					}),
			},
			store,
		);
		await machine.restore();
		expect(machine.getState()).toEqual({ status: "signed-in", user });
		expect(store.data).toEqual({
			accessToken: "fresh-access",
			refreshToken: "fresh-refresh",
		});
	});

	it("surfaces secure-storage failure as signed-out with a message", async () => {
		const store = new MemoryStore();
		store.loadError = new Error("keystore unavailable");
		const machine = makeMachine({}, store);
		await machine.restore();
		const state = machine.getState();
		expect(state.status).toBe("signed-out");
		if (state.status === "signed-out") {
			expect(state.error).toContain("Secure storage");
		}
	});

	it("keeps the stored session when the API is unreachable during restore", async () => {
		const store = new MemoryStore();
		store.data = { accessToken: ACCESS, refreshToken: REFRESH };
		const machine = makeMachine(
			{
				"GET /api/auth/me": () => {
					throw new TypeError("Network request failed");
				},
			},
			store,
		);
		await machine.restore();
		const state = machine.getState();
		expect(state.status).toBe("signed-out");
		if (state.status === "signed-out") {
			expect(state.error).toContain("Could not reach the server");
		}
		expect(store.clears).toBe(0);
	});

	it("clears the session when refresh is rejected as invalid", async () => {
		const store = new MemoryStore();
		store.data = { accessToken: ACCESS, refreshToken: REFRESH };
		const machine = makeMachine(
			{
				"GET /api/auth/me": () =>
					errorEnvelope(401, "UNAUTHENTICATED", "No session"),
				"POST /api/auth/refresh": () =>
					errorEnvelope(401, "INVALID_REFRESH_TOKEN", "Invalid refresh token"),
			},
			store,
		);
		await machine.restore();
		expect(machine.getState()).toEqual({ status: "signed-out" });
		expect(store.clears).toBe(1);
	});
});

describe("SessionMachine.signIn / signOut", () => {
	it("lands signed-in after a successful credential sign-in", async () => {
		const store = new MemoryStore();
		const machine = makeMachine(
			{
				"POST /api/auth/login": () =>
					jsonResponse(200, user, {
						"set-cookie": `${ACCESS_COOKIE}=${ACCESS}; Path=/, ${REFRESH_COOKIE}=${REFRESH}; Path=/api/auth`,
					}),
			},
			store,
		);
		await machine.signIn("user@example.com", "long-enough");
		expect(machine.getState()).toEqual({ status: "signed-in", user });
		expect(store.saves).toBe(1);
	});

	it("lands signed-out with the failure message after rejected credentials", async () => {
		const machine = makeMachine({
			"POST /api/auth/login": () =>
				errorEnvelope(
					401,
					"AUTH_INVALID_CREDENTIALS",
					"Invalid email or password.",
				),
		});
		await machine.signIn("user@example.com", "wrong-password");
		const state = machine.getState();
		expect(state.status).toBe("signed-out");
		if (state.status === "signed-out") {
			expect(state.error).toBe("Invalid email or password.");
		}
	});

	it("signs out and clears storage even when the endpoint fails", async () => {
		const store = new MemoryStore();
		store.data = { accessToken: ACCESS, refreshToken: REFRESH };
		const machine = makeMachine(
			{
				"POST /api/auth/logout": () => {
					throw new TypeError("Network request failed");
				},
			},
			store,
		);
		await machine.signOut();
		expect(machine.getState()).toEqual({ status: "signed-out" });
		expect(store.clears).toBe(1);
	});
});

describe("SessionMachine.run (single-flight refresh)", () => {
	it("performs exactly one refresh for concurrent 401s and retries both", async () => {
		const store = new MemoryStore();
		store.data = { accessToken: ACCESS, refreshToken: REFRESH };
		let dataCalls = 0;
		let refreshCalls = 0;
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const machine = makeMachine(
			{
				"GET /api/data": () => {
					dataCalls += 1;
					return dataCalls <= 2
						? errorEnvelope(401, "UNAUTHENTICATED", "expired")
						: jsonResponse(200, { ok: true });
				},
				"POST /api/auth/refresh": async () => {
					refreshCalls += 1;
					await gate;
					return jsonResponse(200, user, {
						"set-cookie": `${ACCESS_COOKIE}=fresh-access; Path=/`,
					});
				},
			},
			store,
		);
		const operation = (options: ApiClientOptions) =>
			apiFetch<{ ok: boolean }>("/api/data", {}, options);

		const first = machine.run(operation);
		const second = machine.run(operation);
		await vi.waitFor(() => expect(refreshCalls).toBe(1));
		release();
		const [resultA, resultB] = await Promise.all([first, second]);
		expect(resultA).toEqual({ ok: true });
		expect(resultB).toEqual({ ok: true });
		expect(refreshCalls).toBe(1);
		expect(dataCalls).toBe(4);
		expect(machine.getState()).toEqual({ status: "signed-in", user });
	});

	it("clears the session and rethrows when refresh is invalid", async () => {
		const store = new MemoryStore();
		store.data = { accessToken: ACCESS, refreshToken: REFRESH };
		const machine = makeMachine(
			{
				"GET /api/data": () =>
					errorEnvelope(401, "UNAUTHENTICATED", "expired"),
				"POST /api/auth/refresh": () =>
					errorEnvelope(401, "INVALID_REFRESH_TOKEN", "Invalid refresh token"),
			},
			store,
		);
		const operation = (options: ApiClientOptions) =>
			apiFetch<{ ok: boolean }>("/api/data", {}, options);
		await expect(machine.run(operation)).rejects.toThrow("Invalid refresh token");
		expect(machine.getState()).toEqual({ status: "signed-out" });
		expect(store.clears).toBe(1);
	});
});
