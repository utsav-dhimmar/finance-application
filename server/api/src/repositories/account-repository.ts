import { and, asc, eq, ne } from "drizzle-orm";
import type { Db } from "@/db";
import { accounts, type Account } from "@/db/schema";

// The single name-normalization point: uniqueness is case-insensitive and
// whitespace-trimmed, backed by the partial unique index on name_normalized.
export function normalizeAccountName(name: string): string {
	return name.trim().toLowerCase();
}

export interface NewAccountRow {
	id: string;
	userId: string;
	name: string;
	type: string;
	openingBalanceMinor: number;
	createdAt: string;
	updatedAt: string;
}

export interface AccountDetailsPatch {
	name?: string;
	type?: string;
	openingBalanceMinor?: number;
}

export function createAccountRepository(db: Db) {
	return {
		async insert(row: NewAccountRow): Promise<Account> {
			const inserted = await db
				.insert(accounts)
				.values({ ...row, nameNormalized: normalizeAccountName(row.name) })
				.returning();
			const account = inserted[0];
			if (!account) {
				throw new Error("account insert returned no rows");
			}
			return account;
		},

		async findById(id: string): Promise<Account | undefined> {
			const found = await db
				.select()
				.from(accounts)
				.where(eq(accounts.id, id))
				.limit(1);
			return found[0];
		},

		async listByStatus(userId: string, status: string): Promise<Account[]> {
			return db
				.select()
				.from(accounts)
				.where(and(eq(accounts.userId, userId), eq(accounts.status, status)))
				.orderBy(asc(accounts.createdAt), asc(accounts.name));
		},

		// Uniqueness scope: the user's non-deleted accounts. Mirrors the partial
		// unique index so the service can return a friendly conflict instead of
		// a raw constraint error.
		async findNonDeletedByNameNormalized(
			userId: string,
			nameNormalized: string,
		): Promise<Account | undefined> {
			const found = await db
				.select()
				.from(accounts)
				.where(
					and(
						eq(accounts.userId, userId),
						eq(accounts.nameNormalized, nameNormalized),
						ne(accounts.status, "deleted"),
					),
				)
				.limit(1);
			return found[0];
		},

		async updateDetails(
			id: string,
			patch: AccountDetailsPatch,
			updatedAt: string,
		): Promise<Account | undefined> {
			const updated = await db
				.update(accounts)
				.set({
					...(patch.name !== undefined
						? {
								name: patch.name,
								nameNormalized: normalizeAccountName(patch.name),
							}
						: {}),
					...(patch.type !== undefined ? { type: patch.type } : {}),
					...(patch.openingBalanceMinor !== undefined
						? { openingBalanceMinor: patch.openingBalanceMinor }
						: {}),
					updatedAt,
				})
				.where(eq(accounts.id, id))
				.returning();
			return updated[0];
		},

		async updateStatus(
			id: string,
			status: string,
			timestamps: { archivedAt: string | null; deletedAt: string | null },
			updatedAt: string,
		): Promise<Account | undefined> {
			const updated = await db
				.update(accounts)
				.set({
					status,
					archivedAt: timestamps.archivedAt,
					deletedAt: timestamps.deletedAt,
					updatedAt,
				})
				.where(eq(accounts.id, id))
				.returning();
			return updated[0];
		},

		// Restore path when the account's name conflicts with a live account:
		// rename and re-activate in one statement so no intermediate state
		// violates the uniqueness rule.
		async updateStatusWithRename(
			id: string,
			status: string,
			newName: string,
			timestamps: { archivedAt: string | null; deletedAt: string | null },
			updatedAt: string,
		): Promise<Account | undefined> {
			const updated = await db
				.update(accounts)
				.set({
					status,
					name: newName,
					nameNormalized: normalizeAccountName(newName),
					archivedAt: timestamps.archivedAt,
					deletedAt: timestamps.deletedAt,
					updatedAt,
				})
				.where(eq(accounts.id, id))
				.returning();
			return updated[0];
		},
	};
}

export type AccountRepository = ReturnType<typeof createAccountRepository>;
