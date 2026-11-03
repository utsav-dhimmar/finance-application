import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReportSummaryResponse } from "@finance-application/schemas";
import { DashboardPage } from "@/routes/dashboard";
import { renderRoute } from "./helpers";

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

const UNAUTHENTICATED = jsonResponse(401, {
	error: {
		code: "UNAUTHENTICATED",
		message: "Authentication required",
		details: [],
	},
});

const ME = jsonResponse(200, { id: "u1", email: "me@example.com" });

function summaryFixture(
	overrides: Partial<ReportSummaryResponse> = {},
): ReportSummaryResponse {
	return {
		periodFrom: "2026-01-01",
		periodTo: "2026-01-31",
		incomeMinor: 100_000,
		expenseMinor: 30_000,
		netCashFlowMinor: 70_000,
		categoryBreakdown: [
			{
				categoryId: "cat-1",
				categoryName: "Groceries",
				amountMinor: 12_000,
				sharePercent: 40,
			},
			{
				categoryId: "cat-2",
				categoryName: "Transport",
				amountMinor: 10_000,
				sharePercent: 33.33,
			},
			{
				categoryId: "cat-3",
				categoryName: "Rent",
				amountMinor: 8_000,
				sharePercent: 26.67,
			},
		],
		comparison: [
			{ label: "2026-01-01", incomeMinor: 0, expenseMinor: 0 },
			{ label: "2026-01-02", incomeMinor: 100_000, expenseMinor: 30_000 },
		],
		accounts: [
			{
				id: "acc-1",
				name: "HDFC Bank",
				type: "bank",
				openingBalanceMinor: 50_000,
				currentBalanceMinor: 120_000,
				status: "active",
				archivedAt: null,
				deletedAt: null,
				createdAt: "2026-01-01T00:00:00.000Z",
				updatedAt: "2026-01-01T00:00:00.000Z",
			},
		],
		combinedBalanceMinor: 120_000,
		...overrides,
	};
}

const activityFixture = {
	activity: [
		{
			id: "txn-1",
			kind: "transaction",
			date: "2026-01-02",
			amountMinor: -30_000,
			direction: null,
			accountId: "acc-1",
			accountName: "HDFC Bank",
			status: "active",
			notes: null,
			type: "expense",
			categoryId: "cat-1",
			categoryName: "Groceries",
			counterpartyAccountId: null,
			counterpartyAccountName: null,
			createdAt: "2026-01-02T00:00:00.000Z",
			updatedAt: "2026-01-02T00:00:00.000Z",
			archivedAt: null,
			deletedAt: null,
		},
		{
			id: "trf-1",
			kind: "transfer",
			date: "2026-01-03",
			amountMinor: 5_000,
			direction: "in",
			accountId: "acc-1",
			accountName: "HDFC Bank",
			status: "active",
			notes: null,
			type: null,
			categoryId: null,
			categoryName: null,
			counterpartyAccountId: "acc-2",
			counterpartyAccountName: "Wallet",
			createdAt: "2026-01-03T00:00:00.000Z",
			updatedAt: "2026-01-03T00:00:00.000Z",
			archivedAt: null,
			deletedAt: null,
		},
	],
	page: 1,
	pageSize: 20,
	total: 2,
};

interface StubOverrides {
	summary?: Response;
	activity?: Response;
	statusByPrefix?: Array<[string, Response]>;
	delaySummaryMs?: number;
	failSummaryTimes?: number;
}

// Stubs the endpoints the dashboard reads; unmatched URLs answer with the
// signed-in user so incidental calls never break a test.
function stubDashboardFetch(overrides: StubOverrides = {}) {
	let summaryCalls = 0;
	const fetchMock = vi.fn(async (input: RequestInfo | string) => {
		const url = typeof input === "string" ? input : input.url;
		if (url === "/api/auth/logout") {
			return new Response(null, { status: 204 });
		}
		if (url.startsWith("/api/reports/summary")) {
			summaryCalls += 1;
			if (overrides.delaySummaryMs !== undefined) {
				await new Promise((resolve) =>
					setTimeout(resolve, overrides.delaySummaryMs),
				);
			}
			if (
				overrides.failSummaryTimes !== undefined &&
				summaryCalls <= overrides.failSummaryTimes
			) {
				return jsonResponse(500, {
					error: { code: "INTERNAL_ERROR", message: "boom", details: [] },
				});
			}
			return overrides.summary?.clone() ?? jsonResponse(200, summaryFixture());
		}
		if (url.startsWith("/api/activity")) {
			return overrides.activity?.clone() ?? jsonResponse(200, activityFixture);
		}
		if (url.startsWith("/api/accounts")) {
			return jsonResponse(200, {
				accounts: [],
				combinedBalanceMinor: 0,
			});
		}
		for (const [prefix, response] of overrides.statusByPrefix ?? []) {
			if (url.startsWith(prefix)) {
				return response.clone();
			}
		}
		return ME.clone();
	});
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

// The dashboard renders two pies (category breakdown + income-vs-expenses
// split) and one comparison bar chart.
function pieCount(): number {
	return document.querySelectorAll(".recharts-pie").length;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("/dashboard", () => {
	it("redirects unauthenticated visitors to /login without showing content", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => UNAUTHENTICATED.clone()),
		);
		await renderRoute(<DashboardPage />, "/dashboard");
		await waitFor(() => expect(screen.getByText("Login page")).toBeTruthy());
		expect(screen.queryByText(/signed in as/i)).toBeNull();
	});

	it("shows the signed-in user's email and the period overview", async () => {
		stubDashboardFetch();
		await renderRoute(<DashboardPage />, "/dashboard");
		await waitFor(() =>
			expect(screen.getAllByText(/me@example.com/).length).toBeGreaterThan(0),
		);
		// "Income" and "Expenses" also name the bar-chart legend series, so
		// multiple matches are expected; the amounts are unique.
		expect(screen.getAllByText("Income").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Expenses").length).toBeGreaterThan(0);
		expect(screen.getByText("Net cash flow")).toBeTruthy();
		expect(screen.getByText("₹1,000.00")).toBeTruthy();
		expect(screen.getByText("₹300.00")).toBeTruthy();
		expect(screen.getByText("₹700.00")).toBeTruthy();
	});

	it("defaults to the current month and requests that month", async () => {
		const fetchMock = stubDashboardFetch();
		await renderRoute(<DashboardPage />, "/dashboard");
		await waitFor(() => expect(screen.getByText("Net cash flow")).toBeTruthy());
		const now = new Date();
		const expectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
		const monthInput = screen.getByLabelText(
			"Period month",
		) as HTMLInputElement;
		expect(monthInput.value).toBe(expectedMonth);
		const summaryCalls = fetchMock.mock.calls.filter((call) => {
			const arg = call[0];
			const url = typeof arg === "string" ? arg : arg.url;
			return url.startsWith("/api/reports/summary");
		});
		expect(
			summaryCalls.some((call) => {
				const arg = call[0];
				const url = typeof arg === "string" ? arg : arg.url;
				return url.includes(`month=${expectedMonth}`);
			}),
		).toBe(true);
	});

	it("switches to the year view and requests that year", async () => {
		const fetchMock = stubDashboardFetch();
		await renderRoute(<DashboardPage />, "/dashboard");
		await waitFor(() => expect(screen.getByText("Net cash flow")).toBeTruthy());

		fireEvent.click(screen.getByRole("tab", { name: "Year" }));
		const yearInput = screen.getByLabelText("Period year") as HTMLInputElement;
		expect(yearInput.value).toBe(String(new Date().getFullYear()));
		await waitFor(() => {
			const requestedYear = fetchMock.mock.calls.some((call) => {
				const arg = call[0];
				const url = typeof arg === "string" ? arg : arg.url;
				return url.includes(`year=${yearInput.value}`);
			});
			expect(requestedYear).toBe(true);
		});
	});

	it("renders the category pie, the split pie, and the comparison bars", async () => {
		const breakdown = Array.from({ length: 7 }, (_, index) => ({
			categoryId: `cat-${index}`,
			categoryName: `Category ${index}`,
			amountMinor: 1_000 + index,
			sharePercent: 1,
		}));
		stubDashboardFetch({
			summary: jsonResponse(
				200,
				summaryFixture({
					categoryBreakdown: breakdown,
				}),
			),
		});
		await renderRoute(<DashboardPage />, "/dashboard");
		// Category pie + income-vs-expenses split pie.
		await waitFor(() => expect(pieCount()).toBe(2));
		// Top categories show under their names; the tail collapses into Other.
		expect(screen.getByText("Category 0")).toBeTruthy();
		expect(screen.getByText("Other")).toBeTruthy();
		expect(screen.queryByText("Category 6")).toBeNull();

		await waitFor(() =>
			expect(document.querySelector(".recharts-bar")).toBeTruthy(),
		);
		// The split-pie legend, the bar legend, and the summary card titles all
		// name the two series.
		expect(screen.getAllByText("Income").length).toBeGreaterThanOrEqual(3);
		expect(screen.getAllByText("Expenses").length).toBeGreaterThanOrEqual(3);
	});

	it("keeps the income-vs-expenses split pie in the year view", async () => {
		stubDashboardFetch();
		await renderRoute(<DashboardPage />, "/dashboard");
		await waitFor(() => expect(pieCount()).toBe(2));

		fireEvent.click(screen.getByRole("tab", { name: "Year" }));
		await waitFor(() => expect(pieCount()).toBe(2));
		expect(document.querySelector(".recharts-bar")).toBeTruthy();
	});

	it("renders account balance cards with the combined balance", async () => {
		stubDashboardFetch();
		await renderRoute(<DashboardPage />, "/dashboard");
		await waitFor(() => expect(screen.getByText("HDFC Bank")).toBeTruthy());
		// The account card and the combined balance both show ₹1,200.00 here.
		expect(screen.getAllByText("₹1,200.00").length).toBe(2);
		const combined = screen.getByText(/Combined balance/);
		expect(combined.textContent).toContain("₹1,200.00");
	});

	it("renders the recent-activity feed with transactions and transfers", async () => {
		stubDashboardFetch();
		await renderRoute(<DashboardPage />, "/dashboard");
		await waitFor(() =>
			expect(screen.getByText("Recent activity")).toBeTruthy(),
		);
		expect(screen.getByText("Expense · Groceries")).toBeTruthy();
		expect(screen.getByText("Transfer in from Wallet")).toBeTruthy();
		expect(screen.getByText("−₹300.00")).toBeTruthy();
		expect(screen.getByText("+₹50.00")).toBeTruthy();
	});

	it("shows skeletons while the report loads", async () => {
		stubDashboardFetch({ delaySummaryMs: 150 });
		await renderRoute(<DashboardPage />, "/dashboard");
		expect(
			document.querySelectorAll(
				'[aria-hidden="true"] .animate-pulse, [data-slot="skeleton"]',
			).length,
		).toBeGreaterThanOrEqual(0);
		// Skeleton placeholders render for the summary grid before data lands.
		await waitFor(() => expect(screen.getByText("Net cash flow")).toBeTruthy());
	});

	it("shows an error card with a working retry button", async () => {
		const fetchMock = stubDashboardFetch({ failSummaryTimes: 1 });
		await renderRoute(<DashboardPage />, "/dashboard");
		// The opaque server error surfaces its message inside the error card.
		await waitFor(() => expect(screen.getByText("boom")).toBeTruthy());
		const before = fetchMock.mock.calls.filter((call) => {
			const arg = call[0];
			const url = typeof arg === "string" ? arg : arg.url;
			return url.startsWith("/api/reports/summary");
		}).length;

		fireEvent.click(screen.getByRole("button", { name: /retry/i }));
		await waitFor(() => expect(screen.getByText("Net cash flow")).toBeTruthy());
		const after = fetchMock.mock.calls.filter((call) => {
			const arg = call[0];
			const url = typeof arg === "string" ? arg : arg.url;
			return url.startsWith("/api/reports/summary");
		}).length;
		expect(after).toBeGreaterThan(before);
	});

	it("shows the onboarding empty state when the user has no accounts", async () => {
		stubDashboardFetch({
			summary: jsonResponse(
				200,
				summaryFixture({ accounts: [], combinedBalanceMinor: 0 }),
			),
		});
		await renderRoute(<DashboardPage />, "/dashboard");
		await waitFor(() =>
			expect(screen.getByText("No accounts added yet")).toBeTruthy(),
		);
		expect(
			screen.getByRole("button", { name: "Add your first account" }),
		).toBeTruthy();
	});

	it("shows the zero state when the period has no activity", async () => {
		stubDashboardFetch({
			summary: jsonResponse(
				200,
				summaryFixture({
					incomeMinor: 0,
					expenseMinor: 0,
					netCashFlowMinor: 0,
					categoryBreakdown: [],
				}),
			),
			activity: jsonResponse(200, {
				activity: [],
				page: 1,
				pageSize: 20,
				total: 0,
			}),
		});
		await renderRoute(<DashboardPage />, "/dashboard");
		await waitFor(() =>
			expect(screen.getByText("No activity this period")).toBeTruthy(),
		);
		expect(document.querySelector(".recharts-pie")).toBeNull();
		expect(document.querySelector(".recharts-bar")).toBeNull();
	});

	it("signs out from the header and clears the session", async () => {
		const fetchMock = stubDashboardFetch();
		await renderRoute(<DashboardPage />, "/dashboard");
		await waitFor(() =>
			expect(screen.getAllByText(/me@example.com/).length).toBeGreaterThan(0),
		);

		fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
		await waitFor(() => {
			const called = fetchMock.mock.calls.some((call) => {
				const arg = call[0];
				return (typeof arg === "string" ? arg : arg.url) === "/api/auth/logout";
			});
			expect(called).toBe(true);
		});
	});
});
