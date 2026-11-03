/// <reference types="@cloudflare/vitest-plugin/types" />
import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { ACCESS_COOKIE } from "@/lib/session";
import { uuidV7 } from "@/lib/uuid";

// The main worker's default export, invoked with real bindings so requests
// carry env (D1 + JWT_SECRET) like production traffic does.
const worker = (
	exports as {
		default: { fetch: (req: Request, envVal: unknown) => Promise<Response> };
	}
).default;

function fetchApp(url: string, init?: RequestInit): Promise<Response> {
	return worker.fetch(new Request(url, init), env);
}

const BASE = "https://test.local/api/reports/summary";
const ACCOUNTS_URL = "https://test.local/api/accounts";
const CATEGORIES_URL = "https://test.local/api/categories";
const TRANSACTIONS_URL = "https://test.local/api/transactions";
const TRANSFERS_URL = "https://test.local/api/transfers";
const REGISTER_URL = "https://test.local/api/auth/register";

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

async function registerAndGetCookie(email: string): Promise<string> {
	const res = await worker.fetch(
		new Request(REGISTER_URL, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email, password: "s3cret-pw" }),
		}),
		env,
	);
	const access = res.headers
		.getSetCookie()
		.find((entry) => entry.startsWith(`${ACCESS_COOKIE}=`))
		?.split(";")[0];
	if (!access) {
		throw new Error("registration did not yield an access cookie");
	}
	return access;
}

let userCounter = 0;

async function freshCookie(): Promise<string> {
	userCounter += 1;
	return registerAndGetCookie(`reports-api-${userCounter}@example.com`);
}

async function createAccount(
	cookie: string,
	body: Record<string, unknown>,
): Promise<{ id: string; currentBalanceMinor: number }> {
	const res = await fetchApp(
		ACCOUNTS_URL,
		jsonResponseInit("POST", body, cookie),
	);
	expect(res.status).toBe(201);
	return (await res.json()) as { id: string; currentBalanceMinor: number };
}

async function createCategory(
	cookie: string,
	name: string,
	type: "income" | "expense",
): Promise<string> {
	const res = await fetchApp(
		CATEGORIES_URL,
		jsonResponseInit("POST", { name, type }, cookie),
	);
	expect(res.status).toBe(201);
	return ((await res.json()) as { id: string }).id;
}

interface TransactionSpec {
	type: "income" | "expense";
	amountMinor: number;
	date: string;
	status?: "active" | "archived" | "deleted";
	categoryId: string;
	accountId: string;
}

async function seedTransaction(
	cookie: string,
	spec: TransactionSpec,
): Promise<void> {
	const created = await fetchApp(
		TRANSACTIONS_URL,
		jsonResponseInit(
			"POST",
			{
				id: uuidV7(),
				type: spec.type,
				amountMinor: spec.amountMinor,
				date: spec.date,
				accountId: spec.accountId,
				categoryId: spec.categoryId,
			},
			cookie,
		),
	);
	expect(created.status).toBe(201);
	const { id } = (await created.json()) as { id: string };
	if (spec.status !== undefined && spec.status !== "active") {
		const transitioned = await fetchApp(
			`${TRANSACTIONS_URL}/${id}/${spec.status === "archived" ? "archive" : "delete"}`,
			jsonResponseInit("POST", undefined, cookie),
		);
		expect(transitioned.status).toBe(200);
	}
}

interface SummaryResponse {
	periodFrom: string;
	periodTo: string;
	incomeMinor: number;
	expenseMinor: number;
	netCashFlowMinor: number;
	categoryBreakdown: Array<{
		categoryId: string;
		categoryName: string | null;
		amountMinor: number;
		sharePercent: number;
	}>;
	comparison: Array<{
		label: string;
		incomeMinor: number;
		expenseMinor: number;
	}>;
	accounts: Array<{ id: string; currentBalanceMinor: number }>;
	combinedBalanceMinor: number;
}

async function getSummary(
	cookie: string,
	query: string,
): Promise<{
	status: number;
	body: SummaryResponse | { error: { code: string } };
}> {
	const res = await fetchApp(`${BASE}${query}`, { headers: { cookie } });
	return { status: res.status, body: (await res.json()) as SummaryResponse };
}

beforeEach(async () => {
	await env.finance_application.exec(
		"DELETE FROM transfers; DELETE FROM transactions; DELETE FROM categories; DELETE FROM accounts; DELETE FROM refresh_tokens; DELETE FROM users;",
	);
});

describe("authentication", () => {
	it("rejects the report endpoint without a session", async () => {
		expect((await fetchApp(BASE)).status).toBe(401);
	});
});

describe("period happy paths", () => {
	it("summarizes a month with bounds, totals, breakdown, and balances", async () => {
		const cookie = await freshCookie();
		const bank = await createAccount(cookie, {
			name: "HDFC Bank",
			type: "bank",
			openingBalanceMinor: 100_000,
		});
		const food = await createCategory(cookie, "Groceries", "expense");
		const salary = await createCategory(cookie, "Salary", "income");
		await seedTransaction(cookie, {
			type: "income",
			amountMinor: 50_000,
			date: "2026-01-10",
			categoryId: salary,
			accountId: bank.id,
		});
		await seedTransaction(cookie, {
			type: "expense",
			amountMinor: 20_000,
			date: "2026-01-15",
			categoryId: food,
			accountId: bank.id,
		});

		const { status, body } = await getSummary(cookie, "?month=2026-01");
		expect(status).toBe(200);
		const summary = body as SummaryResponse;
		expect(summary.periodFrom).toBe("2026-01-01");
		expect(summary.periodTo).toBe("2026-01-31");
		expect(summary.incomeMinor).toBe(50_000);
		expect(summary.expenseMinor).toBe(20_000);
		expect(summary.netCashFlowMinor).toBe(30_000);
		expect(summary.categoryBreakdown).toEqual([
			{
				categoryId: food,
				categoryName: "Groceries",
				amountMinor: 20_000,
				sharePercent: 100,
			},
		]);
		expect(summary.combinedBalanceMinor).toBe(130_000);
		expect(summary.accounts.map((account) => account.id)).toEqual([bank.id]);
	});

	it("summarizes a year with twelve monthly comparison buckets", async () => {
		const cookie = await freshCookie();
		const bank = await createAccount(cookie, {
			name: "HDFC Bank",
			type: "bank",
			openingBalanceMinor: 0,
		});
		const food = await createCategory(cookie, "Groceries", "expense");
		await seedTransaction(cookie, {
			type: "expense",
			amountMinor: 5_000,
			date: "2026-03-05",
			categoryId: food,
			accountId: bank.id,
		});
		await seedTransaction(cookie, {
			type: "expense",
			amountMinor: 2_000,
			date: "2026-04-01",
			categoryId: food,
			accountId: bank.id,
		});

		const { status, body } = await getSummary(cookie, "?year=2026");
		expect(status).toBe(200);
		const summary = body as SummaryResponse;
		expect(summary.periodFrom).toBe("2026-01-01");
		expect(summary.periodTo).toBe("2026-12-31");
		expect(summary.comparison).toHaveLength(12);
		expect(summary.comparison[2]).toEqual({
			label: "2026-03",
			incomeMinor: 0,
			expenseMinor: 5_000,
		});
		expect(summary.comparison[3]).toEqual({
			label: "2026-04",
			incomeMinor: 0,
			expenseMinor: 2_000,
		});
		expect(summary.comparison[0]).toEqual({
			label: "2026-01",
			incomeMinor: 0,
			expenseMinor: 0,
		});
	});

	it("accepts an explicit from/to range with daily buckets for a short span", async () => {
		const cookie = await freshCookie();
		const bank = await createAccount(cookie, {
			name: "HDFC Bank",
			type: "bank",
			openingBalanceMinor: 0,
		});
		const food = await createCategory(cookie, "Groceries", "expense");
		await seedTransaction(cookie, {
			type: "expense",
			amountMinor: 1_000,
			date: "2026-01-05",
			categoryId: food,
			accountId: bank.id,
		});

		const { status, body } = await getSummary(
			cookie,
			"?from=2026-01-01&to=2026-01-31",
		);
		expect(status).toBe(200);
		const summary = body as SummaryResponse;
		expect(summary.periodFrom).toBe("2026-01-01");
		expect(summary.comparison).toHaveLength(31);
	});
});

describe("invalid periods", () => {
	it("rejects a period with no form, both forms, or a reversed range with INVALID_PERIOD", async () => {
		const cookie = await freshCookie();
		const empty = await getSummary(cookie, "");
		expect(empty.status).toBe(400);
		expect(empty.body).toMatchObject({ error: { code: "INVALID_PERIOD" } });

		const both = await getSummary(cookie, "?month=2026-01&year=2026");
		expect(both.status).toBe(400);
		expect(both.body).toMatchObject({ error: { code: "INVALID_PERIOD" } });

		const halfRange = await getSummary(cookie, "?from=2026-01-01");
		expect(halfRange.status).toBe(400);
		expect(halfRange.body).toMatchObject({ error: { code: "INVALID_PERIOD" } });

		const reversed = await getSummary(cookie, "?from=2026-02-01&to=2026-01-31");
		expect(reversed.status).toBe(400);
		expect(reversed.body).toMatchObject({ error: { code: "INVALID_PERIOD" } });
	});

	it("rejects malformed period fields as validation errors", async () => {
		const cookie = await freshCookie();
		expect((await getSummary(cookie, "?month=2026-13")).status).toBe(400);
		expect((await getSummary(cookie, "?year=20x6")).status).toBe(400);
		expect(
			(await getSummary(cookie, "?from=2026-01-01&to=not-a-date")).status,
		).toBe(400);
	});
});

describe("reporting inclusion rules", () => {
	it("counts archived transactions, excludes soft-deleted ones, and ignores transfers entirely", async () => {
		const cookie = await freshCookie();
		const bank = await createAccount(cookie, {
			name: "HDFC Bank",
			type: "bank",
			openingBalanceMinor: 0,
		});
		const wallet = await createAccount(cookie, {
			name: "Wallet",
			type: "wallet",
			openingBalanceMinor: 0,
		});
		const food = await createCategory(cookie, "Groceries", "expense");
		const salary = await createCategory(cookie, "Salary", "income");

		await seedTransaction(cookie, {
			type: "income",
			amountMinor: 40_000,
			date: "2026-01-05",
			categoryId: salary,
			accountId: bank.id,
		});
		await seedTransaction(cookie, {
			type: "expense",
			amountMinor: 10_000,
			date: "2026-01-06",
			categoryId: food,
			accountId: bank.id,
			status: "archived",
		});
		await seedTransaction(cookie, {
			type: "expense",
			amountMinor: 7_000,
			date: "2026-01-07",
			categoryId: food,
			accountId: bank.id,
			status: "deleted",
		});
		// An in-period transfer moves money but is never income or expense.
		const transfer = await fetchApp(
			TRANSFERS_URL,
			jsonResponseInit(
				"POST",
				{
					id: uuidV7(),
					amountMinor: 15_000,
					date: "2026-01-08",
					sourceAccountId: bank.id,
					destinationAccountId: wallet.id,
				},
				cookie,
			),
		);
		expect(transfer.status).toBe(201);

		const { status, body } = await getSummary(cookie, "?month=2026-01");
		expect(status).toBe(200);
		const summary = body as SummaryResponse;
		expect(summary.incomeMinor).toBe(40_000);
		expect(summary.expenseMinor).toBe(10_000);
		expect(summary.netCashFlowMinor).toBe(30_000);
	});

	it("includes expenses against archived and soft-deleted categories under their resolved names", async () => {
		const cookie = await freshCookie();
		const bank = await createAccount(cookie, {
			name: "HDFC Bank",
			type: "bank",
			openingBalanceMinor: 0,
		});
		const archivedCategory = await createCategory(
			cookie,
			"Old Hobby",
			"expense",
		);
		const deletedCategory = await createCategory(
			cookie,
			"Old Subscription",
			"expense",
		);
		await seedTransaction(cookie, {
			type: "expense",
			amountMinor: 3_000,
			date: "2026-01-05",
			categoryId: archivedCategory,
			accountId: bank.id,
		});
		await seedTransaction(cookie, {
			type: "expense",
			amountMinor: 2_000,
			date: "2026-01-06",
			categoryId: deletedCategory,
			accountId: bank.id,
		});
		expect(
			(
				await fetchApp(
					`${CATEGORIES_URL}/${archivedCategory}/archive`,
					jsonResponseInit("POST", undefined, cookie),
				)
			).status,
		).toBe(200);
		expect(
			(
				await fetchApp(
					`${CATEGORIES_URL}/${deletedCategory}/delete`,
					jsonResponseInit("POST", undefined, cookie),
				)
			).status,
		).toBe(200);

		const { status, body } = await getSummary(cookie, "?month=2026-01");
		expect(status).toBe(200);
		const summary = body as SummaryResponse;
		expect(summary.categoryBreakdown).toEqual([
			{
				categoryId: archivedCategory,
				categoryName: "Old Hobby",
				amountMinor: 3_000,
				sharePercent: 60,
			},
			{
				categoryId: deletedCategory,
				categoryName: "Old Subscription",
				amountMinor: 2_000,
				sharePercent: 40,
			},
		]);
	});

	it("combines balances over active accounts only while archived accounts' transactions still count", async () => {
		const cookie = await freshCookie();
		const bank = await createAccount(cookie, {
			name: "HDFC Bank",
			type: "bank",
			openingBalanceMinor: 100_000,
		});
		const oldBank = await createAccount(cookie, {
			name: "Old Bank",
			type: "bank",
			openingBalanceMinor: 50_000,
		});
		const food = await createCategory(cookie, "Groceries", "expense");
		// The archived account's expense still counts in the period totals.
		await seedTransaction(cookie, {
			type: "expense",
			amountMinor: 8_000,
			date: "2026-01-05",
			categoryId: food,
			accountId: oldBank.id,
		});
		expect(
			(
				await fetchApp(
					`${ACCOUNTS_URL}/${oldBank.id}/archive`,
					jsonResponseInit("POST", undefined, cookie),
				)
			).status,
		).toBe(200);

		const { status, body } = await getSummary(cookie, "?month=2026-01");
		expect(status).toBe(200);
		const summary = body as SummaryResponse;
		expect(summary.expenseMinor).toBe(8_000);
		expect(summary.accounts.map((account) => account.id)).toEqual([bank.id]);
		// Combined over active accounts only: the archived account contributes
		// nothing, even though its transaction still counts in the totals.
		expect(summary.combinedBalanceMinor).toBe(100_000);
	});

	it("counts boundary dates exactly once", async () => {
		const cookie = await freshCookie();
		const bank = await createAccount(cookie, {
			name: "HDFC Bank",
			type: "bank",
			openingBalanceMinor: 0,
		});
		const food = await createCategory(cookie, "Groceries", "expense");
		await seedTransaction(cookie, {
			type: "expense",
			amountMinor: 100,
			date: "2026-01-01",
			categoryId: food,
			accountId: bank.id,
		});
		await seedTransaction(cookie, {
			type: "expense",
			amountMinor: 100,
			date: "2026-01-31",
			categoryId: food,
			accountId: bank.id,
		});
		await seedTransaction(cookie, {
			type: "expense",
			amountMinor: 100,
			date: "2026-01-15",
			categoryId: food,
			accountId: bank.id,
		});

		const { status, body } = await getSummary(cookie, "?month=2026-01");
		expect(status).toBe(200);
		const summary = body as SummaryResponse;
		expect(summary.expenseMinor).toBe(300);
		const firstDay = summary.comparison.find(
			(bucket) => bucket.label === "2026-01-01",
		);
		const lastDay = summary.comparison.find(
			(bucket) => bucket.label === "2026-01-31",
		);
		expect(firstDay).toEqual({
			label: "2026-01-01",
			incomeMinor: 0,
			expenseMinor: 100,
		});
		expect(lastDay).toEqual({
			label: "2026-01-31",
			incomeMinor: 0,
			expenseMinor: 100,
		});
	});
});

describe("scoping and empty data", () => {
	it("isolates users from each other's records", async () => {
		const cookieA = await freshCookie();
		const cookieB = await freshCookie();
		const bankA = await createAccount(cookieA, {
			name: "Bank A",
			type: "bank",
			openingBalanceMinor: 0,
		});
		const foodA = await createCategory(cookieA, "Groceries", "expense");
		await seedTransaction(cookieA, {
			type: "expense",
			amountMinor: 5_000,
			date: "2026-01-05",
			categoryId: foodA,
			accountId: bankA.id,
		});

		const bankB = await createAccount(cookieB, {
			name: "Bank B",
			type: "bank",
			openingBalanceMinor: 0,
		});
		const foodB = await createCategory(cookieB, "Groceries", "expense");
		await seedTransaction(cookieB, {
			type: "expense",
			amountMinor: 9_000,
			date: "2026-01-06",
			categoryId: foodB,
			accountId: bankB.id,
		});

		const summaryA = (await getSummary(cookieA, "?month=2026-01"))
			.body as SummaryResponse;
		expect(summaryA.expenseMinor).toBe(5_000);
		expect(summaryA.accounts.map((account) => account.id)).toEqual([bankA.id]);

		const summaryB = (await getSummary(cookieB, "?month=2026-01"))
			.body as SummaryResponse;
		expect(summaryB.expenseMinor).toBe(9_000);
	});

	it("returns zero totals, an empty breakdown, and zero charts for a user with no data", async () => {
		const cookie = await freshCookie();
		const { status, body } = await getSummary(cookie, "?month=2026-01");
		expect(status).toBe(200);
		const summary = body as SummaryResponse;
		expect(summary.incomeMinor).toBe(0);
		expect(summary.expenseMinor).toBe(0);
		expect(summary.netCashFlowMinor).toBe(0);
		expect(summary.categoryBreakdown).toEqual([]);
		expect(summary.accounts).toEqual([]);
		expect(summary.combinedBalanceMinor).toBe(0);
		expect(summary.comparison).toHaveLength(31);
		expect(
			summary.comparison.every(
				(bucket) => bucket.incomeMinor === 0 && bucket.expenseMinor === 0,
			),
		).toBe(true);
	});
});
