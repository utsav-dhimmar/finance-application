import {
	createRecurringExpenseBodySchema as sharedCreateBodySchema,
	dueRecurringExpensesQuerySchema as sharedDueQuerySchema,
	listRecurringExpensesQuerySchema as sharedListQuerySchema,
	postDueRecurringExpenseBodySchema as sharedPostDueBodySchema,
	recurringExpenseStatusSchema,
	transactionResponseSchema,
	updateRecurringExpenseBodySchema as sharedUpdateBodySchema,
} from "@finance-application/schemas";
import { z } from "@hono/zod-openapi";

export {
	sharedCreateBodySchema as createRecurringExpenseBodySchema,
	sharedDueQuerySchema as dueRecurringExpensesQuerySchema,
	sharedListQuerySchema as listRecurringExpensesQuerySchema,
	sharedPostDueBodySchema as postDueRecurringExpenseBodySchema,
	sharedUpdateBodySchema as updateRecurringExpenseBodySchema,
};

export const recurringExpenseResponseSchema = z.object({
	id: z.string().openapi({ description: "UUIDv7 identifier" }),
	name: z.string().openapi({ description: "Name of the recurring expense" }),
	amountMinor: z.number().int().openapi({ description: "Amount in paise" }),
	intervalMonths: z
		.number()
		.int()
		.openapi({ description: "Cadence interval in months" }),
	sourceAccountId: z.string().openapi({ description: "Source account id" }),
	accountName: z.string().nullable(),
	categoryId: z.string().openapi({ description: "Expense category id" }),
	categoryName: z.string().nullable(),
	startDate: z.string().openapi({ description: "Start date (YYYY-MM-DD)" }),
	nextDueDate: z
		.string()
		.openapi({ description: "Next due date (YYYY-MM-DD)" }),
	endDate: z.string().nullable(),
	lastPostedDate: z.string().nullable(),
	status: recurringExpenseStatusSchema,
	notes: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
	daysUntilDue: z.number().optional(),
	isOverdue: z.boolean().optional(),
});

export const recurringExpenseListResponseSchema = z.object({
	recurringExpenses: z.array(recurringExpenseResponseSchema),
});

export const postDueResponseSchema = z.object({
	transaction: transactionResponseSchema,
	recurringExpense: recurringExpenseResponseSchema,
});
