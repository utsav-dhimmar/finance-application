import {
	addCalendarMonths,
	diffCalendarDays,
	recurringExpenseStatusSchema,
	type RecurringExpenseStatus,
} from "@finance-application/schemas";
import type { RecurringExpense } from "@/db/schema";
import type { ErrorCode } from "@/lib/error";
import type { AccountRepository } from "@/repositories/account-repository";
import type { CategoryRepository } from "@/repositories/category-repository";
import type {
	RecurringExpensePatch,
	RecurringExpenseRepository,
} from "@/repositories/recurring-expense-repository";
import type { TransactionRepository } from "@/repositories/transaction-repository";
import type { TransactionView } from "@/services/transaction-service";
import { isoNow } from "@/utils/datetime";

export interface RecurringExpenseView {
	id: string;
	name: string;
	amountMinor: number;
	intervalMonths: number;
	sourceAccountId: string;
	accountName: string | null;
	categoryId: string;
	categoryName: string | null;
	startDate: string;
	nextDueDate: string;
	endDate: string | null;
	lastPostedDate: string | null;
	status: RecurringExpenseStatus;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
	daysUntilDue?: number;
	isOverdue?: boolean;
}

function toView(
	row: RecurringExpense & {
		accountName?: string | null;
		categoryName?: string | null;
	},
	asOfDate?: string,
): RecurringExpenseView {
	const parsedStatus = recurringExpenseStatusSchema.parse(row.status);
	const view: RecurringExpenseView = {
		id: row.id,
		name: row.name,
		amountMinor: row.amountMinor,
		intervalMonths: row.intervalMonths,
		sourceAccountId: row.sourceAccountId,
		accountName: row.accountName ?? null,
		categoryId: row.categoryId,
		categoryName: row.categoryName ?? null,
		startDate: row.startDate,
		nextDueDate: row.nextDueDate,
		endDate: row.endDate,
		lastPostedDate: row.lastPostedDate,
		status: parsedStatus,
		notes: row.notes,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};

	if (asOfDate) {
		const diff = diffCalendarDays(row.nextDueDate, asOfDate);
		view.daysUntilDue = diff;
		view.isOverdue = diff < 0;
	}

	return view;
}

export type RecurringExpenseOutcome<T, E extends ErrorCode> =
	| { ok: true; value: T }
	| { ok: false; code: E };

export type CreateRecurringExpenseOutcome =
	| { ok: true; value: RecurringExpenseView; replayed: boolean }
	| {
			ok: false;
			code: "ACCOUNT_INELIGIBLE" | "CATEGORY_INELIGIBLE" | "ID_CONFLICT";
	  };

export interface CreateRecurringExpenseInput {
	userId: string;
	id: string;
	name: string;
	amountMinor: number;
	intervalMonths: number;
	sourceAccountId: string;
	categoryId: string;
	startDate: string;
	endDate?: string | null;
	notes?: string | null;
	initialNextDueDate?: string;
	lastPostedDate?: string | null;
}

export interface UpdateRecurringExpenseInput {
	userId: string;
	id: string;
	name?: string;
	amountMinor?: number;
	intervalMonths?: number;
	sourceAccountId?: string;
	categoryId?: string;
	endDate?: string | null;
	notes?: string | null;
}

export interface PostDueRecurringExpenseInput {
	userId: string;
	id: string;
	transactionId: string;
	date?: string;
	amountMinor?: number;
	notes?: string | null;
}

export interface RecurringExpenseServiceDeps {
	recurringExpenses: RecurringExpenseRepository;
	accounts: AccountRepository;
	categories: CategoryRepository;
	transactions: TransactionRepository;
}

export function createRecurringExpenseService(
	deps: RecurringExpenseServiceDeps,
) {
	const { recurringExpenses, accounts, categories, transactions } = deps;

	async function checkAccountEligibility(
		userId: string,
		accountId: string,
	): Promise<boolean> {
		const account = await accounts.findById(accountId);
		return Boolean(
			account && account.userId === userId && account.status === "active",
		);
	}

	async function checkCategoryEligibility(
		userId: string,
		categoryId: string,
	): Promise<boolean> {
		const category = await categories.findById(categoryId);
		return Boolean(
			category &&
				category.userId === userId &&
				category.status === "active" &&
				category.type === "expense",
		);
	}

	return {
		async create(
			input: CreateRecurringExpenseInput,
		): Promise<CreateRecurringExpenseOutcome> {
			const existing = await recurringExpenses.findById(input.id);
			if (existing) {
				if (existing.userId === input.userId) {
					const row = await recurringExpenses.findByIdWithRefs(input.id);
					if (row) {
						return {
							ok: true,
							value: toView({
								...row.recurringExpense,
								accountName: row.accountName,
								categoryName: row.categoryName,
							}),
							replayed: true,
						};
					}
				}
				return { ok: false, code: "ID_CONFLICT" };
			}

			if (
				!(await checkAccountEligibility(
					input.userId,
					input.sourceAccountId,
				))
			) {
				return { ok: false, code: "ACCOUNT_INELIGIBLE" };
			}
			if (
				!(await checkCategoryEligibility(
					input.userId,
					input.categoryId,
				))
			) {
				return { ok: false, code: "CATEGORY_INELIGIBLE" };
			}

			const nowIso = isoNow();
			const nextDueDate = input.initialNextDueDate ?? input.startDate;

			try {
				const inserted = await recurringExpenses.insert({
					id: input.id,
					userId: input.userId,
					name: input.name,
					amountMinor: input.amountMinor,
					intervalMonths: input.intervalMonths,
					sourceAccountId: input.sourceAccountId,
					categoryId: input.categoryId,
					startDate: input.startDate,
					nextDueDate,
					endDate: input.endDate ?? null,
					lastPostedDate: input.lastPostedDate ?? null,
					status: "active",
					notes: input.notes ?? null,
					createdAt: nowIso,
					updatedAt: nowIso,
				});

				const rowWithRefs = await recurringExpenses.findByIdWithRefs(
					inserted.id,
				);
				return {
					ok: true,
					value: toView({
						...inserted,
						accountName: rowWithRefs?.accountName ?? null,
						categoryName: rowWithRefs?.categoryName ?? null,
					}),
					replayed: false,
				};
			} catch {
				return { ok: false, code: "ID_CONFLICT" };
			}
		},

		async getById(
			userId: string,
			id: string,
		): Promise<RecurringExpenseOutcome<RecurringExpenseView, "NOT_FOUND">> {
			const row = await recurringExpenses.findByIdWithRefs(id);
			if (!row || row.recurringExpense.userId !== userId) {
				return { ok: false, code: "NOT_FOUND" };
			}
			return {
				ok: true,
				value: toView({
					...row.recurringExpense,
					accountName: row.accountName,
					categoryName: row.categoryName,
				}),
			};
		},

		async list(
			userId: string,
			filters?: {
				status?: string;
				sourceAccountId?: string;
				categoryId?: string;
			},
		): Promise<RecurringExpenseView[]> {
			const rows = await recurringExpenses.list(userId, filters);
			return rows.map((r) =>
				toView({
					...r.recurringExpense,
					accountName: r.accountName,
					categoryName: r.categoryName,
				}),
			);
		},

		async findDue(
			userId: string,
			cutoffDate?: string,
		): Promise<RecurringExpenseView[]> {
			const targetCutoff = cutoffDate ?? isoNow().slice(0, 10);
			const rows = await recurringExpenses.findDue(userId, targetCutoff);
			return rows.map((r) =>
				toView(
					{
						...r.recurringExpense,
						accountName: r.accountName,
						categoryName: r.categoryName,
					},
					targetCutoff,
				),
			);
		},

		async update(
			input: UpdateRecurringExpenseInput,
		): Promise<
			RecurringExpenseOutcome<
				RecurringExpenseView,
				"NOT_FOUND" | "ACCOUNT_INELIGIBLE" | "CATEGORY_INELIGIBLE"
			>
		> {
			const existing = await recurringExpenses.findById(input.id);
			if (!existing || existing.userId !== input.userId) {
				return { ok: false, code: "NOT_FOUND" };
			}

			if (
				input.sourceAccountId &&
				!(await checkAccountEligibility(
					input.userId,
					input.sourceAccountId,
				))
			) {
				return { ok: false, code: "ACCOUNT_INELIGIBLE" };
			}
			if (
				input.categoryId &&
				!(await checkCategoryEligibility(
					input.userId,
					input.categoryId,
				))
			) {
				return { ok: false, code: "CATEGORY_INELIGIBLE" };
			}

			const patch: RecurringExpensePatch = {};
			if (input.name !== undefined) patch.name = input.name;
			if (input.amountMinor !== undefined)
				patch.amountMinor = input.amountMinor;
			if (input.sourceAccountId !== undefined)
				patch.sourceAccountId = input.sourceAccountId;
			if (input.categoryId !== undefined)
				patch.categoryId = input.categoryId;
			if (input.endDate !== undefined) patch.endDate = input.endDate;
			if (input.notes !== undefined) patch.notes = input.notes;

			// If interval changes, recalculate future nextDueDate
			if (
				input.intervalMonths !== undefined &&
				input.intervalMonths !== existing.intervalMonths
			) {
				patch.intervalMonths = input.intervalMonths;
				const baseDate = existing.lastPostedDate ?? existing.startDate;
				patch.nextDueDate = addCalendarMonths(
					baseDate,
					input.intervalMonths,
				);
			}

			const nowIso = isoNow();
			const updated = await recurringExpenses.update(
				input.id,
				patch,
				nowIso,
			);
			if (!updated) {
				return { ok: false, code: "NOT_FOUND" };
			}

			const rowWithRefs = await recurringExpenses.findByIdWithRefs(
				updated.id,
			);
			return {
				ok: true,
				value: toView({
					...updated,
					accountName: rowWithRefs?.accountName ?? null,
					categoryName: rowWithRefs?.categoryName ?? null,
				}),
			};
		},

		async pause(
			userId: string,
			id: string,
		): Promise<
			RecurringExpenseOutcome<
				RecurringExpenseView,
				"NOT_FOUND" | "RECURRING_EXPENSE_TRANSITION_INVALID"
			>
		> {
			const existing = await recurringExpenses.findById(id);
			if (!existing || existing.userId !== userId) {
				return { ok: false, code: "NOT_FOUND" };
			}
			if (existing.status !== "active") {
				return {
					ok: false,
					code: "RECURRING_EXPENSE_TRANSITION_INVALID",
				};
			}

			const nowIso = isoNow();
			const updated = await recurringExpenses.update(
				id,
				{ status: "paused" },
				nowIso,
			);
			if (!updated) return { ok: false, code: "NOT_FOUND" };

			const rowWithRefs = await recurringExpenses.findByIdWithRefs(id);
			return {
				ok: true,
				value: toView({
					...updated,
					accountName: rowWithRefs?.accountName ?? null,
					categoryName: rowWithRefs?.categoryName ?? null,
				}),
			};
		},

		async resume(
			userId: string,
			id: string,
		): Promise<
			RecurringExpenseOutcome<
				RecurringExpenseView,
				"NOT_FOUND" | "RECURRING_EXPENSE_TRANSITION_INVALID"
			>
		> {
			const existing = await recurringExpenses.findById(id);
			if (!existing || existing.userId !== userId) {
				return { ok: false, code: "NOT_FOUND" };
			}
			if (existing.status !== "paused") {
				return {
					ok: false,
					code: "RECURRING_EXPENSE_TRANSITION_INVALID",
				};
			}

			const nowIso = isoNow();
			const updated = await recurringExpenses.update(
				id,
				{ status: "active" },
				nowIso,
			);
			if (!updated) return { ok: false, code: "NOT_FOUND" };

			const rowWithRefs = await recurringExpenses.findByIdWithRefs(id);
			return {
				ok: true,
				value: toView({
					...updated,
					accountName: rowWithRefs?.accountName ?? null,
					categoryName: rowWithRefs?.categoryName ?? null,
				}),
			};
		},

		async cancel(
			userId: string,
			id: string,
		): Promise<
			RecurringExpenseOutcome<
				RecurringExpenseView,
				"NOT_FOUND" | "RECURRING_EXPENSE_TRANSITION_INVALID"
			>
		> {
			const existing = await recurringExpenses.findById(id);
			if (!existing || existing.userId !== userId) {
				return { ok: false, code: "NOT_FOUND" };
			}
			if (
				existing.status === "cancelled" ||
				existing.status === "completed"
			) {
				return {
					ok: false,
					code: "RECURRING_EXPENSE_TRANSITION_INVALID",
				};
			}

			const nowIso = isoNow();
			const updated = await recurringExpenses.update(
				id,
				{ status: "cancelled" },
				nowIso,
			);
			if (!updated) return { ok: false, code: "NOT_FOUND" };

			const rowWithRefs = await recurringExpenses.findByIdWithRefs(id);
			return {
				ok: true,
				value: toView({
					...updated,
					accountName: rowWithRefs?.accountName ?? null,
					categoryName: rowWithRefs?.categoryName ?? null,
				}),
			};
		},

		async skip(
			userId: string,
			id: string,
		): Promise<
			RecurringExpenseOutcome<
				RecurringExpenseView,
				"NOT_FOUND" | "RECURRING_EXPENSE_TRANSITION_INVALID"
			>
		> {
			const existing = await recurringExpenses.findById(id);
			if (!existing || existing.userId !== userId) {
				return { ok: false, code: "NOT_FOUND" };
			}
			if (existing.status !== "active") {
				return {
					ok: false,
					code: "RECURRING_EXPENSE_TRANSITION_INVALID",
				};
			}

			const nextDue = addCalendarMonths(
				existing.nextDueDate,
				existing.intervalMonths,
			);
			const isCompleted = existing.endDate && nextDue > existing.endDate;

			const nowIso = isoNow();
			const updated = await recurringExpenses.update(
				id,
				{
					nextDueDate: nextDue,
					...(isCompleted ? { status: "completed" } : {}),
				},
				nowIso,
			);
			if (!updated) return { ok: false, code: "NOT_FOUND" };

			const rowWithRefs = await recurringExpenses.findByIdWithRefs(id);
			return {
				ok: true,
				value: toView({
					...updated,
					accountName: rowWithRefs?.accountName ?? null,
					categoryName: rowWithRefs?.categoryName ?? null,
				}),
			};
		},

		async postDue(
			input: PostDueRecurringExpenseInput,
		): Promise<
			RecurringExpenseOutcome<
				{
					transaction: TransactionView;
					recurringExpense: RecurringExpenseView;
				},
				| "NOT_FOUND"
				| "RECURRING_EXPENSE_TRANSITION_INVALID"
				| "ACCOUNT_INELIGIBLE"
				| "CATEGORY_INELIGIBLE"
				| "ID_CONFLICT"
			>
		> {
			const existing = await recurringExpenses.findById(input.id);
			if (!existing || existing.userId !== input.userId) {
				return { ok: false, code: "NOT_FOUND" };
			}
			if (existing.status !== "active") {
				return {
					ok: false,
					code: "RECURRING_EXPENSE_TRANSITION_INVALID",
				};
			}

			if (
				!(await checkAccountEligibility(
					input.userId,
					existing.sourceAccountId,
				))
			) {
				return { ok: false, code: "ACCOUNT_INELIGIBLE" };
			}
			if (
				!(await checkCategoryEligibility(
					input.userId,
					existing.categoryId,
				))
			) {
				return { ok: false, code: "CATEGORY_INELIGIBLE" };
			}

			const existingTxn = await transactions.findById(
				input.transactionId,
			);
			if (existingTxn) {
				return { ok: false, code: "ID_CONFLICT" };
			}

			const nowIso = isoNow();
			const txnDate = input.date ?? existing.nextDueDate;
			const txnAmount = input.amountMinor ?? existing.amountMinor;

			// Insert ledger transaction
			await transactions.insert({
				id: input.transactionId,
				userId: input.userId,
				type: "expense",
				amountMinor: txnAmount,
				date: txnDate,
				accountId: existing.sourceAccountId,
				categoryId: existing.categoryId,
				recurringExpenseId: existing.id,
				notes: input.notes !== undefined ? input.notes : existing.notes,
				createdAt: nowIso,
				updatedAt: nowIso,
			});

			const nextDue = addCalendarMonths(
				existing.nextDueDate,
				existing.intervalMonths,
			);
			const isCompleted = existing.endDate && nextDue > existing.endDate;

			const updatedRecurring = await recurringExpenses.update(
				existing.id,
				{
					nextDueDate: nextDue,
					lastPostedDate: txnDate,
					...(isCompleted ? { status: "completed" } : {}),
				},
				nowIso,
			);

			const txnWithRefs = await transactions.findByIdWithRefs(
				input.transactionId,
			);
			const recurringWithRefs =
				await recurringExpenses.findByIdWithRefs(existing.id);
			if (!txnWithRefs || !updatedRecurring) {
				// Unreachable in practice: the transaction and rule update both
				// completed above, so their rows must exist.
				return { ok: false, code: "NOT_FOUND" };
			}

			const txnView: TransactionView = {
				id: txnWithRefs.transaction.id,
				type: "expense",
				amountMinor: txnWithRefs.transaction.amountMinor,
				date: txnWithRefs.transaction.date,
				accountId: txnWithRefs.transaction.accountId,
				accountName: txnWithRefs.accountName,
				categoryId: txnWithRefs.transaction.categoryId,
				categoryName: txnWithRefs.categoryName,
				recurringExpenseId: existing.id,
				notes: txnWithRefs.transaction.notes,
				status: "active",
				archivedAt: null,
				deletedAt: null,
				createdAt: txnWithRefs.transaction.createdAt,
				updatedAt: txnWithRefs.transaction.updatedAt,
			};

			return {
				ok: true,
				value: {
					transaction: txnView,
					recurringExpense: toView({
						...updatedRecurring,
						accountName: recurringWithRefs?.accountName ?? null,
						categoryName: recurringWithRefs?.categoryName ?? null,
					}),
				},
			};
		},
	};
}

export type RecurringExpenseService = ReturnType<
	typeof createRecurringExpenseService
>;
