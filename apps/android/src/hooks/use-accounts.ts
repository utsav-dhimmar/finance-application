import type {
	AccountStatus,
	CreateAccountBody,
	UpdateAccountBody,
} from "@finance-application/schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
	notifyMutationError,
	notifyMutationSuccess,
} from "@/lib/mutation-feedback";
import {
	ACCOUNTS_QUERY_KEY,
	accountsQueryOptions,
	archiveExistingAccount,
	createNewAccount,
	deleteExistingAccount,
	destroyAccount,
	editAccount,
	getAccountsErrorMessage,
	restoreTrashedAccount,
} from "@/services/accounts-service";
import { REPORTS_QUERY_KEY } from "@/services/reports-service";
import { TRANSACTIONS_QUERY_KEY } from "@/services/transactions-service";
import {
	ACTIVITY_QUERY_KEY,
	TRANSFERS_QUERY_KEY,
} from "@/services/transfers-service";

export function useAccounts(status: AccountStatus) {
	return useQuery(accountsQueryOptions(status));
}

// Every mutation invalidates the whole ["accounts"] prefix: each tab's
// response carries the combined balance over active accounts, so all slices
// must refresh together. Account names also appear inside ledger rows and the
// unified activity feed (resolved at read time), so those families refresh
// too; reports share the balances.
function useInvalidateAccountRelated() {
	const queryClient = useQueryClient();
	return () => {
		queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY });
		queryClient.invalidateQueries({ queryKey: TRANSACTIONS_QUERY_KEY });
		queryClient.invalidateQueries({ queryKey: TRANSFERS_QUERY_KEY });
		queryClient.invalidateQueries({ queryKey: ACTIVITY_QUERY_KEY });
		queryClient.invalidateQueries({ queryKey: REPORTS_QUERY_KEY });
	};
}

const FALLBACK = "Could not save the account. Is the API running?";

export function useCreateAccount() {
	const invalidate = useInvalidateAccountRelated();
	return useMutation({
		mutationFn: (body: CreateAccountBody) => createNewAccount(body),
		onSuccess: () => {
			invalidate();
			notifyMutationSuccess("Account created.");
		},
		onError: (error) =>
			notifyMutationError(error, getAccountsErrorMessage, FALLBACK),
	});
}

export function useUpdateAccount() {
	const invalidate = useInvalidateAccountRelated();
	return useMutation({
		mutationFn: ({ id, body }: { id: string; body: UpdateAccountBody }) =>
			editAccount(id, body),
		onSuccess: () => {
			invalidate();
			notifyMutationSuccess("Account updated.");
		},
		onError: (error) =>
			notifyMutationError(error, getAccountsErrorMessage, FALLBACK),
	});
}

export function useArchiveAccount() {
	const invalidate = useInvalidateAccountRelated();
	return useMutation({
		mutationFn: (id: string) => archiveExistingAccount(id),
		onSuccess: () => {
			invalidate();
			notifyMutationSuccess("Account archived.");
		},
		onError: (error) =>
			notifyMutationError(error, getAccountsErrorMessage, FALLBACK),
	});
}

export function useDeleteAccount() {
	const invalidate = useInvalidateAccountRelated();
	return useMutation({
		mutationFn: (id: string) => deleteExistingAccount(id),
		onSuccess: () => {
			invalidate();
			notifyMutationSuccess("Account moved to trash.");
		},
		onError: (error) =>
			notifyMutationError(error, getAccountsErrorMessage, FALLBACK),
	});
}

export function useRestoreAccount() {
	const invalidate = useInvalidateAccountRelated();
	return useMutation({
		mutationFn: ({ id, newName }: { id: string; newName?: string }) =>
			restoreTrashedAccount(id, newName ? { newName } : {}),
		onSuccess: () => {
			invalidate();
			notifyMutationSuccess("Account restored.");
		},
		onError: (error) =>
			notifyMutationError(
				error,
				getAccountsErrorMessage,
				"Could not restore the account. Is the API running?",
			),
	});
}

// Permanent deletion from trash: irreversible, gate-checked server-side on
// zero referencing transactions/transfers in any status.
export function usePermanentlyDeleteAccount() {
	const invalidate = useInvalidateAccountRelated();
	return useMutation({
		mutationFn: (id: string) => destroyAccount(id),
		onSuccess: () => {
			invalidate();
			notifyMutationSuccess("Account deleted permanently.");
		},
		onError: (error) =>
			notifyMutationError(
				error,
				getAccountsErrorMessage,
				"Could not delete the account. Is the API running?",
			),
	});
}
