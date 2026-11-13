import { ApiError } from "@finance-application/api-client";
import type { ReportSummaryResponse } from "@finance-application/schemas";
import { describe, expect, it } from "vitest";

import {
	getReportsErrorMessage,
	REPORTS_QUERY_KEY,
	reportsQueryKey,
	reportsQueryOptions,
} from "@/services/reports-service";
import { jsonResponse } from "@/session/fetch-mock";
import { makeRegisteredMachine } from "./helpers";

const summary: ReportSummaryResponse = {
	periodFrom: "2026-01-01",
	periodTo: "2026-01-31",
	incomeMinor: 5000000,
	expenseMinor: 125050,
	netCashFlowMinor: 4874950,
	categoryBreakdown: [],
	comparison: [],
	accounts: [],
	combinedBalanceMinor: 4874950,
};

describe("reports service", () => {
	it("exposes the shared reports key and canonical period keys", () => {
		expect(REPORTS_QUERY_KEY).toEqual(["reports"]);
		expect(reportsQueryKey({ month: "2026-01" })).toEqual([
			"reports",
			"month=2026-01",
		]);
		expect(reportsQueryKey({ year: "2026" })).toEqual(["reports", "year=2026"]);
		// Different period objects that serialize identically share one key.
		expect(reportsQueryKey({ month: "2026-01" })).toEqual(
			reportsQueryKey({ month: "2026-01" }),
		);
	});

	it("fetches the report summary through the session for the period", async () => {
		const { fetchMock } = makeRegisteredMachine({
			"GET /api/reports/summary": (init?: RequestInit) => {
				const headers = init?.headers as Record<string, string> | undefined;
				expect(headers?.cookie).toContain("access-value-123");
				return jsonResponse(200, summary);
			},
		});
		const options = reportsQueryOptions({ month: "2026-01" });
		expect(options.staleTime).toBe(30_000);
		const result = await options.queryFn();
		expect(result.incomeMinor).toBe(5000000);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("maps reporting error codes to the web's user copy", () => {
		const fallback = "Could not load the dashboard. Is the API running?";
		expect(
			getReportsErrorMessage(
				new ApiError(422, "INVALID_PERIOD", "bad period", []),
				fallback,
			),
		).toBe("That period is not valid. Pick a month or a year and try again.");
		expect(
			getReportsErrorMessage(
				new ApiError(401, "UNAUTHENTICATED", "no session", []),
				fallback,
			),
		).toBe("Your session expired. Sign in again to see your reports.");
		expect(getReportsErrorMessage(new Error("nope"), fallback)).toBe(fallback);
	});
});
