import type {
	ActivityListResponse,
	CreateTransferBody,
	ListActivityQuery,
	ListTransfersQuery,
	RestoreTransferBody,
	TransferListResponse,
	TransferResponse,
	UpdateTransferBody,
} from "@finance-application/schemas";
import type { ApiClientOptions } from "./auth";
import { apiFetch } from "./client";

export function createTransfer(
	body: CreateTransferBody,
	options?: ApiClientOptions,
): Promise<TransferResponse> {
	return apiFetch<TransferResponse>(
		"/api/transfers",
		{
			method: "POST",
			body: JSON.stringify(body),
		},
		options,
	);
}

export function listTransfers(
	query: Partial<ListTransfersQuery> = {},
	options?: ApiClientOptions,
): Promise<TransferListResponse> {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value !== undefined && value !== "") {
			params.set(key, String(value));
		}
	}
	const suffix = params.size > 0 ? `?${params}` : "";
	return apiFetch<TransferListResponse>(
		`/api/transfers${suffix}`,
		{},
		options,
	);
}

export function getTransfer(
	id: string,
	options?: ApiClientOptions,
): Promise<TransferResponse> {
	return apiFetch<TransferResponse>(`/api/transfers/${id}`, {}, options);
}

export function updateTransfer(
	id: string,
	body: UpdateTransferBody,
	options?: ApiClientOptions,
): Promise<TransferResponse> {
	return apiFetch<TransferResponse>(
		`/api/transfers/${id}`,
		{
			method: "PATCH",
			body: JSON.stringify(body),
		},
		options,
	);
}

export function archiveTransfer(
	id: string,
	options?: ApiClientOptions,
): Promise<TransferResponse> {
	return apiFetch<TransferResponse>(
		`/api/transfers/${id}/archive`,
		{
			method: "POST",
		},
		options,
	);
}

// Soft-delete: the transfer moves to trash and both balance effects reverse;
// restoration re-applies them exactly once.
export function deleteTransfer(
	id: string,
	options?: ApiClientOptions,
): Promise<TransferResponse> {
	return apiFetch<TransferResponse>(
		`/api/transfers/${id}/delete`,
		{
			method: "POST",
		},
		options,
	);
}

export function restoreTransfer(
	id: string,
	body: RestoreTransferBody = {},
	options?: ApiClientOptions,
): Promise<TransferResponse> {
	return apiFetch<TransferResponse>(
		`/api/transfers/${id}/restore`,
		{
			method: "POST",
			body: JSON.stringify(body),
		},
		options,
	);
}

// Permanent deletion from trash: irreversible, always user-requested.
export function permanentlyDeleteTransfer(
	id: string,
	options?: ApiClientOptions,
): Promise<TransferResponse> {
	return apiFetch<TransferResponse>(
		`/api/transfers/${id}`,
		{
			method: "DELETE",
		},
		options,
	);
}

// Unified history: transactions interleaved with both legs of every transfer,
// direction-tagged; the optional accountId filter scopes it to one account.
export function listActivity(
	query: Partial<ListActivityQuery> = {},
	options?: ApiClientOptions,
): Promise<ActivityListResponse> {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value !== undefined && value !== "") {
			params.set(key, String(value));
		}
	}
	const suffix = params.size > 0 ? `?${params}` : "";
	return apiFetch<ActivityListResponse>(`/api/activity${suffix}`, {}, options);
}
