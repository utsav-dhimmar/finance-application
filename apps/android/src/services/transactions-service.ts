import {
	ApiError,
	archiveTransaction,
	createTransaction,
	deleteTransaction,
	getTransaction,
	listTransactions,
	permanentlyDeleteTransaction,
	restoreTransaction,
	updateTransaction,
} from "@finance-application/api-client";
import type {
	CreateTransactionBody,
	ListTransactionsQuery,
	RestoreTransactionBody,
	TransactionListResponse,
	TransactionResponse,
	UpdateTransactionBody,
} from "@finance-application/schemas";

import { sessionMachine } from "@/session/session-runtime";

// All transaction list slices share the ["transactions"] prefix so mutations
// can invalidate every filter combination at once.
export const TRANSACTIONS_QUERY_KEY = ["transactions"] as const;

export function transactionsQueryKey(filters: Partial<ListTransactionsQuery>) {
	// Key by the canonical string form so different filter objects that
	// serialize identically share one cache entry.
	return [...TRANSACTIONS_QUERY_KEY, serializeFilters(filters)] as const;
}

export function serializeFilters(
	filters: Partial<ListTransactionsQuery>,
): string {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(filters)) {
		if (value !== undefined && value !== "") {
			params.set(key, String(value));
		}
	}
	return params.toString();
}

export function transactionsQueryOptions(
	filters: Partial<ListTransactionsQuery>,
) {
	return {
		queryKey: transactionsQueryKey(filters),
		queryFn: () =>
			sessionMachine().run((options) => listTransactions(filters, options)),
		staleTime: 30_000,
	};
}

export function getExistingTransaction(
	id: string,
): Promise<TransactionResponse> {
	return sessionMachine().run((options) => getTransaction(id, options));
}

export function createNewTransaction(
	body: CreateTransactionBody,
): Promise<TransactionResponse> {
	return sessionMachine().run((options) => createTransaction(body, options));
}

export function editTransaction(
	id: string,
	body: UpdateTransactionBody,
): Promise<TransactionResponse> {
	return sessionMachine().run((options) =>
		updateTransaction(id, body, options),
	);
}

export function archiveExistingTransaction(
	id: string,
): Promise<TransactionResponse> {
	return sessionMachine().run((options) => archiveTransaction(id, options));
}

export function deleteExistingTransaction(
	id: string,
): Promise<TransactionResponse> {
	return sessionMachine().run((options) => deleteTransaction(id, options));
}

export function restoreTrashedTransaction(
	id: string,
	body: RestoreTransactionBody = {},
): Promise<TransactionResponse> {
	return sessionMachine().run((options) =>
		restoreTransaction(id, body, options),
	);
}

export function destroyTransaction(id: string): Promise<TransactionResponse> {
	return sessionMachine().run((options) =>
		permanentlyDeleteTransaction(id, options),
	);
}

export type {
	ListTransactionsQuery,
	TransactionListResponse,
	TransactionResponse,
};

// Maps known transaction error codes to user-facing copy, matching the web
// service's wording. `fallback` names the action that failed when the API is
// unreachable.
export function getTransactionsErrorMessage(
	error: unknown,
	fallback: string,
): string {
	if (error instanceof ApiError) {
		if (error.code === "ACCOUNT_INELIGIBLE") {
			return "Transactions need an active account. Archived or deleted accounts cannot be used.";
		}
		if (error.code === "CATEGORY_INELIGIBLE") {
			return "Choose an active category of the matching type.";
		}
		if (error.code === "RESTORE_CONFLICT") {
			return "This transaction's account or category was deleted. Assign a replacement to restore it.";
		}
		return error.message;
	}
	return fallback;
}
