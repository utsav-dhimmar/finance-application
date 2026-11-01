import { z } from "zod";
import { ACCOUNT_NAME_MAX_LENGTH } from "./accounts";

// Single source of truth for category validation rules, shared by the API, the
// web app, and the future mobile client. OpenAPI metadata for the API's route
// schemas is layered on top of these in server/api/src/schemas — do not add
// transport concerns here.

export const categoryTypes = ["income", "expense"] as const;
export const categoryTypeSchema = z.enum(categoryTypes);
export type CategoryType = z.infer<typeof categoryTypeSchema>;

export const categoryStatuses = ["active", "archived", "deleted"] as const;
export const categoryStatusSchema = z.enum(categoryStatuses);
export type CategoryStatus = z.infer<typeof categoryStatusSchema>;

// Categories follow the account naming rules exactly, so the limit is shared:
// one constant keeps any future length change in sync across both modules.
export const CATEGORY_NAME_MAX_LENGTH = ACCOUNT_NAME_MAX_LENGTH;

export const categoryNameSchema = z
	.string()
	.trim()
	.min(1, "Category name is required")
	.max(
		CATEGORY_NAME_MAX_LENGTH,
		`Category name must be at most ${CATEGORY_NAME_MAX_LENGTH} characters`,
	);

// Presentation color as a strict #RRGGBB hex string; empty means "unset" and
// is stored as null.
export const categoryColorSchema = z
	.string()
	.trim()
	.regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #22C55E");

// Presentation icon as a Lucide icon name (kebab-case component name without
// the Icon suffix, e.g. "utensils" or "shopping-cart").
export const CATEGORY_ICON_MAX_LENGTH = 50;
export const categoryIconSchema = z
	.string()
	.trim()
	.max(
		CATEGORY_ICON_MAX_LENGTH,
		`Icon name must be at most ${CATEGORY_ICON_MAX_LENGTH} characters`,
	)
	.regex(
		/^(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/,
		"Use a lowercase icon name like utensils",
	);

export const createCategoryBodySchema = z.object({
	name: categoryNameSchema,
	type: categoryTypeSchema,
	color: categoryColorSchema.optional(),
	icon: categoryIconSchema.optional(),
});

// `color`/`icon` accept null to clear the presentation value; omitted fields
// are left unchanged.
export const updateCategoryBodySchema = z.object({
	name: categoryNameSchema.optional(),
	type: categoryTypeSchema.optional(),
	color: categoryColorSchema.nullable().optional(),
	icon: categoryIconSchema.nullable().optional(),
});

export const restoreCategoryBodySchema = z.object({
	newName: categoryNameSchema.optional(),
});

export const categoryResponseSchema = z.object({
	id: z.string(),
	name: z.string(),
	type: categoryTypeSchema,
	color: z.string().nullable(),
	icon: z.string().nullable(),
	status: categoryStatusSchema,
	archivedAt: z.string().nullable(),
	deletedAt: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const categoryListResponseSchema = z.object({
	categories: z.array(categoryResponseSchema),
});

// Web form input: color/icon accept an empty string meaning "unset" — the
// dialogs translate that to omitted (create) or null (edit) — while non-empty
// values are validated inline with the shared rules. A union instead of a
// preprocess keeps the field's input type a plain string for form bindings.
export const categoryFormSchema = createCategoryBodySchema.extend({
	color: z.union([categoryColorSchema, z.literal("")]).optional(),
	icon: z.union([categoryIconSchema, z.literal("")]).optional(),
});

export type CreateCategoryBody = z.infer<typeof createCategoryBodySchema>;
export type UpdateCategoryBody = z.infer<typeof updateCategoryBodySchema>;
export type RestoreCategoryBody = z.infer<typeof restoreCategoryBodySchema>;
export type CategoryResponse = z.infer<typeof categoryResponseSchema>;
export type CategoryListResponse = z.infer<typeof categoryListResponseSchema>;
export type CategoryFormInput = z.input<typeof categoryFormSchema>;
export type CategoryFormValues = z.output<typeof categoryFormSchema>;
