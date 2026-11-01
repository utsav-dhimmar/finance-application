import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@finance-application/api-client";
import type { TransactionResponse } from "@finance-application/schemas";
import {
	useArchiveTransaction,
	useCreateTransaction,
	useDeleteTransaction,
	usePermanentlyDeleteTransaction,
	useRestoreTransaction,
	useTransactions,
	useUpdateTransaction,
} from "@/hooks/use-transactions";
import {
	getTransactionsErrorMessage,
	transactionsQueryKey,
} from "@/services/transactions-service";

const UUID = "018f6a2c-9b7d-7ce2-8f3a-1d4e5f6a7b8c";

const transaction: TransactionResponse = {
	id: UUID,
	type: "expense",
	amountMinor: 125050,
	date: "2026-01-15",
	accountId: "acc-1",
	accountName: "HDFC Bank",
	categoryId: "cat-1",
	categoryName: "Groceries",
	notes: "weekly shop",
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

function listResponse(transactions: TransactionResponse[]): Response {
	return jsonResponse(200, {
		transactions,
		page: 1,
		pageSize: 20,
		total: transactions.length,
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

describe("useTransactions", () => {
	it("fetches the serialized filter combination", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | string) => {
			const url = typeof input === "string" ? input : input.url;
			expect(url).toBe("/api/transactions?status=archived&page=2&pageSize=50");
			return listResponse([{ ...transaction, status: "archived" }]);
		});
		vi.stubGlobal("fetch", fetchMock);

		const { view } = renderWithProvider(() =>
			useTransactions({ status: "archived", page: 2, pageSize: 50 }),
		);
		await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
		expect(view.result.current.data?.transactions).toHaveLength(1);
		expect(view.result.current.data?.total).toBe(1);
	});

	it("exposes the query key per filter set", () => {
		expect(transactionsQueryKey({ status: "active" })).toEqual([
			"transactions",
			"status=active",
		]);
		expect(transactionsQueryKey({ status: "active", q: "shop" })).toEqual([
			"transactions",
			"status=active&q=shop",
		]);
	});
});

describe("transaction mutations", () => {
	it("createTransaction posts and invalidates transaction, account, and category caches", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | string) => {
			const url = typeof input === "string" ? input : input.url;
			if (url === "/api/transactions") {
				return jsonResponse(201, transaction);
			}
			if (url.startsWith("/api/accounts")) {
				return jsonResponse(200, {
					accounts: [],
					combinedBalanceMinor: 0,
				});
			}
			return listResponse([transaction]);
		});
		vi.stubGlobal("fetch", fetchMock);

		const { view, queryClient } = renderWithProvider(useCreateTransaction);
		queryClient.setQueryData(["transactions", "status=active"], {
			transactions: [],
			page: 1,
			pageSize: 20,
			total: 0,
		});
		queryClient.setQueryData(["accounts", "active"], {
			accounts: [],
			combinedBalanceMinor: 0,
		});
		act(() => {
			view.result.current.mutate({
				id: UUID,
				type: "expense",
				amountMinor: 1000,
				date: "2026-01-15",
				accountId: "acc-1",
				categoryId: "cat-1",
			});
		});
		await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
		await waitFor(() =>
			expect(
				queryClient.getQueryState(["transactions", "status=active"])
					?.isInvalidated,
			).toBe(true),
		);
		await waitFor(() =>
			expect(
				queryClient.getQueryState(["accounts", "active"])?.isInvalidated,
			).toBe(true),
		);
	});

	it("updateTransaction patches by id", async () => {
		const fetchMock = stubTransactionApi("/api/transactions/txn-1");
		const { view } = renderWithProvider(useUpdateTransaction);
		act(() => {
			view.result.current.mutate({
				id: "txn-1",
				body: { amountMinor: 500 },
			});
		});
		await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
		expect(callsUrl(fetchMock, "/api/transactions/txn-1")).toBeDefined();
	});

	it.each([
		["archive", useArchiveTransaction, "/api/transactions/txn-1/archive"],
		["delete", useDeleteTransaction, "/api/transactions/txn-1/delete"],
		[
			"permanent delete",
			usePermanentlyDeleteTransaction,
			"/api/transactions/txn-1",
		],
	])("%s hits its endpoint", async (_label, useHook, endpoint) => {
		const fetchMock = stubTransactionApi(endpoint);
		const { view } = renderWithProvider(useHook);
		act(() => {
			view.result.current.mutate("txn-1");
		});
		await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
		expect(callsUrl(fetchMock, endpoint)).toBeDefined();
	});

	it("restoreTransaction posts with reassignment", async () => {
		const fetchMock = stubTransactionApi("/api/transactions/txn-1/restore");
		const { view } = renderWithProvider(useRestoreTransaction);
		act(() => {
			view.result.current.mutate({ id: "txn-1", accountId: "acc-2" });
		});
		await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
		const call = callsUrl(fetchMock, "/api/transactions/txn-1/restore");
		const [, init] = call as [string, RequestInit];
		expect(init.body).toBe(JSON.stringify({ accountId: "acc-2" }));
	});
});

function stubTransactionApi(endpoint: string) {
	const fetchMock = vi.fn(async (input: RequestInfo | string) => {
		const url = typeof input === "string" ? input : input.url;
		if (url === endpoint) {
			return jsonResponse(200, transaction);
		}
		if (url.startsWith("/api/accounts")) {
			return jsonResponse(200, { accounts: [], combinedBalanceMinor: 0 });
		}
		return listResponse([transaction]);
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

describe("getTransactionsErrorMessage", () => {
	it("explains account and category eligibility", () => {
		const error = new ApiError(409, "ACCOUNT_INELIGIBLE", "x", []);
		expect(getTransactionsErrorMessage(error, "fallback")).toMatch(
			/active account/i,
		);
		const categoryError = new ApiError(409, "CATEGORY_INELIGIBLE", "x", []);
		expect(getTransactionsErrorMessage(categoryError, "fallback")).toMatch(
			/matching type/i,
		);
	});

	it("explains restore conflicts", () => {
		const error = new ApiError(409, "RESTORE_CONFLICT", "x", []);
		expect(getTransactionsErrorMessage(error, "fallback")).toMatch(
			/replacement/i,
		);
	});

	it("falls back for unknown errors", () => {
		expect(getTransactionsErrorMessage(new Error("boom"), "Save failed")).toBe(
			"Save failed",
		);
	});
});
