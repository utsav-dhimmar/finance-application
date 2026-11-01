import type {
	CreateTransactionBody,
	ListTransactionsQuery,
	RestoreTransactionBody,
	TransactionListResponse,
	TransactionResponse,
	UpdateTransactionBody,
} from "@finance-application/schemas";
import { apiFetch } from "./client";
import type { ApiClientOptions } from "./auth";

export function createTransaction(
	body: CreateTransactionBody,
	options?: ApiClientOptions,
): Promise<TransactionResponse> {
	return apiFetch<TransactionResponse>(
		"/api/transactions",
		{
			method: "POST",
			body: JSON.stringify(body),
		},
		options,
	);
}

export function listTransactions(
	query: Partial<ListTransactionsQuery> = {},
	options?: ApiClientOptions,
): Promise<TransactionListResponse> {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value !== undefined && value !== "") {
			params.set(key, String(value));
		}
	}
	const suffix = params.size > 0 ? `?${params}` : "";
	return apiFetch<TransactionListResponse>(
		`/api/transactions${suffix}`,
		{},
		options,
	);
}

export function getTransaction(
	id: string,
	options?: ApiClientOptions,
): Promise<TransactionResponse> {
	return apiFetch<TransactionResponse>(
		`/api/transactions/${id}`,
		{},
		options,
	);
}

export function updateTransaction(
	id: string,
	body: UpdateTransactionBody,
	options?: ApiClientOptions,
): Promise<TransactionResponse> {
	return apiFetch<TransactionResponse>(
		`/api/transactions/${id}`,
		{
			method: "PATCH",
			body: JSON.stringify(body),
		},
		options,
	);
}

export function archiveTransaction(
	id: string,
	options?: ApiClientOptions,
): Promise<TransactionResponse> {
	return apiFetch<TransactionResponse>(
		`/api/transactions/${id}/archive`,
		{
			method: "POST",
		},
		options,
	);
}

// Soft-delete: the transaction moves to trash and its balance effect reverses;
// restoration re-applies it exactly once.
export function deleteTransaction(
	id: string,
	options?: ApiClientOptions,
): Promise<TransactionResponse> {
	return apiFetch<TransactionResponse>(
		`/api/transactions/${id}/delete`,
		{
			method: "POST",
		},
		options,
	);
}

export function restoreTransaction(
	id: string,
	body: RestoreTransactionBody = {},
	options?: ApiClientOptions,
): Promise<TransactionResponse> {
	return apiFetch<TransactionResponse>(
		`/api/transactions/${id}/restore`,
		{
			method: "POST",
			body: JSON.stringify(body),
		},
		options,
	);
}

// Permanent deletion from trash: irreversible, always user-requested.
export function permanentlyDeleteTransaction(
	id: string,
	options?: ApiClientOptions,
): Promise<TransactionResponse> {
	return apiFetch<TransactionResponse>(
		`/api/transactions/${id}`,
		{
			method: "DELETE",
		},
		options,
	);
}
