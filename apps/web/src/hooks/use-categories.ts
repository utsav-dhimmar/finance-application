import type {
	CategoryStatus,
	CreateCategoryBody,
	UpdateCategoryBody,
} from "@finance-application/schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	archiveExistingCategory,
	CATEGORIES_QUERY_KEY,
	categoriesQueryOptions,
	createNewCategory,
	deleteExistingCategory,
	editCategory,
	restoreTrashedCategory,
} from "@/services/categories-service";

export function useCategories(status: CategoryStatus) {
	return useQuery(categoriesQueryOptions(status));
}

// Every mutation invalidates the whole ["categories"] prefix so every tab's
// cache refreshes together.
export function useCreateCategory() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: CreateCategoryBody) => createNewCategory(body),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
		},
	});
}

export function useUpdateCategory() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, body }: { id: string; body: UpdateCategoryBody }) =>
			editCategory(id, body),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
		},
	});
}

export function useArchiveCategory() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => archiveExistingCategory(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
		},
	});
}

export function useDeleteCategory() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => deleteExistingCategory(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
		},
	});
}

export function useRestoreCategory() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, newName }: { id: string; newName?: string }) =>
			restoreTrashedCategory(id, newName ? { newName } : {}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
		},
	});
}
