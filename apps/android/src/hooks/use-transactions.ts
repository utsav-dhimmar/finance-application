import type {
	CreateTransactionBody,
	ListTransactionsQuery,
	UpdateTransactionBody,
} from "@finance-application/schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
	notifyMutationError,
	notifyMutationSuccess,
} from "@/lib/mutation-feedback";
import { ACCOUNTS_QUERY_KEY } from "@/services/accounts-service";
import { CATEGORIES_QUERY_KEY } from "@/services/categories-service";
import { REPORTS_QUERY_KEY } from "@/services/reports-service";
import {
	archiveExistingTransaction,
	createNewTransaction,
	deleteExistingTransaction,
	destroyTransaction,
	editTransaction,
	getTransactionsErrorMessage,
	restoreTrashedTransaction,
	TRANSACTIONS_QUERY_KEY,
	transactionsQueryOptions,
} from "@/services/transactions-service";
import { ACTIVITY_QUERY_KEY } from "@/services/transfers-service";

export function useTransactions(filters: Partial<ListTransactionsQuery>) {
	return useQuery(transactionsQueryOptions(filters));
}

// Every balance-affecting mutation invalidates the transaction list, the
// account slices (their balances derive from the ledger), the category
// slices (their type-lock state derives from references), the unified
// activity feed (its transaction legs come from the same ledger), and the
// report summaries (their totals derive from the same ledger).
function useInvalidateTransactionRelated() {
	const queryClient = useQueryClient();
	return () => {
		queryClient.invalidateQueries({ queryKey: TRANSACTIONS_QUERY_KEY });
		queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY });
		queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
		queryClient.invalidateQueries({ queryKey: ACTIVITY_QUERY_KEY });
		queryClient.invalidateQueries({ queryKey: REPORTS_QUERY_KEY });
	};
}

const FALLBACK = "Could not save the transaction. Is the API running?";

export function useCreateTransaction() {
	const invalidate = useInvalidateTransactionRelated();
	return useMutation({
		mutationFn: (body: CreateTransactionBody) => createNewTransaction(body),
		onSuccess: () => {
			invalidate();
			notifyMutationSuccess("Transaction recorded.");
		},
		onError: (error) =>
			notifyMutationError(error, getTransactionsErrorMessage, FALLBACK),
	});
}

export function useUpdateTransaction() {
	const invalidate = useInvalidateTransactionRelated();
	return useMutation({
		mutationFn: ({ id, body }: { id: string; body: UpdateTransactionBody }) =>
			editTransaction(id, body),
		onSuccess: () => {
			invalidate();
			notifyMutationSuccess("Transaction updated.");
		},
		onError: (error) =>
			notifyMutationError(error, getTransactionsErrorMessage, FALLBACK),
	});
}

export function useArchiveTransaction() {
	const invalidate = useInvalidateTransactionRelated();
	return useMutation({
		mutationFn: (id: string) => archiveExistingTransaction(id),
		onSuccess: () => {
			invalidate();
			notifyMutationSuccess("Transaction archived.");
		},
		onError: (error) =>
			notifyMutationError(error, getTransactionsErrorMessage, FALLBACK),
	});
}

export function useDeleteTransaction() {
	const invalidate = useInvalidateTransactionRelated();
	return useMutation({
		mutationFn: (id: string) => deleteExistingTransaction(id),
		onSuccess: () => {
			invalidate();
			notifyMutationSuccess("Transaction moved to trash.");
		},
		onError: (error) =>
			notifyMutationError(error, getTransactionsErrorMessage, FALLBACK),
	});
}

export function useRestoreTransaction() {
	const invalidate = useInvalidateTransactionRelated();
	return useMutation({
		mutationFn: ({
			id,
			accountId,
			categoryId,
		}: {
			id: string;
			accountId?: string;
			categoryId?: string;
		}) =>
			restoreTrashedTransaction(id, {
				...(accountId ? { accountId } : {}),
				...(categoryId ? { categoryId } : {}),
			}),
		onSuccess: () => {
			invalidate();
			notifyMutationSuccess("Transaction restored.");
		},
		onError: (error) =>
			notifyMutationError(
				error,
				getTransactionsErrorMessage,
				"Could not restore the transaction. Is the API running?",
			),
	});
}

export function usePermanentlyDeleteTransaction() {
	const invalidate = useInvalidateTransactionRelated();
	return useMutation({
		mutationFn: (id: string) => destroyTransaction(id),
		onSuccess: () => {
			invalidate();
			notifyMutationSuccess("Transaction deleted permanently.");
		},
		onError: (error) =>
			notifyMutationError(
				error,
				getTransactionsErrorMessage,
				"Could not delete the transaction. Is the API running?",
			),
	});
}
