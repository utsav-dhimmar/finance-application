import {
	ApiError,
	archiveTransfer,
	createTransfer,
	deleteTransfer,
	getTransfer,
	listActivity,
	listTransfers,
	permanentlyDeleteTransfer,
	restoreTransfer,
	updateTransfer,
} from "@finance-application/api-client";
import type {
	CreateTransferBody,
	ListActivityQuery,
	ListTransfersQuery,
	RestoreTransferBody,
	TransferListResponse,
	TransferResponse,
	UpdateTransferBody,
} from "@finance-application/schemas";

// All transfer list slices share the ["transfers"] prefix so mutations can
// invalidate every filter combination at once.
export const TRANSFERS_QUERY_KEY = ["transfers"] as const;

// The unified account-history slices share ["activity"] so transfer and
// transaction mutations can invalidate every account's history at once.
export const ACTIVITY_QUERY_KEY = ["activity"] as const;

export function transfersQueryKey(filters: Partial<ListTransfersQuery>) {
	// Key by the canonical string form so different filter objects that
	// serialize identically share one cache entry.
	return [...TRANSFERS_QUERY_KEY, serializeFilters(filters)] as const;
}

export function serializeFilters(filters: Partial<ListTransfersQuery>): string {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(filters)) {
		if (value !== undefined && value !== "") {
			params.set(key, String(value));
		}
	}
	return params.toString();
}

export function transfersQueryOptions(filters: Partial<ListTransfersQuery>) {
	return {
		queryKey: transfersQueryKey(filters),
		queryFn: () => listTransfers(filters),
		staleTime: 30_000,
	};
}

export function activityQueryKey(filters: Partial<ListActivityQuery>) {
	return [
		...ACTIVITY_QUERY_KEY,
		serializeFilters(filters as Partial<ListTransfersQuery>),
	] as const;
}

export function activityQueryOptions(filters: Partial<ListActivityQuery>) {
	return {
		queryKey: activityQueryKey(filters),
		queryFn: () => listActivity(filters),
		staleTime: 30_000,
	};
}

export function getExistingTransfer(id: string): Promise<TransferResponse> {
	return getTransfer(id);
}

export function createNewTransfer(
	body: CreateTransferBody,
): Promise<TransferResponse> {
	return createTransfer(body);
}

export function editTransfer(
	id: string,
	body: UpdateTransferBody,
): Promise<TransferResponse> {
	return updateTransfer(id, body);
}

export function archiveExistingTransfer(id: string): Promise<TransferResponse> {
	return archiveTransfer(id);
}

export function deleteExistingTransfer(id: string): Promise<TransferResponse> {
	return deleteTransfer(id);
}

export function restoreTrashedTransfer(
	id: string,
	body: RestoreTransferBody = {},
): Promise<TransferResponse> {
	return restoreTransfer(id, body);
}

export function destroyTransfer(id: string): Promise<TransferResponse> {
	return permanentlyDeleteTransfer(id);
}

export type {
	ListActivityQuery,
	ListTransfersQuery,
	TransferListResponse,
	TransferResponse,
};

// Maps known transfer error codes to user-facing copy. `fallback` names the
// action that failed when the API is unreachable.
export function getTransfersErrorMessage(
	error: unknown,
	fallback: string,
): string {
	if (error instanceof ApiError) {
		if (error.code === "SAME_ACCOUNT_TRANSFER") {
			return "Choose two different accounts: source and destination must differ.";
		}
		if (error.code === "ACCOUNT_INELIGIBLE") {
			return "Transfers need active accounts. Archived or deleted accounts cannot be used.";
		}
		if (error.code === "RESTORE_CONFLICT") {
			return "This transfer's account was deleted. Assign a replacement to restore it.";
		}
		return error.message;
	}
	return fallback;
}
