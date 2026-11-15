import type { LoginBody, UserResponse } from "@finance-application/schemas";
import { apiFetch } from "./client";

export interface ApiClientOptions {
	/** Prefix for all requests, e.g. "https://api.example.com". Defaults to same-origin relative paths. */
	baseUrl?: string;
	/** Abort signal forwarded to the underlying fetch, for cancellable requests. */
	signal?: AbortSignal;
}

export function login(
	body: LoginBody,
	options?: ApiClientOptions,
): Promise<UserResponse> {
	return apiFetch<UserResponse>(
		"/api/auth/login",
		{
			method: "POST",
			body: JSON.stringify(body),
		},
		options,
	);
}

export function me(options?: ApiClientOptions): Promise<UserResponse> {
	return apiFetch<UserResponse>("/api/auth/me", {}, options);
}

export function refresh(options?: ApiClientOptions): Promise<UserResponse> {
	return apiFetch<UserResponse>(
		"/api/auth/refresh",
		{ method: "POST" },
		options,
	);
}

export function logout(options?: ApiClientOptions): Promise<null> {
	return apiFetch<null>("/api/auth/logout", { method: "POST" }, options);
}
