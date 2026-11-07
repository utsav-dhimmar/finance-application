import type { UserResponse } from "@finance-application/schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	loginWithCredentials,
	logoutCurrentSession,
	ME_QUERY_KEY,
	meQueryOptions,
} from "@/services/auth-service";

export function useMe() {
	return useQuery(meQueryOptions());
}

function useCredentialsMutation(
	action: (input: { email: string; password: string }) => Promise<UserResponse>,
) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: action,
		onSuccess: (user) => {
			// Every cached response belongs to the previously signed-in
			// principal: principal-agnostic query keys would otherwise render
			// that data for whoever signs in next. Clear it all, then seed the
			// new principal's identity.
			queryClient.clear();
			queryClient.setQueryData(ME_QUERY_KEY, user);
		},
	});
}

export function useLogin() {
	return useCredentialsMutation(loginWithCredentials);
}

export function useLogout() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: logoutCurrentSession,
		onSettled: () => {
			// Clear cached data on logout too, so an in-place sign-in by a
			// different account never sees the previous account's rows.
			queryClient.clear();
			queryClient.setQueryData(ME_QUERY_KEY, null);
		},
	});
}
