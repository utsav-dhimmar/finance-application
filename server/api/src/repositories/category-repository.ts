import { and, asc, eq, ne } from "drizzle-orm";
import type { Db } from "@/db";
import { categories, type Category } from "@/db/schema";
import { normalizeName } from "@/lib/name-normalization";

// Case-insensitive, whitespace-trimmed uniqueness backed by the partial unique
// index on name_normalized; shared with the other named entities.
export function normalizeCategoryName(name: string): string {
	return normalizeName(name);
}

export interface NewCategoryRow {
	id: string;
	userId: string;
	name: string;
	type: string;
	color: string | null;
	icon: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface CategoryDetailsPatch {
	name?: string;
	type?: string;
	color?: string | null;
	icon?: string | null;
}

export function createCategoryRepository(db: Db) {
	return {
		async insert(row: NewCategoryRow): Promise<Category> {
			const inserted = await db
				.insert(categories)
				.values({ ...row, nameNormalized: normalizeName(row.name) })
				.returning();
			const category = inserted[0];
			if (!category) {
				throw new Error("category insert returned no rows");
			}
			return category;
		},

		async findById(id: string): Promise<Category | undefined> {
			const found = await db
				.select()
				.from(categories)
				.where(eq(categories.id, id))
				.limit(1);
			return found[0];
		},

		async listByStatus(userId: string, status: string): Promise<Category[]> {
			return db
				.select()
				.from(categories)
				.where(and(eq(categories.userId, userId), eq(categories.status, status)))
				.orderBy(asc(categories.createdAt), asc(categories.name));
		},

		// Uniqueness scope: the user's non-deleted categories, regardless of
		// type. Mirrors the partial unique index so the service can return a
		// friendly conflict instead of a raw constraint error.
		async findNonDeletedByNameNormalized(
			userId: string,
			nameNormalized: string,
		): Promise<Category | undefined> {
			const found = await db
				.select()
				.from(categories)
				.where(
					and(
						eq(categories.userId, userId),
						eq(categories.nameNormalized, nameNormalized),
						ne(categories.status, "deleted"),
					),
				)
				.limit(1);
			return found[0];
		},

		async updateDetails(
			id: string,
			patch: CategoryDetailsPatch,
			updatedAt: string,
		): Promise<Category | undefined> {
			const updated = await db
				.update(categories)
				.set({
					...(patch.name !== undefined
						? {
								name: patch.name,
								nameNormalized: normalizeName(patch.name),
							}
						: {}),
					...(patch.type !== undefined ? { type: patch.type } : {}),
					...(patch.color !== undefined ? { color: patch.color } : {}),
					...(patch.icon !== undefined ? { icon: patch.icon } : {}),
					updatedAt,
				})
				.where(eq(categories.id, id))
				.returning();
			return updated[0];
		},

		async updateStatus(
			id: string,
			status: string,
			timestamps: { archivedAt: string | null; deletedAt: string | null },
			updatedAt: string,
		): Promise<Category | undefined> {
			const updated = await db
				.update(categories)
				.set({
					status,
					archivedAt: timestamps.archivedAt,
					deletedAt: timestamps.deletedAt,
					updatedAt,
				})
				.where(eq(categories.id, id))
				.returning();
			return updated[0];
		},

		// Restore path when the category's name conflicts with a live category:
		// rename and re-activate in one statement so no intermediate state
		// violates the uniqueness rule.
		async updateStatusWithRename(
			id: string,
			status: string,
			newName: string,
			timestamps: { archivedAt: string | null; deletedAt: string | null },
			updatedAt: string,
		): Promise<Category | undefined> {
			const updated = await db
				.update(categories)
				.set({
					status,
					name: newName,
					nameNormalized: normalizeName(newName),
					archivedAt: timestamps.archivedAt,
					deletedAt: timestamps.deletedAt,
					updatedAt,
				})
				.where(eq(categories.id, id))
				.returning();
			return updated[0];
		},

		// SEAM: the category type lock depends on how many non-deleted
		// transactions reference the category. No transactions table exists yet,
		// so the count is vacuously 0 today; the transactions epic replaces this
		// wiring (no transaction may be created while bypassing the lock check).
		async getReferencingTransactionCount(_categoryId: string): Promise<number> {
			return 0;
		},
	};
}

export type CategoryRepository = ReturnType<typeof createCategoryRepository>;
