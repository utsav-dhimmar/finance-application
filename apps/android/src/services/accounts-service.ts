import {
	ApiError,
	archiveAccount,
	createAccount,
	deleteAccount,
	listAccounts,
	permanentlyDeleteAccount,
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

import { sessionMachine } from "@/session/session-runtime";

// All account slices share the ["accounts"] prefix so mutations can
// invalidate every tab's cache at once.
export const ACCOUNTS_QUERY_KEY = ["accounts"] as const;

export function accountsQueryKey(status: AccountStatus) {
	return [...ACCOUNTS_QUERY_KEY, status] as const;
}

// Every service call routes through SessionMachine.run() so a rejected
// access token triggers the shared single-flight refresh and retry, exactly
// as the web's cookie session does transparently.
export function accountsQueryOptions(status: AccountStatus) {
	return {
		queryKey: accountsQueryKey(status),
		queryFn: () =>
			sessionMachine().run((options) => listAccounts(status, options)),
		staleTime: 30_000,
	};
}

export function createNewAccount(
	body: CreateAccountBody,
): Promise<AccountResponse> {
	return sessionMachine().run((options) => createAccount(body, options));
}

export function editAccount(
	id: string,
	body: UpdateAccountBody,
): Promise<AccountResponse> {
	return sessionMachine().run((options) => updateAccount(id, body, options));
}

export function archiveExistingAccount(id: string): Promise<AccountResponse> {
	return sessionMachine().run((options) => archiveAccount(id, options));
}

export function deleteExistingAccount(id: string): Promise<AccountResponse> {
	return sessionMachine().run((options) => deleteAccount(id, options));
}

export function destroyAccount(id: string): Promise<void> {
	return sessionMachine().run((options) =>
		permanentlyDeleteAccount(id, options),
	);
}

export function restoreTrashedAccount(
	id: string,
	body: RestoreAccountBody = {},
): Promise<AccountResponse> {
	return sessionMachine().run((options) => restoreAccount(id, body, options));
}

export type { AccountListResponse, AccountResponse, AccountStatus };

// Maps known account error codes to user-facing copy, matching the web
// service's wording. `fallback` names the action that failed when the API is
// unreachable.
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
