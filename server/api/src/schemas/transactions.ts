import {
	restoreTransactionBodySchema,
	transactionAmountSchema,
	transactionDateSchema,
	transactionIdSchema,
	transactionListResponseSchema,
	transactionNotesSchema,
	transactionResponseSchema,
	transactionStatuses,
	transactionStatusSchema,
	transactionTypeSchema,
	updateTransactionBodySchema,
} from "@finance-application/schemas";
import { z } from "@hono/zod-openapi";

// The shared package owns the validation rules; this module owns the OpenAPI
// metadata the route definitions need. Response and envelope schemas need no
// metadata and are re-exported as-is.

export {
	restoreTransactionBodySchema,
	transactionListResponseSchema,
	transactionResponseSchema,
	transactionStatusSchema,
	updateTransactionBodySchema,
};

export const createTransactionBodySchema = z.object({
	id: transactionIdSchema.openapi({
		description:
			"Client-generated UUIDv7 id; repeats return the existing record",
		example: "018f6a2c-9b7d-7ce2-8f3a-1d4e5f6a7b8c",
	}),
	type: transactionTypeSchema.openapi({
		description: "income credits the account, expense debits it",
	}),
	amountMinor: transactionAmountSchema.openapi({
		description: "Strictly positive integer paise",
	}),
	date: transactionDateSchema.openapi({
		description: "Calendar date (YYYY-MM-DD) the transaction belongs to",
	}),
	accountId: z.string().min(1).openapi({ description: "Target account id" }),
	categoryId: z
		.string()
		.min(1)
		.openapi({ description: "Active category id compatible with the type" }),
	notes: transactionNotesSchema
		.openapi({ description: "Optional notes" })
		.optional(),
	recurrence: z
		.object({
			intervalMonths: z
				.number()
				.int()
				.min(1)
				.max(120)
				.openapi({ description: "Duration interval in months" }),
			endDate: transactionDateSchema.optional().nullable(),
		})
		.optional()
		.nullable(),
	recurringExpenseId: transactionIdSchema.optional().nullable(),
});

export const listTransactionsQuerySchema = z.object({
	status: z.enum(transactionStatuses).default("active"),
	from: transactionDateSchema.optional(),
	to: transactionDateSchema.optional(),
	type: transactionTypeSchema.optional(),
	accountId: z.string().min(1).optional(),
	categoryId: z.string().min(1).optional(),
	q: z.string().trim().max(200).optional(),
	page: z.coerce.number().int().min(1).max(10_000).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
