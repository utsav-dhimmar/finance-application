import { describe, expect, it, vi } from "vitest";
import type { Account, Category, RecurringExpense, Transaction } from "@/db/schema";
import type {
	NewRecurringExpenseRow,
	RecurringExpensePatch,
} from "@/repositories/recurring-expense-repository";
import type { NewTransactionRow } from "@/repositories/transaction-repository";
import {
	createRecurringExpenseService,
	type RecurringExpenseServiceDeps,
} from "@/services/recurring-expense-service";

const UUID_V7_1 = "018f6a2c-9b7d-7ce2-8f3a-1d4e5f6a7b8c";
const UUID_V7_2 = "018f6a2c-9b7d-7ce2-8f3a-1d4e5f6a7b8d";

function createFakes() {
	const recurringRows = new Map<string, RecurringExpense>();
	const accountRows = new Map<string, Account>();
	const categoryRows = new Map<string, Category>();
	const txnRows = new Map<string, Transaction>();

	const accounts = {
		findById: vi.fn(async (id: string) => accountRows.get(id)),
	};

	const categories = {
		findById: vi.fn(async (id: string) => categoryRows.get(id)),
	};

	const recurringExpenses = {
		insert: vi.fn(async (input: NewRecurringExpenseRow) => {
			const row: RecurringExpense = {
				...input,
				status: input.status ?? "active",
			};
			recurringRows.set(row.id, row);
			return row;
		}),
		findById: vi.fn(async (id: string) => recurringRows.get(id)),
		findByIdWithRefs: vi.fn(async (id: string) => {
			const rec = recurringRows.get(id);
			if (!rec) return undefined;
			return {
				recurringExpense: rec,
				accountName: accountRows.get(rec.sourceAccountId)?.name ?? "Account",
				categoryName: categoryRows.get(rec.categoryId)?.name ?? "Category",
			};
		}),
		list: vi.fn(
			async (
				userId: string,
				filters?: {
					status?: string;
					sourceAccountId?: string;
					categoryId?: string;
				},
			) => {
			let matches = [...recurringRows.values()].filter((r) => r.userId === userId);
			if (filters?.status) {
				matches = matches.filter((r) => r.status === filters.status);
			}
			return matches.map((rec) => ({
				recurringExpense: rec,
				accountName: accountRows.get(rec.sourceAccountId)?.name ?? "Account",
				categoryName: categoryRows.get(rec.categoryId)?.name ?? "Category",
			}));
		}),
		findDue: vi.fn(async (userId: string, cutoff: string) => {
			const matches = [...recurringRows.values()].filter(
				(r) => r.userId === userId && r.status === "active" && r.nextDueDate <= cutoff,
			);
			return matches.map((rec) => ({
				recurringExpense: rec,
				accountName: accountRows.get(rec.sourceAccountId)?.name ?? "Account",
				categoryName: categoryRows.get(rec.categoryId)?.name ?? "Category",
			}));
		}),
		update: vi.fn(
			async (id: string, patch: RecurringExpensePatch, updatedAt: string) => {
			const existing = recurringRows.get(id);
			if (!existing) return undefined;
			const updated = { ...existing, ...patch, updatedAt };
			recurringRows.set(id, updated);
			return updated;
		}),
		delete: vi.fn(async (id: string) => recurringRows.delete(id)),
	};

	const transactions = {
		findById: vi.fn(async (id: string) => txnRows.get(id)),
		findByIdWithRefs: vi.fn(async (id: string) => {
			const txn = txnRows.get(id);
			if (!txn) return undefined;
			return {
				transaction: txn,
				accountName: accountRows.get(txn.accountId)?.name ?? "Account",
				categoryName: categoryRows.get(txn.categoryId)?.name ?? "Category",
			};
		}),
		insert: vi.fn(async (input: NewTransactionRow) => {
			const row: Transaction = {
				...input,
				recurringExpenseId: input.recurringExpenseId ?? null,
				status: "active",
				archivedAt: null,
				deletedAt: null,
			};
			txnRows.set(row.id, row);
			return row;
		}),
	};

	function seedAccount(acc: Partial<Account> & { id: string }) {
		accountRows.set(acc.id, {
			userId: "user-1",
			name: acc.id,
			nameNormalized: acc.id.toLowerCase(),
			type: "bank",
			openingBalanceMinor: 0,
			status: "active",
			archivedAt: null,
			deletedAt: null,
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-01T00:00:00.000Z",
			...acc,
		});
	}

	function seedCategory(cat: Partial<Category> & { id: string }) {
		categoryRows.set(cat.id, {
			userId: "user-1",
			name: cat.id,
			nameNormalized: cat.id.toLowerCase(),
			type: "expense",
			color: null,
			icon: null,
			status: "active",
			archivedAt: null,
			deletedAt: null,
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-01T00:00:00.000Z",
			...cat,
		});
	}

	return {
		deps: {
			recurringExpenses,
			accounts,
			categories,
			transactions,
		} as unknown as RecurringExpenseServiceDeps,
		seedAccount,
		seedCategory,
		recurringRows,
		txnRows,
	};
}

describe("recurringExpenseService", () => {
	it("creates an active recurring expense rule and initializes nextDueDate", async () => {
		const { deps, seedAccount, seedCategory } = createFakes();
		seedAccount({ id: "acc-1" });
		seedCategory({ id: "cat-1", type: "expense" });

		const service = createRecurringExpenseService(deps);
		const result = await service.create({
			userId: "user-1",
			id: UUID_V7_1,
			name: "Broadband",
			amountMinor: 99900,
			intervalMonths: 1,
			sourceAccountId: "acc-1",
			categoryId: "cat-1",
			startDate: "2026-01-10",
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.name).toBe("Broadband");
			expect(result.value.status).toBe("active");
			expect(result.value.nextDueDate).toBe("2026-01-10");
			expect(result.replayed).toBe(false);
		}
	});

	it("rejects creation when source account is inactive or not found", async () => {
		const { deps, seedAccount, seedCategory } = createFakes();
		seedAccount({ id: "acc-1", status: "archived" });
		seedCategory({ id: "cat-1", type: "expense" });

		const service = createRecurringExpenseService(deps);
		const result = await service.create({
			userId: "user-1",
			id: UUID_V7_1,
			name: "Broadband",
			amountMinor: 99900,
			intervalMonths: 1,
			sourceAccountId: "acc-1",
			categoryId: "cat-1",
			startDate: "2026-01-10",
		});

		expect(result).toEqual({ ok: false, code: "ACCOUNT_INELIGIBLE" });
	});

	it("rejects creation when category is income type", async () => {
		const { deps, seedAccount, seedCategory } = createFakes();
		seedAccount({ id: "acc-1" });
		seedCategory({ id: "cat-1", type: "income" });

		const service = createRecurringExpenseService(deps);
		const result = await service.create({
			userId: "user-1",
			id: UUID_V7_1,
			name: "Broadband",
			amountMinor: 99900,
			intervalMonths: 1,
			sourceAccountId: "acc-1",
			categoryId: "cat-1",
			startDate: "2026-01-10",
		});

		expect(result).toEqual({ ok: false, code: "CATEGORY_INELIGIBLE" });
	});

	it("findDue returns rules due on or before cutoff date with overdue indicator", async () => {
		const { deps, seedAccount, seedCategory } = createFakes();
		seedAccount({ id: "acc-1" });
		seedCategory({ id: "cat-1" });

		const service = createRecurringExpenseService(deps);
		await service.create({
			userId: "user-1",
			id: UUID_V7_1,
			name: "Gym",
			amountMinor: 200000,
			intervalMonths: 1,
			sourceAccountId: "acc-1",
			categoryId: "cat-1",
			startDate: "2026-01-01",
		});

		const due = await service.findDue("user-1", "2026-01-05");
		expect(due).toHaveLength(1);
		expect(due[0]?.name).toBe("Gym");
		expect(due[0]?.isOverdue).toBe(true);

		const noneDue = await service.findDue("user-1", "2025-12-31");
		expect(noneDue).toHaveLength(0);
	});

	it("updates cadence interval and recalculates future nextDueDate without altering past transactions", async () => {
		const { deps, seedAccount, seedCategory } = createFakes();
		seedAccount({ id: "acc-1" });
		seedCategory({ id: "cat-1" });

		const service = createRecurringExpenseService(deps);
		await service.create({
			userId: "user-1",
			id: UUID_V7_1,
			name: "Gym",
			amountMinor: 200000,
			intervalMonths: 1,
			sourceAccountId: "acc-1",
			categoryId: "cat-1",
			startDate: "2026-01-01",
			lastPostedDate: "2026-01-01",
		});

		const updated = await service.update({
			userId: "user-1",
			id: UUID_V7_1,
			intervalMonths: 3, // change from 1 month to 3 months
		});

		expect(updated.ok).toBe(true);
		if (updated.ok) {
			expect(updated.value.intervalMonths).toBe(3);
			// 2026-01-01 + 3 months = 2026-04-01
			expect(updated.value.nextDueDate).toBe("2026-04-01");
		}
	});

	it("posts a due occurrence: generates transaction and advances nextDueDate by interval", async () => {
		const { deps, seedAccount, seedCategory, txnRows } = createFakes();
		seedAccount({ id: "acc-1" });
		seedCategory({ id: "cat-1" });

		const service = createRecurringExpenseService(deps);
		await service.create({
			userId: "user-1",
			id: UUID_V7_1,
			name: "Cloud Server",
			amountMinor: 50000,
			intervalMonths: 1,
			sourceAccountId: "acc-1",
			categoryId: "cat-1",
			startDate: "2026-01-15",
		});

		const postResult = await service.postDue({
			userId: "user-1",
			id: UUID_V7_1,
			transactionId: UUID_V7_2,
		});

		expect(postResult.ok).toBe(true);
		if (postResult.ok) {
			expect(postResult.value.transaction.amountMinor).toBe(50000);
			expect(postResult.value.transaction.recurringExpenseId).toBe(UUID_V7_1);
			expect(postResult.value.recurringExpense.lastPostedDate).toBe("2026-01-15");
			expect(postResult.value.recurringExpense.nextDueDate).toBe("2026-02-15");
		}

		expect(txnRows.has(UUID_V7_2)).toBe(true);
	});

	it("skips an occurrence: advances nextDueDate without creating a transaction", async () => {
		const { deps, seedAccount, seedCategory, txnRows } = createFakes();
		seedAccount({ id: "acc-1" });
		seedCategory({ id: "cat-1" });

		const service = createRecurringExpenseService(deps);
		await service.create({
			userId: "user-1",
			id: UUID_V7_1,
			name: "Cloud Server",
			amountMinor: 50000,
			intervalMonths: 1,
			sourceAccountId: "acc-1",
			categoryId: "cat-1",
			startDate: "2026-01-15",
		});

		const skipResult = await service.skip("user-1", UUID_V7_1);
		expect(skipResult.ok).toBe(true);
		if (skipResult.ok) {
			expect(skipResult.value.nextDueDate).toBe("2026-02-15");
		}
		expect(txnRows.size).toBe(0);
	});

	it("pauses, resumes, and cancels lifecycle state transitions", async () => {
		const { deps, seedAccount, seedCategory } = createFakes();
		seedAccount({ id: "acc-1" });
		seedCategory({ id: "cat-1" });

		const service = createRecurringExpenseService(deps);
		await service.create({
			userId: "user-1",
			id: UUID_V7_1,
			name: "Subscription",
			amountMinor: 10000,
			intervalMonths: 1,
			sourceAccountId: "acc-1",
			categoryId: "cat-1",
			startDate: "2026-01-01",
		});

		const paused = await service.pause("user-1", UUID_V7_1);
		expect(paused.ok).toBe(true);
		if (paused.ok) expect(paused.value.status).toBe("paused");

		const resumed = await service.resume("user-1", UUID_V7_1);
		expect(resumed.ok).toBe(true);
		if (resumed.ok) expect(resumed.value.status).toBe("active");

		const cancelled = await service.cancel("user-1", UUID_V7_1);
		expect(cancelled.ok).toBe(true);
		if (cancelled.ok) expect(cancelled.value.status).toBe("cancelled");
	});
});
