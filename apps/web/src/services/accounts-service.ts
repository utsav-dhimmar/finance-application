import {
	ApiError,
	archiveAccount,
	createAccount,
	deleteAccount,
	listAccounts,
	restoreAccount,
	updateAccount,
} from "@finance-application/api-client";
import type {
	AccountListResponse,
	AccountResponse,
	AccountStatus,
	CreateAccountBody,
	RestoreAccountBody,
	UpdateAccountBody,
} from "@finance-application/schemas";

// All account slices share the ["accounts"] prefix so mutations can
// invalidate every tab's cache at once.
export const ACCOUNTS_QUERY_KEY = ["accounts"] as const;

export function accountsQueryKey(status: AccountStatus) {
	return [...ACCOUNTS_QUERY_KEY, status] as const;
}

export function accountsQueryOptions(status: AccountStatus) {
	return {
		queryKey: accountsQueryKey(status),
		queryFn: () => listAccounts(status),
		staleTime: 30_000,
	};
}

export function createNewAccount(
	body: CreateAccountBody,
): Promise<AccountResponse> {
	return createAccount(body);
}

export function editAccount(
	id: string,
	body: UpdateAccountBody,
): Promise<AccountResponse> {
	return updateAccount(id, body);
}

export function archiveExistingAccount(id: string): Promise<AccountResponse> {
	return archiveAccount(id);
}

export function deleteExistingAccount(id: string): Promise<AccountResponse> {
	return deleteAccount(id);
}

export function restoreTrashedAccount(
	id: string,
	body: RestoreAccountBody = {},
): Promise<AccountResponse> {
	return restoreAccount(id, body);
}

export type { AccountListResponse, AccountResponse, AccountStatus };

// Maps known account error codes to user-facing copy. `fallback` names the
// action that failed when the API is unreachable.
export function getAccountsErrorMessage(
	error: unknown,
	fallback: string,
): string {
	if (error instanceof ApiError) {
		if (error.code === "ACCOUNT_NAME_TAKEN") {
			return "An account with this name already exists. Try a different name.";
		}
		if (error.code === "ACCOUNT_FIELD_LOCKED") {
			return "This account has transactions, so its opening balance and type can no longer be changed.";
		}
		return error.message;
	}
	return fallback;
}
