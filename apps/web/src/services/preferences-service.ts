import {
	ApiError,
	getPreferences,
	updatePreferences,
} from "@finance-application/api-client";
import type {
	PreferencesResponse,
	UpdatePreferencesBody,
} from "@finance-application/schemas";

// All preferences reads share the ["preferences"] key so an update
// invalidates every consumer at once.
export const PREFERENCES_QUERY_KEY = ["preferences"] as const;

export function preferencesQueryOptions() {
	return {
		queryKey: PREFERENCES_QUERY_KEY,
		queryFn: () => getPreferences(),
		staleTime: 30_000,
	};
}

export function changePreferences(
	body: UpdatePreferencesBody,
): Promise<PreferencesResponse> {
	return updatePreferences(body);
}

export type { PreferencesResponse, UpdatePreferencesBody };

// Maps known preference error codes to user-facing copy. `fallback` names
// the action that failed when the API is unreachable.
export function getPreferencesErrorMessage(
	error: unknown,
	fallback: string,
): string {
	if (error instanceof ApiError) {
		if (error.code === "UNSUPPORTED_CURRENCY") {
			return "That display currency is not supported.";
		}
		return error.message;
	}
	return fallback;
}
