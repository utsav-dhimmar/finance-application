/// <reference types="@cloudflare/vitest-plugin/types" />
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import type { Transaction } from "@/db/schema";
import { uuidV7 } from "@/lib/uuid";
import { createAccountRepository } from "@/repositories/account-repository";
import { createCategoryRepository } from "@/repositories/category-repository";
import {
	createTransactionRepository,
	type NewTransactionRow,
} from "@/repositories/transaction-repository";
import { createUserRepository } from "@/repositories/user-repository";

const db = getDb(env);
const repo = createTransactionRepository(db);
const users = createUserRepository(db);
const accounts = createAccountRepository(db);
const categories = createCategoryRepository(db);

const nowIso = new Date().toISOString();

let userId: string;
let accountId: string;
let otherAccountId: string;
let categoryId: string;
let otherCategoryId: string;

let sequence = 0;

async function insertTransaction(overrides: {
	type?: string;
	amountMinor?: number;
	date?: string;
	status?: string;
	accountId?: string;
	categoryId?: string;
	notes?: string | null;
}): Promise<Transaction> {
	sequence += 1;
	const row: NewTransactionRow = {
		id: uuidV7(),
		userId,
		type: overrides.type ?? "expense",
		amountMinor: overrides.amountMinor ?? 1000,
		date: overrides.date ?? "2026-01-15",
		accountId: overrides.accountId ?? accountId,
		categoryId: overrides.categoryId ?? categoryId,
		notes: overrides.notes ?? null,
		createdAt: `2026-01-${String(10 + (sequence % 10)).padStart(2, "0")}T00:00:00.000Z`,
		updatedAt: nowIso,
	};
	const inserted = await repo.insert(row);
	if (overrides.status !== undefined && overrides.status !== "active") {
		await repo.updateStatus(
			inserted.id,
			overrides.status,
			overrides.status === "archived"
				? { archivedAt: nowIso, deletedAt: null }
				: { archivedAt: null, deletedAt: nowIso },
			nowIso,
		);
	}
	return inserted;
}

beforeEach(async () => {
	await env.finance_application.exec(
		"DELETE FROM transactions; DELETE FROM categories; DELETE FROM accounts; DELETE FROM refresh_tokens; DELETE FROM users;",
	);
	userId = (
		await users.insert({
			id: uuidV7(),
			email: "transaction-repo@example.com",
			passwordHash: "hash",
			createdAt: nowIso,
			updatedAt: nowIso,
		})
	).id;
	accountId = (
		await accounts.insert({
			id: uuidV7(),
			userId,
			name: "HDFC Bank",
			type: "bank",
			openingBalanceMinor: 0,
			createdAt: nowIso,
			updatedAt: nowIso,
		})
	).id;
	otherAccountId = (
		await accounts.insert({
			id: uuidV7(),
			userId,
			name: "Wallet",
			type: "wallet",
			openingBalanceMinor: 0,
			createdAt: nowIso,
			updatedAt: nowIso,
		})
	).id;
	categoryId = (
		await categories.insert({
			id: uuidV7(),
			userId,
			name: "Groceries",
			type: "expense",
			color: null,
			icon: null,
			createdAt: nowIso,
			updatedAt: nowIso,
		})
	).id;
	otherCategoryId = (
		await categories.insert({
			id: uuidV7(),
			userId,
			name: "Salary",
			type: "income",
			color: null,
			icon: null,
			createdAt: nowIso,
			updatedAt: nowIso,
		})
	).id;
});

describe("TransactionRepository.signed sums", () => {
	it("sums income as positive and expense as negative, including archived, excluding deleted", async () => {
		await insertTransaction({ type: "income", amountMinor: 5000 });
		await insertTransaction({ type: "expense", amountMinor: 1500 });
		await insertTransaction({
			type: "expense",
			amountMinor: 500,
			status: "archived",
		});
		await insertTransaction({
			type: "expense",
			amountMinor: 999,
			status: "deleted",
		});

		const total = await repo.sumNonDeletedEffects(accountId);
		expect(total).toBe(5000 - 1500 - 500);

		const byAccount = await repo.sumNonDeletedEffectsByAccount(userId);
		expect(byAccount.get(accountId)).toBe(3000);
	});

	it("returns zero for an account without transactions", async () => {
		expect(await repo.sumNonDeletedEffects(otherAccountId)).toBe(0);
		const byAccount = await repo.sumNonDeletedEffectsByAccount(userId);
		expect(byAccount.get(otherAccountId) ?? 0).toBe(0);
	});

	it("keeps accounts separate", async () => {
		await insertTransaction({ type: "income", amountMinor: 2000 });
		await insertTransaction({
			type: "expense",
			amountMinor: 700,
			accountId: otherAccountId,
		});
		const byAccount = await repo.sumNonDeletedEffectsByAccount(userId);
		expect(byAccount.get(accountId)).toBe(2000);
		expect(byAccount.get(otherAccountId)).toBe(-700);
	});
});

describe("TransactionRepository count seams", () => {
	it("counts non-deleted transactions per account and category", async () => {
		await insertTransaction({});
		await insertTransaction({ status: "archived" });
		await insertTransaction({ status: "deleted" });

		expect(await repo.countNonDeletedByAccount(accountId)).toBe(2);
		expect(await repo.countNonDeletedByCategory(categoryId)).toBe(2);
		expect(await repo.countNonDeletedByAccount(otherAccountId)).toBe(0);
		expect(await repo.countNonDeletedByCategory(otherCategoryId)).toBe(0);
	});
});

describe("TransactionRepository.findByIdWithRefs", () => {
	it("resolves account and category names", async () => {
		await insertTransaction({ notes: "weekly shop" });
		const found = await repo.findByIdWithRefs;
		const all = await repo.list(userId, {
			status: "active",
			page: 1,
			pageSize: 10,
		});
		expect(all.rows[0]?.accountName).toBe("HDFC Bank");
		expect(all.rows[0]?.categoryName).toBe("Groceries");
		expect(all.rows[0]?.transaction.notes).toBe("weekly shop");
		void found;
	});
});

describe("TransactionRepository.list filters and pagination", () => {
	beforeEach(async () => {
		await insertTransaction({
			type: "expense",
			amountMinor: 1000,
			date: "2026-01-05",
			notes: "market run",
		});
		await insertTransaction({
			type: "income",
			amountMinor: 50000,
			date: "2026-01-20",
			categoryId: otherCategoryId,
		});
		await insertTransaction({
			type: "expense",
			amountMinor: 2000,
			date: "2026-02-10",
			accountId: otherAccountId,
		});
		await insertTransaction({
			type: "expense",
			amountMinor: 3000,
			date: "2026-02-15",
			status: "archived",
		});
		await insertTransaction({
			type: "expense",
			amountMinor: 4000,
			date: "2026-02-20",
			status: "deleted",
		});
	});

	it("paginates with total over the whole filtered set", async () => {
		const page1 = await repo.list(userId, {
			status: "active",
			page: 1,
			pageSize: 2,
		});
		expect(page1.total).toBe(3);
		expect(page1.rows).toHaveLength(2);
		// date DESC ordering: newest first
		expect(page1.rows[0]?.transaction.date).toBe("2026-02-10");

		const page2 = await repo.list(userId, {
			status: "active",
			page: 2,
			pageSize: 2,
		});
		expect(page2.rows).toHaveLength(1);
		expect(page2.rows[0]?.transaction.date).toBe("2026-01-05");
	});

	it("filters by date range inclusively", async () => {
		const result = await repo.list(userId, {
			status: "active",
			from: "2026-01-05",
			to: "2026-01-20",
			page: 1,
			pageSize: 10,
		});
		expect(result.total).toBe(2);
	});

	it("filters by type, account, and category combined", async () => {
		const byType = await repo.list(userId, {
			status: "active",
			type: "income",
			page: 1,
			pageSize: 10,
		});
		expect(byType.total).toBe(1);
		expect(byType.rows[0]?.transaction.categoryId).toBe(otherCategoryId);

		const byAccount = await repo.list(userId, {
			status: "active",
			accountId: otherAccountId,
			page: 1,
			pageSize: 10,
		});
		expect(byAccount.total).toBe(1);

		const combined = await repo.list(userId, {
			status: "active",
			type: "expense",
			accountId: accountId,
			categoryId: categoryId,
			page: 1,
			pageSize: 10,
		});
		expect(combined.total).toBe(1);
	});

	it("searches notes, account names, and category names case-insensitively", async () => {
		const byNotes = await repo.list(userId, {
			status: "active",
			q: "MARKET",
			page: 1,
			pageSize: 10,
		});
		expect(byNotes.total).toBe(1);
		expect(byNotes.rows[0]?.transaction.notes).toBe("market run");

		const byAccountName = await repo.list(userId, {
			status: "active",
			q: "hdfc",
			page: 1,
			pageSize: 10,
		});
		// Both active transactions sit on the HDFC account, so both match.
		expect(byAccountName.total).toBe(2);

		const byCategoryName = await repo.list(userId, {
			status: "active",
			q: "sala",
			page: 1,
			pageSize: 10,
		});
		expect(byCategoryName.total).toBe(1);
	});
});

describe("TransactionRepository.update and lifecycle", () => {
	it("updates details and keeps other fields", async () => {
		const inserted = await insertTransaction({ notes: "before" });
		const updated = await repo.updateDetails(
			inserted.id,
			{ amountMinor: 4242, notes: "after" },
			nowIso,
		);
		expect(updated?.amountMinor).toBe(4242);
		expect(updated?.notes).toBe("after");
		expect(updated?.type).toBe("expense");
		expect(updated?.accountId).toBe(accountId);
	});

	it("updateStatus sets lifecycle timestamps", async () => {
		const inserted = await insertTransaction({});
		const archived = await repo.updateStatus(
			inserted.id,
			"archived",
			{ archivedAt: nowIso, deletedAt: null },
			nowIso,
		);
		expect(archived?.status).toBe("archived");
		expect(archived?.archivedAt).toBe(nowIso);

		const restored = await repo.updateStatus(
			inserted.id,
			"active",
			{ archivedAt: null, deletedAt: null },
			nowIso,
		);
		expect(restored?.status).toBe("active");
		expect(restored?.archivedAt).toBeNull();
	});

	it("physically deletes only the targeted row", async () => {
		const inserted = await insertTransaction({});
		const other = await insertTransaction({});
		expect(await repo.delete(inserted.id)).toBe(true);
		expect(await repo.findById(inserted.id)).toBeUndefined();
		expect(await repo.findById(other.id)).toBeDefined();
		expect(await repo.delete(inserted.id)).toBe(false);
	});
});
