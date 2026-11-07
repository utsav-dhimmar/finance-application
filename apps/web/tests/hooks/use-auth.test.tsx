import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLogin, useLogout, useMe } from "@/hooks/use-auth";

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function renderWithProvider<TResult>(hook: () => TResult) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	const view = renderHook(hook, {
		wrapper: ({ children }: { children: React.ReactNode }) => (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		),
	});
	return { view, queryClient };
}

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("useMe", () => {
	it("returns the user when /api/auth/me succeeds", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				jsonResponse(200, { id: "u1", email: "me@example.com" }),
			),
		);
		const { view } = renderWithProvider(useMe);
		await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
		expect(view.result.current.data).toEqual({
			id: "u1",
			email: "me@example.com",
		});
	});

	it("refreshes once and retries when the access token has expired", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse(401, {
					error: {
						code: "UNAUTHENTICATED",
						message: "Authentication required",
						details: [],
					},
				}),
			)
			.mockResolvedValueOnce(new Response(null, { status: 204 }))
			.mockResolvedValueOnce(
				jsonResponse(200, { id: "u2", email: "refreshed@example.com" }),
			);
		vi.stubGlobal("fetch", fetchMock);

		const { view } = renderWithProvider(useMe);
		await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
		expect(view.result.current.data).toEqual({
			id: "u2",
			email: "refreshed@example.com",
		});
		expect(fetchMock).toHaveBeenCalledTimes(3);
		const refreshCall = fetchMock.mock.calls[1]?.[0];
		expect(
			typeof refreshCall === "string" ? refreshCall : refreshCall.url,
		).toBe("/api/auth/refresh");
	});

	it("returns null when both the token and refresh are unauthenticated", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				jsonResponse(401, {
					error: {
						code: "UNAUTHENTICATED",
						message: "Authentication required",
						details: [],
					},
				}),
			),
		);
		const { view } = renderWithProvider(useMe);
		await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
		expect(view.result.current.data).toBeNull();
	});
});

describe("useLogin", () => {
	it("posts credentials and seeds the me cache", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | string) => {
			const url = typeof input === "string" ? input : input.url;
			expect(url).toBe("/api/auth/login");
			return jsonResponse(200, { id: "u3", email: "seeded@example.com" });
		});
		vi.stubGlobal("fetch", fetchMock);

		const { view, queryClient } = renderWithProvider(useLogin);
		act(() => {
			view.result.current.mutate({
				email: "seeded@example.com",
				password: "s3cret-pw",
			});
		});
		await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
		expect(queryClient.getQueryData(["me"])).toEqual({
			id: "u3",
			email: "seeded@example.com",
		});
	});

	it("clears the previous principal's cached data on login", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				jsonResponse(200, { id: "u3", email: "seeded@example.com" }),
			),
		);
		const { view, queryClient } = renderWithProvider(useLogin);
		// Cached rows belonging to a previously signed-in principal.
		queryClient.setQueryData(["accounts", "active"], {
			accounts: [{ id: "acc-1", name: "A's account" }],
		});
		queryClient.setQueryData(["reports", "month"], { total: 125000 });

		act(() => {
			view.result.current.mutate({
				email: "seeded@example.com",
				password: "s3cret-pw",
			});
		});
		await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
		// The new principal must not inherit any of it.
		expect(queryClient.getQueryData(["accounts", "active"])).toBeUndefined();
		expect(queryClient.getQueryData(["reports", "month"])).toBeUndefined();
		// Only the new principal's identity is seeded.
		expect(queryClient.getQueryData(["me"])).toEqual({
			id: "u3",
			email: "seeded@example.com",
		});
	});

	it("surfaces the server error envelope for invalid credentials", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				jsonResponse(401, {
					error: {
						code: "AUTH_INVALID_CREDENTIALS",
						message: "Invalid email or password",
						details: [],
					},
				}),
			),
		);
		const { view } = renderWithProvider(useLogin);
		act(() => {
			view.result.current.mutate({
				email: "x@example.com",
				password: "wrong-pw-1",
			});
		});
		await waitFor(() => expect(view.result.current.isError).toBe(true));
		expect(view.result.current.error).toMatchObject({
			code: "AUTH_INVALID_CREDENTIALS",
		});
	});
});

describe("useLogout", () => {
	it("posts to the logout endpoint and clears all cached data", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | string) => {
			const url = typeof input === "string" ? input : input.url;
			if (url === "/api/auth/logout") {
				return new Response(null, { status: 204 });
			}
			return jsonResponse(404, {
				error: {
					code: "NOT_FOUND",
					message: "Resource not found",
					details: [],
				},
			});
		});
		vi.stubGlobal("fetch", fetchMock);

		const { view, queryClient } = renderWithProvider(useLogout);
		queryClient.setQueryData(["me"], { id: "u4", email: "out@example.com" });
		queryClient.setQueryData(["accounts", "active"], {
			accounts: [{ id: "acc-9", name: "Leaving account" }],
		});
		act(() => {
			view.result.current.mutate();
		});
		await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
		expect(queryClient.getQueryData(["me"])).toBeNull();
		// Cached financial rows do not outlive the session they belonged to.
		expect(queryClient.getQueryData(["accounts", "active"])).toBeUndefined();
	});
});
