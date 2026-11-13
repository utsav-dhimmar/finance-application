import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { useReportSummary } from "@/hooks/use-report-summary";
import { jsonResponse } from "@/session/fetch-mock";
import { createTestQueryClient, HookWrapper } from "../helpers";
import { makeRegisteredMachine } from "../services/helpers";

const summary = {
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

describe("useReportSummary", () => {
	it("loads the report summary for the selected period", async () => {
		makeRegisteredMachine({
			"GET /api/reports/summary": () => jsonResponse(200, summary),
		});
		const { result } = await renderHook(
			() => useReportSummary({ month: "2026-01" }),
			{
				wrapper: ({ children }: { children?: ReactNode }) => (
					<HookWrapper queryClient={createTestQueryClient()}>
						{children}
					</HookWrapper>
				),
			},
		);
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data?.netCashFlowMinor).toBe(4874950);
	});
});
