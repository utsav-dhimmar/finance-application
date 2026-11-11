import type {
	CreateTransferBody,
	ListTransfersQuery,
	UpdateTransferBody,
} from "@finance-application/schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
	notifyMutationError,
	notifyMutationSuccess,
} from "@/lib/mutation-feedback";
import { ACCOUNTS_QUERY_KEY } from "@/services/accounts-service";
import { REPORTS_QUERY_KEY } from "@/services/reports-service";
import {
	ACTIVITY_QUERY_KEY,
	archiveExistingTransfer,
	createNewTransfer,
	deleteExistingTransfer,
	destroyTransfer,
	editTransfer,
	getTransfersErrorMessage,
	restoreTrashedTransfer,
	TRANSFERS_QUERY_KEY,
	transfersQueryOptions,
} from "@/services/transfers-service";

export function useTransfers(filters: Partial<ListTransfersQuery>) {
	return useQuery(transfersQueryOptions(filters));
}

// Every balance-affecting mutation invalidates the transfer list, the account
// slices (their balances derive from the ledgers), the unified activity feed
// (its transfer legs and balance effects change), and the report summaries.
// Categories are not involved: transfers never touch them.
function useInvalidateTransferRelated() {
	const queryClient = useQueryClient();
	return () => {
		queryClient.invalidateQueries({ queryKey: TRANSFERS_QUERY_KEY });
		queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY });
		queryClient.invalidateQueries({ queryKey: ACTIVITY_QUERY_KEY });
		queryClient.invalidateQueries({ queryKey: REPORTS_QUERY_KEY });
	};
}

const FALLBACK = "Could not save the transfer. Is the API running?";

export function useCreateTransfer() {
	const invalidate = useInvalidateTransferRelated();
	return useMutation({
		mutationFn: (body: CreateTransferBody) => createNewTransfer(body),
		onSuccess: () => {
			invalidate();
			notifyMutationSuccess("Transfer recorded.");
		},
		onError: (error) =>
			notifyMutationError(error, getTransfersErrorMessage, FALLBACK),
	});
}

export function useUpdateTransfer() {
	const invalidate = useInvalidateTransferRelated();
	return useMutation({
		mutationFn: ({ id, body }: { id: string; body: UpdateTransferBody }) =>
			editTransfer(id, body),
		onSuccess: () => {
			invalidate();
			notifyMutationSuccess("Transfer updated.");
		},
		onError: (error) =>
			notifyMutationError(error, getTransfersErrorMessage, FALLBACK),
	});
}

export function useArchiveTransfer() {
	const invalidate = useInvalidateTransferRelated();
	return useMutation({
		mutationFn: (id: string) => archiveExistingTransfer(id),
		onSuccess: () => {
			invalidate();
			notifyMutationSuccess("Transfer archived.");
		},
		onError: (error) =>
			notifyMutationError(error, getTransfersErrorMessage, FALLBACK),
	});
}

export function useDeleteTransfer() {
	const invalidate = useInvalidateTransferRelated();
	return useMutation({
		mutationFn: (id: string) => deleteExistingTransfer(id),
		onSuccess: () => {
			invalidate();
			notifyMutationSuccess("Transfer moved to trash.");
		},
		onError: (error) =>
			notifyMutationError(error, getTransfersErrorMessage, FALLBACK),
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
		onSuccess: () => {
			invalidate();
			notifyMutationSuccess("Transfer restored.");
		},
		onError: (error) =>
			notifyMutationError(
				error,
				getTransfersErrorMessage,
				"Could not restore the transfer. Is the API running?",
			),
	});
}

export function usePermanentlyDeleteTransfer() {
	const invalidate = useInvalidateTransferRelated();
	return useMutation({
		mutationFn: (id: string) => destroyTransfer(id),
		onSuccess: () => {
			invalidate();
			notifyMutationSuccess("Transfer deleted permanently.");
		},
		onError: (error) =>
			notifyMutationError(
				error,
				getTransfersErrorMessage,
				"Could not delete the transfer. Is the API running?",
			),
	});
}
