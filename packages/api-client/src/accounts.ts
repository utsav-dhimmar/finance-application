import type {
	AccountListResponse,
	AccountResponse,
	AccountStatus,
	CreateAccountBody,
	RestoreAccountBody,
	UpdateAccountBody,
} from "@finance-application/schemas";
import type { ApiClientOptions } from "./auth";
import { apiFetch } from "./client";

export type { ApiClientOptions };

export function createAccount(
	body: CreateAccountBody,
	options?: ApiClientOptions,
): Promise<AccountResponse> {
	return apiFetch<AccountResponse>(
		"/api/accounts",
		{
			method: "POST",
			body: JSON.stringify(body),
		},
		options,
	);
}

export function listAccounts(
	status: AccountStatus = "active",
	options?: ApiClientOptions,
): Promise<AccountListResponse> {
	const query = new URLSearchParams({ status });
	return apiFetch<AccountListResponse>(`/api/accounts?${query}`, {}, options);
}

export function getAccount(
	id: string,
	options?: ApiClientOptions,
): Promise<AccountResponse> {
	return apiFetch<AccountResponse>(`/api/accounts/${id}`, {}, options);
}

export function updateAccount(
	id: string,
	body: UpdateAccountBody,
	options?: ApiClientOptions,
): Promise<AccountResponse> {
	return apiFetch<AccountResponse>(
		`/api/accounts/${id}`,
		{
			method: "PATCH",
			body: JSON.stringify(body),
		},
		options,
	);
}

export function archiveAccount(
	id: string,
	options?: ApiClientOptions,
): Promise<AccountResponse> {
	return apiFetch<AccountResponse>(
		`/api/accounts/${id}/archive`,
		{
			method: "POST",
		},
		options,
	);
}

// Soft-delete: the account moves to trash and stays restorable.
export function deleteAccount(
	id: string,
	options?: ApiClientOptions,
): Promise<AccountResponse> {
	return apiFetch<AccountResponse>(
		`/api/accounts/${id}/delete`,
		{
			method: "POST",
		},
		options,
	);
}

// Permanent deletion from trash: irreversible, always user-requested, and
// gated server-side on zero referencing transactions/transfers in any
// lifecycle status. The endpoint answers 204 with no body.
export async function permanentlyDeleteAccount(
	id: string,
	options?: ApiClientOptions,
): Promise<void> {
	// The body is always empty on success; discard it to honor the void type.
	await apiFetch<unknown>(
		`/api/accounts/${id}`,
		{
			method: "DELETE",
		},
		options,
	);
}

export function restoreAccount(
	id: string,
	body: RestoreAccountBody = {},
	options?: ApiClientOptions,
): Promise<AccountResponse> {
	return apiFetch<AccountResponse>(
		`/api/accounts/${id}/restore`,
		{
			method: "POST",
			body: JSON.stringify(body),
		},
		options,
	);
}
