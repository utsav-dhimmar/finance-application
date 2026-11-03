import { ApiError } from "@finance-application/api-client";
import type { ReportSummaryResponse } from "@finance-application/schemas";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useReportSummary } from "@/hooks/use-reports";
import {
	getReportsErrorMessage,
	reportsQueryKey,
	reportsQueryOptions,
} from "@/services/reports-service";

const summary: ReportSummaryResponse = {
	periodFrom: "2026-01-01",
	periodTo: "2026-01-31",
	incomeMinor: 100_000,
	expenseMinor: 80_000,
	netCashFlowMinor: 20_000,
	categoryBreakdown: [
		{
			categoryId: "cat-1",
			categoryName: "Groceries",
			amountMinor: 80_000,
			sharePercent: 100,
		},
	],
	comparison: [{ label: "2026-01-01", incomeMinor: 0, expenseMinor: 0 }],
	accounts: [],
	combinedBalanceMinor: 20_000,
};

function renderWithProvider<TResult>(hook: () => TResult) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	const view = renderHook(hook, {
		wrapper: ({ children }: { children: React.ReactNode }) => (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		),
	});
	return { view, queryClient };
}

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("reports service", () => {
	it("keys each period form canonically", () => {
		expect(reportsQueryKey({ month: "2026-01" })).toEqual([
			"reports",
			"month=2026-01",
		]);
		expect(reportsQueryKey({ year: "2026" })).toEqual(["reports", "year=2026"]);
		expect(reportsQueryKey({ from: "2026-01-01", to: "2026-01-31" })).toEqual([
			"reports",
			"from=2026-01-01&to=2026-01-31",
		]);
	});

	it("builds query options that fetch the summary", async () => {
		const fetchMock = vi.fn(async () => {
			return new Response(JSON.stringify(summary), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		});
		vi.stubGlobal("fetch", fetchMock);

		const options = reportsQueryOptions({ month: "2026-01" });
		expect(options.queryKey).toEqual(["reports", "month=2026-01"]);
		await expect(options.queryFn()).resolves.toEqual(summary);
		const [url] = fetchMock.mock.calls[0] as unknown as [string];
		expect(url).toBe("/api/reports/summary?month=2026-01");
	});
});

describe("useReportSummary", () => {
	it("fetches the period summary", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | string) => {
			const url = typeof input === "string" ? input : input.url;
			expect(url).toBe("/api/reports/summary?month=2026-01");
			return new Response(JSON.stringify(summary), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		});
		vi.stubGlobal("fetch", fetchMock);

		const { view } = renderWithProvider(() =>
			useReportSummary({ month: "2026-01" }),
		);
		await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
		expect(view.result.current.data?.incomeMinor).toBe(100_000);
		expect(view.result.current.data?.netCashFlowMinor).toBe(20_000);
	});
});

describe("getReportsErrorMessage", () => {
	it("explains invalid periods and expired sessions", () => {
		const invalid = new ApiError(400, "INVALID_PERIOD", "x", []);
		expect(getReportsErrorMessage(invalid, "fallback")).toMatch(/not valid/i);
		const unauthenticated = new ApiError(401, "UNAUTHENTICATED", "x", []);
		expect(getReportsErrorMessage(unauthenticated, "fallback")).toMatch(
			/session expired/i,
		);
	});

	it("falls back for unknown errors", () => {
		expect(getReportsErrorMessage(new Error("boom"), "Could not load")).toBe(
			"Could not load",
		);
	});
});
