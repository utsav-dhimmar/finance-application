import { ApiError } from "@finance-application/api-client";
import type { CategoryResponse } from "@finance-application/schemas";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	useArchiveCategory,
	useCategories,
	useCreateCategory,
	useDeleteCategory,
	usePermanentlyDeleteCategory,
	useRestoreCategory,
	useUpdateCategory,
} from "@/hooks/use-categories";
import {
	categoriesQueryKey,
	getCategoriesErrorMessage,
} from "@/services/categories-service";

const category: CategoryResponse = {
	id: "cat-1",
	name: "Groceries",
	type: "expense",
	color: "#22C55E",
	icon: "shopping-cart",
	status: "active",
	archivedAt: null,
	deletedAt: null,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function listResponse(categories: CategoryResponse[]): Response {
	return jsonResponse(200, { categories });
}

function renderWithProvider<TResult>(hook: () => TResult) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	const view = renderHook(hook, {
		wrapper: ({ children }: { children: React.ReactNode }) => (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		),
	});
	return { view, queryClient };
}

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("useCategories", () => {
	it("fetches the requested status slice", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | string) => {
			const url = typeof input === "string" ? input : input.url;
			expect(url).toBe("/api/categories?status=archived");
			return listResponse([{ ...category, status: "archived" }]);
		});
		vi.stubGlobal("fetch", fetchMock);

		const { view } = renderWithProvider(() => useCategories("archived"));
		await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
		expect(view.result.current.data?.categories).toHaveLength(1);
	});

	it("exposes the query key per status", () => {
		expect(categoriesQueryKey("active")).toEqual(["categories", "active"]);
		expect(categoriesQueryKey("deleted")).toEqual(["categories", "deleted"]);
	});
});

describe("category mutations", () => {
	it("createCategory posts and invalidates all category slices", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | string) => {
			const url = typeof input === "string" ? input : input.url;
			if (url === "/api/categories") {
				return jsonResponse(201, category);
			}
			return listResponse([category]);
		});
		vi.stubGlobal("fetch", fetchMock);

		const { view, queryClient } = renderWithProvider(useCreateCategory);
		queryClient.setQueryData(["categories", "active"], { categories: [] });
		act(() => {
			view.result.current.mutate({
				name: "Groceries",
				type: "expense",
			});
		});
		await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
		// The stale active slice is refetched after invalidation.
		await waitFor(() =>
			expect(
				queryClient.getQueryState(["categories", "active"])?.isInvalidated,
			).toBe(true),
		);
	});

	it("updateCategory patches and invalidates category caches", async () => {
		const fetchMock = stubCategoryApi("/api/categories/cat-1");
		const { view } = renderWithProvider(useUpdateCategory);
		act(() => {
			view.result.current.mutate({ id: "cat-1", body: { name: "Renamed" } });
		});
		await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
		expect(callsUrl(fetchMock, "/api/categories/cat-1")).toBeDefined();
	});

	it("archiveCategory posts to the archive endpoint", async () => {
		const fetchMock = stubCategoryApi("/api/categories/cat-1/archive");
		const { view } = renderWithProvider(useArchiveCategory);
		act(() => {
			view.result.current.mutate("cat-1");
		});
		await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
		expect(callsUrl(fetchMock, "/api/categories/cat-1/archive")).toBeDefined();
	});

	it("deleteCategory posts to the delete endpoint", async () => {
		const fetchMock = stubCategoryApi("/api/categories/cat-1/delete");
		const { view } = renderWithProvider(useDeleteCategory);
		act(() => {
			view.result.current.mutate("cat-1");
		});
		await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
		expect(callsUrl(fetchMock, "/api/categories/cat-1/delete")).toBeDefined();
	});

	it("restoreCategory posts with the optional new name", async () => {
		const fetchMock = stubCategoryApi("/api/categories/cat-1/restore");
		const { view } = renderWithProvider(useRestoreCategory);
		act(() => {
			view.result.current.mutate({ id: "cat-1", newName: "Back again" });
		});
		await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
		const call = callsUrl(fetchMock, "/api/categories/cat-1/restore");
		expect(call).toBeDefined();
		const [, init] = call as [string, RequestInit];
		expect(init.body).toBe(JSON.stringify({ newName: "Back again" }));
	});

	it("category mutations invalidate every affected query family", async () => {
		stubCategoryApi("/api/categories/cat-1/archive");
		const { view, queryClient } = renderWithProvider(useArchiveCategory);
		// Transaction rows and the unified activity feed resolve category names
		// at read time, and the report breakdown groups by category, so all of
		// them refresh on a category change.
		queryClient.setQueryData(["categories", "active"], {
			categories: [category],
		});
		queryClient.setQueryData(["transactions", ""], { transactions: [], total: 0 });
		queryClient.setQueryData(["activity", ""], { activity: [], total: 0 });
		queryClient.setQueryData(["reports", "month=2026-01"], {
			incomeMinor: 0,
			expenseMinor: 0,
		});
		act(() => {
			view.result.current.mutate("cat-1");
		});
		await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
		const invalidatedKeys: Array<string[]> = [
			["categories", "active"],
			["transactions", ""],
			["activity", ""],
			["reports", "month=2026-01"],
		];
		for (const key of invalidatedKeys) {
			await waitFor(() =>
				expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true),
			);
		}
	});

	it("permanent delete sends DELETE and invalidates every affected query family", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | string) => {
			const url = typeof input === "string" ? input : input.url;
			if (url === "/api/categories/cat-1") {
				return new Response(null, { status: 204 });
			}
			return listResponse([category]);
		});
		vi.stubGlobal("fetch", fetchMock);
		const { view, queryClient } = renderWithProvider(
			usePermanentlyDeleteCategory,
		);
		queryClient.setQueryData(["categories", "deleted"], {
			categories: [category],
		});
		queryClient.setQueryData(["transactions", ""], { transactions: [], total: 0 });
		queryClient.setQueryData(["activity", ""], { activity: [], total: 0 });
		queryClient.setQueryData(["reports", "month=2026-01"], {
			incomeMinor: 0,
			expenseMinor: 0,
		});
		act(() => {
			view.result.current.mutate("cat-1");
		});
		await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
		const call = callsUrl(fetchMock, "/api/categories/cat-1");
		expect(call).toBeDefined();
		const [, init] = call as [string, RequestInit];
		expect(init.method).toBe("DELETE");
		const invalidatedKeys: Array<string[]> = [
			["categories", "deleted"],
			["transactions", ""],
			["activity", ""],
			["reports", "month=2026-01"],
		];
		for (const key of invalidatedKeys) {
			await waitFor(() =>
				expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true),
			);
		}
	});
});

function stubCategoryApi(endpoint: string) {
	const fetchMock = vi.fn(async (input: RequestInfo | string) => {
		const url = typeof input === "string" ? input : input.url;
		if (url === endpoint) {
			return jsonResponse(200, category);
		}
		return listResponse([category]);
	});
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

function callsUrl(
	fetchMock: ReturnType<typeof vi.fn>,
	endpoint: string,
): unknown[] | undefined {
	return vi
		.mocked(fetchMock)
		.mock.calls.find(
			([input]) => (typeof input === "string" ? input : input.url) === endpoint,
		);
}

describe("getCategoriesErrorMessage", () => {
	it("maps the name-taken code to friendly copy", () => {
		const error = new ApiError(
			409,
			"CATEGORY_NAME_TAKEN",
			"A category with this name already exists",
			[],
		);
		expect(getCategoriesErrorMessage(error, "fallback")).toMatch(
			/already exists/i,
		);
	});

	it("explains the locked type", () => {
		const error = new ApiError(409, "CATEGORY_TYPE_LOCKED", "locked", []);
		expect(getCategoriesErrorMessage(error, "fallback")).toMatch(
			/no longer be changed/i,
		);
	});

	it("falls back for unknown errors", () => {
		expect(getCategoriesErrorMessage(new Error("boom"), "Save failed")).toBe(
			"Save failed",
		);
	});
});
