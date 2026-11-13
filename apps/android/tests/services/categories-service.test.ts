import { ApiError } from "@finance-application/api-client";
import type { CategoryResponse } from "@finance-application/schemas";
import { describe, expect, it } from "vitest";

import {
	CATEGORIES_QUERY_KEY,
	categoriesQueryKey,
	categoriesQueryOptions,
	createNewCategory,
	getCategoriesErrorMessage,
} from "@/services/categories-service";
import { jsonResponse } from "@/session/fetch-mock";
import { makeRegisteredMachine } from "./helpers";

const category: CategoryResponse = {
	id: "cat-1",
	name: "Groceries",
	type: "expense",
	color: "#FF5500",
	icon: "cart",
	status: "active",
	archivedAt: null,
	deletedAt: null,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("categories service", () => {
	it("exposes the shared categories query key and per-status slices", () => {
		expect(CATEGORIES_QUERY_KEY).toEqual(["categories"]);
		expect(categoriesQueryKey("archived")).toEqual(["categories", "archived"]);
	});

	it("query options carry web-parity staleness and route through the session", async () => {
		const { fetchMock } = makeRegisteredMachine({
			"GET /api/categories": () =>
				jsonResponse(200, { categories: [category] }),
		});
		const options = categoriesQueryOptions("active");
		expect(options.staleTime).toBe(30_000);
		const result = await options.queryFn();
		expect(result.categories).toHaveLength(1);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("create posts the parsed body to the documented endpoint", async () => {
		const { fetchMock } = makeRegisteredMachine({
			"POST /api/categories": () => jsonResponse(201, category),
		});
		await createNewCategory({
			name: "Groceries",
			type: "expense",
			color: "#FF5500",
			icon: "cart",
		});
		const calls = fetchMock.mock.calls as unknown as Array<
			[string, RequestInit]
		>;
		expect(calls[0]?.[0]).toContain("/api/categories");
		expect(calls[0]?.[1]?.method).toBe("POST");
	});

	it("maps category error codes to the web's user copy", () => {
		const fallback = "Could not save the category. Is the API running?";
		expect(
			getCategoriesErrorMessage(
				new ApiError(409, "CATEGORY_NAME_TAKEN", "name taken", []),
				fallback,
			),
		).toBe("A category with this name already exists. Try a different name.");
		expect(
			getCategoriesErrorMessage(
				new ApiError(409, "CATEGORY_TYPE_LOCKED", "locked", []),
				fallback,
			),
		).toBe(
			"This category has transactions, so its type can no longer be changed.",
		);
		expect(getCategoriesErrorMessage(new Error("nope"), fallback)).toBe(
			fallback,
		);
	});
});
