// The transactions filter state machine, ported from the web's
// /transactions route reducer so reset behavior is reviewable side by side.
// All list-shaping state lives in one reducer: every filter change resets the
// page, the type change invalidates the chosen category, and the search input
// updates freely until the debounce lands it in `q`.

import type { ListActivityQuery } from "@finance-application/schemas";

export type TransactionsTab = "active" | "archived" | "deleted";

export interface TransactionsFilterState {
	tab: TransactionsTab;
	type: string;
	accountId: string;
	categoryId: string;
	from: string;
	to: string;
	searchInput: string;
	q: string;
	page: number;
}

export const initialFilterState: TransactionsFilterState = {
	tab: "active",
	type: "",
	accountId: "",
	categoryId: "",
	from: "",
	to: "",
	searchInput: "",
	q: "",
	page: 1,
};

export type TransactionsFilterAction =
	| { type: "setTab"; value: TransactionsTab }
	| { type: "setType"; value: string }
	| { type: "setAccount"; value: string }
	| { type: "setCategory"; value: string }
	| { type: "setFrom"; value: string }
	| { type: "setTo"; value: string }
	| { type: "setSearchInput"; value: string }
	| { type: "applyDebouncedQuery"; value: string }
	| { type: "setPage"; value: number };

export function transactionsFilterReducer(
	state: TransactionsFilterState,
	action: TransactionsFilterAction,
): TransactionsFilterState {
	switch (action.type) {
		case "setTab":
			if (action.value === state.tab) {
				return state;
			}
			return { ...state, tab: action.value, page: 1 };
		case "setType":
			return { ...state, type: action.value, categoryId: "", page: 1 };
		case "setAccount":
			return { ...state, accountId: action.value, page: 1 };
		case "setCategory":
			return { ...state, categoryId: action.value, page: 1 };
		case "setFrom":
			return { ...state, from: action.value, page: 1 };
		case "setTo":
			return { ...state, to: action.value, page: 1 };
		case "setSearchInput":
			return { ...state, searchInput: action.value };
		case "applyDebouncedQuery": {
			const q = action.value.trim();
			if (q === state.q) {
				return state;
			}
			return { ...state, q, page: 1 };
		}
		case "setPage":
			return { ...state, page: Math.max(1, action.value) };
	}
}

/**
 * Maps the filter state onto the activity query's partial filters — the same
 * selections the web serializes into its request params. Unset filters are
 * omitted (never empty strings), and the page/pageSize stay out: the
 * infinite-feed hook owns pagination under this key.
 */
export function activityFeedFilters(
	state: Pick<
		TransactionsFilterState,
		"tab" | "type" | "accountId" | "categoryId" | "from" | "to" | "q"
	>,
): Partial<ListActivityQuery> {
	return {
		status: state.tab,
		...(state.type ? { type: state.type as ListActivityQuery["type"] } : {}),
		...(state.accountId ? { accountId: state.accountId } : {}),
		...(state.categoryId ? { categoryId: state.categoryId } : {}),
		...(state.from ? { from: state.from } : {}),
		...(state.to ? { to: state.to } : {}),
		...(state.q ? { q: state.q } : {}),
	};
}
