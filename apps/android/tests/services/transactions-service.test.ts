import { ApiError } from "@finance-application/api-client";
import type { TransactionResponse } from "@finance-application/schemas";
import { describe, expect, it } from "vitest";

import {
	archiveExistingTransaction,
	createNewTransaction,
	deleteExistingTransaction,
	getTransactionsErrorMessage,
	restoreTrashedTransaction,
	serializeFilters,
	TRANSACTIONS_QUERY_KEY,
	transactionsQueryKey,
	transactionsQueryOptions,
} from "@/services/transactions-service";
import { jsonResponse } from "@/session/fetch-mock";
import { makeRegisteredMachine } from "./helpers";

const transaction: TransactionResponse = {
	id: "018f6a2c-9b7d-7ce2-8f3a-1d4e5f6a7b8c",
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

describe("transactions service", () => {
	it("exposes the shared transactions key and filter-slice keys", () => {
		expect(TRANSACTIONS_QUERY_KEY).toEqual(["transactions"]);
		expect(transactionsQueryKey({ type: "expense" })).toEqual([
			"transactions",
			"type=expense",
		]);
	});

	it("serializes filters canonically, skipping empty values", () => {
		expect(serializeFilters({ page: 2, pageSize: 20 })).toBe(
			"page=2&pageSize=20",
		);
		expect(serializeFilters({ q: "" })).toBe("");
	});

	it("lists transactions through the session with filters in the query", async () => {
		const { fetchMock } = makeRegisteredMachine({
			"GET /api/transactions": (init?: RequestInit) => {
				const headers = init?.headers as Record<string, string> | undefined;
				expect(headers?.cookie).toContain("access-value-123");
				return jsonResponse(200, {
					transactions: [transaction],
					page: 1,
					pageSize: 20,
					total: 1,
				});
			},
		});
		const options = transactionsQueryOptions({ type: "expense", page: 1 });
		expect(options.staleTime).toBe(30_000);
		const result = await options.queryFn();
		expect(result.transactions).toHaveLength(1);
		const calls = fetchMock.mock.calls as unknown as Array<[string]>;
		expect(calls[0]?.[0]).toContain("type=expense");
	});

	it("create, archive, delete, and restore hit the documented endpoints", async () => {
		const { fetchMock } = makeRegisteredMachine({
			"POST /api/transactions": () => jsonResponse(201, transaction),
			"POST /api/transactions/tx-1/archive": () =>
				jsonResponse(200, transaction),
			"POST /api/transactions/tx-1/delete": () =>
				jsonResponse(200, transaction),
			"POST /api/transactions/tx-1/restore": () =>
				jsonResponse(200, transaction),
		});
		await createNewTransaction({
			id: "018f6a2c-9b7d-7ce2-8f3a-1d4e5f6a7b8c",
			type: "expense",
			amountMinor: 125050,
			date: "2026-01-15",
			accountId: "acc-1",
			categoryId: "cat-1",
		});
		await archiveExistingTransaction("tx-1");
		await deleteExistingTransaction("tx-1");
		await restoreTrashedTransaction("tx-1", {
			accountId: "acc-2",
			categoryId: "cat-2",
		});
		const calls = fetchMock.mock.calls as unknown as Array<
			[string, RequestInit]
		>;
		expect(JSON.parse(calls[0]?.[1]?.body as string)).toEqual({
			id: "018f6a2c-9b7d-7ce2-8f3a-1d4e5f6a7b8c",
			type: "expense",
			amountMinor: 125050,
			date: "2026-01-15",
			accountId: "acc-1",
			categoryId: "cat-1",
		});
		expect(calls[3]?.[1]?.body).toBe(
			JSON.stringify({ accountId: "acc-2", categoryId: "cat-2" }),
		);
	});

	it("maps transaction error codes to the web's user copy", () => {
		const fallback = "Could not save the transaction. Is the API running?";
		expect(
			getTransactionsErrorMessage(
				new ApiError(409, "ACCOUNT_INELIGIBLE", "account", []),
				fallback,
			),
		).toBe(
			"Transactions need an active account. Archived or deleted accounts cannot be used.",
		);
		expect(
			getTransactionsErrorMessage(
				new ApiError(409, "CATEGORY_INELIGIBLE", "category", []),
				fallback,
			),
		).toBe("Choose an active category of the matching type.");
		expect(
			getTransactionsErrorMessage(
				new ApiError(409, "RESTORE_CONFLICT", "conflict", []),
				fallback,
			),
		).toBe(
			"This transaction's account or category was deleted. Assign a replacement to restore it.",
		);
		expect(getTransactionsErrorMessage(new Error("nope"), fallback)).toBe(
			fallback,
		);
	});
});
