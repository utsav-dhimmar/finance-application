import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import type { UserResponse } from "@finance-application/schemas";
import { meQueryOptions } from "@/services/auth-service";

// Route-level auth guards. Each protected route wires one into `beforeLoad`,
// so the session is resolved (with the refresh-once-on-401 semantics of the
// me query) before any protected content renders. Living outside router.tsx
// keeps route files from importing the router module, which imports the
// route tree and would form an import cycle.

export interface GuardContext {
	queryClient: QueryClient;
}

// Resolves the cached session. An API failure is not an auth outcome: the
// page's own pending/error states stay authoritative, so the failure is
// swallowed here and the guard lets the route proceed.
async function resolveSession(
	context: GuardContext,
): Promise<UserResponse | null | undefined> {
	try {
		// 'static': a cached session resolves as-is; only a missing or
		// invalidated session fetches. Login and logout clear the cache, so
		// it never outlives the principal.
		return await context.queryClient.query({
			...meQueryOptions(),
			staleTime: "static",
		});
	} catch {
		return undefined;
	}
}

// beforeLoad guard for protected routes: a visitor without a session is sent
// to /login before any protected content renders or any protected data
// request is made. Guards either proceed (resolve without a value) or throw
// the router's redirect signal; they never return data.
export async function guardAuthenticated({
	context,
}: {
	context: GuardContext;
}): Promise<void> {
	const session = await resolveSession(context);
	if (session === null) {
		throw redirect({ to: "/login" });
	}
}

// beforeLoad guard for /login and /register: a signed-in visitor is sent to
// /dashboard instead of seeing the auth forms.
export async function guardUnauthenticated({
	context,
}: {
	context: GuardContext;
}): Promise<void> {
	const session = await resolveSession(context);
	if (session !== null && session !== undefined) {
		throw redirect({ to: "/dashboard" });
	}
}
