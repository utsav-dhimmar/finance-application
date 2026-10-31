import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@finance-application/api-client";
import type { AccountResponse } from "@finance-application/schemas";
import { formatPaise } from "@/lib/money";
import {
	useAccounts,
	useArchiveAccount,
	useCreateAccount,
	useDeleteAccount,
	useRestoreAccount,
	useUpdateAccount,
} from "@/hooks/use-accounts";
import {
	accountsQueryKey,
	getAccountsErrorMessage,
} from "@/services/accounts-service";

const account: AccountResponse = {
	id: "acc-1",
	name: "HDFC Bank",
	type: "bank",
	openingBalanceMinor: 125050,
	currentBalanceMinor: 125050,
	status: "active",
	archivedAt: null,
	deletedAt: null,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function listResponse(accounts: AccountResponse[]): Response {
	return jsonResponse(200, { accounts, combinedBalanceMinor: 125050 });
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

describe("formatPaise", () => {
	it.each([
		[125050, "₹1,250.50"],
		[5, "₹0.05"],
		[0, "₹0.00"],
		[-1234, "-₹12.34"],
	])("formats %i paise as %s", (input, expected) => {
		expect(formatPaise(input)).toBe(expected);
	});
});

describe("useAccounts", () => {
	it("fetches the requested status slice", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | string) => {
			const url = typeof input === "string" ? input : input.url;
			expect(url).toBe("/api/accounts?status=archived");
			return listResponse([{ ...account, status: "archived" }]);
		});
		vi.stubGlobal("fetch", fetchMock);

		const { view } = renderWithProvider(() => useAccounts("archived"));
		await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
		expect(view.result.current.data?.accounts).toHaveLength(1);
		expect(view.result.current.data?.combinedBalanceMinor).toBe(125050);
	});

	it("exposes the query key per status", () => {
		expect(accountsQueryKey("active")).toEqual(["accounts", "active"]);
		expect(accountsQueryKey("deleted")).toEqual(["accounts", "deleted"]);
	});
});

describe("account mutations", () => {
	it("createAccount posts and invalidates all account slices", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | string) => {
			const url = typeof input === "string" ? input : input.url;
			if (url === "/api/accounts") {
				return jsonResponse(201, account);
			}
			return listResponse([account]);
		});
		vi.stubGlobal("fetch", fetchMock);

		const { view, queryClient } = renderWithProvider(useCreateAccount);
		queryClient.setQueryData(["accounts", "active"], {
			accounts: [],
			combinedBalanceMinor: 0,
		});
		act(() => {
			view.result.current.mutate({
				name: "HDFC Bank",
				type: "bank",
				openingBalanceMinor: 125050,
			});
		});
		await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
		// The stale active slice is refetched after invalidation.
		await waitFor(() =>
			expect(
				queryClient.getQueryState(["accounts", "active"])?.isInvalidated,
			).toBe(true),
		);
	});

	it("updateAccount patches and invalidates account caches", async () => {
		const fetchMock = stubAccountApi("/api/accounts/acc-1");
		const { view } = renderWithProvider(useUpdateAccount);
		act(() => {
			view.result.current.mutate({ id: "acc-1", body: { name: "Renamed" } });
		});
		await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
		expect(callsUrl(fetchMock, "/api/accounts/acc-1")).toBeDefined();
	});

	it("archiveAccount posts to the archive endpoint", async () => {
		const fetchMock = stubAccountApi("/api/accounts/acc-1/archive");
		const { view } = renderWithProvider(useArchiveAccount);
		act(() => {
			view.result.current.mutate("acc-1");
		});
		await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
		expect(callsUrl(fetchMock, "/api/accounts/acc-1/archive")).toBeDefined();
	});

	it("deleteAccount posts to the delete endpoint", async () => {
		const fetchMock = stubAccountApi("/api/accounts/acc-1/delete");
		const { view } = renderWithProvider(useDeleteAccount);
		act(() => {
			view.result.current.mutate("acc-1");
		});
		await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
		expect(callsUrl(fetchMock, "/api/accounts/acc-1/delete")).toBeDefined();
	});

	it("restoreAccount posts with the optional new name", async () => {
		const fetchMock = stubAccountApi("/api/accounts/acc-1/restore");
		const { view } = renderWithProvider(useRestoreAccount);
		act(() => {
			view.result.current.mutate({ id: "acc-1", newName: "Back again" });
		});
		await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
		const call = callsUrl(fetchMock, "/api/accounts/acc-1/restore");
		expect(call).toBeDefined();
		const [, init] = call as [string, RequestInit];
		expect(init.body).toBe(JSON.stringify({ newName: "Back again" }));
	});
});

function stubAccountApi(endpoint: string) {
	const fetchMock = vi.fn(async (input: RequestInfo | string) => {
		const url = typeof input === "string" ? input : input.url;
		if (url === endpoint) {
			return jsonResponse(200, account);
		}
		return listResponse([account]);
	});
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

function callsUrl(
	fetchMock: ReturnType<typeof vi.fn>,
	endpoint: string,
): unknown[] | undefined {
	return vi
		.mocked(fetchMock)
		.mock.calls.find(
			([input]) => (typeof input === "string" ? input : input.url) === endpoint,
		);
}

describe("getAccountsErrorMessage", () => {
	it("maps the name-taken code to friendly copy", () => {
		const error = new ApiError(
			409,
			"ACCOUNT_NAME_TAKEN",
			"An account with this name already exists",
			[],
		);
		expect(getAccountsErrorMessage(error, "fallback")).toMatch(
			/already exists/i,
		);
	});

	it("explains locked fields", () => {
		const error = new ApiError(409, "ACCOUNT_FIELD_LOCKED", "locked", []);
		expect(getAccountsErrorMessage(error, "fallback")).toMatch(
			/no longer be changed/i,
		);
	});

	it("falls back for unknown errors", () => {
		expect(getAccountsErrorMessage(new Error("boom"), "Save failed")).toBe(
			"Save failed",
		);
	});
});
