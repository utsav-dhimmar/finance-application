import { z } from "zod";
import { amountInputSchema } from "./accounts";

// Single source of truth for transaction validation rules, shared by the API,
// the web app, and the future mobile client. OpenAPI metadata for the API's
// route schemas is layered on top of these in server/api/src/schemas — do not
// add transport concerns here.

export const transactionTypes = ["income", "expense"] as const;
export const transactionTypeSchema = z.enum(transactionTypes);
export type TransactionType = z.infer<typeof transactionTypeSchema>;

export const transactionStatuses = ["active", "archived", "deleted"] as const;
export const transactionStatusSchema = z.enum(transactionStatuses);
export type TransactionStatus = z.infer<typeof transactionStatusSchema>;

// Transaction amounts are strictly positive: the sign comes from the type
// (income credits the account, expense debits it), never from the amount.
export const transactionAmountSchema = z
	.number()
	.int("Amount must be a whole number of paise")
	.positive("Amount must be greater than zero");

// Transaction dates are calendar dates (YYYY-MM-DD), independent of creation
// timestamps, so date-based reports never shift with timezones.
export const transactionDateSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date in YYYY-MM-DD format")
	.refine((value) => {
		const [year, month, day] = value.split("-").map(Number);
		const date = new Date(Date.UTC(year ?? 0, (month ?? 0) - 1, day ?? 0));
		return (
			date.getUTCFullYear() === year &&
			date.getUTCMonth() === (month ?? 1) - 1 &&
			date.getUTCDate() === day
		);
	}, "Enter a real calendar date");

// Creation is idempotent via a client-generated UUIDv7 id: the version nibble
// must be 7, not just any UUID.
export const transactionIdSchema = z
	.string()
	.uuid("Use a UUID-formatted id")
	.refine((value) => value[14] === "7", "Use a UUIDv7 (version 7) id");

export const NOTES_MAX_LENGTH = 500;
export const transactionNotesSchema = z
	.string()
	.trim()
	.max(
		NOTES_MAX_LENGTH,
		`Notes must be at most ${NOTES_MAX_LENGTH} characters`,
	);

export const createTransactionBodySchema = z.object({
	id: transactionIdSchema,
	type: transactionTypeSchema,
	amountMinor: transactionAmountSchema,
	date: transactionDateSchema,
	accountId: z.string().min(1),
	categoryId: z.string().min(1),
	notes: transactionNotesSchema.optional(),
});

export const updateTransactionBodySchema = z.object({
	amountMinor: transactionAmountSchema.optional(),
	date: transactionDateSchema.optional(),
	accountId: z.string().min(1).optional(),
	categoryId: z.string().min(1).optional(),
	notes: transactionNotesSchema.nullable().optional(),
});

export const restoreTransactionBodySchema = z.object({
	accountId: z.string().min(1).optional(),
	categoryId: z.string().min(1).optional(),
});

export const listTransactionsQuerySchema = z.object({
	status: transactionStatusSchema.default("active"),
	from: transactionDateSchema.optional(),
	to: transactionDateSchema.optional(),
	type: transactionTypeSchema.optional(),
	accountId: z.string().min(1).optional(),
	categoryId: z.string().min(1).optional(),
	q: z.string().trim().max(200).optional(),
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const transactionResponseSchema = z.object({
	id: z.string(),
	type: transactionTypeSchema,
	amountMinor: z.number().int(),
	date: z.string(),
	accountId: z.string(),
	accountName: z.string().nullable(),
	categoryId: z.string(),
	categoryName: z.string().nullable(),
	notes: z.string().nullable(),
	status: transactionStatusSchema,
	archivedAt: z.string().nullable(),
	deletedAt: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const transactionListResponseSchema = z.object({
	transactions: z.array(transactionResponseSchema),
	page: z.number().int(),
	pageSize: z.number().int(),
	total: z.number().int(),
});

// Web form input: the amount is a rupee string; the parsed output maps onto
// CreateTransactionBody's amountMinor. Empty notes mean "unset".
export const transactionFormSchema = z.object({
	type: transactionTypeSchema,
	amount: amountInputSchema.pipe(
		z.number().refine((value) => value > 0, "Amount must be greater than zero"),
	),
	date: transactionDateSchema,
	accountId: z.string().min(1, "Choose an account"),
	categoryId: z.string().min(1, "Choose a category"),
	notes: z
		.string()
		.trim()
		.max(
			NOTES_MAX_LENGTH,
			`Notes must be at most ${NOTES_MAX_LENGTH} characters`,
		)
		.optional(),
});

export type CreateTransactionBody = z.infer<typeof createTransactionBodySchema>;
export type UpdateTransactionBody = z.infer<typeof updateTransactionBodySchema>;
export type RestoreTransactionBody = z.infer<
	typeof restoreTransactionBodySchema
>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
export type TransactionResponse = z.infer<typeof transactionResponseSchema>;
export type TransactionListResponse = z.infer<
	typeof transactionListResponseSchema
>;
export type TransactionFormInput = z.input<typeof transactionFormSchema>;
export type TransactionFormValues = z.output<typeof transactionFormSchema>;
