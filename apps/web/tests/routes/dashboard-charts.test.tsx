import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "@/routes/dashboard";
import { renderRoute } from "./helpers";

// Chart-bundle failure containment: the chart modules fail at import time
// (the mocked factory rejects), so the slot-local boundary must catch the
// rejected lazy payloads without unmounting the route, and the retry
// affordance must recover by re-importing. This file's module cache is
// fresh, so the very first import fails; a separate file covers the
// pending-skeleton path with a delayed factory.
const chartState = vi.hoisted(() => ({
	fail: true,
}));

vi.mock("@/components/charts/expenses-by-category-chart", async () => {
	if (chartState.fail) {
		throw new Error("chunk load failed");
	}
	const React = await import("react");
	return {
		ExpensesByCategoryChart: () =>
			React.createElement("div", { "data-testid": "mock-category-chart" }),
	};
});
vi.mock("@/components/charts/income-expense-split-chart", async () => {
	if (chartState.fail) {
		throw new Error("chunk load failed");
	}
	const React = await import("react");
	return {
		IncomeExpenseSplitChart: () =>
			React.createElement("div", { "data-testid": "mock-split-chart" }),
	};
});
vi.mock("@/components/charts/income-expense-comparison-chart", async () => {
	if (chartState.fail) {
		throw new Error("chunk load failed");
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

describe("/dashboard chart bundle failure", () => {
	it("contains the failure to the chart slots and recovers via retry", async () => {
		stubDashboardEndpoints();
		await renderRoute(<DashboardPage />, "/dashboard");
		await waitFor(() =>
			expect(screen.getAllByText("Could not load the chart.").length).toBe(3),
		);
		// The rest of the dashboard keeps working.
		expect(screen.getByText("Net cash flow")).toBeTruthy();
		expect(screen.getByText("₹1,000.00")).toBeTruthy();
		const retryButtons = screen.getAllByRole("button", { name: /retry/i });
		expect(retryButtons.length).toBe(3);

		// Fix the chunk and retry: the parent recreates the lazy set, the
		// boundaries remount, and the re-imports succeed. Every failed slot
		// carries the same affordance; one click retries all of them.
		chartState.fail = false;
		const [firstRetryButton] = retryButtons;
		if (!firstRetryButton) {
			throw new Error("expected a retry button in the first chart slot");
		}
		fireEvent.click(firstRetryButton);
		await waitFor(() =>
			expect(screen.getByTestId("mock-category-chart")).toBeTruthy(),
		);
		expect(screen.getByTestId("mock-split-chart")).toBeTruthy();
		expect(screen.getByTestId("mock-comparison-chart")).toBeTruthy();
		expect(screen.queryByText("Could not load the chart.")).toBeNull();
	});
});
