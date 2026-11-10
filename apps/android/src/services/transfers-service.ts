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

import { sessionMachine } from "@/session/session-runtime";

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
		queryFn: () =>
			sessionMachine().run((options) => listTransfers(filters, options)),
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
		queryFn: () =>
			sessionMachine().run((options) => listActivity(filters, options)),
		staleTime: 30_000,
	};
}

export function getExistingTransfer(id: string): Promise<TransferResponse> {
	return sessionMachine().run((options) => getTransfer(id, options));
}

export function createNewTransfer(
	body: CreateTransferBody,
): Promise<TransferResponse> {
	return sessionMachine().run((options) => createTransfer(body, options));
}

export function editTransfer(
	id: string,
	body: UpdateTransferBody,
): Promise<TransferResponse> {
	return sessionMachine().run((options) => updateTransfer(id, body, options));
}

export function archiveExistingTransfer(id: string): Promise<TransferResponse> {
	return sessionMachine().run((options) => archiveTransfer(id, options));
}

export function deleteExistingTransfer(id: string): Promise<TransferResponse> {
	return sessionMachine().run((options) => deleteTransfer(id, options));
}

export function restoreTrashedTransfer(
	id: string,
	body: RestoreTransferBody = {},
): Promise<TransferResponse> {
	return sessionMachine().run((options) => restoreTransfer(id, body, options));
}

export function destroyTransfer(id: string): Promise<TransferResponse> {
	return sessionMachine().run((options) =>
		permanentlyDeleteTransfer(id, options),
	);
}

export type {
	ListActivityQuery,
	ListTransfersQuery,
	TransferListResponse,
	TransferResponse,
};

// Maps known transfer error codes to user-facing copy, matching the web
// service's wording. `fallback` names the action that failed when the API is
// unreachable.
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
