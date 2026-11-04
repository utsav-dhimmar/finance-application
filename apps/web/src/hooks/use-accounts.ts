import type {
	AccountStatus,
	CreateAccountBody,
	UpdateAccountBody,
} from "@finance-application/schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ACCOUNTS_QUERY_KEY,
	accountsQueryOptions,
	archiveExistingAccount,
	createNewAccount,
	deleteExistingAccount,
	destroyAccount,
	editAccount,
	restoreTrashedAccount,
} from "@/services/accounts-service";
import { ACTIVITY_QUERY_KEY, TRANSFERS_QUERY_KEY } from "@/services/transfers-service";
import { REPORTS_QUERY_KEY } from "@/services/reports-service";
import { TRANSACTIONS_QUERY_KEY } from "@/services/transactions-service";

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

export function useCreateAccount() {
	const invalidate = useInvalidateAccountRelated();
	return useMutation({
		mutationFn: (body: CreateAccountBody) => createNewAccount(body),
		onSuccess: invalidate,
	});
}

export function useUpdateAccount() {
	const invalidate = useInvalidateAccountRelated();
	return useMutation({
		mutationFn: ({ id, body }: { id: string; body: UpdateAccountBody }) =>
			editAccount(id, body),
		onSuccess: invalidate,
	});
}

export function useArchiveAccount() {
	const invalidate = useInvalidateAccountRelated();
	return useMutation({
		mutationFn: (id: string) => archiveExistingAccount(id),
		onSuccess: invalidate,
	});
}

export function useDeleteAccount() {
	const invalidate = useInvalidateAccountRelated();
	return useMutation({
		mutationFn: (id: string) => deleteExistingAccount(id),
		onSuccess: invalidate,
	});
}

export function useRestoreAccount() {
	const invalidate = useInvalidateAccountRelated();
	return useMutation({
		mutationFn: ({ id, newName }: { id: string; newName?: string }) =>
			restoreTrashedAccount(id, newName ? { newName } : {}),
		onSuccess: invalidate,
	});
}

// Permanent deletion from trash: irreversible, gate-checked server-side on
// zero referencing transactions/transfers in any status.
export function usePermanentlyDeleteAccount() {
	const invalidate = useInvalidateAccountRelated();
	return useMutation({
		mutationFn: (id: string) => destroyAccount(id),
		onSuccess: invalidate,
	});
}
