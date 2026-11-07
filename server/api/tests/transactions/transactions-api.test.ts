/// <reference types="@cloudflare/vitest-plugin/types" />
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { hashPassword } from "@/lib/password";
import { ACCESS_COOKIE } from "@/lib/session";
import { uuidV7 } from "@/lib/uuid";
import { createAccountRepository } from "@/repositories/account-repository";
import { createCategoryRepository } from "@/repositories/category-repository";
import { createTransactionRepository } from "@/repositories/transaction-repository";
import { createUserRepository } from "@/repositories/user-repository";
import { isoNow } from "@/utils/datetime";
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
): Promise<string> {
	const res = await fetchApp(
		ACCOUNTS_URL,
		jsonResponseInit("POST", body, cookie),
	);
	expect(res.status).toBe(201);
	return ((await res.json()) as { id: string }).id;
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

async function seedBaseline(cookie: string): Promise<{
	accountId: string;
	categoryId: string;
}> {
	const accountId = await createAccount(cookie, {
		name: "HDFC Bank",
		type: "bank",
	});
	const categoryId = await createCategory(cookie, {
		name: "Groceries",
		type: "expense",
	});
	return { accountId, categoryId };
}

function transactionBody(
	overrides: Record<string, unknown> = {},
): Record<string, unknown> {
	return {
		id: uuidV7(),
		type: "expense",
		amountMinor: 1000,
		date: "2026-01-15",
		accountId: "acc",
		categoryId: "cat",
		...overrides,
	};
}

async function postTransaction(
	cookie: string,
	body: Record<string, unknown>,
): Promise<Response> {
	return fetchApp(BASE, jsonResponseInit("POST", body, cookie));
}

interface TransactionListBody {
	total: number;
	transactions: Array<{ id: string; notes: string | null }>;
}

async function listTransactions(
	cookie: string,
	query: string,
): Promise<TransactionListBody> {
	const res = await fetchApp(`${BASE}${query}`, { headers: { cookie } });
	expect(res.status).toBe(200);
	return (await res.json()) as TransactionListBody;
}

beforeEach(async () => {
	await env.finance_application.exec(
		"DELETE FROM transactions; DELETE FROM categories; DELETE FROM accounts; DELETE FROM refresh_tokens; DELETE FROM users;",
	);
});

describe("authentication", () => {
	it("rejects unauthenticated requests on every endpoint", async () => {
		expect((await fetchApp(BASE)).status).toBe(401);
		expect((await fetchApp(`${BASE}/some-id`)).status).toBe(401);
		expect(
			(
				await postTransaction(
					cookieHeader({ [ACCESS_COOKIE]: "invalid" }),
					transactionBody(),
				)
			).status,
		).toBe(401);
		expect(
			(
				await fetchApp(
					`${BASE}/some-id/archive`,
					jsonResponseInit(
						"POST",
						undefined,
						cookieHeader({ [ACCESS_COOKIE]: "invalid" }),
					),
				)
			).status,
		).toBe(401);
	});
});

describe("POST /api/transactions", () => {
	it("creates a transaction and returns 201 with resolved names", async () => {
		const cookie = await freshCookie();
		const { accountId, categoryId } = await seedBaseline(cookie);
		const res = await postTransaction(
			cookie,
			transactionBody({
				accountId,
				categoryId,
				notes: "  weekly shop  ",
			}),
		);
		expect(res.status).toBe(201);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body).toMatchObject({
			type: "expense",
			amountMinor: 1000,
			date: "2026-01-15",
			accountId,
			accountName: "HDFC Bank",
			categoryId,
			categoryName: "Groceries",
			notes: "weekly shop",
			status: "active",
			archivedAt: null,
			deletedAt: null,
		});
	});

	it("replays the same client id with 200 and no duplicate", async () => {
		const cookie = await freshCookie();
		const { accountId, categoryId } = await seedBaseline(cookie);
		const sharedId = uuidV7();
		const first = await postTransaction(
			cookie,
			transactionBody({ id: sharedId, accountId, categoryId }),
		);
		expect(first.status).toBe(201);
		const replay = await postTransaction(
			cookie,
			transactionBody({
				id: sharedId,
				accountId,
				categoryId,
				amountMinor: 999,
			}),
		);
		expect(replay.status).toBe(200);
		await expect(replay.json()).resolves.toMatchObject({
			amountMinor: 1000,
		});
		const list = (await (
			await fetchApp(BASE, { headers: { cookie } })
		).json()) as { total: number };
		expect(list.total).toBe(1);
	});

	it.each([
		["zero amount", { amountMinor: 0 }],
		["negative amount", { amountMinor: -100 }],
		["fractional amount", { amountMinor: 10.5 }],
		["v4 id", { id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301" }],
		["bad date", { date: "2026-02-30" }],
		["bad type", { type: "transfer" }],
	])("returns 400 for %s", async (_label, overrides) => {
		const cookie = await freshCookie();
		const res = await postTransaction(cookie, transactionBody(overrides));
		expect(res.status).toBe(400);
		await expect(res.json()).resolves.toMatchObject({
			error: { code: "VALIDATION_ERROR" },
		});
	});

	it("returns 409 for an archived account and a wrong-type category", async () => {
		const cookie = await freshCookie();
		const accountId = await createAccount(cookie, {
			name: "Old",
			type: "bank",
		});
		const categoryId = await createCategory(cookie, {
			name: "Groceries",
			type: "expense",
		});
		await fetchApp(
			`${ACCOUNTS_URL}/${accountId}/archive`,
			jsonResponseInit("POST", undefined, cookie),
		);
		const archivedAccount = await postTransaction(
			cookie,
			transactionBody({ accountId, categoryId }),
		);
		expect(archivedAccount.status).toBe(409);
		await expect(archivedAccount.json()).resolves.toMatchObject({
			error: { code: "ACCOUNT_INELIGIBLE" },
		});

		const activeAccount = await createAccount(cookie, {
			name: "Fresh",
			type: "bank",
		});
		const wrongType = await postTransaction(
			cookie,
			transactionBody({
				accountId: activeAccount,
				categoryId,
				type: "income",
			}),
		);
		expect(wrongType.status).toBe(409);
		await expect(wrongType.json()).resolves.toMatchObject({
			error: { code: "CATEGORY_INELIGIBLE" },
		});
	});

	it("answers 409 ID_CONFLICT for a client id already owned by another user", async () => {
		const session = await seedUserAndLogin();
		const cookie = cookieHeader({ [ACCESS_COOKIE]: session.access });
		const { accountId, categoryId } = await seedBaseline(cookie);

		// A second user, seeded directly (no session): their own account,
		// category, and a transaction already holding the colliding id.
		const db = getDb(env);
		const otherUserId = uuidV7();
		const now = isoNow();
		await createUserRepository(db).insert({
			id: otherUserId,
			email: "conflict-peer@test.local",
			passwordHash: hashPassword("s3cret-pw"),
			createdAt: now,
			updatedAt: now,
		});
		const otherAccountId = uuidV7();
		await createAccountRepository(db).insert({
			id: otherAccountId,
			userId: otherUserId,
			name: "Peer Bank",
			type: "bank",
			openingBalanceMinor: 0,
			createdAt: now,
			updatedAt: now,
		});
		const otherCategoryId = uuidV7();
		await createCategoryRepository(db).insert({
			id: otherCategoryId,
			userId: otherUserId,
			name: "Peer Groceries",
			type: "expense",
			color: null,
			icon: null,
			createdAt: now,
			updatedAt: now,
		});
		const collidingId = uuidV7();
		await createTransactionRepository(db).insert({
			id: collidingId,
			userId: otherUserId,
			type: "expense",
			amountMinor: 123,
			date: "2026-01-10",
			accountId: otherAccountId,
			categoryId: otherCategoryId,
			notes: "peer private note",
			createdAt: now,
			updatedAt: now,
		});

		const res = await postTransaction(
			cookie,
			transactionBody({ id: collidingId, accountId, categoryId }),
		);
		expect(res.status).toBe(409);
		const body: unknown = await res.json();
		expect(body).toMatchObject({ error: { code: "ID_CONFLICT" } });
		// The neutral conflict response must not leak the other user's row.
		const bodyText = JSON.stringify(body);
		expect(bodyText).not.toContain("peer private note");
		expect(bodyText).not.toContain(otherAccountId);
	});
});

describe("GET /api/transactions", () => {
	it("filters by date range, type, account, category, and search, paginated", async () => {
		const cookie = await freshCookie();
		const { accountId, categoryId } = await seedBaseline(cookie);
		const otherAccountId = await createAccount(cookie, {
			name: "Wallet",
			type: "wallet",
		});

		for (const body of [
			transactionBody({
				accountId,
				categoryId,
				date: "2026-01-05",
				notes: "market run",
			}),
			transactionBody({
				accountId,
				categoryId,
				date: "2026-01-20",
				amountMinor: 2000,
			}),
			transactionBody({
				accountId: otherAccountId,
				categoryId,
				date: "2026-02-10",
				amountMinor: 3000,
			}),
		]) {
			expect((await postTransaction(cookie, body)).status).toBe(201);
		}

		const all = (await (
			await fetchApp(BASE, { headers: { cookie } })
		).json()) as { total: number; transactions: { date: string }[] };
		expect(all.total).toBe(3);
		expect(all.transactions[0]?.date).toBe("2026-02-10");

		const ranged = (await (
			await fetchApp(`${BASE}?from=2026-01-05&to=2026-01-20`, {
				headers: { cookie },
			})
		).json()) as { total: number };
		expect(ranged.total).toBe(2);

		const paged = (await (
			await fetchApp(`${BASE}?page=2&pageSize=2`, { headers: { cookie } })
		).json()) as {
			total: number;
			page: number;
			pageSize: number;
			transactions: unknown[];
		};
		expect(paged.total).toBe(3);
		expect(paged.page).toBe(2);
		expect(paged.pageSize).toBe(2);
		expect(paged.transactions).toHaveLength(1);

		const searched = (await (
			await fetchApp(`${BASE}?q=market`, { headers: { cookie } })
		).json()) as { total: number };
		expect(searched.total).toBe(1);

		const byAccount = (await (
			await fetchApp(`${BASE}?accountId=${otherAccountId}`, {
				headers: { cookie },
			})
		).json()) as { total: number };
		expect(byAccount.total).toBe(1);

		const empty = (await (
			await fetchApp(`${BASE}?q=nomatch`, { headers: { cookie } })
		).json()) as { total: number; transactions: unknown[] };
		expect(empty.total).toBe(0);
		expect(empty.transactions).toHaveLength(0);
	});

	it("serves archived and deleted slices via status", async () => {
		const cookie = await freshCookie();
		const { accountId, categoryId } = await seedBaseline(cookie);
		const id = (
			(await (
				await postTransaction(
					cookie,
					transactionBody({ accountId, categoryId }),
				)
			).json()) as { id: string }
		).id;
		await fetchApp(
			`${BASE}/${id}/archive`,
			jsonResponseInit("POST", undefined, cookie),
		);

		const archived = (await (
			await fetchApp(`${BASE}?status=archived`, { headers: { cookie } })
		).json()) as { total: number };
		expect(archived.total).toBe(1);

		const active = (await (
			await fetchApp(`${BASE}?status=active`, { headers: { cookie } })
		).json()) as { total: number };
		expect(active.total).toBe(0);
	});

	// US-021 historical reporting: archived accounts and categories remain
	// reportable through the list filters, with names still resolved.
	it("filters by an archived account and archived or deleted categories", async () => {
		const cookie = await freshCookie();
		const activeAccount = await createAccount(cookie, {
			name: "HDFC Bank",
			type: "bank",
		});
		const archivedAccount = await createAccount(cookie, {
			name: "Old Bank",
			type: "bank",
		});
		const archivedCategory = await createCategory(cookie, {
			name: "Old Hobby",
			type: "expense",
		});
		const deletedCategory = await createCategory(cookie, {
			name: "Old Subscription",
			type: "expense",
		});
		const activeCategory = await createCategory(cookie, {
			name: "Groceries",
			type: "expense",
		});

		for (const body of [
			transactionBody({
				accountId: archivedAccount,
				categoryId: archivedCategory,
				date: "2026-01-05",
				amountMinor: 3000,
			}),
			transactionBody({
				accountId: archivedAccount,
				categoryId: deletedCategory,
				date: "2026-01-10",
				amountMinor: 2000,
			}),
			transactionBody({
				accountId: activeAccount,
				categoryId: activeCategory,
				date: "2026-02-01",
				amountMinor: 1000,
			}),
		]) {
			expect((await postTransaction(cookie, body)).status).toBe(201);
		}
		expect(
			(
				await fetchApp(
					`${ACCOUNTS_URL}/${archivedAccount}/archive`,
					jsonResponseInit("POST", undefined, cookie),
				)
			).status,
		).toBe(200);
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

		// The archived account's historical transactions remain reportable.
		const byArchivedAccount = (await (
			await fetchApp(`${BASE}?accountId=${archivedAccount}`, {
				headers: { cookie },
			})
		).json()) as {
			total: number;
			transactions: Array<{ accountName: string | null }>;
		};
		expect(byArchivedAccount.total).toBe(2);
		expect(byArchivedAccount.transactions[0]?.accountName).toBe("Old Bank");

		// Archived and soft-deleted categories remain reportable with names.
		const byArchivedCategory = (await (
			await fetchApp(`${BASE}?categoryId=${archivedCategory}`, {
				headers: { cookie },
			})
		).json()) as {
			total: number;
			transactions: Array<{ categoryName: string | null }>;
		};
		expect(byArchivedCategory.total).toBe(1);
		expect(byArchivedCategory.transactions[0]?.categoryName).toBe("Old Hobby");

		const byDeletedCategory = (await (
			await fetchApp(`${BASE}?categoryId=${deletedCategory}`, {
				headers: { cookie },
			})
		).json()) as {
			total: number;
			transactions: Array<{ categoryName: string | null }>;
		};
		expect(byDeletedCategory.total).toBe(1);
		expect(byDeletedCategory.transactions[0]?.categoryName).toBe(
			"Old Subscription",
		);

		// Historical range over the archived account stays boundary-inclusive.
		const ranged = (await (
			await fetchApp(
				`${BASE}?accountId=${archivedAccount}&from=2026-01-05&to=2026-01-10`,
				{ headers: { cookie } },
			)
		).json()) as { total: number };
		expect(ranged.total).toBe(2);
	});

	it("matches % and _ in search text literally instead of as wildcards", async () => {
		const cookie = await freshCookie();
		const { accountId, categoryId } = await seedBaseline(cookie);
		const discountId = (
			(await (
				await postTransaction(
					cookie,
					transactionBody({
						accountId,
						categoryId,
						date: "2026-01-05",
						notes: "50%_off",
					}),
				)
			).json()) as { id: string }
		).id;
		await postTransaction(
			cookie,
			transactionBody({
				accountId,
				categoryId,
				date: "2026-01-06",
				notes: "50xoff",
			}),
		);

		// URLSearchParams percent-encodes `%` and `_` exactly like the app's
		// api-client, so the search text arrives as the literal characters.
		const fullNeedle = await listTransactions(
			cookie,
			`?${new URLSearchParams({ q: "50%_off" })}`,
		);
		expect(fullNeedle.total).toBe(1);
		expect(fullNeedle.transactions[0]?.id).toBe(discountId);

		// As a wildcard pattern "%50%%" would also match "50xoff"; the literal
		// `%` does not.
		const percentOnly = await listTransactions(
			cookie,
			`?${new URLSearchParams({ q: "50%" })}`,
		);
		expect(percentOnly.total).toBe(1);
		expect(percentOnly.transactions[0]?.id).toBe(discountId);

		// An underscore wildcard would turn "50_off" into "50?off" and match
		// "50xoff"; the literal underscore matches nothing here.
		const underscoreNeedle = await listTransactions(
			cookie,
			`?${new URLSearchParams({ q: "50_off" })}`,
		);
		expect(underscoreNeedle.total).toBe(0);
	});

	it("paginates stably when date and createdAt tie across rows", async () => {
		const session = await seedUserAndLogin();
		const cookie = cookieHeader({ [ACCESS_COOKIE]: session.access });
		const { accountId, categoryId } = await seedBaseline(cookie);

		// Identical date AND createdAt: ordering ties must fall through to the
		// unique trailing id so pages never repeat or skip a row.
		const tiedTimestamp = "2026-01-15T10:00:00.000Z";
		const insertedIds = new Set<string>();
		const db = getDb(env);
		for (const amountMinor of [111, 222, 333]) {
			const row = await createTransactionRepository(db).insert({
				id: uuidV7(),
				userId: session.userId,
				type: "expense",
				amountMinor,
				date: "2026-01-15",
				accountId,
				categoryId,
				notes: null,
				createdAt: tiedTimestamp,
				updatedAt: tiedTimestamp,
			});
			insertedIds.add(row.id);
		}

		const seenIds: string[] = [];
		for (const page of [1, 2, 3]) {
			const list = await listTransactions(cookie, `?page=${page}&pageSize=1`);
			expect(list.total).toBe(3);
			const id = list.transactions[0]?.id;
			if (!id) {
				throw new Error(`page ${page} returned no transaction`);
			}
			seenIds.push(id);
		}
		expect(new Set(seenIds).size).toBe(3);
		expect(new Set(seenIds)).toEqual(insertedIds);
	});
});

describe("GET /api/transactions/:id", () => {
	it("returns the transaction for its owner and 404 otherwise", async () => {
		const cookie = await freshCookie();
		const { accountId, categoryId } = await seedBaseline(cookie);
		const id = (
			(await (
				await postTransaction(
					cookie,
					transactionBody({ accountId, categoryId }),
				)
			).json()) as { id: string }
		).id;

		const found = await fetchApp(`${BASE}/${id}`, { headers: { cookie } });
		expect(found.status).toBe(200);

		const otherCookie = await freshCookie();
		expect(
			(await fetchApp(`${BASE}/${id}`, { headers: { cookie: otherCookie } }))
				.status,
		).toBe(404);
		expect(
			(await fetchApp(`${BASE}/no-such-id`, { headers: { cookie } })).status,
		).toBe(404);
	});
});

describe("PATCH /api/transactions/:id", () => {
	it("edits fields and validates the new references", async () => {
		const cookie = await freshCookie();
		const { accountId, categoryId } = await seedBaseline(cookie);
		const otherCategoryId = await createCategory(cookie, {
			name: "Salary",
			type: "income",
		});
		const id = (
			(await (
				await postTransaction(
					cookie,
					transactionBody({ accountId, categoryId }),
				)
			).json()) as { id: string }
		).id;

		const ok = await fetchApp(
			`${BASE}/${id}`,
			jsonResponseInit(
				"PATCH",
				{ amountMinor: 2500, notes: "edited", date: "2026-01-16" },
				cookie,
			),
		);
		expect(ok.status).toBe(200);
		await expect(ok.json()).resolves.toMatchObject({
			amountMinor: 2500,
			notes: "edited",
			date: "2026-01-16",
		});

		const wrongType = await fetchApp(
			`${BASE}/${id}`,
			jsonResponseInit("PATCH", { categoryId: otherCategoryId }, cookie),
		);
		expect(wrongType.status).toBe(409);
		await expect(wrongType.json()).resolves.toMatchObject({
			error: { code: "CATEGORY_INELIGIBLE" },
		});

		const invalid = await fetchApp(
			`${BASE}/${id}`,
			jsonResponseInit("PATCH", { amountMinor: 0 }, cookie),
		);
		expect(invalid.status).toBe(400);
	});

	it("rejects editing a non-active transaction", async () => {
		const cookie = await freshCookie();
		const { accountId, categoryId } = await seedBaseline(cookie);
		const id = (
			(await (
				await postTransaction(
					cookie,
					transactionBody({ accountId, categoryId }),
				)
			).json()) as { id: string }
		).id;
		await fetchApp(
			`${BASE}/${id}/archive`,
			jsonResponseInit("POST", undefined, cookie),
		);
		const res = await fetchApp(
			`${BASE}/${id}`,
			jsonResponseInit("PATCH", { amountMinor: 5 }, cookie),
		);
		expect(res.status).toBe(409);
		await expect(res.json()).resolves.toMatchObject({
			error: { code: "TRANSACTION_TRANSITION_INVALID" },
		});
	});
});

describe("restore validation and permanent deletion", () => {
	it("blocks restore on a deleted category and succeeds with reassignment", async () => {
		const cookie = await freshCookie();
		const { accountId, categoryId } = await seedBaseline(cookie);
		const id = (
			(await (
				await postTransaction(
					cookie,
					transactionBody({ accountId, categoryId }),
				)
			).json()) as { id: string }
		).id;
		await fetchApp(
			`${BASE}/${id}/delete`,
			jsonResponseInit("POST", undefined, cookie),
		);
		await fetchApp(
			`${CATEGORIES_URL}/${categoryId}/delete`,
			jsonResponseInit("POST", undefined, cookie),
		);

		const conflict = await fetchApp(
			`${BASE}/${id}/restore`,
			jsonResponseInit("POST", undefined, cookie),
		);
		expect(conflict.status).toBe(409);
		await expect(conflict.json()).resolves.toMatchObject({
			error: { code: "RESTORE_CONFLICT" },
		});

		const replacement = await createCategory(cookie, {
			name: "Food",
			type: "expense",
		});
		const reassigned = await fetchApp(
			`${BASE}/${id}/restore`,
			jsonResponseInit("POST", { categoryId: replacement }, cookie),
		);
		expect(reassigned.status).toBe(200);
		await expect(reassigned.json()).resolves.toMatchObject({
			categoryId: replacement,
			categoryName: "Food",
			status: "active",
		});
	});

	it("permanently deletes only trashed transactions", async () => {
		const cookie = await freshCookie();
		const { accountId, categoryId } = await seedBaseline(cookie);
		const activeId = (
			(await (
				await postTransaction(
					cookie,
					transactionBody({ accountId, categoryId }),
				)
			).json()) as { id: string }
		).id;
		expect(
			(
				await fetchApp(
					`${BASE}/${activeId}`,
					jsonResponseInit("DELETE", undefined, cookie),
				)
			).status,
		).toBe(409);

		await fetchApp(
			`${BASE}/${activeId}/delete`,
			jsonResponseInit("POST", undefined, cookie),
		);
		const destroyed = await fetchApp(
			`${BASE}/${activeId}`,
			jsonResponseInit("DELETE", undefined, cookie),
		);
		expect(destroyed.status).toBe(200);
		expect(
			(await fetchApp(`${BASE}/${activeId}`, { headers: { cookie } })).status,
		).toBe(404);
	});
});
