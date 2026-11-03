import { ApiError } from "@finance-application/api-client";
import type { TransferResponse } from "@finance-application/schemas";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	useArchiveTransfer,
	useCreateTransfer,
	useDeleteTransfer,
	usePermanentlyDeleteTransfer,
	useRestoreTransfer,
	useTransfers,
	useUpdateTransfer,
} from "@/hooks/use-transfers";
import {
	getTransfersErrorMessage,
	activityQueryKey,
	transfersQueryKey,
} from "@/services/transfers-service";

const UUID = "018f6a2c-9b7d-7ce2-8f3a-1d4e5f6a7b8c";

const transfer: TransferResponse = {
	id: UUID,
	amountMinor: 125050,
	date: "2026-01-15",
	sourceAccountId: "acc-1",
	sourceAccountName: "HDFC Bank",
	destinationAccountId: "acc-2",
	destinationAccountName: "Wallet",
	notes: "cash withdrawal",
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

function listResponse(transfers: TransferResponse[]): Response {
	return jsonResponse(200, {
		transfers,
		page: 1,
		pageSize: 20,
		total: transfers.length,
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

describe("useTransfers", () => {
	it("fetches the serialized filter combination", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | string) => {
			const url = typeof input === "string" ? input : input.url;
			expect(url).toBe("/api/transfers?status=archived&page=2&pageSize=50");
			return listResponse([{ ...transfer, status: "archived" }]);
		});
		vi.stubGlobal("fetch", fetchMock);

		const { view } = renderWithProvider(() =>
			useTransfers({ status: "archived", page: 2, pageSize: 50 }),
		);
		await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
		expect(view.result.current.data?.transfers).toHaveLength(1);
		expect(view.result.current.data?.total).toBe(1);
	});

	it("exposes the query key per filter set", () => {
		expect(transfersQueryKey({ status: "active" })).toEqual([
			"transfers",
			"status=active",
		]);
		expect(transfersQueryKey({ status: "active", q: "wallet" })).toEqual([
			"transfers",
			"status=active&q=wallet",
		]);
		expect(activityQueryKey({ accountId: "acc-1", status: "active" })).toEqual([
			"activity",
			"accountId=acc-1&status=active",
		]);
	});
});

describe("transfer mutations", () => {
	it("createTransfer posts and invalidates transfer, account, activity, and report caches", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | string) => {
			const url = typeof input === "string" ? input : input.url;
			if (url === "/api/transfers") {
				return jsonResponse(201, transfer);
			}
			if (url.startsWith("/api/accounts")) {
				return jsonResponse(200, {
					accounts: [],
					combinedBalanceMinor: 0,
				});
			}
			return listResponse([transfer]);
		});
		vi.stubGlobal("fetch", fetchMock);

		const { view, queryClient } = renderWithProvider(useCreateTransfer);
		queryClient.setQueryData(["transfers", "status=active"], {
			transfers: [],
			page: 1,
			pageSize: 20,
			total: 0,
		});
		queryClient.setQueryData(["accounts", "active"], {
			accounts: [],
			combinedBalanceMinor: 0,
		});
		queryClient.setQueryData(["activity", "accountId=acc-1&status=active"], {
			activity: [],
			page: 1,
			pageSize: 20,
			total: 0,
		});
		// The dashboard's period summary must refresh after a recording.
		queryClient.setQueryData(["reports", "month=2026-01"], {
			incomeMinor: 0,
			expenseMinor: 0,
		});
		act(() => {
			view.result.current.mutate({
				id: UUID,
				amountMinor: 1000,
				date: "2026-01-15",
				sourceAccountId: "acc-1",
				destinationAccountId: "acc-2",
			});
		});
		await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
		await waitFor(() =>
			expect(
				queryClient.getQueryState(["transfers", "status=active"])
					?.isInvalidated,
			).toBe(true),
		);
		await waitFor(() =>
			expect(
				queryClient.getQueryState(["accounts", "active"])?.isInvalidated,
			).toBe(true),
		);
		await waitFor(() =>
			expect(
				queryClient.getQueryState(["activity", "accountId=acc-1&status=active"])
					?.isInvalidated,
			).toBe(true),
		);
		await waitFor(() =>
			expect(
				queryClient.getQueryState(["reports", "month=2026-01"])?.isInvalidated,
			).toBe(true),
		);
	});

	it("updateTransfer patches by id", async () => {
		const fetchMock = stubTransferApi("/api/transfers/txn-1");
		const { view } = renderWithProvider(useUpdateTransfer);
		act(() => {
			view.result.current.mutate({
				id: "txn-1",
				body: { amountMinor: 500 },
			});
		});
		await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
		expect(callsUrl(fetchMock, "/api/transfers/txn-1")).toBeDefined();
	});

	it.each([
		["archive", useArchiveTransfer, "/api/transfers/txn-1/archive"],
		["delete", useDeleteTransfer, "/api/transfers/txn-1/delete"],
		["permanent delete", usePermanentlyDeleteTransfer, "/api/transfers/txn-1"],
	])("%s hits its endpoint", async (_label, useHook, endpoint) => {
		const fetchMock = stubTransferApi(endpoint);
		const { view } = renderWithProvider(useHook);
		act(() => {
			view.result.current.mutate("txn-1");
		});
		await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
		expect(callsUrl(fetchMock, endpoint)).toBeDefined();
	});

	it("restoreTransfer posts with reassignment", async () => {
		const fetchMock = stubTransferApi("/api/transfers/txn-1/restore");
		const { view } = renderWithProvider(useRestoreTransfer);
		act(() => {
			view.result.current.mutate({
				id: "txn-1",
				destinationAccountId: "acc-3",
			});
		});
		await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
		const call = callsUrl(fetchMock, "/api/transfers/txn-1/restore");
		const [, init] = call as [string, RequestInit];
		expect(init.body).toBe(JSON.stringify({ destinationAccountId: "acc-3" }));
	});
});

function stubTransferApi(endpoint: string) {
	const fetchMock = vi.fn(async (input: RequestInfo | string) => {
		const url = typeof input === "string" ? input : input.url;
		if (url === endpoint) {
			return jsonResponse(200, transfer);
		}
		if (url.startsWith("/api/accounts")) {
			return jsonResponse(200, { accounts: [], combinedBalanceMinor: 0 });
		}
		return listResponse([transfer]);
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

describe("getTransfersErrorMessage", () => {
	it("explains same-account and eligibility conflicts", () => {
		const sameAccount = new ApiError(409, "SAME_ACCOUNT_TRANSFER", "x", []);
		expect(getTransfersErrorMessage(sameAccount, "fallback")).toMatch(
			/different/i,
		);
		const ineligible = new ApiError(409, "ACCOUNT_INELIGIBLE", "x", []);
		expect(getTransfersErrorMessage(ineligible, "fallback")).toMatch(
			/active accounts/i,
		);
	});

	it("explains restore conflicts", () => {
		const error = new ApiError(409, "RESTORE_CONFLICT", "x", []);
		expect(getTransfersErrorMessage(error, "fallback")).toMatch(/replacement/i);
	});

	it("falls back for unknown errors", () => {
		expect(getTransfersErrorMessage(new Error("boom"), "Save failed")).toBe(
			"Save failed",
		);
	});
});
