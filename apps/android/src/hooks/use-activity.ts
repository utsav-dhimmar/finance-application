import type { ListActivityQuery } from "@finance-application/schemas";
import { useQuery } from "@tanstack/react-query";

import { activityQueryOptions } from "@/services/transfers-service";

// The unified account-history feed. Read-only on the mobile client for now:
// transfer mutations arrive with the transactions screen change and their
// hooks invalidate this family through TRANSFERS_QUERY_KEY/ACTIVITY_QUERY_KEY.
export function useActivity(filters: Partial<ListActivityQuery>) {
	return useQuery(activityQueryOptions(filters));
}
