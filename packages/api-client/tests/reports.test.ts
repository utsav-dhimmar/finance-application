import type {
	ReportPeriodQuery,
	ReportSummaryResponse,
} from "@finance-application/schemas";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/client";
import { getReportSummary } from "../src/reports";

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
	comparison: [
		{ label: "2026-01-01", incomeMinor: 0, expenseMinor: 0 },
		{ label: "2026-01-02", incomeMinor: 100_000, expenseMinor: 80_000 },
	],
	accounts: [],
	combinedBalanceMinor: 20_000,
};

beforeEach(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn(
			async () =>
				new Response(JSON.stringify(summary), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
		),
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("getReportSummary", () => {
	it("requests the month form with its query string", async () => {
		await expect(getReportSummary({ month: "2026-01" })).resolves.toEqual(
			summary,
		);
		expect(vi.mocked(fetch)).toHaveBeenCalledWith(
			"/api/reports/summary?month=2026-01",
			expect.objectContaining({
				headers: { "content-type": "application/json" },
			}),
		);
	});

	it("serializes each period form and skips empty values", async () => {
		await getReportSummary({ year: "2026" });
		expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe(
			"/api/reports/summary?year=2026",
		);

		await getReportSummary({ from: "2026-01-01", to: "2026-01-31" });
		expect(vi.mocked(fetch).mock.calls[1]?.[0]).toBe(
			"/api/reports/summary?from=2026-01-01&to=2026-01-31",
		);

		// An unvalidated query can carry empty strings; they are dropped.
		await getReportSummary({
			month: "",
			from: "",
			to: "",
		} as ReportPeriodQuery);
		expect(vi.mocked(fetch).mock.calls[2]?.[0]).toBe("/api/reports/summary");
	});

	it("supports a baseUrl for non-browser clients", async () => {
		await getReportSummary(
			{ month: "2026-01" },
			{ baseUrl: "https://api.example.com" },
		);
		expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe(
			"https://api.example.com/api/reports/summary?month=2026-01",
		);
	});

	it("decodes the shared error envelope", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							error: {
								code: "INVALID_PERIOD",
								message:
									"Provide exactly one of a month, a year, or a from/to date range",
								details: [],
							},
						}),
						{ status: 400, headers: { "content-type": "application/json" } },
					),
			),
		);
		const error = await getReportSummary({ month: "2026-01" }).catch(
			(e: unknown) => e,
		);
		expect(error).toBeInstanceOf(ApiError);
		expect((error as ApiError).status).toBe(400);
		expect((error as ApiError).code).toBe("INVALID_PERIOD");
	});
});
