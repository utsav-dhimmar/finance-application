import type {
	PreferencesResponse,
	UpdatePreferencesBody,
} from "@finance-application/schemas";
import type { ApiClientOptions } from "./auth";
import { apiFetch } from "./client";

export function getPreferences(
	options?: ApiClientOptions,
): Promise<PreferencesResponse> {
	return apiFetch<PreferencesResponse>("/api/preferences", {}, options);
}

export function updatePreferences(
	body: UpdatePreferencesBody,
	options?: ApiClientOptions,
): Promise<PreferencesResponse> {
	return apiFetch<PreferencesResponse>(
		"/api/preferences",
		{
			method: "PATCH",
			body: JSON.stringify(body),
		},
		options,
	);
}
