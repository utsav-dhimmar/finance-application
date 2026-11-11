import { describe, expect, it } from "vitest";

import {
	activityFeedFilters,
	initialFilterState,
	transactionsFilterReducer,
} from "@/components/transactions/filter-state";
import { serializeFilters } from "@/services/transfers-service";

describe("transactionsFilterReducer", () => {
	it("starts on the active tab, unfiltered, page 1", () => {
		expect(initialFilterState).toEqual({
			tab: "active",
			type: "",
			accountId: "",
			categoryId: "",
			from: "",
			to: "",
			searchInput: "",
			q: "",
			page: 1,
		});
	});

	it("resets the page when the tab changes but not on a same-tab set", () => {
		const paged = transactionsFilterReducer(initialFilterState, {
			type: "setPage",
			value: 3,
		});
		expect(
			transactionsFilterReducer(paged, { type: "setTab", value: "deleted" }),
		).toEqual({ ...paged, tab: "deleted", page: 1 });
		expect(
			transactionsFilterReducer(paged, { type: "setTab", value: "active" }),
		).toBe(paged);
	});

	it("clears the category and resets the page on a type change", () => {
		const filtered = transactionsFilterReducer(initialFilterState, {
			type: "setCategory",
			value: "cat-1",
		});
		const next = transactionsFilterReducer(filtered, {
			type: "setType",
			value: "transfer",
		});
		expect(next.type).toBe("transfer");
		expect(next.categoryId).toBe("");
		expect(next.page).toBe(1);
	});

	it("resets the page on account, category, and date-range changes", () => {
		const paged = transactionsFilterReducer(initialFilterState, {
			type: "setPage",
			value: 4,
		});
		expect(
			transactionsFilterReducer(paged, { type: "setAccount", value: "acc-1" })
				.page,
		).toBe(1);
		expect(
			transactionsFilterReducer(paged, { type: "setCategory", value: "cat-1" })
				.page,
		).toBe(1);
		expect(
			transactionsFilterReducer(paged, { type: "setFrom", value: "2026-01-01" })
				.page,
		).toBe(1);
		expect(
			transactionsFilterReducer(paged, { type: "setTo", value: "2026-01-31" })
				.page,
		).toBe(1);
	});

	it("keeps the raw search input off the page until the debounce lands it", () => {
		const typing = transactionsFilterReducer(initialFilterState, {
			type: "setSearchInput",
			value: "groceries",
		});
		expect(typing.searchInput).toBe("groceries");
		expect(typing.q).toBe("");
		expect(typing.page).toBe(1);

		const landed = transactionsFilterReducer(typing, {
			type: "applyDebouncedQuery",
			value: "  groceries ",
		});
		// The landed query is trimmed and the page restarts.
		expect(landed.q).toBe("groceries");
		expect(landed.page).toBe(1);

		// Landing the same query again is a no-op.
		expect(
			transactionsFilterReducer(landed, {
				type: "applyDebouncedQuery",
				value: "groceries",
			}),
		).toBe(landed);
	});

	it("clamps the page to at least 1", () => {
		expect(
			transactionsFilterReducer(initialFilterState, {
				type: "setPage",
				value: 0,
			}).page,
		).toBe(1);
		expect(
			transactionsFilterReducer(initialFilterState, {
				type: "setPage",
				value: 7,
			}).page,
		).toBe(7);
	});
});

// The filters → query-params mapping must match the web's for the same
// selections: unset filters are omitted (never empty strings), so the
// serialized request is identical.
describe("activityFeedFilters", () => {
	it("serializes the same selections the web sends", () => {
		expect(activityFeedFilters(initialFilterState)).toEqual({
			status: "active",
		});
		expect(
			activityFeedFilters({
				tab: "deleted",
				type: "transfer",
				accountId: "acc-1",
				categoryId: "", // cleared by the type change
				from: "2026-01-01",
				to: "2026-01-31",
				q: "groceries",
			}),
		).toEqual({
			status: "deleted",
			type: "transfer",
			accountId: "acc-1",
			from: "2026-01-01",
			to: "2026-01-31",
			q: "groceries",
		});
		// Page and page size stay out: the infinite-feed hook owns pagination.
		expect(activityFeedFilters(initialFilterState)).not.toHaveProperty("page");
		expect(activityFeedFilters(initialFilterState)).not.toHaveProperty(
			"pageSize",
		);
	});

	it("serializes identically to the web's request params", () => {
		// The service's serializer turns the mapped filters into exactly the
		// query string the web's client builds for the same selections.
		const filters = activityFeedFilters({
			tab: "active",
			type: "income",
			accountId: "acc-1",
			categoryId: "cat-1",
			from: "2026-01-01",
			to: "2026-01-31",
			q: "salary",
		});
		expect(serializeFilters(filters)).toBe(
			"status=active&type=income&accountId=acc-1&categoryId=cat-1&from=2026-01-01&to=2026-01-31&q=salary",
		);
	});
});
