import type { ReportPeriodQuery } from "@finance-application/schemas";
import { useQuery } from "@tanstack/react-query";
import { reportsQueryOptions } from "@/services/reports-service";

// The dashboard's period overview. Reports are read-only — there are no
// report mutations; account, transaction, and transfer hooks invalidate the
// ["reports"] prefix so the dashboard refreshes after every recording.
export function useReportSummary(period: ReportPeriodQuery) {
	return useQuery(reportsQueryOptions(period));
}
