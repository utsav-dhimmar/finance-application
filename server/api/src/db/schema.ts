import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

export type User = typeof users.$inferSelect;
export type RefreshToken = typeof refreshTokens.$inferSelect;
