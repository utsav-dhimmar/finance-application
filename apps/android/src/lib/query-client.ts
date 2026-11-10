import { QueryClient } from "@tanstack/react-query";

// One shared client for the whole app, matching the web's configuration
// (apps/web/src/router.tsx): cached data is fresh for 30 seconds, so screens
// re-render cache instead of refetching on every focus within that window.
export function createQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 30_000,
			},
		},
	});
}

export const queryClient = createQueryClient();
