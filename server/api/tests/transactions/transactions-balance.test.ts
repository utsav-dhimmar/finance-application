/// <reference types="@cloudflare/vitest-plugin/types" />
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { ACCESS_COOKIE } from "@/lib/session";
import { uuidV7 } from "@/lib/uuid";
import { cookieHeader, fetchApp, seedUserAndLogin } from "../helpers";

const BASE = "https://test.local/api/transactions";
const ACCOUNTS_URL = "https://test.local/api/accounts";
const CATEGORIES_URL = "https://test.local/api/categories";

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
	body: Record<string, unknown>,
): Promise<{ id: string; currentBalanceMinor: number }> {
	const res = await fetchApp(
		ACCOUNTS_URL,
		jsonResponseInit("POST", body, cookie),
	);
	expect(res.status).toBe(201);
	const parsed = (await res.json()) as {
		id: string;
		currentBalanceMinor: number;
	};
	return parsed;
}

async function createCategory(
	cookie: string,
	body: Record<string, unknown>,
): Promise<string> {
	const res = await fetchApp(
		CATEGORIES_URL,
		jsonResponseInit("POST", body, cookie),
	);
	expect(res.status).toBe(201);
	return ((await res.json()) as { id: string }).id;
}

async function postTransaction(
	cookie: string,
	body: Record<string, unknown>,
): Promise<Response> {
	return fetchApp(BASE, jsonResponseInit("POST", body, cookie));
}

async function accountById(
	cookie: string,
	id: string,
): Promise<{
	currentBalanceMinor: number;
	type: string;
	openingBalanceMinor: number;
}> {
	const res = await fetchApp(`${ACCOUNTS_URL}/${id}`, {
		headers: { cookie },
	});
	const parsed = (await res.json()) as {
		currentBalanceMinor: number;
		type: string;
		openingBalanceMinor: number;
	};
	return parsed;
}

beforeEach(async () => {
	await env.finance_application.exec(
		"DELETE FROM transactions; DELETE FROM categories; DELETE FROM accounts; DELETE FROM refresh_tokens; DELETE FROM users;",
	);
});

describe("balance effects", () => {
	it("credits income and debits expense on top of the opening balance", async () => {
		const cookie = await freshCookie();
		const account = await createAccount(cookie, {
			name: "HDFC Bank",
			type: "bank",
			openingBalanceMinor: 10000,
		});
		const expenseCategory = await createCategory(cookie, {
			name: "Groceries",
			type: "expense",
		});
		const incomeCategory = await createCategory(cookie, {
			name: "Salary",
			type: "income",
		});

		const income = await postTransaction(cookie, {
			id: uuidV7(),
			type: "income",
			amountMinor: 50000,
			date: "2026-01-10",
			accountId: account.id,
			categoryId: incomeCategory,
		});
		expect(income.status).toBe(201);

		const expense = await postTransaction(cookie, {
			id: uuidV7(),
			type: "expense",
			amountMinor: 1500,
			date: "2026-01-12",
			accountId: account.id,
			categoryId: expenseCategory,
		});
		expect(expense.status).toBe(201);

		const afterBoth = await accountById(cookie, account.id);
		expect(afterBoth.currentBalanceMinor).toBe(10000 + 50000 - 1500);
	});

	it("displays negative balances as-is when expenses overdraw", async () => {
		const cookie = await freshCookie();
		const account = await createAccount(cookie, {
			name: "Cash",
			type: "cash",
			openingBalanceMinor: 100,
		});
		const category = await createCategory(cookie, {
			name: "Snacks",
			type: "expense",
		});
		const res = await postTransaction(cookie, {
			id: uuidV7(),
			type: "expense",
			amountMinor: 500,
			date: "2026-01-10",
			accountId: account.id,
			categoryId: category,
		});
		expect(res.status).toBe(201);
		const after = await accountById(cookie, account.id);
		expect(after.currentBalanceMinor).toBe(-400);
	});

	it("archive keeps the effect, delete reverses it, restore re-applies exactly once", async () => {
		const cookie = await freshCookie();
		const account = await createAccount(cookie, {
			name: "HDFC Bank",
			type: "bank",
			openingBalanceMinor: 0,
		});
		const category = await createCategory(cookie, {
			name: "Salary",
			type: "income",
		});
		const txnId = (
			(await (
				await postTransaction(cookie, {
					id: uuidV7(),
					type: "income",
					amountMinor: 30000,
					date: "2026-01-10",
					accountId: account.id,
					categoryId: category,
				})
			).json()) as { id: string }
		).id;

		const archive = await fetchApp(
			`${BASE}/${txnId}/archive`,
			jsonResponseInit("POST", undefined, cookie),
		);
		expect(archive.status).toBe(200);
		expect((await accountById(cookie, account.id)).currentBalanceMinor).toBe(
			30000,
		);

		// Archiving an already-archived transaction is invalid.
		expect(
			(
				await fetchApp(
					`${BASE}/${txnId}/archive`,
					jsonResponseInit("POST", undefined, cookie),
				)
			).status,
		).toBe(409);

		const remove = await fetchApp(
			`${BASE}/${txnId}/delete`,
			jsonResponseInit("POST", undefined, cookie),
		);
		expect(remove.status).toBe(409);

		const restore = await fetchApp(
			`${BASE}/${txnId}/restore`,
			jsonResponseInit("POST", undefined, cookie),
		);
		expect(restore.status).toBe(200);
		expect((await accountById(cookie, account.id)).currentBalanceMinor).toBe(
			30000,
		);

		const softDelete = await fetchApp(
			`${BASE}/${txnId}/delete`,
			jsonResponseInit("POST", undefined, cookie),
		);
		expect(softDelete.status).toBe(200);
		expect((await accountById(cookie, account.id)).currentBalanceMinor).toBe(0);

		const restoreAgain = await fetchApp(
			`${BASE}/${txnId}/restore`,
			jsonResponseInit("POST", undefined, cookie),
		);
		expect(restoreAgain.status).toBe(200);
		expect((await accountById(cookie, account.id)).currentBalanceMinor).toBe(
			30000,
		);
	});

	it("rebalances both accounts when a transaction is edited across accounts", async () => {
		const cookie = await freshCookie();
		const from = await createAccount(cookie, {
			name: "From",
			type: "bank",
			openingBalanceMinor: 0,
		});
		const to = await createAccount(cookie, {
			name: "To",
			type: "wallet",
			openingBalanceMinor: 0,
		});
		const category = await createCategory(cookie, {
			name: "Salary",
			type: "income",
		});
		const txnId = (
			(await (
				await postTransaction(cookie, {
					id: uuidV7(),
					type: "income",
					amountMinor: 7000,
					date: "2026-01-10",
					accountId: from.id,
					categoryId: category,
				})
			).json()) as { id: string }
		).id;

		const edit = await fetchApp(
			`${BASE}/${txnId}`,
			jsonResponseInit("PATCH", { accountId: to.id, type: undefined }, cookie),
		);
		expect(edit.status).toBe(200);
		expect((await accountById(cookie, from.id)).currentBalanceMinor).toBe(0);
		expect((await accountById(cookie, to.id)).currentBalanceMinor).toBe(7000);
	});
});

describe("field locks from posted history", () => {
	it("locks the account opening balance/type and category type, then unlocks on delete", async () => {
		const cookie = await freshCookie();
		const account = await createAccount(cookie, {
			name: "HDFC Bank",
			type: "bank",
			openingBalanceMinor: 0,
		});
		const category = await createCategory(cookie, {
			name: "Groceries",
			type: "expense",
		});
		const txnId = (
			(await (
				await postTransaction(cookie, {
					id: uuidV7(),
					type: "expense",
					amountMinor: 1000,
					date: "2026-01-10",
					accountId: account.id,
					categoryId: category,
				})
			).json()) as { id: string }
		).id;
		void txnId;

		const lockedOpening = await fetchApp(
			`${ACCOUNTS_URL}/${account.id}`,
			jsonResponseInit("PATCH", { openingBalanceMinor: 999 }, cookie),
		);
		expect(lockedOpening.status).toBe(409);
		await expect(lockedOpening.json()).resolves.toMatchObject({
			error: { code: "ACCOUNT_FIELD_LOCKED" },
		});

		const lockedType = await fetchApp(
			`${ACCOUNTS_URL}/${account.id}`,
			jsonResponseInit("PATCH", { type: "wallet" }, cookie),
		);
		expect(lockedType.status).toBe(409);
		await expect(lockedType.json()).resolves.toMatchObject({
			error: { code: "ACCOUNT_FIELD_LOCKED" },
		});

		const lockedCategory = await fetchApp(
			`${CATEGORIES_URL}/${category}`,
			jsonResponseInit("PATCH", { type: "income" }, cookie),
		);
		expect(lockedCategory.status).toBe(409);
		await expect(lockedCategory.json()).resolves.toMatchObject({
			error: { code: "CATEGORY_TYPE_LOCKED" },
		});

		// Soft-deleting the only transaction removes its posted effect and
		// unlocks both entities.
		const remove = await fetchApp(
			`${BASE}/${txnId}/delete`,
			jsonResponseInit("POST", undefined, cookie),
		);
		expect(remove.status).toBe(200);

		const unlockedOpening = await fetchApp(
			`${ACCOUNTS_URL}/${account.id}`,
			jsonResponseInit("PATCH", { openingBalanceMinor: 999 }, cookie),
		);
		expect(unlockedOpening.status).toBe(200);

		const unlockedCategory = await fetchApp(
			`${CATEGORIES_URL}/${category}`,
			jsonResponseInit("PATCH", { type: "income" }, cookie),
		);
		expect(unlockedCategory.status).toBe(200);
	});
});
