import { ApiError, getReportSummary } from "@finance-application/api-client";
import type {
	ReportPeriodQuery,
	ReportSummaryResponse,
} from "@finance-application/schemas";

// Every report slice shares the ["reports"] prefix so account, transaction,
// and transfer mutations can invalidate every period's cache at once.
export const REPORTS_QUERY_KEY = ["reports"] as const;

// The dashboard's period selection: a month (YYYY-MM), a year (YYYY), or an
// explicit range. The month/year forms are the primary navigation; the range
// form exists for deep links and future report views.
export type DashboardPeriod = { month: string } | { year: string };

export function reportsQueryKey(period: ReportPeriodQuery) {
	// Key by the canonical string form so different period objects that
	// serialize identically share one cache entry.
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(period)) {
		if (value !== undefined && value !== "") {
			params.set(key, String(value));
		}
	}
	return [...REPORTS_QUERY_KEY, params.toString()] as const;
}

export function reportsQueryOptions(period: ReportPeriodQuery) {
	return {
		queryKey: reportsQueryKey(period),
		queryFn: () => getReportSummary(period),
		staleTime: 30_000,
	};
}

export type { ReportPeriodQuery, ReportSummaryResponse };

// Maps known reporting error codes to user-facing copy. `fallback` names the
// context when the API is unreachable or the error is unknown.
export function getReportsErrorMessage(
	error: unknown,
	fallback: string,
): string {
	if (error instanceof ApiError) {
		if (error.code === "INVALID_PERIOD") {
			return "That period is not valid. Pick a month or a year and try again.";
		}
		if (error.code === "UNAUTHENTICATED") {
			return "Your session expired. Sign in again to see your reports.";
		}
		return error.message;
	}
	return fallback;
}
