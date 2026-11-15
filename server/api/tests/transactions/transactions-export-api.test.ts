/// <reference types="@cloudflare/vitest-plugin/types" />
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { ACCESS_COOKIE } from "@/lib/session";
import { uuidV7 } from "@/lib/uuid";
import { createAccountRepository } from "@/repositories/account-repository";
import { createCategoryRepository } from "@/repositories/category-repository";
import {
	createTransactionRepository,
	type NewTransactionRow,
} from "@/repositories/transaction-repository";
import { isoNow } from "@/utils/datetime";
import { cookieHeader, fetchApp, seedUserAndLogin } from "../helpers";

const EXPORT_URL = "https://test.local/api/transactions/export";
const LIST_URL = "https://test.local/api/transactions";

const db = getDb(env);
const accounts = createAccountRepository(db);
const categories = createCategoryRepository(db);
const transactions = createTransactionRepository(db);

interface ExportChunkBody {
	transactions: Array<{
		id: string;
		date: string;
		createdAt: string;
		type: string;
		amountMinor: number;
		notes: string | null;
		status: string;
		accountName: string | null;
		categoryName: string | null;
	}>;
	nextCursor: string | null;
}

interface ListBody {
	transactions: Array<{ id: string }>;
}

let sequence = 0;
const nowIso = isoNow();

async function seedFixture(
	ownerId: string,
): Promise<{ accountId: string; otherAccountId: string; categoryId: string }> {
	const accountId = (
		await accounts.insert({
			id: uuidV7(),
			userId: ownerId,
			name: "HDFC Bank",
			type: "bank",
			openingBalanceMinor: 0,
			createdAt: nowIso,
			updatedAt: nowIso,
		})
	).id;
	const otherAccountId = (
		await accounts.insert({
			id: uuidV7(),
			userId: ownerId,
			name: "Wallet",
			type: "wallet",
			openingBalanceMinor: 0,
			createdAt: nowIso,
			updatedAt: nowIso,
		})
	).id;
	const categoryId = (
		await categories.insert({
			id: uuidV7(),
			userId: ownerId,
			name: "Groceries",
			type: "expense",
			color: null,
			icon: null,
			createdAt: nowIso,
			updatedAt: nowIso,
		})
	).id;
	return { accountId, otherAccountId, categoryId };
}

async function seedTransaction(
	ownerId: string,
	refs: { accountId: string; categoryId: string },
	overrides: Partial<NewTransactionRow> = {},
): Promise<{ id: string }> {
	sequence += 1;
	const row: NewTransactionRow = {
		id: uuidV7(),
		userId: ownerId,
		type: "expense",
		amountMinor: 1000,
		date: "2026-03-15",
		accountId: refs.accountId,
		categoryId: refs.categoryId,
		notes: `txn ${sequence}`,
		createdAt: `2026-03-01T00:00:00.${String(sequence).padStart(3, "0")}Z`,
		updatedAt: nowIso,
		...overrides,
	};
	await transactions.insert(row);
	return { id: row.id };
}

function exportRequest(
	cookie: string,
	query: Record<string, string> = {},
): Promise<Response> {
	const params = new URLSearchParams(query);
	const suffix = params.size > 0 ? `?${params}` : "";
	return fetchApp(`${EXPORT_URL}${suffix}`, { headers: { cookie } });
}

beforeEach(async () => {
	await env.finance_application.exec(
		"DELETE FROM transactions; DELETE FROM categories; DELETE FROM accounts; DELETE FROM refresh_tokens; DELETE FROM users;",
	);
	sequence = 0;
});

describe("GET /api/transactions/export", () => {
	it("rejects unauthenticated requests", async () => {
		expect((await fetchApp(EXPORT_URL)).status).toBe(401);
		expect(
			(
				await fetchApp(EXPORT_URL, {
					headers: { cookie: cookieHeader({ [ACCESS_COOKIE]: "invalid" }) },
				})
			).status,
		).toBe(401);
	});

	it("validates the query and names the failing field", async () => {
		const session = await seedUserAndLogin();
		const cookie = cookieHeader({ [ACCESS_COOKIE]: session.access });

		const tooSmall = await exportRequest(cookie, { limit: "99" });
		expect(tooSmall.status).toBe(400);
		expect(JSON.stringify(await tooSmall.json())).toContain("limit");

		const tooLarge = await exportRequest(cookie, { limit: "2001" });
		expect(tooLarge.status).toBe(400);
		expect(JSON.stringify(await tooLarge.json())).toContain("limit");

		const badCursor = await exportRequest(cookie, {
			cursor: "not-a-uuid",
		});
		expect(badCursor.status).toBe(400);
		expect(JSON.stringify(await badCursor.json())).toContain("cursor");

		const v4Cursor = await exportRequest(cookie, {
			cursor: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
		});
		expect(v4Cursor.status).toBe(400);
	});

	it("404s a cursor that is not one of the user's transactions", async () => {
		const session = await seedUserAndLogin();
		const cookie = cookieHeader({ [ACCESS_COOKIE]: session.access });
		const refs = await seedFixture(session.userId);
		await seedTransaction(session.userId, refs);

		const foreign = await seedUserAndLogin();
		const foreignRefs = await seedFixture(foreign.userId);
		const foreignTxn = await seedTransaction(foreign.userId, foreignRefs);

		const missing = await exportRequest(cookie, {
			cursor: uuidV7(),
		});
		expect(missing.status).toBe(404);

		// Another user's transaction id is indistinguishable from a missing one.
		const notOwned = await exportRequest(cookie, { cursor: foreignTxn.id });
		expect(notOwned.status).toBe(404);
	});

	it("returns slim raw rows with resolved names", async () => {
		const session = await seedUserAndLogin();
		const cookie = cookieHeader({ [ACCESS_COOKIE]: session.access });
		const refs = await seedFixture(session.userId);
		await seedTransaction(session.userId, refs, {
			type: "income",
			amountMinor: 125050,
			notes: "salary",
		});

		const res = await exportRequest(cookie);
		expect(res.status).toBe(200);
		const body = (await res.json()) as ExportChunkBody;
		expect(body.transactions).toHaveLength(1);
		const row = body.transactions[0];
		expect(row).toEqual({
			id: row?.id,
			date: "2026-03-15",
			createdAt: row?.createdAt,
			type: "income",
			amountMinor: 125050,
			notes: "salary",
			status: "active",
			accountName: "HDFC Bank",
			categoryName: "Groceries",
		});
		expect(body.nextCursor).toBeNull();
	});

	it("matches the filtered list endpoint for the same filters", async () => {
		const session = await seedUserAndLogin();
		const cookie = cookieHeader({ [ACCESS_COOKIE]: session.access });
		const refs = await seedFixture(session.userId);
		await seedTransaction(session.userId, refs, {
			type: "expense",
			amountMinor: 1000,
			date: "2026-03-10",
		});
		await seedTransaction(session.userId, refs, {
			type: "income",
			amountMinor: 5000,
			date: "2026-03-20",
			accountId: refs.otherAccountId,
		});
		await seedTransaction(session.userId, refs, {
			type: "expense",
			amountMinor: 2000,
			date: "2026-04-01",
			notes: "outside range",
		});

		const query = {
			type: "expense",
			accountId: refs.accountId,
			from: "2026-03-01",
			to: "2026-03-31",
		};
		const listRes = await fetchApp(
			`${LIST_URL}?${new URLSearchParams(query)}`,
			{ headers: { cookie } },
		);
		expect(listRes.status).toBe(200);
		const listed = (await listRes.json()) as ListBody;

		const exportRes = await exportRequest(cookie, query);
		expect(exportRes.status).toBe(200);
		const exported = (await exportRes.json()) as ExportChunkBody;

		expect(exported.transactions.map((row) => row.id)).toEqual(
			listed.transactions.map((row) => row.id),
		);
	});

	it("walks every row exactly once and exhausts with a null cursor", async () => {
		const session = await seedUserAndLogin();
		const cookie = cookieHeader({ [ACCESS_COOKIE]: session.access });
		const refs = await seedFixture(session.userId);
		// 200 rows = exactly two full chunks at the 100 minimum, so the walk
		// must end with the third request returning zero rows and a null
		// cursor — the exhaustion protocol for an exact-multiple total.
		for (let i = 0; i < 200; i += 1) {
			await seedTransaction(session.userId, refs, {
				date: `2026-${String(1 + (i % 3)).padStart(2, "0")}-${String(
					1 + Math.floor(i / 3),
				).padStart(2, "0")}`,
			});
		}

		const listed = (await (
			await fetchApp(`${LIST_URL}?pageSize=100&page=1`, {
				headers: { cookie },
			})
		).json()) as ListBody;
		const allIds = new Set<string>();

		let cursor: string | undefined;
		let requests = 0;
		for (;;) {
			requests += 1;
			const res = await exportRequest(
				cookie,
				cursor ? { cursor, limit: "100" } : { limit: "100" },
			);
			expect(res.status).toBe(200);
			const chunk = (await res.json()) as ExportChunkBody;
			for (const row of chunk.transactions) {
				allIds.add(row.id);
			}
			if (chunk.nextCursor === null) {
				expect(chunk.transactions.length).toBeLessThan(100);
				break;
			}
			cursor = chunk.nextCursor;
			expect(requests).toBeLessThan(10);
		}
		// Chunks of 100 + 100, then the empty exhaustion request.
		expect(requests).toBe(3);
		expect(allIds.size).toBe(200);
		// Every listed row was exported, and nothing extra appeared.
		for (const row of listed.transactions) {
			expect(allIds.has(row.id)).toBe(true);
		}
	});

	it("signals exhaustion on a short final chunk without an extra request", async () => {
		const session = await seedUserAndLogin();
		const cookie = cookieHeader({ [ACCESS_COOKIE]: session.access });
		const refs = await seedFixture(session.userId);
		// 105 rows at limit 100: one full chunk, then a short tail whose
		// null cursor ends the walk immediately.
		for (let i = 0; i < 105; i += 1) {
			await seedTransaction(session.userId, refs, {
				date: `2026-${String(1 + (i % 3)).padStart(2, "0")}-${String(
					1 + Math.floor(i / 3),
				).padStart(2, "0")}`,
			});
		}

		let cursor: string | undefined;
		let requests = 0;
		let total = 0;
		for (;;) {
			requests += 1;
			const res = await exportRequest(
				cookie,
				cursor ? { cursor, limit: "100" } : { limit: "100" },
			);
			const chunk = (await res.json()) as ExportChunkBody;
			total += chunk.transactions.length;
			if (chunk.nextCursor === null) {
				break;
			}
			cursor = chunk.nextCursor;
			expect(requests).toBeLessThan(10);
		}
		expect(requests).toBe(2);
		expect(total).toBe(105);
	});
});
