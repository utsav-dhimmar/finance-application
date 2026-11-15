import type {
	CreateTransactionBody,
	ExportTransactionsQuery,
	ExportTransactionsResponse,
	ListTransactionsQuery,
	RestoreTransactionBody,
	TransactionListResponse,
	TransactionResponse,
	UpdateTransactionBody,
} from "@finance-application/schemas";
import type { ApiClientOptions } from "./auth";
import { apiFetch } from "./client";

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
	return apiFetch<TransactionResponse>(`/api/transactions/${id}`, {}, options);
}

// One keyset-paginated chunk of the CSV export. The browser export loop calls
// this repeatedly, feeding `nextCursor` back as `cursor` until it is null;
// `options.signal` cancels the in-flight chunk.
export function fetchTransactionsExportChunk(
	query: Partial<ExportTransactionsQuery> = {},
	options?: ApiClientOptions,
): Promise<ExportTransactionsResponse> {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value !== undefined && value !== "") {
			params.set(key, String(value));
		}
	}
	const suffix = params.size > 0 ? `?${params}` : "";
	return apiFetch<ExportTransactionsResponse>(
		`/api/transactions/export${suffix}`,
		{ signal: options?.signal },
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
