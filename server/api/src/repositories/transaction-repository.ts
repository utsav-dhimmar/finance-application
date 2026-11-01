import {
	and,
	count,
	desc,
	eq,
	gte,
	inArray,
	lte,
	or,
	sql,
	type SQL,
} from "drizzle-orm";
import type { Db } from "@/db";
import {
	accounts,
	categories,
	transactions,
	type Transaction,
} from "@/db/schema";

// One row per transaction with its referenced account and category names
// resolved. Names may be null when a referenced record was permanently
// deleted from trash (only ever referenced by other trash records) — the UI
// displays such references as unavailable instead of failing the read.
export interface TransactionRowWithRefs {
	transaction: Transaction;
	accountName: string | null;
	categoryName: string | null;
}

export interface NewTransactionRow {
	id: string;
	userId: string;
	type: string;
	amountMinor: number;
	date: string;
	accountId: string;
	categoryId: string;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface TransactionDetailsPatch {
	amountMinor?: number;
	date?: string;
	accountId?: string;
	categoryId?: string;
	notes?: string | null;
}

export interface TransactionListFilters {
	status: string;
	from?: string;
	to?: string;
	type?: string;
	accountId?: string;
	categoryId?: string;
	q?: string;
	page: number;
	pageSize: number;
}

// Signed effect of a transaction on its account: income credits, expense
// debits. Deleted transactions contribute zero and are excluded by callers.
function signedEffectSql() {
	return sql<number>`CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amountMinor} ELSE -${transactions.amountMinor} END`;
}

function buildFilterConditions(
	userId: string,
	filters: Omit<TransactionListFilters, "page" | "pageSize">,
): SQL[] {
	const conditions: SQL[] = [
		eq(transactions.userId, userId),
		eq(transactions.status, filters.status),
	];
	if (filters.from) {
		conditions.push(gte(transactions.date, filters.from));
	}
	if (filters.to) {
		conditions.push(lte(transactions.date, filters.to));
	}
	if (filters.type) {
		conditions.push(eq(transactions.type, filters.type));
	}
	if (filters.accountId) {
		conditions.push(eq(transactions.accountId, filters.accountId));
	}
	if (filters.categoryId) {
		conditions.push(eq(transactions.categoryId, filters.categoryId));
	}
	if (filters.q) {
		const needle = `%${filters.q}%`;
		// SQLite LIKE is case-insensitive for ASCII, matching the app's other
		// case-insensitive text rules. Notes are searched directly, category and
		// account names through the joins.
		const searchCondition = or(
			sql`${transactions.notes} LIKE ${needle}`,
			sql`${accounts.name} LIKE ${needle}`,
			sql`${categories.name} LIKE ${needle}`,
		);
		if (searchCondition) {
			conditions.push(searchCondition);
		}
	}
	return conditions;
}

export function createTransactionRepository(db: Db) {
	return {
		async insert(row: NewTransactionRow): Promise<Transaction> {
			const inserted = await db.insert(transactions).values(row).returning();
			const transaction = inserted[0];
			if (!transaction) {
				throw new Error("transaction insert returned no rows");
			}
			return transaction;
		},

		async findById(id: string): Promise<Transaction | undefined> {
			const found = await db
				.select()
				.from(transactions)
				.where(eq(transactions.id, id))
				.limit(1);
			return found[0];
		},

		async findByIdWithRefs(id: string): Promise<TransactionRowWithRefs | undefined> {
			const found = await db
				.select({
					transaction: transactions,
					accountName: accounts.name,
					categoryName: categories.name,
				})
				.from(transactions)
				.leftJoin(accounts, eq(accounts.id, transactions.accountId))
				.leftJoin(categories, eq(categories.id, transactions.categoryId))
				.where(eq(transactions.id, id))
				.limit(1);
			return found[0];
		},

		async list(
			userId: string,
			filters: TransactionListFilters,
		): Promise<{ rows: TransactionRowWithRefs[]; total: number }> {
			const conditions = buildFilterConditions(userId, filters);
			const rows = await db
				.select({
					transaction: transactions,
					accountName: accounts.name,
					categoryName: categories.name,
				})
				.from(transactions)
				.leftJoin(accounts, eq(accounts.id, transactions.accountId))
				.leftJoin(categories, eq(categories.id, transactions.categoryId))
				.where(and(...conditions))
				.orderBy(desc(transactions.date), desc(transactions.createdAt))
				.limit(filters.pageSize)
				.offset((filters.page - 1) * filters.pageSize);
			const totals = await db
				.select({ value: count() })
				.from(transactions)
				.leftJoin(accounts, eq(accounts.id, transactions.accountId))
				.leftJoin(categories, eq(categories.id, transactions.categoryId))
				.where(and(...conditions));
			return { rows, total: totals[0]?.value ?? 0 };
		},

		// Signed sum of non-deleted transaction effects per account for one
		// user, in one grouped query. Accounts without transactions are absent
		// from the result — callers treat missing keys as 0.
		async sumNonDeletedEffectsByAccount(
			userId: string,
		): Promise<Map<string, number>> {
			const rows = await db
				.select({
					accountId: transactions.accountId,
					total: sql<number>`SUM(${signedEffectSql()})`,
				})
				.from(transactions)
				.where(
					and(
						eq(transactions.userId, userId),
						inArray(transactions.status, ["active", "archived"]),
					),
				)
				.groupBy(transactions.accountId);
			return new Map(rows.map((row) => [row.accountId, Number(row.total)]));
		},

		// Signed sum of one account's non-deleted transaction effects.
		async sumNonDeletedEffects(accountId: string): Promise<number> {
			const rows = await db
				.select({ total: sql<number>`SUM(${signedEffectSql()})` })
				.from(transactions)
				.where(
					and(
						eq(transactions.accountId, accountId),
						inArray(transactions.status, ["active", "archived"]),
					),
				);
			const total = rows[0]?.total;
			return total === null || total === undefined ? 0 : Number(total);
		},

		// Non-deleted transaction count for an account — the account
		// opening-balance/type lock predicate.
		async countNonDeletedByAccount(accountId: string): Promise<number> {
			const rows = await db
				.select({ value: count() })
				.from(transactions)
				.where(
					and(
						eq(transactions.accountId, accountId),
						inArray(transactions.status, ["active", "archived"]),
					),
				);
			return rows[0]?.value ?? 0;
		},

		// Non-deleted transaction count for a category — the category type-lock
		// predicate.
		async countNonDeletedByCategory(categoryId: string): Promise<number> {
			const rows = await db
				.select({ value: count() })
				.from(transactions)
				.where(
					and(
						eq(transactions.categoryId, categoryId),
						inArray(transactions.status, ["active", "archived"]),
					),
				);
			return rows[0]?.value ?? 0;
		},

		async updateDetails(
			id: string,
			patch: TransactionDetailsPatch,
			updatedAt: string,
		): Promise<Transaction | undefined> {
			const updated = await db
				.update(transactions)
				.set({ ...patch, updatedAt })
				.where(eq(transactions.id, id))
				.returning();
			return updated[0];
		},

		async updateStatus(
			id: string,
			status: string,
			timestamps: { archivedAt: string | null; deletedAt: string | null },
			updatedAt: string,
		): Promise<Transaction | undefined> {
			const updated = await db
				.update(transactions)
				.set({
					status,
					archivedAt: timestamps.archivedAt,
					deletedAt: timestamps.deletedAt,
					updatedAt,
				})
				.where(eq(transactions.id, id))
				.returning();
			return updated[0];
		},

		// Physical removal — permanent deletion from trash, always user-requested.
		async delete(id: string): Promise<boolean> {
			const removed = await db
				.delete(transactions)
				.where(eq(transactions.id, id))
				.returning();
			return removed.length > 0;
		},
	};
}

export type TransactionRepository = ReturnType<
	typeof createTransactionRepository
>;
