import { describe, expect, it, vi } from "vitest";
import type { Account, Category, Transaction } from "@/db/schema";
import {
	createTransactionService,
	type TransactionList,
} from "@/services/transaction-service";

const UUID_V7 = "018f6a2c-9b7d-7ce2-8f3a-1d4e5f6a7b8c";

// Fakes of the three repository interfaces: service rules are tested here
// without a database; the real repositories' SQL behavior is covered by the
// repository integration tests and the route contract tests.
function createFakes() {
	let sequence = 0;
	const txnRows = new Map<string, Transaction>();
	const accountRows = new Map<string, Account>();
	const categoryRows = new Map<string, Category>();

	function accountRow(overrides: Partial<Account> & { id: string }): Account {
		return {
			userId: "user-1",
			name: overrides.id,
			nameNormalized: (overrides.name ?? overrides.id).toLowerCase(),
			type: "bank",
			openingBalanceMinor: 0,
			status: "active",
			archivedAt: null,
			deletedAt: null,
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-01T00:00:00.000Z",
			...overrides,
		};
	}

	function categoryRow(overrides: Partial<Category> & { id: string }): Category {
		return {
			userId: "user-1",
			name: overrides.id,
			nameNormalized: (overrides.name ?? overrides.id).toLowerCase(),
			type: "expense",
			color: null,
			icon: null,
			status: "active",
			archivedAt: null,
			deletedAt: null,
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-01T00:00:00.000Z",
			...overrides,
		};
	}

	const transactions = {
		nextId: () => `txn-${++sequence}`,
		rows: txnRows,
		insert: vi.fn(async (input: Transaction) => {
			if (txnRows.has(input.id)) {
				throw new Error("UNIQUE constraint failed: transactions.id");
			}
			// Mirror the table defaults the real INSERT applies.
			const row: Transaction = {
				...input,
				status: input.status ?? "active",
				archivedAt: input.archivedAt ?? null,
				deletedAt: input.deletedAt ?? null,
			};
			txnRows.set(row.id, row);
			return row;
		}),
		findById: vi.fn(async (id: string) => txnRows.get(id)),
		findByIdWithRefs: vi.fn(async (id: string) => {
			const transaction = txnRows.get(id);
			if (!transaction) {
				return undefined;
			}
			return {
				transaction,
				accountName: accountRows.get(transaction.accountId)?.name ?? null,
				categoryName: categoryRows.get(transaction.categoryId)?.name ?? null,
			};
		}),
		list: vi.fn(
			async (
				_userId: string,
				filters: { status: string; page: number; pageSize: number },
			) => {
				const matching = [...txnRows.values()].filter(
					(t) => t.status === filters.status,
				);
				const start = (filters.page - 1) * filters.pageSize;
				const rows = matching
					.slice(start, start + filters.pageSize)
					.map((transaction) => ({
						transaction,
						accountName: accountRows.get(transaction.accountId)?.name ?? null,
						categoryName:
							categoryRows.get(transaction.categoryId)?.name ?? null,
					}));
				const result: { rows: typeof rows; total: number } = {
					rows,
					total: matching.length,
				};
				return result;
			},
		),
		updateDetails: vi.fn(
			async (
				id: string,
				patch: Partial<Transaction>,
				updatedAt: string,
			) => {
				const transaction = txnRows.get(id);
				if (!transaction) {
					return undefined;
				}
				const updated: Transaction = { ...transaction, ...patch, updatedAt };
				txnRows.set(id, updated);
				return updated;
			},
		),
		updateStatus: vi.fn(
			async (
				id: string,
				status: string,
				timestamps: { archivedAt: string | null; deletedAt: string | null },
				updatedAt: string,
			) => {
				const transaction = txnRows.get(id);
				if (!transaction) {
					return undefined;
				}
				const updated: Transaction = {
					...transaction,
					status,
					archivedAt: timestamps.archivedAt,
					deletedAt: timestamps.deletedAt,
					updatedAt,
				};
				txnRows.set(id, updated);
				return updated;
			},
		),
		delete: vi.fn(async (id: string) => txnRows.delete(id)),
	};

	const accounts = {
		findById: vi.fn(async (id: string) => accountRows.get(id)),
	};

	const categories = {
		findById: vi.fn(async (id: string) => categoryRows.get(id)),
	};

	function seedAccount(overrides: Partial<Account> & { id: string }): Account {
		const account = accountRow(overrides);
		accountRows.set(account.id, account);
		return account;
	}

	function seedCategory(overrides: Partial<Category> & { id: string }): Category {
		const category = categoryRow(overrides);
		categoryRows.set(category.id, category);
		return category;
	}

	return {
		transactions,
		accounts,
		categories,
		seedAccount,
		seedCategory,
	};
}

type Fakes = ReturnType<typeof createFakes>;

function asDeps(fakes: Fakes) {
	return fakes as unknown as Parameters<
		typeof createTransactionService
	>[0];
}

function createdId(
	outcome: { ok: true; value: { id: string } } | { ok: false },
): string {
	if (!outcome.ok) {
		throw new Error("seed failed");
	}
	return outcome.value.id;
}

function validCreateInput(overrides: Record<string, unknown> = {}) {
	return {
		userId: "user-1",
		id: `${UUID_V7}`,
		type: "expense",
		amountMinor: 1000,
		date: "2026-01-15",
		accountId: "acc-1",
		categoryId: "cat-1",
		...overrides,
	};
}

describe("createTransactionService.create", () => {
	it("creates an eligible transaction", async () => {
		const fakes = createFakes();
		fakes.seedAccount({ id: "acc-1", name: "HDFC Bank" });
		fakes.seedCategory({ id: "cat-1", name: "Groceries" });
		const service = createTransactionService(asDeps(fakes));
		const outcome = await service.create(validCreateInput());
		expect(outcome.ok).toBe(true);
		if (outcome.ok) {
			expect(outcome.replayed).toBe(false);
			expect(outcome.value).toMatchObject({
				type: "expense",
				amountMinor: 1000,
				accountName: "HDFC Bank",
				categoryName: "Groceries",
			});
		}
	});

	it("replays an existing id without re-inserting", async () => {
		const fakes = createFakes();
		fakes.seedAccount({ id: "acc-1", name: "HDFC Bank" });
		fakes.seedCategory({ id: "cat-1", name: "Groceries" });
		const service = createTransactionService(asDeps(fakes));
		const first = await service.create(validCreateInput());
		expect(first.ok).toBe(true);
		const insertCalls = vi.mocked(fakes.transactions.insert).mock.calls.length;
		const replay = await service.create(
			validCreateInput({ amountMinor: 999999 }),
		);
		expect(replay.ok).toBe(true);
		if (replay.ok) {
			expect(replay.replayed).toBe(true);
			// The original amount wins; the retry's payload is ignored.
			expect(replay.value.amountMinor).toBe(1000);
		}
		expect(vi.mocked(fakes.transactions.insert).mock.calls.length).toBe(
			insertCalls,
		);
	});

	it("rejects an ineligible account", async () => {
		const fakes = createFakes();
		fakes.seedAccount({
			id: "acc-1",
			name: "Old",
			status: "archived",
			archivedAt: "2026-01-01T00:00:00.000Z",
		});
		fakes.seedCategory({ id: "cat-1", name: "Groceries" });
		const service = createTransactionService(asDeps(fakes));
		expect(await service.create(validCreateInput())).toEqual({
			ok: false,
			code: "ACCOUNT_INELIGIBLE",
		});
	});

	it("rejects a foreign account as ineligible", async () => {
		const fakes = createFakes();
		fakes.seedAccount({ id: "acc-1", name: "Mine" });
		fakes.seedAccount({ id: "acc-2", name: "Theirs", userId: "user-2" });
		fakes.seedCategory({ id: "cat-1", name: "Groceries" });
		const service = createTransactionService(asDeps(fakes));
		expect(
			await service.create(validCreateInput({ accountId: "acc-2" })),
		).toEqual({ ok: false, code: "ACCOUNT_INELIGIBLE" });
	});

	it.each([
		[
			"wrong-type category",
			{ id: "cat-1", name: "Groceries", type: "expense" },
			"income",
		],
		[
			"archived category",
			{
				id: "cat-1",
				name: "Old",
				status: "archived",
				archivedAt: "2026-01-01T00:00:00.000Z",
			},
			"expense",
		],
	])("rejects a %s", async (_label, categorySeed, transactionType) => {
		const fakes = createFakes();
		fakes.seedAccount({ id: "acc-1", name: "HDFC Bank" });
		fakes.seedCategory(categorySeed);
		const service = createTransactionService(asDeps(fakes));
		expect(
			await service.create(validCreateInput({ type: transactionType })),
		).toEqual({ ok: false, code: "CATEGORY_INELIGIBLE" });
	});
});

describe("createTransactionService.list and get", () => {
	it("lists the requested slice with pagination metadata", async () => {
		const fakes = createFakes();
		fakes.seedAccount({ id: "acc-1", name: "HDFC Bank" });
		fakes.seedCategory({ id: "cat-1", name: "Groceries" });
		const service = createTransactionService(asDeps(fakes));
		await service.create(validCreateInput({ id: `${UUID_V7}` }));
		const list: TransactionList = await service.list("user-1", {
			status: "active",
			page: 1,
			pageSize: 20,
		});
		expect(list.total).toBe(1);
		expect(list.transactions).toHaveLength(1);
		expect(list.page).toBe(1);
	});

	it("hides foreign transactions behind 404", async () => {
		const fakes = createFakes();
		fakes.seedAccount({ id: "acc-1", name: "HDFC Bank" });
		fakes.seedCategory({ id: "cat-1", name: "Groceries" });
		const service = createTransactionService(asDeps(fakes));
		const id = createdId(await service.create(validCreateInput()));
		expect(await service.get("user-2", id)).toEqual({
			ok: false,
			code: "NOT_FOUND",
		});
		expect(await service.get("user-1", "ghost")).toEqual({
			ok: false,
			code: "NOT_FOUND",
		});
	});
});

describe("createTransactionService.update", () => {
	it("edits an active transaction's fields", async () => {
		const fakes = createFakes();
		fakes.seedAccount({ id: "acc-1", name: "HDFC Bank" });
		fakes.seedAccount({ id: "acc-2", name: "Wallet" });
		fakes.seedCategory({ id: "cat-1", name: "Groceries" });
		const service = createTransactionService(asDeps(fakes));
		const id = createdId(await service.create(validCreateInput()));
		const outcome = await service.update({
			userId: "user-1",
			transactionId: id,
			amountMinor: 2000,
			accountId: "acc-2",
			notes: "updated",
		});
		expect(outcome.ok).toBe(true);
		if (outcome.ok) {
			expect(outcome.value).toMatchObject({
				amountMinor: 2000,
				accountId: "acc-2",
				accountName: "Wallet",
				notes: "updated",
			});
		}
	});

	it("rejects edits of non-active transactions", async () => {
		const fakes = createFakes();
		fakes.seedAccount({ id: "acc-1", name: "HDFC Bank" });
		fakes.seedCategory({ id: "cat-1", name: "Groceries" });
		const service = createTransactionService(asDeps(fakes));
		const id = createdId(await service.create(validCreateInput()));
		await service.archive("user-1", id);
		const outcome = await service.update({
			userId: "user-1",
			transactionId: id,
			amountMinor: 1,
		});
		expect(outcome).toEqual({
			ok: false,
			code: "TRANSACTION_TRANSITION_INVALID",
		});
	});

	it("rejects moving to an ineligible account or category", async () => {
		const fakes = createFakes();
		fakes.seedAccount({ id: "acc-1", name: "HDFC Bank" });
		fakes.seedAccount({
			id: "acc-archived",
			name: "Old",
			status: "archived",
			archivedAt: "2026-01-01T00:00:00.000Z",
		});
		fakes.seedCategory({ id: "cat-1", name: "Groceries" });
		fakes.seedCategory({
			id: "cat-archived",
			name: "Old Cat",
			status: "archived",
			archivedAt: "2026-01-01T00:00:00.000Z",
		});
		const service = createTransactionService(asDeps(fakes));
		const id = createdId(await service.create(validCreateInput()));
		expect(
			await service.update({
				userId: "user-1",
				transactionId: id,
				accountId: "acc-archived",
			}),
		).toEqual({ ok: false, code: "ACCOUNT_INELIGIBLE" });
		expect(
			await service.update({
				userId: "user-1",
				transactionId: id,
				categoryId: "cat-archived",
			}),
		).toEqual({ ok: false, code: "CATEGORY_INELIGIBLE" });
	});

	it("keeps the current account/category eligible when unchanged", async () => {
		const fakes = createFakes();
		fakes.seedAccount({
			id: "acc-1",
			name: "Since Archived",
			status: "archived",
			archivedAt: "2026-01-01T00:00:00.000Z",
		});
		fakes.seedCategory({ id: "cat-1", name: "Groceries" });
		const service = createTransactionService(asDeps(fakes));
		// Seed directly: the transaction was valid when the account was active.
		fakes.transactions.rows.set(
			"seeded",
			fakes.transactions.rows.get("seeded") ?? {
				id: "seeded",
				userId: "user-1",
				type: "expense",
				amountMinor: 500,
				date: "2026-01-15",
				accountId: "acc-1",
				categoryId: "cat-1",
				notes: null,
				status: "active",
				archivedAt: null,
				deletedAt: null,
				createdAt: "2026-01-01T00:00:00.000Z",
				updatedAt: "2026-01-01T00:00:00.000Z",
			},
		);
		const outcome = await service.update({
			userId: "user-1",
			transactionId: "seeded",
			amountMinor: 600,
		});
		expect(outcome.ok).toBe(true);
	});
});

describe("createTransactionService lifecycle transitions", () => {
	it("covers the full transition matrix", async () => {
		const fakes = createFakes();
		fakes.seedAccount({ id: "acc-1", name: "HDFC Bank" });
		fakes.seedCategory({ id: "cat-1", name: "Groceries" });
		const service = createTransactionService(asDeps(fakes));
		let seedCounter = 0;

		async function seed(): Promise<string> {
			seedCounter += 1;
			return createdId(
				await service.create(
					validCreateInput({ id: `${UUID_V7.slice(0, -1)}${seedCounter}` }),
				),
			);
		}

		// active → archived and archived → active
		const toArchive = await seed();
		expect(
			(await service.transition("user-1", toArchive, "archived")).ok,
		).toBe(true);
		expect(
			(await service.transition("user-1", toArchive, "active")).ok,
		).toBe(true);

		// active → deleted and deleted → active
		const toDelete = await seed();
		expect(
			(await service.transition("user-1", toDelete, "deleted")).ok,
		).toBe(true);
		expect(
			(await service.transition("user-1", toDelete, "active")).ok,
		).toBe(true);

		// archived → deleted is invalid
		const blocked = await seed();
		await service.transition("user-1", blocked, "archived");
		expect(
			await service.transition("user-1", blocked, "deleted"),
		).toEqual({ ok: false, code: "TRANSACTION_TRANSITION_INVALID" });

		// deleted → archived is invalid
		const trashed = await seed();
		await service.transition("user-1", trashed, "deleted");
		expect(
			await service.transition("user-1", trashed, "archived"),
		).toEqual({ ok: false, code: "TRANSACTION_TRANSITION_INVALID" });

		// same-status is invalid
		const sameStatus = await seed();
		expect(
			await service.transition("user-1", sameStatus, "active"),
		).toEqual({ ok: false, code: "TRANSACTION_TRANSITION_INVALID" });

		// unknown ids are NOT_FOUND
		expect(await service.transition("user-1", "ghost", "archived")).toEqual({
			ok: false,
			code: "NOT_FOUND",
		});
	});

	it("blocks restore when the account was deleted, allows archived", async () => {
		const fakes = createFakes();
		fakes.seedAccount({ id: "acc-1", name: "HDFC Bank" });
		fakes.seedCategory({ id: "cat-1", name: "Groceries" });
		const service = createTransactionService(asDeps(fakes));
		const id = createdId(await service.create(validCreateInput()));

		// Archived account restores fine.
		await service.archive("user-1", id);
		fakes.seedAccount({
			id: "acc-1",
			name: "HDFC Bank",
			status: "archived",
			archivedAt: "2026-01-02T00:00:00.000Z",
		});
		expect((await service.restore({ userId: "user-1", transactionId: id })).ok).toBe(
			true,
		);

		// Deleted account blocks the restore.
		await service.remove("user-1", id);
		fakes.seedAccount({
			id: "acc-1",
			name: "HDFC Bank",
			status: "deleted",
			deletedAt: "2026-01-02T00:00:00.000Z",
		});
		expect(await service.restore({ userId: "user-1", transactionId: id })).toEqual(
			{ ok: false, code: "RESTORE_CONFLICT" },
		);
	});

	it("blocks restore when the category was deleted", async () => {
		const fakes = createFakes();
		fakes.seedAccount({ id: "acc-1", name: "HDFC Bank" });
		fakes.seedCategory({ id: "cat-1", name: "Groceries" });
		const service = createTransactionService(asDeps(fakes));
		const id = createdId(await service.create(validCreateInput()));
		await service.remove("user-1", id);
		fakes.seedCategory({
			id: "cat-1",
			name: "Groceries",
			status: "deleted",
			deletedAt: "2026-01-02T00:00:00.000Z",
		});
		expect(await service.restore({ userId: "user-1", transactionId: id })).toEqual(
			{ ok: false, code: "RESTORE_CONFLICT" },
		);
	});

	it("restores with reassignment onto eligible replacements", async () => {
		const fakes = createFakes();
		fakes.seedAccount({ id: "acc-1", name: "HDFC Bank" });
		fakes.seedAccount({ id: "acc-2", name: "Wallet" });
		fakes.seedCategory({ id: "cat-1", name: "Groceries" });
		fakes.seedCategory({
			id: "cat-2",
			name: "Food",
			type: "expense",
		});
		const service = createTransactionService(asDeps(fakes));
		const id = createdId(await service.create(validCreateInput()));
		await service.remove("user-1", id);
		// The category is deleted after the transaction was recorded — the
		// restore must then demand a replacement.
		fakes.seedCategory({
			id: "cat-1",
			name: "Groceries",
			status: "deleted",
			deletedAt: "2026-01-02T00:00:00.000Z",
		});

		const outcome = await service.restore({
			userId: "user-1",
			transactionId: id,
			categoryId: "cat-2",
		});
		expect(outcome.ok).toBe(true);
		if (outcome.ok) {
			expect(outcome.value.categoryId).toBe("cat-2");
			expect(outcome.value.categoryName).toBe("Food");
			expect(outcome.value.status).toBe("active");
		}
	});
});

describe("createTransactionService.destroy", () => {
	it("permanently deletes only trashed transactions", async () => {
		const fakes = createFakes();
		fakes.seedAccount({ id: "acc-1", name: "HDFC Bank" });
		fakes.seedCategory({ id: "cat-1", name: "Groceries" });
		const service = createTransactionService(asDeps(fakes));
		const activeId = createdId(await service.create(validCreateInput()));
		expect(await service.destroy("user-1", activeId)).toEqual({
			ok: false,
			code: "TRANSACTION_TRANSITION_INVALID",
		});

		const id = createdId(await service.create(validCreateInput()));
		await service.remove("user-1", id);
		const destroyed = await service.destroy("user-1", id);
		expect(destroyed.ok).toBe(true);
		expect(fakes.transactions.rows.has(id)).toBe(false);
		expect(await service.destroy("user-1", id)).toEqual({
			ok: false,
			code: "NOT_FOUND",
		});
	});
});
