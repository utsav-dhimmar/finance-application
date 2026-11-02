import type {
	CreateTransferBody,
	ListActivityQuery,
	ListTransfersQuery,
	UpdateTransferBody,
} from "@finance-application/schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ACCOUNTS_QUERY_KEY } from "@/services/accounts-service";
import {
	activityQueryOptions,
	archiveExistingTransfer,
	createNewTransfer,
	deleteExistingTransfer,
	destroyTransfer,
	editTransfer,
	restoreTrashedTransfer,
	ACTIVITY_QUERY_KEY,
	TRANSFERS_QUERY_KEY,
	transfersQueryOptions,
} from "@/services/transfers-service";

export function useTransfers(filters: Partial<ListTransfersQuery>) {
	return useQuery(transfersQueryOptions(filters));
}

export function useActivity(filters: Partial<ListActivityQuery>) {
	return useQuery(activityQueryOptions(filters));
}

// Every balance-affecting mutation invalidates the transfer list, the account
// slices (their balances derive from the ledgers), and the unified activity
// feed (its transfer legs and balance effects change). Categories are not
// involved: transfers never touch them.
function useInvalidateTransferRelated() {
	const queryClient = useQueryClient();
	return () => {
		queryClient.invalidateQueries({ queryKey: TRANSFERS_QUERY_KEY });
		queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY });
		queryClient.invalidateQueries({ queryKey: ACTIVITY_QUERY_KEY });
	};
}

export function useCreateTransfer() {
	const invalidate = useInvalidateTransferRelated();
	return useMutation({
		mutationFn: (body: CreateTransferBody) => createNewTransfer(body),
		onSuccess: invalidate,
	});
}

export function useUpdateTransfer() {
	const invalidate = useInvalidateTransferRelated();
	return useMutation({
		mutationFn: ({ id, body }: { id: string; body: UpdateTransferBody }) =>
			editTransfer(id, body),
		onSuccess: invalidate,
	});
}

export function useArchiveTransfer() {
	const invalidate = useInvalidateTransferRelated();
	return useMutation({
		mutationFn: (id: string) => archiveExistingTransfer(id),
		onSuccess: invalidate,
	});
}

export function useDeleteTransfer() {
	const invalidate = useInvalidateTransferRelated();
	return useMutation({
		mutationFn: (id: string) => deleteExistingTransfer(id),
		onSuccess: invalidate,
	});
}

export function useRestoreTransfer() {
	const invalidate = useInvalidateTransferRelated();
	return useMutation({
		mutationFn: ({
			id,
			sourceAccountId,
			destinationAccountId,
		}: {
			id: string;
			sourceAccountId?: string;
			destinationAccountId?: string;
		}) =>
			restoreTrashedTransfer(id, {
				...(sourceAccountId ? { sourceAccountId } : {}),
				...(destinationAccountId ? { destinationAccountId } : {}),
			}),
		onSuccess: invalidate,
	});
}

export function usePermanentlyDeleteTransfer() {
	const invalidate = useInvalidateTransferRelated();
	return useMutation({
		mutationFn: (id: string) => destroyTransfer(id),
		onSuccess: invalidate,
	});
}
