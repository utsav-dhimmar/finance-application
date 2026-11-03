import type {
	ReportPeriodQuery,
	ReportSummaryResponse,
} from "@finance-application/schemas";
import type { ApiClientOptions } from "./auth";
import { apiFetch } from "./client";

// The period overview: exactly one of month, year, or from/to; the server
// resolves the inclusive bounds and applies every reporting inclusion rule.
export function getReportSummary(
	query: ReportPeriodQuery,
	options?: ApiClientOptions,
): Promise<ReportSummaryResponse> {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value !== undefined && value !== "") {
			params.set(key, String(value));
		}
	}
	const suffix = params.size > 0 ? `?${params}` : "";
	return apiFetch<ReportSummaryResponse>(
		`/api/reports/summary${suffix}`,
		{},
		options,
	);
}
