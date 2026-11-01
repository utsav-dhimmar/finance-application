import { sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

// Timestamps are ISO-8601 text in UTC: D1 has no native datetime type and text
// sorts correctly, avoiding driver-side timezone conversion (AGENTS.md rule).

export const users = sqliteTable(
	"users",
	{
		id: text("id").primaryKey(),
		email: text("email").notNull(),
		passwordHash: text("password_hash").notNull(),
		createdAt: text("created_at").notNull(),
		updatedAt: text("updated_at").notNull(),
	},
	(table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const refreshTokens = sqliteTable(
	"refresh_tokens",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		tokenHash: text("token_hash").notNull(),
		expiresAt: text("expires_at").notNull(),
		revokedAt: text("revoked_at"),
		createdAt: text("created_at").notNull(),
	},
	(table) => [
		uniqueIndex("refresh_tokens_token_hash_unique").on(table.tokenHash),
		index("refresh_tokens_user_id_idx").on(table.userId),
	],
);

// Lifecycle states and the valid transitions between them are owned by the
// account service; the database enforces the state vocabulary. Monetary
// amounts are integer paise (AGENTS.md rule).
export const accounts = sqliteTable(
	"accounts",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		// Trimmed lowercase mirror of `name` backing the case-insensitive
		// uniqueness rule; written only through the account repository.
		nameNormalized: text("name_normalized").notNull(),
		type: text("type").notNull(),
		openingBalanceMinor: integer("opening_balance_minor").notNull().default(0),
		status: text("status").notNull().default("active"),
		archivedAt: text("archived_at"),
		deletedAt: text("deleted_at"),
		createdAt: text("created_at").notNull(),
		updatedAt: text("updated_at").notNull(),
	},
	(table) => [
		check(
			"accounts_type_check",
			sql`${table.type} in ('cash', 'bank', 'wallet')`,
		),
		check(
			"accounts_status_check",
			sql`${table.status} in ('active', 'archived', 'deleted')`,
		),
		// Names are unique only among non-deleted accounts: a trashed account's
		// name can be reused. Archived names still block so a restore cannot
		// collide with a live account.
		uniqueIndex("accounts_user_name_unique")
			.on(table.userId, table.nameNormalized)
			.where(sql`${table.status} != 'deleted'`),
		index("accounts_user_status_idx").on(table.userId, table.status),
	],
);

// Lifecycle states and the valid transitions between them are owned by the
// category service; the database enforces the state vocabulary. Presentation
// values (color, icon) are optional display-only metadata.
export const categories = sqliteTable(
	"categories",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		// Trimmed lowercase mirror of `name` backing the case-insensitive
		// uniqueness rule; written only through the category repository.
		nameNormalized: text("name_normalized").notNull(),
		type: text("type").notNull(),
		color: text("color"),
		icon: text("icon"),
		status: text("status").notNull().default("active"),
		archivedAt: text("archived_at"),
		deletedAt: text("deleted_at"),
		createdAt: text("created_at").notNull(),
		updatedAt: text("updated_at").notNull(),
	},
	(table) => [
		check("categories_type_check", sql`${table.type} in ('income', 'expense')`),
		check(
			"categories_status_check",
			sql`${table.status} in ('active', 'archived', 'deleted')`,
		),
		// Names are unique only among non-deleted categories, across both types:
		// a trashed category's name can be reused. Archived names still block so
		// a restore cannot collide with a live category.
		uniqueIndex("categories_user_name_unique")
			.on(table.userId, table.nameNormalized)
			.where(sql`${table.status} != 'deleted'`),
		index("categories_user_status_idx").on(table.userId, table.status),
	],
);

// The transaction ledger. Lifecycle states are owned by the transaction
// service; the database enforces the state vocabulary. Balances are derived:
// the account service sums the signed effects of non-deleted transactions
// (income credits, expense debits) on top of each account's opening balance —
// no stored balance column exists to drift (AGENTS.md financial-correctness
// rule). Amounts are strictly positive integer paise; the sign is the type.
// Creation is idempotent: the id is a client-generated UUIDv7 primary key.
export const transactions = sqliteTable(
	"transactions",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		type: text("type").notNull(),
		amountMinor: integer("amount_minor").notNull(),
		// Calendar date (YYYY-MM-DD) the transaction belongs to, distinct from
		// the audit timestamps; lexicographic order equals chronological order.
		date: text("date").notNull(),
		accountId: text("account_id")
			.notNull()
			.references(() => accounts.id, { onDelete: "restrict" }),
		categoryId: text("category_id")
			.notNull()
			.references(() => categories.id, { onDelete: "restrict" }),
		notes: text("notes"),
		status: text("status").notNull().default("active"),
		archivedAt: text("archived_at"),
		deletedAt: text("deleted_at"),
		createdAt: text("created_at").notNull(),
		updatedAt: text("updated_at").notNull(),
	},
	(table) => [
		check(
			"transactions_type_check",
			sql`${table.type} in ('income', 'expense')`,
		),
		check("transactions_amount_positive_check", sql`${table.amountMinor} > 0`),
		check(
			"transactions_status_check",
			sql`${table.status} in ('active', 'archived', 'deleted')`,
		),
		index("transactions_user_date_idx").on(table.userId, table.date),
		index("transactions_user_account_date_idx").on(
			table.userId,
			table.accountId,
			table.date,
		),
		index("transactions_user_category_idx").on(table.userId, table.categoryId),
		index("transactions_user_status_date_idx").on(
			table.userId,
			table.status,
			table.date,
		),
	],
);

export type User = typeof users.$inferSelect;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
