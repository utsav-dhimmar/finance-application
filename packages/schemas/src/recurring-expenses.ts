import { z } from "zod";
import { amountInputSchema } from "./accounts";
import {
	NOTES_MAX_LENGTH,
	transactionAmountSchema,
	transactionDateSchema,
	transactionIdSchema,
	transactionNotesSchema,
	transactionRecurrenceInputSchema,
	transactionResponseSchema,
	type TransactionRecurrenceInput,
} from "./transactions";

export const recurringExpenseStatuses = [
	"active",
	"paused",
	"completed",
	"cancelled",
] as const;

export const recurringExpenseStatusSchema = z.enum(recurringExpenseStatuses);
export type RecurringExpenseStatus = z.infer<typeof recurringExpenseStatusSchema>;

export const recurringExpenseIntervalSchema = z
	.number()
	.int("Duration interval must be a whole number of months")
	.min(1, "Interval must be at least 1 month")
	.max(120, "Interval cannot exceed 120 months");

export const recurringExpenseIdSchema = transactionIdSchema;

export const recurringExpenseNameSchema = z
	.string()
	.trim()
	.min(1, "Name is required")
	.max(100, "Name must be at most 100 characters");

export const createRecurringExpenseBodySchema = z
	.object({
		id: recurringExpenseIdSchema,
		name: recurringExpenseNameSchema,
		amountMinor: transactionAmountSchema,
		intervalMonths: recurringExpenseIntervalSchema,
		startDate: transactionDateSchema,
		sourceAccountId: z.string().min(1, "Source account is required"),
		categoryId: z.string().min(1, "Category is required"),
		endDate: transactionDateSchema.optional().nullable(),
		notes: transactionNotesSchema.optional().nullable(),
	})
	.refine(
		(data) => {
			if (!data.endDate) return true;
			return data.endDate >= data.startDate;
		},
		{
			message: "End date must be on or after start date",
			path: ["endDate"],
		},
	);

export type CreateRecurringExpenseBody = z.infer<
	typeof createRecurringExpenseBodySchema
>;

export const updateRecurringExpenseBodySchema = z
	.object({
		name: recurringExpenseNameSchema.optional(),
		amountMinor: transactionAmountSchema.optional(),
		intervalMonths: recurringExpenseIntervalSchema.optional(),
		sourceAccountId: z.string().min(1).optional(),
		categoryId: z.string().min(1).optional(),
		endDate: transactionDateSchema.optional().nullable(),
		notes: transactionNotesSchema.optional().nullable(),
	});

export type UpdateRecurringExpenseBody = z.infer<
	typeof updateRecurringExpenseBodySchema
>;

export const listRecurringExpensesQuerySchema = z.object({
	status: recurringExpenseStatusSchema.optional(),
	sourceAccountId: z.string().min(1).optional(),
	categoryId: z.string().min(1).optional(),
});

export type ListRecurringExpensesQuery = z.infer<
	typeof listRecurringExpensesQuerySchema
>;

export const dueRecurringExpensesQuerySchema = z.object({
	asOfDate: transactionDateSchema.optional(),
});

export type DueRecurringExpensesQuery = z.infer<
	typeof dueRecurringExpensesQuerySchema
>;

export const postDueRecurringExpenseBodySchema = z.object({
	transactionId: transactionIdSchema,
	date: transactionDateSchema.optional(),
	amountMinor: transactionAmountSchema.optional(),
	notes: transactionNotesSchema.optional().nullable(),
});

export type PostDueRecurringExpenseBody = z.infer<
	typeof postDueRecurringExpenseBodySchema
>;

export {
	transactionRecurrenceInputSchema,
	type TransactionRecurrenceInput,
};

export const recurringExpenseResponseSchema = z.object({
	id: z.string(),
	name: z.string(),
	amountMinor: z.number().int(),
	intervalMonths: z.number().int(),
	sourceAccountId: z.string(),
	accountName: z.string().nullable(),
	categoryId: z.string(),
	categoryName: z.string().nullable(),
	startDate: z.string(),
	nextDueDate: z.string(),
	endDate: z.string().nullable(),
	lastPostedDate: z.string().nullable(),
	status: recurringExpenseStatusSchema,
	notes: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
	daysUntilDue: z.number().optional(),
	isOverdue: z.boolean().optional(),
});

export type RecurringExpenseResponse = z.infer<
	typeof recurringExpenseResponseSchema
>;

export const recurringExpenseListResponseSchema = z.object({
	recurringExpenses: z.array(recurringExpenseResponseSchema),
});

export type RecurringExpenseListResponse = z.infer<
	typeof recurringExpenseListResponseSchema
>;

export const postDueResponseSchema = z.object({
	transaction: transactionResponseSchema,
	recurringExpense: recurringExpenseResponseSchema,
});

export type PostDueResponse = z.infer<typeof postDueResponseSchema>;

export const recurringExpenseFormSchema = z.object({
	name: recurringExpenseNameSchema,
	amount: amountInputSchema,
	intervalMonths: z.coerce.number().int().min(1).max(120),
	startDate: transactionDateSchema,
	sourceAccountId: z.string().min(1, "Select an account"),
	categoryId: z.string().min(1, "Select a category"),
	endDate: transactionDateSchema.optional().or(z.literal("")),
	notes: z.string().max(NOTES_MAX_LENGTH).optional(),
});

export type RecurringExpenseFormValues = z.infer<
	typeof recurringExpenseFormSchema
>;
