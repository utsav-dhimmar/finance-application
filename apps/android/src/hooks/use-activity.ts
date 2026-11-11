import type { ListActivityQuery } from "@finance-application/schemas";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import {
	activityInfiniteQueryOptions,
	activityQueryOptions,
} from "@/services/transfers-service";

// The unified account-history feed. Read-only: mutations arrive through the
// transaction and transfer hooks, which invalidate this family through
// ACTIVITY_QUERY_KEY.
export function useActivity(filters: Partial<ListActivityQuery>) {
	return useQuery(activityQueryOptions(filters));
}

/**
 * The mobile activity feed: infinite "Load more" pagination over the same
 * paginated endpoint, keyed by the filters only, so every filter or tab
 * change starts a fresh list at page 1 and loading more appends beneath the
 * loaded rows with the filters preserved.
 */
export function useActivityFeed(filters: Partial<ListActivityQuery>) {
	return useInfiniteQuery(activityInfiniteQueryOptions(filters));
}
