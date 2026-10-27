import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UserResponse } from "@finance-application/schemas";
import {
	ME_QUERY_KEY,
	loginWithCredentials,
	logoutCurrentSession,
	meQueryOptions,
	registerAccount,
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
			queryClient.setQueryData(ME_QUERY_KEY, user);
		},
	});
}

export function useLogin() {
	return useCredentialsMutation(loginWithCredentials);
}

export function useRegister() {
	return useCredentialsMutation(registerAccount);
}

export function useLogout() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: logoutCurrentSession,
		onSettled: () => {
			queryClient.setQueryData(ME_QUERY_KEY, null);
		},
	});
}
