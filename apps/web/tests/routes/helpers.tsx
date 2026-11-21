import { ThemeProvider } from "@finance-application/ui/components/theme-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRouteWithContext,
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
import type { guardAuthenticated } from "@/lib/route-guards";

// Renders a route component inside a real memory-history router with the
// counterpart routes registered, so useNavigate redirects actually resolve.
// `beforeLoad` wires one of the real route guards into the ad-hoc route so
// tests can exercise router-level redirect behavior; the router carries the
// queryClient in its context, exactly as the app router does. The returned
// result exposes that client so tests can assert loader cache warming.
export async function renderRoute(
	ui: ReactNode,
	path: string,
	opts?: {
		beforeLoad?: typeof guardAuthenticated;
	},
): Promise<RenderResult & { queryClient: QueryClient }> {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});

	const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
		component: Outlet,
	});
	const targetRoute = createRoute({
		getParentRoute: () => rootRoute,
		path,
		component: () => ui,
		...(opts?.beforeLoad ? { beforeLoad: opts.beforeLoad } : {}),
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
		context: { queryClient },
	});

	// RouterProvider suspends until the router is ready; flush it inside act.
	let view!: RenderResult;
	await act(async () => {
		view = render(
			<ThemeProvider defaultTheme="light" storageKey="finance-app-theme-test">
				<QueryClientProvider client={queryClient}>
					<RouterProvider router={router} />
				</QueryClientProvider>
			</ThemeProvider>,
		);
	});
	return Object.assign(view, { queryClient });
}

// Renders a route component with the real file-based route tree context is not
// needed here; tests that only assert rendering (not navigation) can use this.
export function renderPlain(ui: ReactNode): RenderResult {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<ThemeProvider defaultTheme="light" storageKey="finance-app-theme-test">
			<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
		</ThemeProvider>,
	);
}

afterEach(() => {
	cleanup();
});
