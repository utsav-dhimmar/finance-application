import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { toast } from "sonner-native";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCategories, useUpdateCategory } from "@/hooks/use-categories";
import { CATEGORIES_QUERY_KEY } from "@/services/categories-service";
import { jsonResponse } from "@/session/fetch-mock";
import { createTestQueryClient, HookWrapper } from "../helpers";
import { makeRegisteredMachine } from "../services/helpers";

vi.mock("sonner-native", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

const category = {
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

describe("useCategories", () => {
	beforeEach(() => {
		vi.mocked(toast.success).mockClear();
		vi.mocked(toast.error).mockClear();
	});

	it("loads categories for the requested status", async () => {
		makeRegisteredMachine({
			"GET /api/categories": () =>
				jsonResponse(200, { categories: [category] }),
		});
		const { result } = await renderHook(() => useCategories("active"), {
			wrapper: ({ children }: { children?: ReactNode }) => (
				<HookWrapper queryClient={createTestQueryClient()}>
					{children}
				</HookWrapper>
			),
		});
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data?.categories).toHaveLength(1);
	});

	it("updating a category invalidates the categories family and toasts", async () => {
		makeRegisteredMachine({
			"PATCH /api/categories/cat-1": () => jsonResponse(200, category),
		});
		const queryClient = createTestQueryClient();
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
		const { result } = await renderHook(() => useUpdateCategory(), {
			wrapper: ({ children }: { children?: ReactNode }) => (
				<HookWrapper queryClient={queryClient}>{children}</HookWrapper>
			),
		});
		result.current.mutate({ id: "cat-1", body: { name: "Groceries" } });
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: CATEGORIES_QUERY_KEY,
		});
		expect(toast.success).toHaveBeenCalledWith("Category updated.");
	});

	it("maps a type-locked rejection to the service copy on the error toast", async () => {
		makeRegisteredMachine({
			"PATCH /api/categories/cat-1": () =>
				jsonResponse(409, {
					error: {
						code: "CATEGORY_TYPE_LOCKED",
						message: "type locked",
						details: [],
					},
				}),
		});
		const { result } = await renderHook(() => useUpdateCategory(), {
			wrapper: ({ children }: { children?: ReactNode }) => (
				<HookWrapper queryClient={createTestQueryClient()}>
					{children}
				</HookWrapper>
			),
		});
		result.current.mutate({ id: "cat-1", body: { type: "income" } });
		await waitFor(() => expect(result.current.isError).toBe(true));
		expect(toast.error).toHaveBeenCalledWith(
			"This category has transactions, so its type can no longer be changed.",
		);
	});
});
