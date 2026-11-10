import {
	cancelRecurringExpense,
	createRecurringExpense,
	getDueRecurringExpenses,
	getRecurringExpense,
	listRecurringExpenses,
	pauseRecurringExpense,
	postDueRecurringExpense,
	resumeRecurringExpense,
	skipRecurringExpense,
	updateRecurringExpense,
} from "@finance-application/api-client";
import type {
	CreateRecurringExpenseBody,
	DueRecurringExpensesQuery,
	ListRecurringExpensesQuery,
	PostDueRecurringExpenseBody,
	PostDueResponse,
	RecurringExpenseResponse,
	UpdateRecurringExpenseBody,
} from "@finance-application/schemas";

export const RECURRING_EXPENSES_QUERY_KEY = ["recurring-expenses"] as const;
export const DUE_RECURRING_EXPENSES_QUERY_KEY = [
	"recurring-expenses",
	"due",
] as const;

export function serializeRecurringFilters(
	filters: Partial<ListRecurringExpensesQuery>,
): string {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(filters)) {
		if (value !== undefined && value !== "") {
			params.set(key, String(value));
		}
	}
	return params.toString();
}

export function recurringExpensesQueryKey(
	filters: Partial<ListRecurringExpensesQuery> = {},
) {
	return [
		...RECURRING_EXPENSES_QUERY_KEY,
		serializeRecurringFilters(filters),
	] as const;
}

export function recurringExpensesQueryOptions(
	filters: Partial<ListRecurringExpensesQuery> = {},
) {
	return {
		queryKey: recurringExpensesQueryKey(filters),
		queryFn: () => listRecurringExpenses(filters),
		staleTime: 30_000,
	};
}

export function dueRecurringExpensesQueryOptions(
	query: Partial<DueRecurringExpensesQuery> = {},
) {
	return {
		queryKey: [...DUE_RECURRING_EXPENSES_QUERY_KEY, query.asOfDate ?? ""] as const,
		queryFn: () => getDueRecurringExpenses(query),
		staleTime: 10_000,
	};
}

export function getExistingRecurringExpense(
	id: string,
): Promise<RecurringExpenseResponse> {
	return getRecurringExpense(id);
}

export function createNewRecurringExpense(
	body: CreateRecurringExpenseBody,
): Promise<RecurringExpenseResponse> {
	return createRecurringExpense(body);
}

export function editRecurringExpense(
	id: string,
	body: UpdateRecurringExpenseBody,
): Promise<RecurringExpenseResponse> {
	return updateRecurringExpense(id, body);
}

export function pauseExistingRecurringExpense(
	id: string,
): Promise<RecurringExpenseResponse> {
	return pauseRecurringExpense(id);
}

export function resumeExistingRecurringExpense(
	id: string,
): Promise<RecurringExpenseResponse> {
	return resumeRecurringExpense(id);
}

export function cancelExistingRecurringExpense(
	id: string,
): Promise<RecurringExpenseResponse> {
	return cancelRecurringExpense(id);
}

export function skipExistingRecurringExpense(
	id: string,
): Promise<RecurringExpenseResponse> {
	return skipRecurringExpense(id);
}

export function postExistingDueRecurringExpense(
	id: string,
	body: PostDueRecurringExpenseBody,
): Promise<PostDueResponse> {
	return postDueRecurringExpense(id, body);
}
