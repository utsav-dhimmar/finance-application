import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
	AccountStatus,
	CreateAccountBody,
	UpdateAccountBody,
} from "@finance-application/schemas";
import {
	ACCOUNTS_QUERY_KEY,
	accountsQueryOptions,
	archiveExistingAccount,
	createNewAccount,
	deleteExistingAccount,
	editAccount,
	restoreTrashedAccount,
} from "@/services/accounts-service";

export function useAccounts(status: AccountStatus) {
	return useQuery(accountsQueryOptions(status));
}

// Every mutation invalidates the whole ["accounts"] prefix: each tab's
// response carries the combined balance over active accounts, so all slices
// must refresh together.
export function useCreateAccount() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: CreateAccountBody) => createNewAccount(body),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY });
		},
	});
}

export function useUpdateAccount() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, body }: { id: string; body: UpdateAccountBody }) =>
			editAccount(id, body),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY });
		},
	});
}

export function useArchiveAccount() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => archiveExistingAccount(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY });
		},
	});
}

export function useDeleteAccount() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => deleteExistingAccount(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY });
		},
	});
}

export function useRestoreAccount() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, newName }: { id: string; newName?: string }) =>
			restoreTrashedAccount(id, newName ? { newName } : {}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY });
		},
	});
}
