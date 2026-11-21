import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "@/routes/dashboard";
import { renderRoute } from "./helpers";

// Chart-bundle pending path: the mocked chart modules resolve their import
// after a delay, so the dashboard shell renders first and each chart slot
// shows the Suspense skeleton until the bundle lands. This file's module
// cache is fresh, so the delayed factory governs the first import; the
// failure/retry path lives in its own file.
const chartState = vi.hoisted(() => ({
	delayMs: 0,
}));

vi.mock("@/components/charts/expenses-by-category-chart", async () => {
	if (chartState.delayMs > 0) {
		await new Promise((resolve) => setTimeout(resolve, chartState.delayMs));
	}
	const React = await import("react");
	return {
		ExpensesByCategoryChart: () =>
			React.createElement("div", { "data-testid": "mock-category-chart" }),
	};
});
vi.mock("@/components/charts/income-expense-split-chart", async () => {
	if (chartState.delayMs > 0) {
		await new Promise((resolve) => setTimeout(resolve, chartState.delayMs));
	}
	const React = await import("react");
	return {
		IncomeExpenseSplitChart: () =>
			React.createElement("div", { "data-testid": "mock-split-chart" }),
	};
});
vi.mock("@/components/charts/income-expense-comparison-chart", async () => {
	if (chartState.delayMs > 0) {
		await new Promise((resolve) => setTimeout(resolve, chartState.delayMs));
	}
	const React = await import("react");
	return {
		IncomeExpenseComparisonChart: () =>
			React.createElement("div", { "data-testid": "mock-comparison-chart" }),
	};
});

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

const SUMMARY = {
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
	],
	comparison: [
		{ label: "2026-01-02", incomeMinor: 100_000, expenseMinor: 30_000 },
	],
	accounts: [],
	combinedBalanceMinor: 0,
};

function stubDashboardEndpoints(): void {
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | string) => {
			const url = typeof input === "string" ? input : input.url;
			if (url.startsWith("/api/auth/me")) {
				return jsonResponse(200, { id: "u1", email: "me@example.com" });
			}
			if (url.startsWith("/api/reports/summary")) {
				return jsonResponse(200, SUMMARY);
			}
			if (url.startsWith("/api/recurring-expenses/due")) {
				return jsonResponse(200, { recurringExpenses: [] });
			}
			if (url.startsWith("/api/activity")) {
				return jsonResponse(200, {
					activity: [],
					page: 1,
					pageSize: 20,
					total: 0,
				});
			}
			return jsonResponse(200, {});
		}),
	);
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("/dashboard lazy chart slots", () => {
	it("renders the dashboard shell and skeletons before the chart bundle resolves", async () => {
		chartState.delayMs = 250;
		stubDashboardEndpoints();
		await renderRoute(<DashboardPage />, "/dashboard");
		// The shell is interactive first: summary cards render while the
		// chart import is still pending.
		expect(screen.getByText("Net cash flow")).toBeTruthy();
		expect(screen.getByText("Expenses by category")).toBeTruthy();
		expect(document.querySelector('[data-slot="skeleton"]')).toBeTruthy();
		expect(screen.queryByTestId("mock-category-chart")).toBeNull();

		await waitFor(() =>
			expect(screen.getByTestId("mock-category-chart")).toBeTruthy(),
		);
		expect(screen.getByTestId("mock-split-chart")).toBeTruthy();
		expect(screen.getByTestId("mock-comparison-chart")).toBeTruthy();
		// Once loaded, the skeleton placeholder is gone.
		expect(document.querySelector('[data-slot="skeleton"]')).toBeNull();
	});
});
