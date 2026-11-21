import { and, asc, eq, lte } from "drizzle-orm";
import type { Db } from "@/db";
import {
	accounts,
	categories,
	type RecurringExpense,
	recurringExpenses,
} from "@/db/schema";

export interface RecurringExpenseRowWithRefs {
	recurringExpense: RecurringExpense;
	accountName: string | null;
	categoryName: string | null;
}

export interface NewRecurringExpenseRow {
	id: string;
	userId: string;
	name: string;
	amountMinor: number;
	intervalMonths: number;
	sourceAccountId: string;
	categoryId: string;
	startDate: string;
	nextDueDate: string;
	endDate: string | null;
	lastPostedDate: string | null;
	status?: "active" | "paused" | "completed" | "cancelled";
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface RecurringExpensePatch {
	name?: string;
	amountMinor?: number;
	intervalMonths?: number;
	sourceAccountId?: string;
	categoryId?: string;
	startDate?: string;
	nextDueDate?: string;
	endDate?: string | null;
	lastPostedDate?: string | null;
	status?: "active" | "paused" | "completed" | "cancelled";
	notes?: string | null;
}

export function createRecurringExpenseRepository(db: Db) {
	return {
		async insert(row: NewRecurringExpenseRow): Promise<RecurringExpense> {
			const inserted = await db
				.insert(recurringExpenses)
				.values({
					...row,
					status: row.status ?? "active",
				})
				.returning();
			const insertedRow = inserted[0];
			if (!insertedRow) {
				throw new Error("Failed to insert recurring expense");
			}
			return insertedRow;
		},

		async findById(id: string): Promise<RecurringExpense | undefined> {
			const rows = await db
				.select()
				.from(recurringExpenses)
				.where(eq(recurringExpenses.id, id));
			return rows[0];
		},

		async findByIdWithRefs(
			id: string,
		): Promise<RecurringExpenseRowWithRefs | undefined> {
			const rows = await db
				.select({
					recurringExpense: recurringExpenses,
					accountName: accounts.name,
					categoryName: categories.name,
				})
				.from(recurringExpenses)
				.leftJoin(accounts, eq(recurringExpenses.sourceAccountId, accounts.id))
				.leftJoin(
					categories,
					eq(recurringExpenses.categoryId, categories.id),
				)
				.where(eq(recurringExpenses.id, id));

			return rows[0];
		},

		async list(
			userId: string,
			filters?: {
				status?: string;
				sourceAccountId?: string;
				categoryId?: string;
			},
		): Promise<RecurringExpenseRowWithRefs[]> {
			const conditions = [eq(recurringExpenses.userId, userId)];

			if (filters?.status) {
				conditions.push(eq(recurringExpenses.status, filters.status));
			}
			if (filters?.sourceAccountId) {
				conditions.push(
					eq(recurringExpenses.sourceAccountId, filters.sourceAccountId),
				);
			}
			if (filters?.categoryId) {
				conditions.push(eq(recurringExpenses.categoryId, filters.categoryId));
			}

			const rows = await db
				.select({
					recurringExpense: recurringExpenses,
					accountName: accounts.name,
					categoryName: categories.name,
				})
				.from(recurringExpenses)
				.leftJoin(accounts, eq(recurringExpenses.sourceAccountId, accounts.id))
				.leftJoin(
					categories,
					eq(recurringExpenses.categoryId, categories.id),
				)
				.where(and(...conditions))
				.orderBy(asc(recurringExpenses.nextDueDate), asc(recurringExpenses.id));

			return rows;
		},

		async findDue(
			userId: string,
			cutoffDate: string,
		): Promise<RecurringExpenseRowWithRefs[]> {
			const rows = await db
				.select({
					recurringExpense: recurringExpenses,
					accountName: accounts.name,
					categoryName: categories.name,
				})
				.from(recurringExpenses)
				.leftJoin(accounts, eq(recurringExpenses.sourceAccountId, accounts.id))
				.leftJoin(
					categories,
					eq(recurringExpenses.categoryId, categories.id),
				)
				.where(
					and(
						eq(recurringExpenses.userId, userId),
						eq(recurringExpenses.status, "active"),
						lte(recurringExpenses.nextDueDate, cutoffDate),
					),
				)
				.orderBy(asc(recurringExpenses.nextDueDate), asc(recurringExpenses.id));

			return rows;
		},

		async update(
			id: string,
			patch: RecurringExpensePatch,
			updatedAt: string,
		): Promise<RecurringExpense | undefined> {
			const updated = await db
				.update(recurringExpenses)
				.set({
					...patch,
					updatedAt,
				})
				.where(eq(recurringExpenses.id, id))
				.returning();

			return updated[0];
		},

		async delete(id: string): Promise<boolean> {
			const removed = await db
				.delete(recurringExpenses)
				.where(eq(recurringExpenses.id, id))
				.returning();
			return removed.length > 0;
		},
	};
}

export type RecurringExpenseRepository = ReturnType<
	typeof createRecurringExpenseRepository
>;
