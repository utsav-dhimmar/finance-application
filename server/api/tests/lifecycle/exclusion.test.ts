/// <reference types="@cloudflare/vitest-plugin/types" />
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { ACCESS_COOKIE } from "@/lib/session";
import { uuidV7 } from "@/lib/uuid";
import { cookieHeader, fetchApp, seedUserAndLogin } from "../helpers";

// Cross-cutting exclusion guarantee (archive-trash capability): after
// archiving and soft-deleting one record of each type, ordinary active lists
// contain none of the hidden records, the lifecycle slices contain exactly
// them, and the report summary follows the reporting capability's inclusion
// rules — archived transactions keep counting, soft-deleted ones do not, and
// hidden accounts never contribute to balances.
const ACCOUNTS_URL = "https://test.local/api/accounts";
const CATEGORIES_URL = "https://test.local/api/categories";
const TRANSACTIONS_URL = "https://test.local/api/transactions";
const TRANSFERS_URL = "https://test.local/api/transfers";
const SUMMARY_URL = "https://test.local/api/reports/summary";

function jsonResponseInit(
	method: string,
	body?: unknown,
	cookie?: string,
): RequestInit {
	return {
		method,
		headers: {
			...(body !== undefined ? { "content-type": "application/json" } : {}),
			...(cookie ? { cookie } : {}),
		},
		...(body !== undefined ? { body: JSON.stringify(body) } : {}),
	};
}

async function freshCookie(): Promise<string> {
	const session = await seedUserAndLogin();
	return cookieHeader({ [ACCESS_COOKIE]: session.access });
}

async function createAccount(
	cookie: string,
	name: string,
	openingBalanceMinor: number,
): Promise<string> {
	const res = await fetchApp(
		ACCOUNTS_URL,
		jsonResponseInit(
			"POST",
			{ name, type: "bank", openingBalanceMinor },
			cookie,
		),
	);
	expect(res.status).toBe(201);
	return ((await res.json()) as { id: string }).id;
}

async function createCategory(
	cookie: string,
	name: string,
	type: string,
): Promise<string> {
	const res = await fetchApp(
		CATEGORIES_URL,
		jsonResponseInit("POST", { name, type }, cookie),
	);
	expect(res.status).toBe(201);
	return ((await res.json()) as { id: string }).id;
}

async function createTransaction(
	cookie: string,
	body: Record<string, unknown>,
): Promise<string> {
	const res = await fetchApp(
		TRANSACTIONS_URL,
		jsonResponseInit("POST", { id: uuidV7(), ...body }, cookie),
	);
	expect(res.status).toBe(201);
	return ((await res.json()) as { id: string }).id;
}

async function createTransfer(
	cookie: string,
	sourceAccountId: string,
	destinationAccountId: string,
	amountMinor: number,
): Promise<string> {
	const res = await fetchApp(
		TRANSFERS_URL,
		jsonResponseInit(
			"POST",
			{
				id: uuidV7(),
				sourceAccountId,
				destinationAccountId,
				amountMinor,
				date: "2026-01-14",
			},
			cookie,
		),
	);
	expect(res.status).toBe(201);
	return ((await res.json()) as { id: string }).id;
}

async function lifecycle(
	cookie: string,
	url: string,
	action: "archive" | "delete",
): Promise<void> {
	const res = await fetchApp(
		`${url}/${action}`,
		jsonResponseInit("POST", undefined, cookie),
	);
	expect(res.status).toBe(200);
}

async function listAccounts(
	cookie: string,
	status: string,
): Promise<{ ids: string[]; combinedBalanceMinor: number }> {
	const res = await fetchApp(`${ACCOUNTS_URL}?status=${status}`, {
		headers: { cookie },
	});
	expect(res.status).toBe(200);
	const body = (await res.json()) as {
		accounts: Array<{ id: string }>;
		combinedBalanceMinor: number;
	};
	return {
		ids: body.accounts.map((account) => account.id),
		combinedBalanceMinor: body.combinedBalanceMinor,
	};
}

async function listCategoryIds(
	cookie: string,
	status: string,
): Promise<string[]> {
	const res = await fetchApp(`${CATEGORIES_URL}?status=${status}`, {
		headers: { cookie },
	});
	expect(res.status).toBe(200);
	const body = (await res.json()) as { categories: Array<{ id: string }> };
	return body.categories.map((category) => category.id);
}

async function listTransactionIds(
	cookie: string,
	status: string,
): Promise<string[]> {
	const res = await fetchApp(
		`${TRANSACTIONS_URL}?status=${status}&page=1&pageSize=100`,
		{ headers: { cookie } },
	);
	expect(res.status).toBe(200);
	const body = (await res.json()) as { transactions: Array<{ id: string }> };
	return body.transactions.map((transaction) => transaction.id);
}

async function listTransferIds(
	cookie: string,
	status: string,
): Promise<string[]> {
	const res = await fetchApp(
		`${TRANSFERS_URL}?status=${status}&page=1&pageSize=100`,
		{ headers: { cookie } },
	);
	expect(res.status).toBe(200);
	const body = (await res.json()) as { transfers: Array<{ id: string }> };
	return body.transfers.map((transfer) => transfer.id);
}

interface SummaryResponse {
	incomeMinor: number;
	expenseMinor: number;
	netCashFlowMinor: number;
	combinedBalanceMinor: number;
	categoryBreakdown: Array<{
		categoryId: string;
		categoryName: string | null;
		amountMinor: number;
		sharePercent: number;
	}>;
	accounts: Array<{ id: string }>;
}

async function getSummary(cookie: string): Promise<SummaryResponse> {
	const res = await fetchApp(`${SUMMARY_URL}?month=2026-01`, {
		headers: { cookie },
	});
	expect(res.status).toBe(200);
	return (await res.json()) as SummaryResponse;
}

beforeEach(async () => {
	await env.finance_application.exec(
		"DELETE FROM transactions; DELETE FROM transfers; DELETE FROM categories; DELETE FROM accounts; DELETE FROM refresh_tokens; DELETE FROM users;",
	);
});

describe("lifecycle exclusion guarantee", () => {
	it("hides archived and deleted records from every ordinary list while the lifecycle slices contain exactly them", async () => {
		const cookie = await freshCookie();

		// Active survivors.
		const accountId = await createAccount(cookie, "HDFC Bank", 100_000);
		const incomeCategoryId = await createCategory(cookie, "Salary", "income");

		// Records headed for the archive.
		const archivedAccountId = await createAccount(cookie, "Old Bank", 40_000);
		const archivedCategoryId = await createCategory(
			cookie,
			"Old Subscriptions",
			"expense",
		);

		// Records headed for trash.
		const deletedAccountId = await createAccount(
			cookie,
			"Trashed Bank",
			20_000,
		);
		const deletedCategoryId = await createCategory(
			cookie,
			"Trashed Utility",
			"expense",
		);

		// Ledgers: one survivor, one archived, one soft-deleted — all on the
		// active account so account-level effects stay attributable.
		const keptTransactionId = await createTransaction(cookie, {
			type: "income",
			amountMinor: 25_000,
			date: "2026-01-10",
			accountId,
			categoryId: incomeCategoryId,
		});
		const archivedTransactionId = await createTransaction(cookie, {
			type: "expense",
			amountMinor: 5_000,
			date: "2026-01-11",
			accountId,
			categoryId: archivedCategoryId,
		});
		const deletedTransactionId = await createTransaction(cookie, {
			type: "expense",
			amountMinor: 2_000,
			date: "2026-01-12",
			accountId,
			categoryId: deletedCategoryId,
		});

		// Transfers: one archived, one soft-deleted; both involve the active
		// account on the source side.
		const archivedTransferId = await createTransfer(
			cookie,
			accountId,
			archivedAccountId,
			10_000,
		);
		const deletedTransferId = await createTransfer(
			cookie,
			accountId,
			deletedAccountId,
			8_000,
		);

		// Hide one of every type on each side of the lifecycle.
		await lifecycle(cookie, `${ACCOUNTS_URL}/${archivedAccountId}`, "archive");
		await lifecycle(cookie, `${ACCOUNTS_URL}/${deletedAccountId}`, "delete");
		await lifecycle(
			cookie,
			`${CATEGORIES_URL}/${archivedCategoryId}`,
			"archive",
		);
		await lifecycle(cookie, `${CATEGORIES_URL}/${deletedCategoryId}`, "delete");
		await lifecycle(
			cookie,
			`${TRANSACTIONS_URL}/${archivedTransactionId}`,
			"archive",
		);
		await lifecycle(
			cookie,
			`${TRANSACTIONS_URL}/${deletedTransactionId}`,
			"delete",
		);
		await lifecycle(
			cookie,
			`${TRANSFERS_URL}/${archivedTransferId}`,
			"archive",
		);
		await lifecycle(cookie, `${TRANSFERS_URL}/${deletedTransferId}`, "delete");

		// Account lists: only the active account is ordinary; the combined
		// balance counts only it, with archived ledger effects intact and the
		// soft-deleted ones zero (100000 + 25000 − 5000 − 10000).
		const activeAccounts = await listAccounts(cookie, "active");
		expect(activeAccounts.ids).toEqual([accountId]);
		expect(activeAccounts.combinedBalanceMinor).toBe(110_000);
		expect((await listAccounts(cookie, "archived")).ids).toEqual([
			archivedAccountId,
		]);
		expect((await listAccounts(cookie, "deleted")).ids).toEqual([
			deletedAccountId,
		]);

		// Category lists.
		expect(await listCategoryIds(cookie, "active")).toEqual([incomeCategoryId]);
		expect(await listCategoryIds(cookie, "archived")).toEqual([
			archivedCategoryId,
		]);
		expect(await listCategoryIds(cookie, "deleted")).toEqual([
			deletedCategoryId,
		]);

		// Transaction lists.
		expect(await listTransactionIds(cookie, "active")).toEqual([
			keptTransactionId,
		]);
		expect(await listTransactionIds(cookie, "archived")).toEqual([
			archivedTransactionId,
		]);
		expect(await listTransactionIds(cookie, "deleted")).toEqual([
			deletedTransactionId,
		]);

		// Transfer lists.
		expect(await listTransferIds(cookie, "active")).toEqual([]);
		expect(await listTransferIds(cookie, "archived")).toEqual([
			archivedTransferId,
		]);
		expect(await listTransferIds(cookie, "deleted")).toEqual([
			deletedTransferId,
		]);

		// Report summary follows the reporting capability's inclusion rules:
		// the archived transaction keeps counting (expense 5000), the
		// soft-deleted one drops out, transfers never enter income/expense, and
		// the combined balance counts only the active account.
		const summary = await getSummary(cookie);
		expect(summary.incomeMinor).toBe(25_000);
		expect(summary.expenseMinor).toBe(5_000);
		expect(summary.netCashFlowMinor).toBe(20_000);
		expect(summary.combinedBalanceMinor).toBe(110_000);
		expect(summary.accounts.map((account) => account.id)).toEqual([accountId]);
		expect(summary.categoryBreakdown).toEqual([
			{
				categoryId: archivedCategoryId,
				categoryName: "Old Subscriptions",
				amountMinor: 5_000,
				sharePercent: 100,
			},
		]);
	});
});
