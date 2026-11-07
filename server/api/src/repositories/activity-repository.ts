import { type SQL, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { LIKE_ESCAPE, escapeLike } from "@/lib/like";

// The unified account-history query: account-scoped transactions UNION ALL
// transfer sides, every row written from one account's perspective (a transfer
// contributes one leg per involved account, direction-tagged "in"/"out").
// Transfers have no category, so a categoryId filter excludes them by
// construction; the type filter switches which legs contribute. The plain
// transactions list stays transactions-only — this query is the history view's
// data source.

export interface ActivityFilters {
	status: string;
	from?: string;
	to?: string;
	// "income" | "expense" select transaction types; "transfer" selects
	// transfer legs; undefined selects everything.
	type?: string;
	accountId?: string;
	categoryId?: string;
	q?: string;
	page: number;
	pageSize: number;
}

export interface ActivityRow {
	id: string;
	kind: "transaction" | "transfer";
	date: string;
	// Signed effect on the row's account.
	amountMinor: number;
	direction: "in" | "out" | null;
	accountId: string;
	accountName: string | null;
	status: string;
	notes: string | null;
	type: "income" | "expense" | null;
	categoryId: string | null;
	categoryName: string | null;
	counterpartyAccountId: string | null;
	counterpartyAccountName: string | null;
	createdAt: string;
	updatedAt: string;
	archivedAt: string | null;
	deletedAt: string | null;
}

interface RawActivityRow {
	id: string;
	kind: "transaction" | "transfer";
	date: string;
	amountMinor: number | string | null;
	direction: "in" | "out" | null;
	accountId: string;
	accountName: string | null;
	status: string;
	notes: string | null;
	type: "income" | "expense" | null;
	categoryId: string | null;
	categoryName: string | null;
	counterpartyAccountId: string | null;
	counterpartyAccountName: string | null;
	createdAt: string;
	updatedAt: string;
	archivedAt: string | null;
	deletedAt: string | null;
}

// Transactions contribute their signed ledger effect: income credits, expense
// debits.
function transactionLeg(
	userId: string,
	filters: Omit<ActivityFilters, "page" | "pageSize">,
): SQL {
	const conditions: SQL[] = [
		sql`t.user_id = ${userId}`,
		sql`t.status = ${filters.status}`,
	];
	if (filters.type && filters.type !== "transfer") {
		conditions.push(sql`t.type = ${filters.type}`);
	}
	if (filters.type === "transfer") {
		// Only transfer legs contribute.
		conditions.push(sql`0 = 1`);
	}
	if (filters.accountId) {
		conditions.push(sql`t.account_id = ${filters.accountId}`);
	}
	if (filters.categoryId) {
		conditions.push(sql`t.category_id = ${filters.categoryId}`);
	}
	if (filters.from) {
		conditions.push(sql`t.date >= ${filters.from}`);
	}
	if (filters.to) {
		conditions.push(sql`t.date <= ${filters.to}`);
	}
	if (filters.q) {
		// Search text is literal: `%` and `_` are escaped so they match
		// themselves instead of acting as wildcard patterns.
		const needle = `%${escapeLike(filters.q)}%`;
		conditions.push(
			sql`(t.notes LIKE ${needle} ESCAPE ${LIKE_ESCAPE} OR a.name LIKE ${needle} ESCAPE ${LIKE_ESCAPE} OR c.name LIKE ${needle} ESCAPE ${LIKE_ESCAPE})`,
		);
	}
	const where = sql.join(conditions, sql` AND `);
	return sql`
		SELECT
			t.id AS "id",
			'transaction' AS "kind",
			t.date AS "date",
			CASE WHEN t.type = 'income' THEN t.amount_minor ELSE -t.amount_minor END AS "amountMinor",
			NULL AS "direction",
			t.account_id AS "accountId",
			a.name AS "accountName",
			t.status AS "status",
			t.notes AS "notes",
			t.type AS "type",
			t.category_id AS "categoryId",
			c.name AS "categoryName",
			NULL AS "counterpartyAccountId",
			NULL AS "counterpartyAccountName",
			t.created_at AS "createdAt",
			t.updated_at AS "updatedAt",
			t.archived_at AS "archivedAt",
			t.deleted_at AS "deletedAt"
		FROM transactions t
		LEFT JOIN accounts a ON a.id = t.account_id
		LEFT JOIN categories c ON c.id = t.category_id
		WHERE ${where}`;
}

// Each transfer contributes two legs — one per involved account — so a
// transfer surfaces in both accounts' histories with the correct direction.
function transferLeg(
	userId: string,
	filters: Omit<ActivityFilters, "page" | "pageSize">,
): SQL {
	const baseConditions: SQL[] = [
		sql`f.user_id = ${userId}`,
		sql`f.status = ${filters.status}`,
	];
	if (filters.type && filters.type !== "transfer") {
		// Only transfer legs contribute.
		baseConditions.push(sql`0 = 1`);
	}
	if (filters.categoryId) {
		// Transfers have no category: a category filter excludes them entirely.
		baseConditions.push(sql`0 = 1`);
	}
	if (filters.from) {
		baseConditions.push(sql`f.date >= ${filters.from}`);
	}
	if (filters.to) {
		baseConditions.push(sql`f.date <= ${filters.to}`);
	}
	if (filters.q) {
		// Search text is literal: `%` and `_` are escaped so they match
		// themselves instead of acting as wildcard patterns.
		const needle = `%${escapeLike(filters.q)}%`;
		baseConditions.push(
			sql`(f.notes LIKE ${needle} ESCAPE ${LIKE_ESCAPE} OR src.name LIKE ${needle} ESCAPE ${LIKE_ESCAPE} OR dst.name LIKE ${needle} ESCAPE ${LIKE_ESCAPE})`,
		);
	}

	// With an account filter, each leg narrows to its own side; unscoped, both
	// legs of every transfer contribute.
	function legConditions(side: "out" | "in"): SQL {
		const conditions = [...baseConditions];
		if (filters.accountId) {
			conditions.push(
				side === "out"
					? sql`f.source_account_id = ${filters.accountId}`
					: sql`f.destination_account_id = ${filters.accountId}`,
			);
		}
		return sql.join(conditions, sql` AND `);
	}

	return sql`
		SELECT
			f.id AS "id",
			'transfer' AS "kind",
			f.date AS "date",
			-f.amount_minor AS "amountMinor",
			'out' AS "direction",
			f.source_account_id AS "accountId",
			src.name AS "accountName",
			f.status AS "status",
			f.notes AS "notes",
			NULL AS "type",
			NULL AS "categoryId",
			NULL AS "categoryName",
			f.destination_account_id AS "counterpartyAccountId",
			dst.name AS "counterpartyAccountName",
			f.created_at AS "createdAt",
			f.updated_at AS "updatedAt",
			f.archived_at AS "archivedAt",
			f.deleted_at AS "deletedAt"
		FROM transfers f
		LEFT JOIN accounts src ON src.id = f.source_account_id
		LEFT JOIN accounts dst ON dst.id = f.destination_account_id
		WHERE ${legConditions("out")}
		UNION ALL
		SELECT
			f.id,
			'transfer',
			f.date,
			f.amount_minor,
			'in',
			f.destination_account_id,
			dst.name,
			f.status,
			f.notes,
			NULL,
			NULL,
			NULL,
			f.source_account_id,
			src.name,
			f.created_at,
			f.updated_at,
			f.archived_at,
			f.deleted_at
		FROM transfers f
		LEFT JOIN accounts src ON src.id = f.source_account_id
		LEFT JOIN accounts dst ON dst.id = f.destination_account_id
		WHERE ${legConditions("in")}`;
}

export function createActivityRepository(db: Db) {
	function buildUnion(
		userId: string,
		filters: Omit<ActivityFilters, "page" | "pageSize">,
	): SQL {
		return sql`${transactionLeg(userId, filters)} UNION ALL ${transferLeg(userId, filters)}`;
	}

	return {
		// One ordered query over the union with the page's LIMIT/OFFSET, plus a
		// merged COUNT(*) over the same union: the total is the number of rows
		// (transaction rows plus both transfer legs) matching the filters.
		async list(
			userId: string,
			filters: ActivityFilters,
		): Promise<{ rows: ActivityRow[]; total: number }> {
			const { page, pageSize, ...rest } = filters;
			const union = buildUnion(userId, rest);
			const rowsResult = await db.all<RawActivityRow>(
				sql`SELECT * FROM (${union}) ORDER BY "date" DESC, "createdAt" DESC, "id" DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
			);
			const totals = await db.all<{ total: number | string }>(
				sql`SELECT COUNT(*) AS "total" FROM (${union})`,
			);
			return {
				rows: rowsResult.map((row) => ({
					...row,
					amountMinor: Number(row.amountMinor ?? 0),
				})),
				total: Number(totals[0]?.total ?? 0),
			};
		},

		// Kept for tests and callers that need the merged count alone.
		async count(
			userId: string,
			filters: Omit<ActivityFilters, "page" | "pageSize">,
		): Promise<number> {
			const totals = await db.all<{ total: number | string }>(
				sql`SELECT COUNT(*) AS "total" FROM (${buildUnion(userId, filters)})`,
			);
			return Number(totals[0]?.total ?? 0);
		},
	};
}

export type ActivityRepository = ReturnType<typeof createActivityRepository>;
