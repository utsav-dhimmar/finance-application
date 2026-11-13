import type { UpdatePreferencesBody } from "@finance-application/schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
	notifyMutationError,
	notifyMutationSuccess,
} from "@/lib/mutation-feedback";
import {
	changePreferences,
	getPreferencesErrorMessage,
	PREFERENCES_QUERY_KEY,
	preferencesQueryOptions,
} from "@/services/preferences-service";

export function usePreferences() {
	return useQuery(preferencesQueryOptions());
}

export function useUpdatePreferences() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: UpdatePreferencesBody) => changePreferences(body),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: PREFERENCES_QUERY_KEY });
			notifyMutationSuccess("Preferences updated.");
		},
		onError: (error) =>
			notifyMutationError(
				error,
				getPreferencesErrorMessage,
				"Could not save preferences. Is the API running?",
			),
	});
}
