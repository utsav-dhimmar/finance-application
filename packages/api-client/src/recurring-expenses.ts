import type {
	CreateRecurringExpenseBody,
	DueRecurringExpensesQuery,
	ListRecurringExpensesQuery,
	PostDueRecurringExpenseBody,
	PostDueResponse,
	RecurringExpenseListResponse,
	RecurringExpenseResponse,
	UpdateRecurringExpenseBody,
} from "@finance-application/schemas";
import type { ApiClientOptions } from "./auth";
import { apiFetch } from "./client";

export function createRecurringExpense(
	body: CreateRecurringExpenseBody,
	options?: ApiClientOptions,
): Promise<RecurringExpenseResponse> {
	return apiFetch<RecurringExpenseResponse>(
		"/api/recurring-expenses",
		{
			method: "POST",
			body: JSON.stringify(body),
		},
		options,
	);
}

export function listRecurringExpenses(
	query: Partial<ListRecurringExpensesQuery> = {},
	options?: ApiClientOptions,
): Promise<RecurringExpenseListResponse> {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value !== undefined && value !== "") {
			params.set(key, String(value));
		}
	}
	const suffix = params.size > 0 ? `?${params}` : "";
	return apiFetch<RecurringExpenseListResponse>(
		`/api/recurring-expenses${suffix}`,
		{},
		options,
	);
}

export function getDueRecurringExpenses(
	query: Partial<DueRecurringExpensesQuery> = {},
	options?: ApiClientOptions,
): Promise<RecurringExpenseListResponse> {
	const params = new URLSearchParams();
	if (query.asOfDate) {
		params.set("asOfDate", query.asOfDate);
	}
	const suffix = params.size > 0 ? `?${params}` : "";
	return apiFetch<RecurringExpenseListResponse>(
		`/api/recurring-expenses/due${suffix}`,
		{},
		options,
	);
}

export function getRecurringExpense(
	id: string,
	options?: ApiClientOptions,
): Promise<RecurringExpenseResponse> {
	return apiFetch<RecurringExpenseResponse>(
		`/api/recurring-expenses/${id}`,
		{},
		options,
	);
}

export function updateRecurringExpense(
	id: string,
	body: UpdateRecurringExpenseBody,
	options?: ApiClientOptions,
): Promise<RecurringExpenseResponse> {
	return apiFetch<RecurringExpenseResponse>(
		`/api/recurring-expenses/${id}`,
		{
			method: "PATCH",
			body: JSON.stringify(body),
		},
		options,
	);
}

export function pauseRecurringExpense(
	id: string,
	options?: ApiClientOptions,
): Promise<RecurringExpenseResponse> {
	return apiFetch<RecurringExpenseResponse>(
		`/api/recurring-expenses/${id}/pause`,
		{
			method: "POST",
		},
		options,
	);
}

export function resumeRecurringExpense(
	id: string,
	options?: ApiClientOptions,
): Promise<RecurringExpenseResponse> {
	return apiFetch<RecurringExpenseResponse>(
		`/api/recurring-expenses/${id}/resume`,
		{
			method: "POST",
		},
		options,
	);
}

export function cancelRecurringExpense(
	id: string,
	options?: ApiClientOptions,
): Promise<RecurringExpenseResponse> {
	return apiFetch<RecurringExpenseResponse>(
		`/api/recurring-expenses/${id}/cancel`,
		{
			method: "POST",
		},
		options,
	);
}

export function skipRecurringExpense(
	id: string,
	options?: ApiClientOptions,
): Promise<RecurringExpenseResponse> {
	return apiFetch<RecurringExpenseResponse>(
		`/api/recurring-expenses/${id}/skip`,
		{
			method: "POST",
		},
		options,
	);
}

export function postDueRecurringExpense(
	id: string,
	body: PostDueRecurringExpenseBody,
	options?: ApiClientOptions,
): Promise<PostDueResponse> {
	return apiFetch<PostDueResponse>(
		`/api/recurring-expenses/${id}/post-due`,
		{
			method: "POST",
			body: JSON.stringify(body),
		},
		options,
	);
}
