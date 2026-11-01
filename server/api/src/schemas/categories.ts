import {
	categoryColorSchema,
	categoryIconSchema,
	categoryListResponseSchema,
	categoryNameSchema,
	categoryResponseSchema,
	categoryStatuses,
	categoryStatusSchema,
	categoryTypeSchema,
} from "@finance-application/schemas";
import { z } from "@hono/zod-openapi";

// The shared package owns the validation rules; this module owns the OpenAPI
// metadata the route definitions need. The object schemas here are rebuilt
// from the shared field schemas so rule changes propagate from one place.
// Response and envelope schemas need no metadata and are re-exported as-is.

export {
	categoryListResponseSchema,
	categoryResponseSchema,
	categoryStatusSchema,
};

export const createCategoryBodySchema = z.object({
	name: categoryNameSchema.openapi({ example: "Groceries" }),
	type: categoryTypeSchema.openapi({
		description: "income or expense",
	}),
	color: categoryColorSchema
		.openapi({ description: "Presentation color as #RRGGBB" })
		.optional(),
	icon: categoryIconSchema
		.openapi({ description: "Lucide icon name, e.g. utensils" })
		.optional(),
});

export const updateCategoryBodySchema = z.object({
	name: categoryNameSchema.openapi({ example: "Groceries" }).optional(),
	type: categoryTypeSchema.optional(),
	// Null clears the presentation value; omitted leaves it unchanged.
	color: categoryColorSchema.nullable().optional(),
	icon: categoryIconSchema.nullable().optional(),
});

export const restoreCategoryBodySchema = z.object({
	newName: categoryNameSchema.optional(),
});

export const listCategoriesQuerySchema = z.object({
	status: z.enum(categoryStatuses).default("active"),
});
