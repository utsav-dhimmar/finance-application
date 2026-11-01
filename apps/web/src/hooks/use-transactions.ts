import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
	CreateTransactionBody,
	ListTransactionsQuery,
	UpdateTransactionBody,
} from "@finance-application/schemas";
import { ACCOUNTS_QUERY_KEY } from "@/services/accounts-service";
import { CATEGORIES_QUERY_KEY } from "@/services/categories-service";
import {
	TRANSACTIONS_QUERY_KEY,
	archiveExistingTransaction,
	createNewTransaction,
	deleteExistingTransaction,
	destroyTransaction,
	editTransaction,
	restoreTrashedTransaction,
	transactionsQueryOptions,
} from "@/services/transactions-service";

export function useTransactions(filters: Partial<ListTransactionsQuery>) {
	return useQuery(transactionsQueryOptions(filters));
}

// Every balance-affecting mutation invalidates the transaction list, the
// account slices (their balances derive from the ledger), and the category
// slices (their type-lock state derives from references).
function useInvalidateTransactionRelated() {
	const queryClient = useQueryClient();
	return () => {
		queryClient.invalidateQueries({ queryKey: TRANSACTIONS_QUERY_KEY });
		queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY });
		queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
	};
}

export function useCreateTransaction() {
	const invalidate = useInvalidateTransactionRelated();
	return useMutation({
		mutationFn: (body: CreateTransactionBody) => createNewTransaction(body),
		onSuccess: invalidate,
	});
}

export function useUpdateTransaction() {
	const invalidate = useInvalidateTransactionRelated();
	return useMutation({
		mutationFn: ({ id, body }: { id: string; body: UpdateTransactionBody }) =>
			editTransaction(id, body),
		onSuccess: invalidate,
	});
}

export function useArchiveTransaction() {
	const invalidate = useInvalidateTransactionRelated();
	return useMutation({
		mutationFn: (id: string) => archiveExistingTransaction(id),
		onSuccess: invalidate,
	});
}

export function useDeleteTransaction() {
	const invalidate = useInvalidateTransactionRelated();
	return useMutation({
		mutationFn: (id: string) => deleteExistingTransaction(id),
		onSuccess: invalidate,
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
		onSuccess: invalidate,
	});
}

export function usePermanentlyDeleteTransaction() {
	const invalidate = useInvalidateTransactionRelated();
	return useMutation({
		mutationFn: (id: string) => destroyTransaction(id),
		onSuccess: invalidate,
	});
}
