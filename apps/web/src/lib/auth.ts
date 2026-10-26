import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiFetch } from "./api-client";

export interface AuthUser {
	id: string;
	email: string;
}

export interface Credentials {
	email: string;
	password: string;
}

const ME_QUERY_KEY = ["me"] as const;

async function fetchMe(): Promise<AuthUser> {
	return apiFetch<AuthUser>("/api/auth/me");
}

// Session state: on 401, tries the refresh endpoint once and retries, so an
// expired access token is invisible to the user while a valid refresh cookie
// exists.
export function meQueryOptions() {
	return {
		queryKey: ME_QUERY_KEY,
		queryFn: async (): Promise<AuthUser | null> => {
			try {
				return await fetchMe();
			} catch (error) {
				if (error instanceof ApiError && error.status === 401) {
					try {
						await apiFetch("/api/auth/refresh", { method: "POST" });
						return await fetchMe();
					} catch {
						return null;
					}
				}
				throw error;
			}
		},
		retry: false,
		staleTime: 30_000,
	};
}

export function useMe() {
	return useQuery(meQueryOptions());
}

function useCredentialsMutation(endpoint: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (credentials: Credentials): Promise<AuthUser> =>
			apiFetch<AuthUser>(endpoint, {
				method: "POST",
				body: JSON.stringify(credentials),
			}),
		onSuccess: (user) => {
			queryClient.setQueryData(ME_QUERY_KEY, user);
		},
	});
}

export function useLogin() {
	return useCredentialsMutation("/api/auth/login");
}

export function useRegister() {
	return useCredentialsMutation("/api/auth/register");
}

export function useLogout() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (): Promise<null> =>
			apiFetch<null>("/api/auth/logout", { method: "POST" }),
		onSettled: () => {
			queryClient.setQueryData(ME_QUERY_KEY, null);
		},
	});
}
