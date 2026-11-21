import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { guardAuthenticated, guardUnauthenticated } from "@/lib/route-guards";
import type { GuardContext } from "@/lib/route-guards";
import { ME_QUERY_KEY } from "@/services/auth-service";

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

const USER = { id: "u1", email: "me@example.com" };

// redirect() throws a Response carrying its target in `options`. Assert the
// shape rather than isRedirect(): its `instanceof Response` check is
// realm-sensitive under the vmThreads pool.
interface RedirectLike {
	options?: { to?: string };
	status?: number;
}

function redirectTarget(thrown: unknown): string | undefined {
	return (thrown as RedirectLike).options?.to;
}

function stubFetch(handler: (url: string) => Response): void {
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | string) => {
			const url = typeof input === "string" ? input : input.url;
			return handler(url).clone();
		}),
	);
}

// One fresh QueryClient per case: ensureQueryData writes to the cache, and
// a shared client would leak one case's session into the next.
function makeContext(): GuardContext {
	return {
		queryClient: new QueryClient({
			defaultOptions: { queries: { retry: false } },
		}),
	};
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("guardAuthenticated", () => {
	it("redirects to /login when the visitor has no session", async () => {
		// 401 on /api/auth/me and the refresh probe → session resolves null.
		stubFetch(() =>
			jsonResponse(401, {
				error: {
					code: "UNAUTHENTICATED",
					message: "Authentication required",
					details: [],
				},
			}),
		);
		let thrown: unknown = null;
		try {
			await guardAuthenticated({ context: makeContext() });
		} catch (error) {
			thrown = error;
		}
		expect(redirectTarget(thrown)).toBe("/login");
		expect((thrown as RedirectLike).status).toBe(307);
	});

	it("resolves without redirecting for a signed-in user", async () => {
		stubFetch((url) =>
			url === "/api/auth/me" ? jsonResponse(200, USER) : jsonResponse(500, {}),
		);
		await expect(
			guardAuthenticated({ context: makeContext() }),
		).resolves.toBeUndefined();
	});

	it("resolves without redirecting when the me query fails (API unreachable)", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new TypeError("Network request failed");
			}),
		);
		await expect(
			guardAuthenticated({ context: makeContext() }),
		).resolves.toBeUndefined();
	});
});

describe("guardUnauthenticated", () => {
	it("redirects to /dashboard for a signed-in user", async () => {
		stubFetch((url) =>
			url === "/api/auth/me" ? jsonResponse(200, USER) : jsonResponse(500, {}),
		);
		let thrown: unknown = null;
		try {
			await guardUnauthenticated({ context: makeContext() });
		} catch (error) {
			thrown = error;
		}
		expect(redirectTarget(thrown)).toBe("/dashboard");
		expect((thrown as RedirectLike).status).toBe(307);
	});

	it("resolves without redirecting when the visitor has no session", async () => {
		stubFetch(() =>
			jsonResponse(401, {
				error: {
					code: "UNAUTHENTICATED",
					message: "Authentication required",
					details: [],
				},
			}),
		);
		await expect(
			guardUnauthenticated({ context: makeContext() }),
		).resolves.toBeUndefined();
	});

	it("redirects from a warm session without re-requesting it", async () => {
		const fetchMock = vi.fn(async () => jsonResponse(200, USER));
		vi.stubGlobal("fetch", fetchMock);
		const context = makeContext();
		await context.queryClient.ensureQueryData({
			queryKey: ME_QUERY_KEY,
			queryFn: () => Promise.resolve(USER),
		});
		let thrown: unknown = null;
		try {
			await guardUnauthenticated({ context });
		} catch (error) {
			thrown = error;
		}
		expect(redirectTarget(thrown)).toBe("/dashboard");
		// Only the seeding call hit fetch; the guard read the warm cache.
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
