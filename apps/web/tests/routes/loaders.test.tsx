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
import { screen, waitFor } from "@testing-library/react";
import { act, cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Route as dashboardRoute } from "@/routes/dashboard";
import { Route as transactionsRoute } from "@/routes/transactions";
import { Route as accountsRoute } from "@/routes/accounts";
import { Route as categoriesRoute } from "@/routes/categories";
import { Route as settingsRoute } from "@/routes/settings";
import { Route as recurringRoute } from "@/routes/recurring-expenses";
import { Route as archiveRoute } from "@/routes/archive";
import { Route as trashRoute } from "@/routes/trash";

// Loader tests mount a placeholder component wired with the real route
// options (beforeLoad + loader), so the assertions measure the navigation
// phase itself: the cache must be warm by the time the route renders, with
// each slice fetched exactly once (the page's useQuery then reads the warm
// cache without refetching). The stub resolves immediately so the awaited
// loader completes inside act() before rendering returns.

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

const ME = jsonResponse(200, { id: "u1", email: "me@example.com" });

// Realistic empty responses per endpoint, longest prefix first: the real
// pages dereference list fields (e.g. activity.activity.slice), so a
// catch-all body would crash them even though the query layer itself never
// validates the payload.
const ENDPOINT_BODIES: Array<[string, unknown]> = [
	["/api/recurring-expenses/due", { recurringExpenses: [] }],
	["/api/recurring-expenses", { recurringExpenses: [] }],
	[
		"/api/reports/summary",
		{
			periodFrom: "2026-01-01",
			periodTo: "2026-01-31",
			incomeMinor: 0,
			expenseMinor: 0,
			netCashFlowMinor: 0,
			categoryBreakdown: [],
			comparison: [],
			accounts: [],
			combinedBalanceMinor: 0,
		},
	],
	["/api/activity", { activity: [], page: 1, pageSize: 20, total: 0 }],
	["/api/preferences", { currencyCode: "INR" }],
	["/api/accounts", { accounts: [], combinedBalanceMinor: 0 }],
	["/api/categories", { categories: [] }],
];

// An Error override rethrows (simulating an unreachable API slice); a
// Response override answers with that response.
function stubFetch(
	overrides: Array<[string, Response | Error]> = [],
): ReturnType<typeof vi.fn> {
	const fetchMock = vi.fn(async (input: RequestInfo | string) => {
		const url = typeof input === "string" ? input : input.url;
		for (const [prefix, outcome] of overrides) {
			if (url.startsWith(prefix)) {
				if (outcome instanceof Error) {
					throw outcome;
				}
				return outcome.clone();
			}
		}
		if (url.startsWith("/api/auth/me")) {
			return ME.clone();
		}
		for (const [prefix, body] of ENDPOINT_BODIES) {
			if (url.startsWith(prefix)) {
				return jsonResponse(200, body);
			}
		}
		return jsonResponse(200, {});
	});
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

function callsFor(fetchMock: ReturnType<typeof vi.fn>, prefix: string): number {
	return fetchMock.mock.calls.filter((call) => {
		const arg = call[0] as RequestInfo | string;
		const url = typeof arg === "string" ? arg : arg.url;
		return url.startsWith(prefix);
	}).length;
}

function cachedCount(
	queryClient: QueryClient,
	key: readonly unknown[],
): number {
	return queryClient
		.getQueryCache()
		.findAll({ queryKey: key })
		.filter((query) => query.state.data !== undefined).length;
}

// Renders a placeholder component under the given real route's beforeLoad
// and loader inside a memory-history router, mirroring the app's router
// context shape. Returns the query client so tests can inspect warmed cache
// entries. The route options come from the registered route modules, so
// their types line up with this context without casts.
async function renderWithRouteOptions(
	routeOptions: {
		beforeLoad?: unknown;
		loader?: unknown;
	},
	path: string,
	component: ReactNode = <p>route loaded</p>,
): Promise<{ queryClient: QueryClient }> {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});

	const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
		component: Outlet,
	});
	const targetRoute = createRoute({
		getParentRoute: () => rootRoute,
		path,
		...(routeOptions.beforeLoad
			? {
					beforeLoad:
						routeOptions.beforeLoad as typeof dashboardRoute.options.beforeLoad,
				}
			: {}),
		...(routeOptions.loader
			? { loader: routeOptions.loader as typeof dashboardRoute.options.loader }
			: {}),
		component: () => component,
	});

	const router = createRouter({
		routeTree: rootRoute.addChildren([targetRoute]),
		history: createMemoryHistory({ initialEntries: [path] }),
		context: { queryClient },
	});

	await act(async () => {
		render(
			<ThemeProvider defaultTheme="light" storageKey="finance-app-theme-test">
				<QueryClientProvider client={queryClient}>
					<RouterProvider router={router} />
				</QueryClientProvider>
			</ThemeProvider>,
		);
	});
	return { queryClient };
}

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("route loaders warm the cache during navigation", () => {
	it("/dashboard warms the report, activity, due-recurring, and preferences slices", async () => {
		const fetchMock = stubFetch();
		const { queryClient } = await renderWithRouteOptions(
			dashboardRoute.options,
			"/dashboard",
		);
		expect(cachedCount(queryClient, ["reports"])).toBe(1);
		expect(cachedCount(queryClient, ["activity"])).toBe(1);
		expect(cachedCount(queryClient, ["recurring-expenses", "due"])).toBe(1);
		expect(cachedCount(queryClient, ["preferences"])).toBe(1);
		expect(callsFor(fetchMock, "/api/reports/summary")).toBe(1);
		expect(callsFor(fetchMock, "/api/activity")).toBe(1);
		expect(callsFor(fetchMock, "/api/recurring-expenses/due")).toBe(1);
		expect(callsFor(fetchMock, "/api/preferences")).toBe(1);
	});

	it("/transactions warms the default activity page plus the filter slices", async () => {
		const fetchMock = stubFetch();
		const { queryClient } = await renderWithRouteOptions(
			transactionsRoute.options,
			"/transactions",
		);
		expect(cachedCount(queryClient, ["activity"])).toBe(1);
		expect(cachedCount(queryClient, ["accounts", "active"])).toBe(1);
		expect(cachedCount(queryClient, ["categories", "active"])).toBe(1);
		expect(cachedCount(queryClient, ["preferences"])).toBe(1);
		expect(callsFor(fetchMock, "/api/activity")).toBe(1);
		expect(callsFor(fetchMock, "/api/accounts")).toBe(1);
		expect(callsFor(fetchMock, "/api/categories")).toBe(1);
		expect(callsFor(fetchMock, "/api/preferences")).toBe(1);
	});

	it("/accounts, /categories, and /settings warm their primary slices", async () => {
		const fetchMock = stubFetch();
		const accounts = await renderWithRouteOptions(
			accountsRoute.options,
			"/accounts",
		);
		expect(cachedCount(accounts.queryClient, ["accounts", "active"])).toBe(1);
		expect(callsFor(fetchMock, "/api/accounts?status=active")).toBe(1);

		const categories = await renderWithRouteOptions(
			categoriesRoute.options,
			"/categories",
		);
		expect(cachedCount(categories.queryClient, ["categories", "active"])).toBe(
			1,
		);
		expect(callsFor(fetchMock, "/api/categories?status=active")).toBe(1);

		const settings = await renderWithRouteOptions(
			settingsRoute.options,
			"/settings",
		);
		expect(cachedCount(settings.queryClient, ["preferences"])).toBe(1);
		expect(callsFor(fetchMock, "/api/preferences")).toBe(1);
	});

	it("/recurring-expenses warms the rule list, due card, and form slices", async () => {
		const fetchMock = stubFetch();
		const { queryClient } = await renderWithRouteOptions(
			recurringRoute.options,
			"/recurring-expenses",
		);
		expect(cachedCount(queryClient, ["recurring-expenses"])).toBe(2);
		expect(cachedCount(queryClient, ["accounts", "active"])).toBe(1);
		expect(cachedCount(queryClient, ["categories", "active"])).toBe(1);
		// The unfiltered list URL carries no query string; both list and due
		// share the /api/recurring-expenses prefix.
		expect(callsFor(fetchMock, "/api/recurring-expenses")).toBe(2);
		expect(callsFor(fetchMock, "/api/recurring-expenses/due")).toBe(1);
	});

	it("/archive and /trash warm their default-tab account slices", async () => {
		const fetchMock = stubFetch();
		const archive = await renderWithRouteOptions(
			archiveRoute.options,
			"/archive",
		);
		expect(cachedCount(archive.queryClient, ["accounts", "archived"])).toBe(1);
		expect(callsFor(fetchMock, "/api/accounts?status=archived")).toBe(1);

		const trash = await renderWithRouteOptions(trashRoute.options, "/trash");
		expect(cachedCount(trash.queryClient, ["accounts", "deleted"])).toBe(1);
		expect(callsFor(fetchMock, "/api/accounts?status=deleted")).toBe(1);
	});

	it("a failed prefetch does not block the route from rendering", async () => {
		stubFetch([
			["/api/reports/summary", new TypeError("Network request failed")],
		]);
		const { queryClient } = await renderWithRouteOptions(
			dashboardRoute.options,
			"/dashboard",
			<p>dashboard loaded</p>,
		);
		// The route rendered despite the failed prefetch; a loader that
		// threw would have replaced the tree with an error component.
		expect(screen.getByText("dashboard loaded")).toBeTruthy();
		// The failed slice stays unwarmed; the page's own useQuery will
		// surface the error and retry states.
		expect(cachedCount(queryClient, ["reports"])).toBe(0);
		expect(cachedCount(queryClient, ["preferences"])).toBe(1);
	});

	it("the real dashboard shows its error card when the prefetched report slice keeps failing", async () => {
		stubFetch([
			[
				"/api/reports/summary",
				jsonResponse(500, {
					error: { code: "INTERNAL_ERROR", message: "boom", details: [] },
				}),
			],
		]);
		const { DashboardPage } = await import("@/routes/dashboard");
		await renderWithRouteOptions(
			dashboardRoute.options,
			"/dashboard",
			<DashboardPage />,
		);
		// The loader's failed prefetch does not consume the failure; the
		// page's own useQuery surfaces the error card with its retry button.
		await waitFor(() => expect(screen.getByText("boom")).toBeTruthy());
		expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
	});
});
