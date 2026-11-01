import type { Category } from "@/db/schema";
import type { ErrorCode } from "@/lib/error";
import { uuidV7 } from "@/lib/uuid";
import type { CategoryStatus, CategoryType } from "@finance-application/schemas";
import type { CategoryRepository } from "@/repositories/category-repository";
import { normalizeCategoryName } from "@/repositories/category-repository";
import { isoNow } from "@/utils/datetime";
import {
	categoryStatusSchema,
	categoryTypeSchema,
} from "@finance-application/schemas";

export interface CategoryView {
	id: string;
	name: string;
	type: CategoryType;
	color: string | null;
	icon: string | null;
	status: CategoryStatus;
	archivedAt: string | null;
	deletedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

function toView(category: Category): CategoryView {
	// The DB CHECK constraints guarantee the enum values; parsing here keeps
	// the view types honest without an unsafe cast.
	return {
		...category,
		type: categoryTypeSchema.parse(category.type),
		status: categoryStatusSchema.parse(category.status),
	};
}

// Each method fails with exactly one code so controllers can map it to a
// literal response status.
export type CategoryOutcome<T, E extends ErrorCode> =
	| { ok: true; value: T }
	| { ok: false; code: E };

export type CreateCategoryOutcome = CategoryOutcome<
	CategoryView,
	"CATEGORY_NAME_TAKEN"
>;
export type GetCategoryOutcome = CategoryOutcome<CategoryView, "NOT_FOUND">;
export type UpdateCategoryOutcome = CategoryOutcome<
	CategoryView,
	| "NOT_FOUND"
	| "CATEGORY_NAME_TAKEN"
	| "CATEGORY_TYPE_LOCKED"
	| "CATEGORY_TRANSITION_INVALID"
>;
export type TransitionCategoryOutcome = CategoryOutcome<
	CategoryView,
	"NOT_FOUND" | "CATEGORY_TRANSITION_INVALID" | "CATEGORY_NAME_TAKEN"
>;

export interface CategoryList {
	categories: CategoryView[];
}

export interface CreateCategoryInput {
	userId: string;
	name: string;
	type: string;
	color?: string | null;
	icon?: string | null;
}

export interface UpdateCategoryInput {
	userId: string;
	categoryId: string;
	name?: string;
	type?: string;
	color?: string | null;
	icon?: string | null;
}

export interface RestoreCategoryInput {
	userId: string;
	categoryId: string;
	newName?: string;
}

// Lifecycle state machine: exactly these transitions are valid; anything else
// is a conflict. Archived and deleted categories are not editable.
const VALID_TRANSITIONS: Record<CategoryStatus, readonly CategoryStatus[]> = {
	active: ["archived", "deleted"],
	archived: ["active"],
	deleted: ["active"],
};

export interface CategoryServiceDeps {
	categories: CategoryRepository;
	getReferencingTransactionCount?: (
		categoryId: string,
	) => Promise<number>;
}

export function createCategoryService(deps: CategoryServiceDeps) {
	const { categories } = deps;
	const referencingCount =
		deps.getReferencingTransactionCount ??
		((categoryId: string) =>
			categories.getReferencingTransactionCount(categoryId));

	async function requireOwnedCategory(
		userId: string,
		categoryId: string,
	): Promise<Category | undefined> {
		const category = await categories.findById(categoryId);
		if (!category || category.userId !== userId) {
			return undefined;
		}
		return category;
	}

	async function findNameConflict(userId: string, name: string) {
		return categories.findNonDeletedByNameNormalized(
			userId,
			normalizeCategoryName(name),
		);
	}

	async function transitionTo(
		userId: string,
		categoryId: string,
		target: CategoryStatus,
		options?: { newName?: string },
	): Promise<TransitionCategoryOutcome> {
		const category = await requireOwnedCategory(userId, categoryId);
		if (!category) {
			return { ok: false, code: "NOT_FOUND" };
		}
		const allowed = VALID_TRANSITIONS[category.status as CategoryStatus];
		if (!allowed?.includes(target)) {
			return { ok: false, code: "CATEGORY_TRANSITION_INVALID" };
		}
		const nowIso = isoNow();
		const timestamps =
			target === "archived"
				? { archivedAt: nowIso, deletedAt: null }
				: target === "deleted"
					? { archivedAt: null, deletedAt: nowIso }
					: { archivedAt: null, deletedAt: null };
		if (target === "active") {
			// A name taken while the category was archived or deleted blocks the
			// restore; the caller can retry with an explicit `newName`, applied
			// atomically with the reactivation.
			const requestedName = options?.newName ?? category.name;
			const conflict = await findNameConflict(userId, requestedName);
			if (conflict && conflict.id !== categoryId) {
				return { ok: false, code: "CATEGORY_NAME_TAKEN" };
			}
			if (options?.newName !== undefined) {
				const renamed = await categories.updateStatusWithRename(
					categoryId,
					target,
					options.newName,
					timestamps,
					nowIso,
				);
				if (!renamed) {
					return { ok: false, code: "NOT_FOUND" };
				}
				return { ok: true, value: toView(renamed) };
			}
		}
		const updated = await categories.updateStatus(
			categoryId,
			target,
			timestamps,
			nowIso,
		);
		if (!updated) {
			return { ok: false, code: "NOT_FOUND" };
		}
		return { ok: true, value: toView(updated) };
	}

	return {
		// Creation never writes any other financial record.
		async create(input: CreateCategoryInput): Promise<CreateCategoryOutcome> {
			const conflict = await findNameConflict(input.userId, input.name);
			if (conflict) {
				return { ok: false, code: "CATEGORY_NAME_TAKEN" };
			}
			const nowIso = isoNow();
			const category = await categories.insert({
				id: uuidV7(),
				userId: input.userId,
				name: input.name,
				type: input.type,
				color: input.color ?? null,
				icon: input.icon ?? null,
				createdAt: nowIso,
				updatedAt: nowIso,
			});
			return { ok: true, value: toView(category) };
		},

		async list(userId: string, status: CategoryStatus): Promise<CategoryList> {
			const filtered = await categories.listByStatus(userId, status);
			return { categories: filtered.map(toView) };
		},

		async get(
			userId: string,
			categoryId: string,
		): Promise<GetCategoryOutcome> {
			const category = await requireOwnedCategory(userId, categoryId);
			if (!category) {
				return { ok: false, code: "NOT_FOUND" };
			}
			return { ok: true, value: toView(category) };
		},

		async update(
			input: UpdateCategoryInput,
		): Promise<UpdateCategoryOutcome> {
			const category = await requireOwnedCategory(
				input.userId,
				input.categoryId,
			);
			if (!category) {
				return { ok: false, code: "NOT_FOUND" };
			}
			if (category.status !== "active") {
				return { ok: false, code: "CATEGORY_TRANSITION_INVALID" };
			}
			// The type is locked while any non-deleted transaction references the
			// category, so recorded history is never silently reinterpreted.
			const changesType =
				input.type !== undefined && input.type !== category.type;
			if (changesType) {
				const referencing =
					await referencingCount(input.categoryId);
				if (referencing > 0) {
					return { ok: false, code: "CATEGORY_TYPE_LOCKED" };
				}
			}
			if (input.name !== undefined) {
				const conflict = await findNameConflict(input.userId, input.name);
				if (conflict && conflict.id !== input.categoryId) {
					return { ok: false, code: "CATEGORY_NAME_TAKEN" };
				}
			}
			const updated = await categories.updateDetails(
				input.categoryId,
				{
					name: input.name,
					type: input.type,
					color: input.color,
					icon: input.icon,
				},
				isoNow(),
			);
			if (!updated) {
				return { ok: false, code: "NOT_FOUND" };
			}
			return { ok: true, value: toView(updated) };
		},

		async archive(
			userId: string,
			categoryId: string,
		): Promise<TransitionCategoryOutcome> {
			return transitionTo(userId, categoryId, "archived");
		},

		async remove(
			userId: string,
			categoryId: string,
		): Promise<TransitionCategoryOutcome> {
			return transitionTo(userId, categoryId, "deleted");
		},

		// Restoring keeps all category data; when the name was taken while the
		// category was archived/deleted, the conflict is surfaced and the caller
		// can retry with an explicit `newName` applied atomically on restore.
		async restore(
			input: RestoreCategoryInput,
		): Promise<TransitionCategoryOutcome> {
			return transitionTo(input.userId, input.categoryId, "active", {
				newName: input.newName,
			});
		},

		transition: transitionTo,
	};
}

export type CategoryService = ReturnType<typeof createCategoryService>;
