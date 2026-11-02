import type { TransferResponse } from "@finance-application/schemas";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/client";
import {
	archiveTransfer,
	createTransfer,
	deleteTransfer,
	getTransfer,
	listActivity,
	listTransfers,
	permanentlyDeleteTransfer,
	restoreTransfer,
	updateTransfer,
} from "../src/transfers";

const transfer: TransferResponse = {
	id: "018f6a2c-9b7d-7ce2-8f3a-1d4e5f6a7b8c",
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

beforeEach(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn(
			async () =>
				new Response(JSON.stringify(transfer), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
		),
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("transfer client functions", () => {
	it("createTransfer posts the body to /api/transfers", async () => {
		const body = {
			id: "018f6a2c-9b7d-7ce2-8f3a-1d4e5f6a7b8c",
			amountMinor: 125050,
			date: "2026-01-15",
			sourceAccountId: "acc-1",
			destinationAccountId: "acc-2",
		};
		await expect(createTransfer(body)).resolves.toEqual(transfer);
		expect(vi.mocked(fetch)).toHaveBeenCalledWith(
			"/api/transfers",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify(body),
			}),
		);
	});

	it("listTransfers serializes only provided filters", async () => {
		await listTransfers();
		const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
		expect(url).toBe("/api/transfers");

		await listTransfers({
			status: "archived",
			from: "2026-01-01",
			to: "2026-01-31",
			accountId: "acc-1",
			q: "wallet",
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
		expect(params.get("accountId")).toBe("acc-1");
		expect(params.get("q")).toBe("wallet");
		expect(params.get("page")).toBe("2");
		expect(params.get("pageSize")).toBe("50");
	});

	it("getTransfer fetches by id", async () => {
		await getTransfer("txn-1");
		const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
		expect(url).toBe("/api/transfers/txn-1");
	});

	it("updateTransfer patches by id, including null notes", async () => {
		const body = { amountMinor: 500, notes: null };
		await updateTransfer("txn-1", body);
		expect(vi.mocked(fetch)).toHaveBeenCalledWith(
			"/api/transfers/txn-1",
			expect.objectContaining({
				method: "PATCH",
				body: JSON.stringify(body),
			}),
		);
	});

	it.each([
		["archive", archiveTransfer, "/api/transfers/txn-1/archive"],
		["delete", deleteTransfer, "/api/transfers/txn-1/delete"],
		["restore", restoreTransfer, "/api/transfers/txn-1/restore"],
	])("%s posts to its lifecycle endpoint", async (_label, action, url) => {
		await action("txn-1");
		expect(vi.mocked(fetch)).toHaveBeenCalledWith(
			url,
			expect.objectContaining({ method: "POST" }),
		);
	});

	it("restoreTransfer sends reassignment references", async () => {
		await restoreTransfer("txn-1", { destinationAccountId: "acc-3" });
		expect(vi.mocked(fetch)).toHaveBeenCalledWith(
			"/api/transfers/txn-1/restore",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ destinationAccountId: "acc-3" }),
			}),
		);
	});

	it("permanentlyDeleteTransfer sends DELETE", async () => {
		await permanentlyDeleteTransfer("txn-1");
		expect(vi.mocked(fetch)).toHaveBeenCalledWith(
			"/api/transfers/txn-1",
			expect.objectContaining({ method: "DELETE" }),
		);
	});

	it("listActivity targets the account's activity endpoint", async () => {
		await listActivity({ accountId: "acc-1", status: "active", page: 2 });
		const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
		expect(url).toBe("/api/activity?accountId=acc-1&status=active&page=2");
	});

	it("decodes the shared error envelope into an ApiError", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							error: {
								code: "SAME_ACCOUNT_TRANSFER",
								message: "Transfers require two different accounts",
								details: [],
							},
						}),
						{ status: 409, headers: { "content-type": "application/json" } },
					),
			),
		);
		const error = await createTransfer({
			id: "018f6a2c-9b7d-7ce2-8f3a-1d4e5f6a7b8c",
			amountMinor: 100,
			date: "2026-01-15",
			sourceAccountId: "acc-1",
			destinationAccountId: "acc-1",
		}).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(ApiError);
		expect((error as ApiError).status).toBe(409);
		expect((error as ApiError).code).toBe("SAME_ACCOUNT_TRANSFER");
	});
});
