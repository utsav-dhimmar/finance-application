import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react-native";
import type { ReactElement, ReactNode } from "react";

// Creates a QueryClient tuned for tests: no retries so failures surface
// immediately, mirroring the web test helpers.
export function createTestQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});
}

/** Wraps a component with the providers data-layer hooks and screens need. */
export function withProviders(
	ui: ReactElement,
	queryClient: QueryClient = createTestQueryClient(),
): { element: ReactElement; queryClient: QueryClient } {
	return {
		element: (
			<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
		),
		queryClient,
	};
}

/** Renders a component under the provider stack, like the web's renderRoute. */
export async function renderWithProviders(
	ui: ReactElement,
	queryClient: QueryClient = createTestQueryClient(),
) {
	const { element, queryClient: client } = withProviders(ui, queryClient);
	// RNTL 14 render is async and must be awaited.
	const view = await render(element);
	return { view, queryClient: client };
}

/** Provider stack for renderHook: pass it as the renderHook wrapper. */
export function HookWrapper({
	children,
	queryClient,
}: {
	children: ReactNode;
	queryClient: QueryClient;
}) {
	return (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
}
