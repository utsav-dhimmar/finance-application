import type { UpdatePreferencesBody } from "@finance-application/schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	changePreferences,
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
		},
	});
}
