import type {
	ExportTransactionsResponse,
	TransactionResponse,
} from "@finance-application/schemas";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/client";
import {
	archiveTransaction,
	createTransaction,
	deleteTransaction,
	fetchTransactionsExportChunk,
	getTransaction,
	listTransactions,
	permanentlyDeleteTransaction,
	restoreTransaction,
	updateTransaction,
} from "../src/transactions";

const UUID_V7 = "018f6a2c-9b7d-7ce2-8f3a-1d4e5f6a7b8c";

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

beforeEach(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn(
			async () =>
				new Response(JSON.stringify(transaction), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
		),
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("transaction client functions", () => {
	it("createTransaction posts the body to /api/transactions", async () => {
		const body = {
			id: "018f6a2c-9b7d-7ce2-8f3a-1d4e5f6a7b8c",
			type: "expense" as const,
			amountMinor: 125050,
			date: "2026-01-15",
			accountId: "acc-1",
			categoryId: "cat-1",
		};
		await expect(createTransaction(body)).resolves.toEqual(transaction);
		expect(vi.mocked(fetch)).toHaveBeenCalledWith(
			"/api/transactions",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify(body),
			}),
		);
	});

	it("listTransactions serializes only provided filters", async () => {
		await listTransactions();
		const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
		expect(url).toBe("/api/transactions");

		await listTransactions({
			status: "archived",
			from: "2026-01-01",
			to: "2026-01-31",
			type: "income",
			accountId: "acc-1",
			categoryId: "cat-1",
			q: "shop",
			page: 2,
			pageSize: 50,
		});
		const [filteredUrl] = vi.mocked(fetch).mock.calls[1] as [
			string,
			RequestInit,
		];
		const params = new URLSearchParams(
			(filteredUrl as string).split("?")[1] ?? "",
		);
		expect(params.get("status")).toBe("archived");
		expect(params.get("from")).toBe("2026-01-01");
		expect(params.get("to")).toBe("2026-01-31");
		expect(params.get("type")).toBe("income");
		expect(params.get("accountId")).toBe("acc-1");
		expect(params.get("categoryId")).toBe("cat-1");
		expect(params.get("q")).toBe("shop");
		expect(params.get("page")).toBe("2");
		expect(params.get("pageSize")).toBe("50");
	});

	it("getTransaction fetches by id", async () => {
		await getTransaction("txn-1");
		const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
		expect(url).toBe("/api/transactions/txn-1");
	});

	it("updateTransaction patches by id, including null notes", async () => {
		const body = { amountMinor: 500, notes: null };
		await updateTransaction("txn-1", body);
		expect(vi.mocked(fetch)).toHaveBeenCalledWith(
			"/api/transactions/txn-1",
			expect.objectContaining({
				method: "PATCH",
				body: JSON.stringify(body),
			}),
		);
	});

	it.each([
		["archive", archiveTransaction, "/api/transactions/txn-1/archive"],
		["delete", deleteTransaction, "/api/transactions/txn-1/delete"],
		["restore", restoreTransaction, "/api/transactions/txn-1/restore"],
	])("%s posts to its lifecycle endpoint", async (_label, action, url) => {
		await action("txn-1");
		expect(vi.mocked(fetch)).toHaveBeenCalledWith(
			url,
			expect.objectContaining({ method: "POST" }),
		);
	});

	it("restoreTransaction sends reassignment references", async () => {
		await restoreTransaction("txn-1", { accountId: "acc-2" });
		expect(vi.mocked(fetch)).toHaveBeenCalledWith(
			"/api/transactions/txn-1/restore",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ accountId: "acc-2" }),
			}),
		);
	});

	it("permanentlyDeleteTransaction sends DELETE", async () => {
		await permanentlyDeleteTransaction("txn-1");
		expect(vi.mocked(fetch)).toHaveBeenCalledWith(
			"/api/transactions/txn-1",
			expect.objectContaining({ method: "DELETE" }),
		);
	});

	it("decodes the shared error envelope into an ApiError", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							error: {
								code: "RESTORE_CONFLICT",
								message:
									"The transaction's account or category has been deleted",
								details: [],
							},
						}),
						{ status: 409, headers: { "content-type": "application/json" } },
					),
			),
		);
		const error = await restoreTransaction("txn-1").catch((e: unknown) => e);
		expect(error).toBeInstanceOf(ApiError);
		expect((error as ApiError).status).toBe(409);
		expect((error as ApiError).code).toBe("RESTORE_CONFLICT");
	});
});

describe("fetchTransactionsExportChunk", () => {
	it("requests /api/transactions/export with no params when empty", async () => {
		await fetchTransactionsExportChunk();
		const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
		expect(url).toBe("/api/transactions/export");
	});

	it("serializes cursor, limit, and filters into the query string", async () => {
		await fetchTransactionsExportChunk({
			cursor: UUID_V7,
			limit: 2000,
			status: "archived",
			type: "income",
			accountId: "acc-1",
			categoryId: "cat-1",
			from: "2026-01-01",
			to: "2026-01-31",
			q: "shop",
		});
		const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
		const params = new URLSearchParams((url as string).split("?")[1] ?? "");
		expect(params.get("cursor")).toBe(UUID_V7);
		expect(params.get("limit")).toBe("2000");
		expect(params.get("status")).toBe("archived");
		expect(params.get("type")).toBe("income");
		expect(params.get("accountId")).toBe("acc-1");
		expect(params.get("categoryId")).toBe("cat-1");
		expect(params.get("from")).toBe("2026-01-01");
		expect(params.get("to")).toBe("2026-01-31");
		expect(params.get("q")).toBe("shop");
	});

	it("forwards the abort signal to fetch", async () => {
		const controller = new AbortController();
		await fetchTransactionsExportChunk({}, { signal: controller.signal });
		const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
		expect(init.signal).toBe(controller.signal);
	});

	it("resolves the parsed chunk envelope", async () => {
		const chunk: ExportTransactionsResponse = {
			transactions: [
				{
					id: UUID_V7,
					date: "2026-01-15",
					createdAt: "2026-01-16T00:00:00.000Z",
					type: "expense",
					amountMinor: 125050,
					notes: null,
					status: "active",
					accountName: "HDFC Bank",
					categoryName: "Groceries",
				},
			],
			nextCursor: null,
		};
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(JSON.stringify(chunk), {
						status: 200,
						headers: { "content-type": "application/json" },
					}),
			),
		);
		await expect(fetchTransactionsExportChunk()).resolves.toEqual(chunk);
	});

	it("propagates a non-2xx envelope as an ApiError", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							error: {
								code: "NOT_FOUND",
								message: "Export cursor not found",
								details: [],
							},
						}),
						{ status: 404, headers: { "content-type": "application/json" } },
					),
			),
		);
		const error = await fetchTransactionsExportChunk().catch((e: unknown) => e);
		expect(error).toBeInstanceOf(ApiError);
		expect((error as ApiError).status).toBe(404);
		expect((error as ApiError).code).toBe("NOT_FOUND");
		expect((error as ApiError).message).toBe("Export cursor not found");
	});
});
