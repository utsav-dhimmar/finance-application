import {
	activityListResponseSchema,
	activityListQuerySchema as sharedActivityListQuerySchema,
	restoreTransferBodySchema,
	transferAmountSchema,
	transferDateSchema,
	transferIdSchema,
	transferListResponseSchema,
	transferNotesSchema,
	transferStatusSchema,
	transferStatuses,
	transferResponseSchema,
	updateTransferBodySchema,
} from "@finance-application/schemas";
import { z } from "@hono/zod-openapi";

// The shared package owns the validation rules; this module owns the OpenAPI
// metadata the route definitions need. Response and envelope schemas need no
// metadata and are re-exported as-is.

export {
	activityListResponseSchema,
	restoreTransferBodySchema,
	transferListResponseSchema,
	transferResponseSchema,
	transferStatusSchema,
	updateTransferBodySchema,
};

// The transport schema omits the shared create schema's same-account
// refinement: the transfer service owns that rule and answers with the
// SAME_ACCOUNT_TRANSFER conflict (409), not a validation error (400).
export const createTransferBodySchema = z.object({
	id: transferIdSchema.openapi({
		description:
			"Client-generated UUIDv7 id; repeats return the existing record",
		example: "018f6a2c-9b7d-7ce2-8f3a-1d4e5f6a7b8c",
	}),
	amountMinor: transferAmountSchema.openapi({
		description: "Strictly positive integer paise",
	}),
	date: transferDateSchema.openapi({
		description: "Calendar date (YYYY-MM-DD) the transfer belongs to",
	}),
	sourceAccountId: z
		.string()
		.min(1)
		.openapi({ description: "Source account id" }),
	destinationAccountId: z
		.string()
		.min(1)
		.openapi({
			description: "Destination account id; must differ from the source",
		}),
	notes: transferNotesSchema
		.openapi({ description: "Optional notes" })
		.optional(),
});

export const transferListQuerySchema = z.object({
	status: z.enum(transferStatuses).default("active"),
	from: transferDateSchema.optional(),
	to: transferDateSchema.optional(),
	accountId: z.string().min(1).optional(),
	q: z.string().trim().max(200).optional(),
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const activityListQuerySchema = z.object({
	status: z.enum(transferStatuses).default("active"),
	from: transferDateSchema.optional(),
	to: transferDateSchema.optional(),
	type: sharedActivityListQuerySchema.shape.type,
	accountId: z.string().min(1).optional(),
	categoryId: z.string().min(1).optional(),
	q: z.string().trim().max(200).optional(),
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
