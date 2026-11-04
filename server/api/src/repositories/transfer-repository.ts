import {
	and,
	count,
	desc,
	eq,
	gte,
	inArray,
	lte,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { Db } from "@/db";
import { accounts, type Transfer, transfers } from "@/db/schema";

// One row per transfer with both referenced account names resolved. Names may
// be null when a referenced account was permanently deleted from trash — the
// UI displays such references as unavailable instead of failing the read.
export interface TransferRowWithRefs {
	transfer: Transfer;
	sourceAccountName: string | null;
	destinationAccountName: string | null;
}

export interface NewTransferRow {
	id: string;
	userId: string;
	sourceAccountId: string;
	destinationAccountId: string;
	amountMinor: number;
	date: string;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface TransferDetailsPatch {
	sourceAccountId?: string;
	destinationAccountId?: string;
	amountMinor?: number;
	date?: string;
	notes?: string | null;
}

export interface TransferListFilters {
	status: string;
	from?: string;
	to?: string;
	accountId?: string;
	q?: string;
	page: number;
	pageSize: number;
}

// Transfers live in two balance directions at once: −amount on the source,
// +amount on the destination. Deleted transfers contribute zero and are
// excluded by every sum here; archived transfers keep their effect.
const NON_DELETED_STATUSES = ["active", "archived"] as const;

const sourceAccounts = alias(accounts, "source_accounts");
const destinationAccounts = alias(accounts, "destination_accounts");

function buildFilterConditions(
	userId: string,
	filters: Omit<TransferListFilters, "page" | "pageSize">,
): SQL[] {
	const conditions: SQL[] = [
		eq(transfers.userId, userId),
		eq(transfers.status, filters.status),
	];
	if (filters.from) {
		conditions.push(gte(transfers.date, filters.from));
	}
	if (filters.to) {
		conditions.push(lte(transfers.date, filters.to));
	}
	// An account filter matches transfers the account participates in on
	// either side.
	if (filters.accountId) {
		const accountCondition = or(
			eq(transfers.sourceAccountId, filters.accountId),
			eq(transfers.destinationAccountId, filters.accountId),
		);
		if (accountCondition) {
			conditions.push(accountCondition);
		}
	}
	if (filters.q) {
		const needle = `%${filters.q}%`;
		// SQLite LIKE is case-insensitive for ASCII, matching the app's other
		// case-insensitive text rules. Notes are searched directly, account
		// names through the joins.
		const searchCondition = or(
			sql`${transfers.notes} LIKE ${needle}`,
			sql`${sourceAccounts.name} LIKE ${needle}`,
			sql`${destinationAccounts.name} LIKE ${needle}`,
		);
		if (searchCondition) {
			conditions.push(searchCondition);
		}
	}
	return conditions;
}

export function createTransferRepository(db: Db) {
	return {
		async insert(row: NewTransferRow): Promise<Transfer> {
			const inserted = await db.insert(transfers).values(row).returning();
			const transfer = inserted[0];
			if (!transfer) {
				throw new Error("transfer insert returned no rows");
			}
			return transfer;
		},

		async findById(id: string): Promise<Transfer | undefined> {
			const found = await db
				.select()
				.from(transfers)
				.where(eq(transfers.id, id))
				.limit(1);
			return found[0];
		},

		async findByIdWithRefs(
			id: string,
		): Promise<TransferRowWithRefs | undefined> {
			const found = await db
				.select({
					transfer: transfers,
					sourceAccountName: sourceAccounts.name,
					destinationAccountName: destinationAccounts.name,
				})
				.from(transfers)
				.leftJoin(
					sourceAccounts,
					eq(sourceAccounts.id, transfers.sourceAccountId),
				)
				.leftJoin(
					destinationAccounts,
					eq(destinationAccounts.id, transfers.destinationAccountId),
				)
				.where(eq(transfers.id, id))
				.limit(1);
			return found[0];
		},

		async list(
			userId: string,
			filters: TransferListFilters,
		): Promise<{ rows: TransferRowWithRefs[]; total: number }> {
			const conditions = buildFilterConditions(userId, filters);
			const rows = await db
				.select({
					transfer: transfers,
					sourceAccountName: sourceAccounts.name,
					destinationAccountName: destinationAccounts.name,
				})
				.from(transfers)
				.leftJoin(
					sourceAccounts,
					eq(sourceAccounts.id, transfers.sourceAccountId),
				)
				.leftJoin(
					destinationAccounts,
					eq(destinationAccounts.id, transfers.destinationAccountId),
				)
				.where(and(...conditions))
				.orderBy(desc(transfers.date), desc(transfers.createdAt))
				.limit(filters.pageSize)
				.offset((filters.page - 1) * filters.pageSize);
			const totals = await db
				.select({ value: count() })
				.from(transfers)
				.leftJoin(
					sourceAccounts,
					eq(sourceAccounts.id, transfers.sourceAccountId),
				)
				.leftJoin(
					destinationAccounts,
					eq(destinationAccounts.id, transfers.destinationAccountId),
				)
				.where(and(...conditions));
			return { rows, total: totals[0]?.value ?? 0 };
		},

		// Signed sum of the user's non-deleted transfer effects per account, in
		// one grouped query per side (each served by a side-specific index).
		// Accounts without transfers are absent — callers treat missing keys as 0.
		async sumNonDeletedEffectsByAccount(
			userId: string,
		): Promise<Map<string, number>> {
			const statusCondition = inArray(transfers.status, [
				...NON_DELETED_STATUSES,
			]);
			const [outRows, inRows] = await Promise.all([
				db
					.select({
						accountId: transfers.sourceAccountId,
						total: sql<number>`SUM(${transfers.amountMinor})`,
					})
					.from(transfers)
					.where(and(eq(transfers.userId, userId), statusCondition))
					.groupBy(transfers.sourceAccountId),
				db
					.select({
						accountId: transfers.destinationAccountId,
						total: sql<number>`SUM(${transfers.amountMinor})`,
					})
					.from(transfers)
					.where(and(eq(transfers.userId, userId), statusCondition))
					.groupBy(transfers.destinationAccountId),
			]);
			const sums = new Map<string, number>();
			for (const row of outRows) {
				sums.set(
					row.accountId,
					(sums.get(row.accountId) ?? 0) - Number(row.total),
				);
			}
			for (const row of inRows) {
				sums.set(
					row.accountId,
					(sums.get(row.accountId) ?? 0) + Number(row.total),
				);
			}
			return sums;
		},

		// Signed sum of one account's non-deleted transfer effects: money out as
		// source counts negative, money in as destination counts positive.
		async sumNonDeletedEffects(accountId: string): Promise<number> {
			const statusCondition = inArray(transfers.status, [
				...NON_DELETED_STATUSES,
			]);
			const [outRows, inRows] = await Promise.all([
				db
					.select({ total: sql<number>`SUM(${transfers.amountMinor})` })
					.from(transfers)
					.where(
						and(eq(transfers.sourceAccountId, accountId), statusCondition),
					),
				db
					.select({ total: sql<number>`SUM(${transfers.amountMinor})` })
					.from(transfers)
					.where(
						and(eq(transfers.destinationAccountId, accountId), statusCondition),
					),
			]);
			const out = outRows[0]?.total;
			const incoming = inRows[0]?.total;
			const outSum = out === null || out === undefined ? 0 : Number(out);
			const inSum =
				incoming === null || incoming === undefined ? 0 : Number(incoming);
			return inSum - outSum;
		},

		// Referencing transfer count across every lifecycle status — the account
		// permanent-delete gate predicate (an account participates on either
		// side). D1 enforces the RESTRICT foreign keys unconditionally, so a
		// referenced account row cannot be physically removed even when only
		// tombstoned transfers point at it; this count lets the gate reject such
		// requests with a meaningful error.
		async countByAccount(accountId: string): Promise<number> {
			const rows = await db
				.select({ value: count() })
				.from(transfers)
				.where(
					or(
						eq(transfers.sourceAccountId, accountId),
						eq(transfers.destinationAccountId, accountId),
					),
				);
			return rows[0]?.value ?? 0;
		},

		async updateDetails(
			id: string,
			patch: TransferDetailsPatch,
			updatedAt: string,
		): Promise<Transfer | undefined> {
			const updated = await db
				.update(transfers)
				.set({ ...patch, updatedAt })
				.where(eq(transfers.id, id))
				.returning();
			return updated[0];
		},

		async updateStatus(
			id: string,
			status: string,
			timestamps: { archivedAt: string | null; deletedAt: string | null },
			updatedAt: string,
		): Promise<Transfer | undefined> {
			const updated = await db
				.update(transfers)
				.set({
					status,
					archivedAt: timestamps.archivedAt,
					deletedAt: timestamps.deletedAt,
					updatedAt,
				})
				.where(eq(transfers.id, id))
				.returning();
			return updated[0];
		},

		// Physical removal — permanent deletion from trash, always user-requested.
		async delete(id: string): Promise<boolean> {
			const removed = await db
				.delete(transfers)
				.where(eq(transfers.id, id))
				.returning();
			return removed.length > 0;
		},
	};
}

export type TransferRepository = ReturnType<typeof createTransferRepository>;
