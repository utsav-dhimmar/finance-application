import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import {
	act,
	cleanup,
	type RenderResult,
	render,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach } from "vitest";

// Renders a route component inside a real memory-history router with the
// counterpart routes registered, so useNavigate redirects actually resolve.
export async function renderRoute(
	ui: ReactNode,
	path: string,
): Promise<RenderResult> {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});

	const rootRoute = createRootRoute({ component: Outlet });
	const targetRoute = createRoute({
		getParentRoute: () => rootRoute,
		path,
		component: () => ui,
	});

	// Counterpart routes for navigation assertions, skipping the path under
	// test so ids stay unique.
	const counterpartEntries: Array<[string, string]> = [
		["/login", "Login page"],
		["/register", "Register page"],
		["/dashboard", "Dashboard page"],
	] as Array<[string, string]>;
	const counterparts = counterpartEntries.filter(
		([routePath]) => routePath !== path,
	);
	const counterpartRoutes = counterparts.map(([routePath, label]) =>
		createRoute({
			getParentRoute: () => rootRoute,
			path: routePath,
			component: () => <p>{label}</p>,
		}),
	);

	const router = createRouter({
		routeTree: rootRoute.addChildren([targetRoute, ...counterpartRoutes]),
		history: createMemoryHistory({ initialEntries: [path] }),
	});

	// RouterProvider suspends until the router is ready; flush it inside act.
	let view!: RenderResult;
	await act(async () => {
		view = render(
			<QueryClientProvider client={queryClient}>
				<RouterProvider router={router} />
			</QueryClientProvider>,
		);
	});
	return view;
}

// Renders a route component with the real file-based route tree context is not
// needed here; tests that only assert rendering (not navigation) can use this.
export function renderPlain(ui: ReactNode): RenderResult {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
	);
}

afterEach(() => {
	cleanup();
});
