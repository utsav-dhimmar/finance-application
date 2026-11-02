import { z } from "zod";
import { amountInputSchema } from "./accounts";
import {
	NOTES_MAX_LENGTH,
	transactionAmountSchema,
	transactionDateSchema,
	transactionIdSchema,
	transactionNotesSchema,
	transactionStatusSchema,
	transactionStatuses,
	transactionTypeSchema,
} from "./transactions";

// Single source of truth for transfer validation rules, shared by the API,
// the web app, and the future mobile client. OpenAPI metadata for the API's
// route schemas is layered on top of these in server/api/src/schemas — do not
// add transport concerns here.

// Transfers share the transaction rules for ids, amounts, dates, notes, and
// lifecycle states; aliasing keeps exactly one definition of each rule.
export const transferStatuses = transactionStatuses;
export const transferStatusSchema = transactionStatusSchema;
export type TransferStatus = z.infer<typeof transferStatusSchema>;

export const transferIdSchema = transactionIdSchema;
export const transferAmountSchema = transactionAmountSchema;
export const transferDateSchema = transactionDateSchema;
export const transferNotesSchema = transactionNotesSchema;

// Same-account refinement lives on the shared schema so web forms reject it
// before submission. The API's transport schema omits it: the transfer service
// owns the rule there and answers with the SAME_ACCOUNT_TRANSFER conflict.
export const createTransferBodySchema = z
	.object({
		id: transferIdSchema,
		amountMinor: transferAmountSchema,
		date: transferDateSchema,
		sourceAccountId: z.string().min(1),
		destinationAccountId: z.string().min(1),
		notes: transferNotesSchema.optional(),
	})
	.refine(
		(values) => values.sourceAccountId !== values.destinationAccountId,
		{
			message: "Source and destination accounts must be different",
			path: ["destinationAccountId"],
		},
	);

// Partial by design; the service merges patches onto the stored transfer and
// enforces the distinct-accounts rule against the merged pair (a body changing
// only one side onto the other is a conflict, not a validation error).
export const updateTransferBodySchema = z.object({
	amountMinor: transferAmountSchema.optional(),
	date: transferDateSchema.optional(),
	sourceAccountId: z.string().min(1).optional(),
	destinationAccountId: z.string().min(1).optional(),
	notes: transferNotesSchema.nullable().optional(),
});

export const restoreTransferBodySchema = z.object({
	sourceAccountId: z.string().min(1).optional(),
	destinationAccountId: z.string().min(1).optional(),
});

export const transferListQuerySchema = z.object({
	status: transferStatusSchema.default("active"),
	from: transferDateSchema.optional(),
	to: transferDateSchema.optional(),
	accountId: z.string().min(1).optional(),
	q: z.string().trim().max(200).optional(),
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const transferResponseSchema = z.object({
	id: z.string(),
	amountMinor: z.number().int(),
	date: z.string(),
	sourceAccountId: z.string(),
	sourceAccountName: z.string().nullable(),
	destinationAccountId: z.string(),
	destinationAccountName: z.string().nullable(),
	notes: z.string().nullable(),
	status: transferStatusSchema,
	archivedAt: z.string().nullable(),
	deletedAt: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const transferListResponseSchema = z.object({
	transfers: z.array(transferResponseSchema),
	page: z.number().int(),
	pageSize: z.number().int(),
	total: z.number().int(),
});

// Web form input: the amount is a rupee string; the parsed output maps onto
// CreateTransferBody's amountMinor. Empty notes mean "unset".
export const transferFormSchema = z
	.object({
		amount: amountInputSchema.pipe(
			z.number().refine((value) => value > 0, "Amount must be greater than zero"),
		),
		date: transferDateSchema,
		sourceAccountId: z.string().min(1, "Choose a source account"),
		destinationAccountId: z.string().min(1, "Choose a destination account"),
		notes: z
			.string()
			.trim()
			.max(
				NOTES_MAX_LENGTH,
				`Notes must be at most ${NOTES_MAX_LENGTH} characters`,
			)
			.optional(),
	})
	.refine(
		(values) => values.sourceAccountId !== values.destinationAccountId,
		{
			message: "Source and destination must be different accounts",
			path: ["destinationAccountId"],
		},
	);

// Unified account-history contract: account-scoped transactions UNION ALL
// transfer sides, every row written from one account's perspective. Category
// filters exclude transfers by construction (transfers have no category).
export const activityKinds = ["transaction", "transfer"] as const;
export const activityKindSchema = z.enum(activityKinds);
export type ActivityKind = z.infer<typeof activityKindSchema>;

export const activityDirections = ["in", "out"] as const;
export const activityDirectionSchema = z.enum(activityDirections);
export type ActivityDirection = z.infer<typeof activityDirectionSchema>;

// The history type filter extends the transaction types with transfers.
export const activityTypes = ["income", "expense", "transfer"] as const;
export const activityTypeSchema = z.enum(activityTypes);
export type ActivityType = z.infer<typeof activityTypeSchema>;

export const activityItemSchema = z.object({
	// Transaction id or transfer id; a transfer contributes one row per
	// involved account, so its id can appear twice in an unscoped list.
	id: z.string(),
	kind: activityKindSchema,
	date: z.string(),
	// Signed effect on the row's account: income credits, expense debits,
	// transfers subtract on the source side and add on the destination side.
	amountMinor: z.number().int(),
	// Direction of money relative to the row's account (transfers only).
	direction: activityDirectionSchema.nullable(),
	accountId: z.string(),
	accountName: z.string().nullable(),
	status: transferStatusSchema,
	notes: z.string().nullable(),
	// Transaction-only fields (null on transfer rows).
	type: transactionTypeSchema.nullable(),
	categoryId: z.string().nullable(),
	categoryName: z.string().nullable(),
	// Transfer-only fields (null on transaction rows): the account on the
	// other side of the transfer.
	counterpartyAccountId: z.string().nullable(),
	counterpartyAccountName: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
	archivedAt: z.string().nullable(),
	deletedAt: z.string().nullable(),
});

export const activityListResponseSchema = z.object({
	activity: z.array(activityItemSchema),
	page: z.number().int(),
	pageSize: z.number().int(),
	total: z.number().int(),
});

export const activityListQuerySchema = z.object({
	status: transferStatusSchema.default("active"),
	from: transferDateSchema.optional(),
	to: transferDateSchema.optional(),
	type: activityTypeSchema.optional(),
	accountId: z.string().min(1).optional(),
	categoryId: z.string().min(1).optional(),
	q: z.string().trim().max(200).optional(),
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateTransferBody = z.infer<typeof createTransferBodySchema>;
export type UpdateTransferBody = z.infer<typeof updateTransferBodySchema>;
export type RestoreTransferBody = z.infer<typeof restoreTransferBodySchema>;
export type ListTransfersQuery = z.infer<typeof transferListQuerySchema>;
export type TransferResponse = z.infer<typeof transferResponseSchema>;
export type TransferListResponse = z.infer<typeof transferListResponseSchema>;
export type TransferFormInput = z.input<typeof transferFormSchema>;
export type TransferFormValues = z.output<typeof transferFormSchema>;
export type ActivityItem = z.infer<typeof activityItemSchema>;
export type ActivityListResponse = z.infer<typeof activityListResponseSchema>;
export type ListActivityQuery = z.infer<typeof activityListQuerySchema>;
