import {
	ApiError,
	login as apiLogin,
	logout as apiLogout,
	me as apiMe,
	refresh as apiRefresh,
	register as apiRegister,
} from "@finance-application/api-client";
import type {
	LoginBody,
	RegisterBody,
	UserResponse,
} from "@finance-application/schemas";

export const ME_QUERY_KEY = ["me"] as const;

export type SessionUser = UserResponse | null;

// Session state: on 401, tries the refresh endpoint once and retries, so an
// expired access token is invisible to the user while a valid refresh cookie
// exists. Resolves null when the visitor is not signed in.
export async function fetchSessionUser(): Promise<SessionUser> {
	try {
		return await apiMe();
	} catch (error) {
		if (error instanceof ApiError && error.status === 401) {
			try {
				await apiRefresh();
				return await apiMe();
			} catch {
				return null;
			}
		}
		throw error;
	}
}

export function meQueryOptions() {
	return {
		queryKey: ME_QUERY_KEY,
		queryFn: fetchSessionUser,
		retry: false,
		staleTime: 30_000,
	};
}

export function loginWithCredentials(body: LoginBody): Promise<UserResponse> {
	return apiLogin(body);
}

export function registerAccount(body: RegisterBody): Promise<UserResponse> {
	return apiRegister(body);
}

export function logoutCurrentSession(): Promise<null> {
	return apiLogout();
}

// Maps an unknown failure to a user-facing message. `fallback` lets callers
// name the action that failed when the API is unreachable.
export function getAuthErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof ApiError) {
		if (error.code === "EMAIL_TAKEN") {
			return "That email is already registered. Try logging in instead.";
		}
		return error.message;
	}
	return fallback;
}
