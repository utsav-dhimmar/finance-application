import { z } from "zod";
import { MAX_AMOUNT_MINOR, amountInputSchema } from "./accounts";

// Single source of truth for transaction validation rules, shared by the API,
// the web app, and the future mobile client. OpenAPI metadata for the API's
// route schemas is layered on top of these in apps/api/src/schemas — do not
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
	.positive("Amount must be greater than zero")
	.max(MAX_AMOUNT_MINOR, "Amount exceeds the supported maximum");

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

export const transactionRecurrenceInputSchema = z.object({
	intervalMonths: z
		.number()
		.int("Duration interval must be a whole number of months")
		.min(1, "Interval must be at least 1 month")
		.max(120, "Interval cannot exceed 120 months"),
	endDate: transactionDateSchema.optional().nullable(),
});
export type TransactionRecurrenceInput = z.infer<
	typeof transactionRecurrenceInputSchema
>;

export const createTransactionBodySchema = z.object({
	id: transactionIdSchema,
	type: transactionTypeSchema,
	amountMinor: transactionAmountSchema,
	date: transactionDateSchema,
	accountId: z.string().min(1),
	categoryId: z.string().min(1),
	notes: transactionNotesSchema.optional(),
	recurrence: transactionRecurrenceInputSchema.optional().nullable(),
	recurringExpenseId: transactionIdSchema.optional().nullable(),
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
	page: z.coerce.number().int().min(1).max(10_000).default(1),
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
	recurringExpenseId: z.string().nullable().optional(),
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

// CSV export: the API returns keyset-paginated raw rows (no server-side
// formatting) and the browser assembles the file. The cursor is the id of the
// last row of the previous chunk; the row shape carries only the fields the
// CSV needs, so responses stay lean on the Worker's CPU budget.
export const EXPORT_CHUNK_MIN = 100;
export const EXPORT_CHUNK_MAX = 2000;
export const EXPORT_CHUNK_DEFAULT = 1000;

export const exportTransactionsQuerySchema = listTransactionsQuerySchema
	.omit({ page: true, pageSize: true })
	.extend({
		cursor: transactionIdSchema.optional(),
		limit: z.coerce
			.number()
			.int()
			.min(EXPORT_CHUNK_MIN, "Limit must be at least 100")
			.max(EXPORT_CHUNK_MAX, "Limit cannot exceed 2000")
			.default(EXPORT_CHUNK_DEFAULT),
	});

export const exportTransactionRowSchema = z.object({
	id: z.string(),
	date: z.string(),
	createdAt: z.string(),
	type: transactionTypeSchema,
	amountMinor: z.number().int(),
	notes: z.string().nullable(),
	status: transactionStatusSchema,
	accountName: z.string().nullable(),
	categoryName: z.string().nullable(),
});

export const exportTransactionsResponseSchema = z.object({
	transactions: z.array(exportTransactionRowSchema),
	nextCursor: z.string().nullable(),
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
	isRecurring: z.boolean().default(false),
	recurrenceIntervalMonths: z.coerce.number().int().min(1).max(120).default(1),
	recurrenceEndDate: transactionDateSchema.optional().or(z.literal("")),
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
export type ExportTransactionsQuery = z.infer<
	typeof exportTransactionsQuerySchema
>;
export type ExportTransactionRow = z.infer<typeof exportTransactionRowSchema>;
export type ExportTransactionsResponse = z.infer<
	typeof exportTransactionsResponseSchema
>;
export type TransactionFormInput = z.input<typeof transactionFormSchema>;
export type TransactionFormValues = z.output<typeof transactionFormSchema>;
