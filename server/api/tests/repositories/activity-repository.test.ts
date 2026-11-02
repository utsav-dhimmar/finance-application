/// <reference types="@cloudflare/vitest-plugin/types" />
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { uuidV7 } from "@/lib/uuid";
import { createAccountRepository } from "@/repositories/account-repository";
import { createActivityRepository } from "@/repositories/activity-repository";
import { createCategoryRepository } from "@/repositories/category-repository";
import { createTransactionRepository } from "@/repositories/transaction-repository";
import { createTransferRepository } from "@/repositories/transfer-repository";
import { createUserRepository } from "@/repositories/user-repository";

const db = getDb(env);
const activity = createActivityRepository(db);
const users = createUserRepository(db);
const accounts = createAccountRepository(db);
const categories = createCategoryRepository(db);
const transactions = createTransactionRepository(db);
const transfers = createTransferRepository(db);

const nowIso = new Date().toISOString();

let userId: string;
let bankAccountId: string;
let walletAccountId: string;

let categorySequence = 0;

async function seedTransaction(input: {
	type: string;
	amountMinor: number;
	date: string;
	accountId?: string;
	categoryId?: string;
	notes?: string | null;
	status?: string;
}): Promise<void> {
	categorySequence += 1;
	const inserted = await transactions.insert({
		id: uuidV7(),
		userId,
		type: input.type,
		amountMinor: input.amountMinor,
		date: input.date,
		accountId: input.accountId ?? bankAccountId,
		categoryId:
			input.categoryId ??
			(
				await categories.insert({
					id: uuidV7(),
					userId,
					name: `Category ${categorySequence}`,
					type: input.type,
					color: null,
					icon: null,
					createdAt: nowIso,
					updatedAt: nowIso,
				})
			).id,
		notes: input.notes ?? null,
		createdAt: `2026-01-01T00:00:0${Math.floor(Math.random() * 9)}.000Z`,
		updatedAt: nowIso,
	});
	if (input.status !== undefined && input.status !== "active") {
		await transactions.updateStatus(
			inserted.id,
			input.status,
			input.status === "archived"
				? { archivedAt: nowIso, deletedAt: null }
				: { archivedAt: null, deletedAt: nowIso },
			nowIso,
		);
	}
}

async function seedTransfer(input: {
	sourceAccountId?: string;
	destinationAccountId?: string;
	amountMinor: number;
	date: string;
	notes?: string | null;
	status?: string;
}): Promise<void> {
	const inserted = await transfers.insert({
		id: uuidV7(),
		userId,
		sourceAccountId: input.sourceAccountId ?? bankAccountId,
		destinationAccountId: input.destinationAccountId ?? walletAccountId,
		amountMinor: input.amountMinor,
		date: input.date,
		notes: input.notes ?? null,
		createdAt: `2026-01-01T00:00:0${Math.floor(Math.random() * 9)}.000Z`,
		updatedAt: nowIso,
	});
	if (input.status !== undefined && input.status !== "active") {
		await transfers.updateStatus(
			inserted.id,
			input.status,
			input.status === "archived"
				? { archivedAt: nowIso, deletedAt: null }
				: { archivedAt: null, deletedAt: nowIso },
			nowIso,
		);
	}
}

beforeEach(async () => {
	await env.finance_application.exec(
		"DELETE FROM transfers; DELETE FROM transactions; DELETE FROM categories; DELETE FROM accounts; DELETE FROM refresh_tokens; DELETE FROM users;",
	);
	userId = (
		await users.insert({
			id: uuidV7(),
			email: "activity@example.com",
			passwordHash: "hash",
			createdAt: nowIso,
			updatedAt: nowIso,
		})
	).id;
	bankAccountId = (
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
	walletAccountId = (
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
});

describe("ActivityRepository legs and direction", () => {
	it("shows a transfer in both accounts' histories with the correct direction", async () => {
		await seedTransfer({ amountMinor: 5000, date: "2026-01-15" });

		const bankHistory = await activity.list(userId, {
			status: "active",
			accountId: bankAccountId,
			page: 1,
			pageSize: 10,
		});
		expect(bankHistory.total).toBe(1);
		const bankRow = bankHistory.rows[0];
		expect(bankRow?.kind).toBe("transfer");
		expect(bankRow?.direction).toBe("out");
		expect(bankRow?.amountMinor).toBe(-5000);
		expect(bankRow?.accountId).toBe(bankAccountId);
		expect(bankRow?.counterpartyAccountId).toBe(walletAccountId);
		expect(bankRow?.counterpartyAccountName).toBe("Wallet");

		const walletHistory = await activity.list(userId, {
			status: "active",
			accountId: walletAccountId,
			page: 1,
			pageSize: 10,
		});
		expect(walletHistory.total).toBe(1);
		const walletRow = walletHistory.rows[0];
		expect(walletRow?.direction).toBe("in");
		expect(walletRow?.amountMinor).toBe(5000);
		expect(walletRow?.counterpartyAccountName).toBe("HDFC Bank");
	});

	it("interleaves transactions and transfers by date with signed amounts", async () => {
		await seedTransaction({
			type: "income",
			amountMinor: 50000,
			date: "2026-01-10",
		});
		await seedTransfer({ amountMinor: 3000, date: "2026-01-15" });
		await seedTransaction({
			type: "expense",
			amountMinor: 1200,
			date: "2026-01-20",
		});

		const history = await activity.list(userId, {
			status: "active",
			accountId: bankAccountId,
			page: 1,
			pageSize: 10,
		});
		expect(history.total).toBe(3);
		expect(history.rows.map((row) => row.date)).toEqual([
			"2026-01-20",
			"2026-01-15",
			"2026-01-10",
		]);
		const amounts = history.rows.map((row) => row.amountMinor);
		expect(amounts).toEqual([-1200, -3000, 50000]);
		// Transactions carry their type and category; transfers do not.
		const transferRow = history.rows[1];
		expect(transferRow?.type).toBeNull();
		expect(transferRow?.categoryId).toBeNull();
		const transactionRow = history.rows[2];
		expect(transactionRow?.type).toBe("income");
		expect(transactionRow?.direction).toBeNull();
		expect(transactionRow?.categoryName).not.toBeNull();
	});

	it("excludes transfers from category filters", async () => {
		const category = await categories.insert({
			id: uuidV7(),
			userId,
			name: "Groceries",
			type: "expense",
			color: null,
			icon: null,
			createdAt: nowIso,
			updatedAt: nowIso,
		});
		await seedTransaction({
			type: "expense",
			amountMinor: 900,
			date: "2026-01-05",
			categoryId: category.id,
		});
		await seedTransfer({ amountMinor: 4000, date: "2026-01-06" });

		const filtered = await activity.list(userId, {
			status: "active",
			accountId: bankAccountId,
			categoryId: category.id,
			page: 1,
			pageSize: 10,
		});
		expect(filtered.total).toBe(1);
		expect(filtered.rows[0]?.kind).toBe("transaction");
	});

	it("supports the transfer-only type filter", async () => {
		await seedTransaction({
			type: "expense",
			amountMinor: 900,
			date: "2026-01-05",
		});
		await seedTransfer({ amountMinor: 4000, date: "2026-01-06" });

		const onlyTransfers = await activity.list(userId, {
			status: "active",
			accountId: bankAccountId,
			type: "transfer",
			page: 1,
			pageSize: 10,
		});
		expect(onlyTransfers.total).toBe(1);
		expect(onlyTransfers.rows[0]?.kind).toBe("transfer");

		const onlyExpenses = await activity.list(userId, {
			status: "active",
			accountId: bankAccountId,
			type: "expense",
			page: 1,
			pageSize: 10,
		});
		expect(onlyExpenses.total).toBe(1);
		expect(onlyExpenses.rows[0]?.kind).toBe("transaction");
	});

	it("follows lifecycle status on both legs", async () => {
		await seedTransfer({ amountMinor: 4000, date: "2026-01-06" });
		await seedTransfer({
			amountMinor: 2000,
			date: "2026-01-07",
			status: "archived",
		});
		await seedTransfer({
			amountMinor: 1000,
			date: "2026-01-08",
			status: "deleted",
		});

		const active = await activity.list(userId, {
			status: "active",
			accountId: bankAccountId,
			page: 1,
			pageSize: 10,
		});
		expect(active.total).toBe(1);

		const archived = await activity.list(userId, {
			status: "archived",
			accountId: bankAccountId,
			page: 1,
			pageSize: 10,
		});
		expect(archived.total).toBe(1);
	});
});

describe("ActivityRepository pagination", () => {
	it("paginates stably over mixed fixtures with a merged total", async () => {
		// 3 transactions + 2 transfers → bank account sees 3 + 2 = 5 rows.
		await seedTransaction({
			type: "income",
			amountMinor: 100,
			date: "2026-01-01",
		});
		await seedTransaction({
			type: "expense",
			amountMinor: 200,
			date: "2026-01-02",
		});
		await seedTransaction({
			type: "expense",
			amountMinor: 300,
			date: "2026-01-03",
		});
		await seedTransfer({ amountMinor: 400, date: "2026-01-04" });
		await seedTransfer({
			sourceAccountId: walletAccountId,
			destinationAccountId: bankAccountId,
			amountMinor: 500,
			date: "2026-01-05",
		});

		const page1 = await activity.list(userId, {
			status: "active",
			accountId: bankAccountId,
			page: 1,
			pageSize: 2,
		});
		expect(page1.total).toBe(5);
		expect(page1.rows).toHaveLength(2);
		expect(page1.rows.map((row) => row.date)).toEqual([
			"2026-01-05",
			"2026-01-04",
		]);

		const page3 = await activity.list(userId, {
			status: "active",
			accountId: bankAccountId,
			page: 3,
			pageSize: 2,
		});
		expect(page3.rows).toHaveLength(1);
		expect(page3.rows[0]?.date).toBe("2026-01-01");
	});

	it("searches notes and account names across both kinds", async () => {
		await seedTransaction({
			type: "expense",
			amountMinor: 900,
			date: "2026-01-05",
			notes: "market run",
		});
		await seedTransfer({
			amountMinor: 4000,
			date: "2026-01-06",
			notes: "atm withdrawal",
		});

		const byNotes = await activity.list(userId, {
			status: "active",
			accountId: bankAccountId,
			q: "ATM",
			page: 1,
			pageSize: 10,
		});
		expect(byNotes.total).toBe(1);
		expect(byNotes.rows[0]?.kind).toBe("transfer");

		const byAccountName = await activity.list(userId, {
			status: "active",
			accountId: bankAccountId,
			q: "WALLET",
			page: 1,
			pageSize: 10,
		});
		expect(byAccountName.total).toBe(1);
		expect(byAccountName.rows[0]?.kind).toBe("transfer");
	});
});
