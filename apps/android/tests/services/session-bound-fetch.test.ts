import { listAccounts } from "@finance-application/api-client";
import { describe, expect, it } from "vitest";

import { errorEnvelope, jsonResponse, user } from "@/session/fetch-mock";
import { MemoryStore, makeRegisteredMachine } from "./helpers";

const FRESH_ACCESS = "fresh-access-789";

describe("session-bound service requests", () => {
	it("refreshes once and retries with the fresh session on 401", async () => {
		let accountRequests = 0;
		let refreshRequests = 0;
		const retriedCookies: Array<string | undefined> = [];
		const { machine } = makeRegisteredMachine({
			"GET /api/accounts": (init?: RequestInit) => {
				accountRequests += 1;
				if (accountRequests === 1) {
					return errorEnvelope(401, "UNAUTHENTICATED", "Access token expired");
				}
				const headers = init?.headers as Record<string, string> | undefined;
				retriedCookies.push(headers?.cookie);
				return jsonResponse(200, { accounts: [], combinedBalanceMinor: 0 });
			},
			"POST /api/auth/refresh": (init?: RequestInit) => {
				refreshRequests += 1;
				const headers = init?.headers as Record<string, string> | undefined;
				expect(headers?.cookie).toContain("refresh-value-456");
				// Multiple Set-Cookie values must go through a real Headers object.
				const responseHeaders = new Headers({
					"content-type": "application/json",
				});
				responseHeaders.append(
					"set-cookie",
					`__Host-access_token=${FRESH_ACCESS}; Path=/; Secure`,
				);
				responseHeaders.append(
					"set-cookie",
					"__Host-refresh_token=fresh-refresh-789; Path=/; Secure",
				);
				return new Response(JSON.stringify(user), {
					status: 200,
					headers: responseHeaders,
				});
			},
		});

		// The production path: every service call goes through the machine.
		const result = await machine.run((options) =>
			listAccounts("active", options),
		);

		expect(result.accounts).toEqual([]);
		expect(accountRequests).toBe(2);
		expect(refreshRequests).toBe(1);
		// The retry carries the rotated access cookie, not the expired one.
		expect(retriedCookies[0]).toContain(FRESH_ACCESS);
	});

	it("clears the stored session when the refresh token is invalid", async () => {
		const store = new MemoryStore();
		const { machine } = makeRegisteredMachine(
			{
				"GET /api/accounts": () =>
					errorEnvelope(401, "UNAUTHENTICATED", "Access token expired"),
				"POST /api/auth/refresh": () =>
					errorEnvelope(401, "INVALID_REFRESH_TOKEN", "Refresh token invalid"),
			},
			store,
		);

		await expect(
			machine.run((options) => listAccounts("active", options)),
		).rejects.toThrow();

		expect(machine.getState().status).toBe("signed-out");
		expect(store.clears).toBe(1);
	});
});
