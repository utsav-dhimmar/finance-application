import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { type UserPreferences, userPreferences } from "@/db/schema";

export function createPreferenceRepository(db: Db) {
	return {
		async findByUserId(userId: string): Promise<UserPreferences | undefined> {
			const found = await db
				.select()
				.from(userPreferences)
				.where(eq(userPreferences.userId, userId))
				.limit(1);
			return found[0];
		},

		// Read-repair insert for a user's first preferences read: harmless when
		// a concurrent request created the row already (the PK conflict is
		// ignored and both writers use identical defaults).
		async insertOrIgnoreDefault(
			userId: string,
			timestamps: { createdAt: string; updatedAt: string },
		): Promise<void> {
			await db
				.insert(userPreferences)
				.values({
					userId,
					createdAt: timestamps.createdAt,
					updatedAt: timestamps.updatedAt,
				})
				.onConflictDoNothing({ target: userPreferences.userId });
		},

		// Reads repair the row first, so this normally updates; the upsert keeps
		// a first-ever PATCH atomic even if it races the default insert.
		async upsertCurrencyCode(
			userId: string,
			currencyCode: string,
			updatedAt: string,
		): Promise<UserPreferences> {
			const upserted = await db
				.insert(userPreferences)
				.values({ userId, currencyCode, createdAt: updatedAt, updatedAt })
				.onConflictDoUpdate({
					target: userPreferences.userId,
					set: { currencyCode, updatedAt },
				})
				.returning();
			const row = upserted[0];
			if (!row) {
				throw new Error("preference upsert returned no rows");
			}
			return row;
		},
	};
}

export type PreferenceRepository = ReturnType<
	typeof createPreferenceRepository
>;
