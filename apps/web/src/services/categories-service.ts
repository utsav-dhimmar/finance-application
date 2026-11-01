import {
	ApiError,
	archiveCategory,
	createCategory,
	deleteCategory,
	listCategories,
	restoreCategory,
	updateCategory,
} from "@finance-application/api-client";
import type {
	CategoryListResponse,
	CategoryResponse,
	CategoryStatus,
	CreateCategoryBody,
	RestoreCategoryBody,
	UpdateCategoryBody,
} from "@finance-application/schemas";

// All category slices share the ["categories"] prefix so mutations can
// invalidate every tab's cache at once.
export const CATEGORIES_QUERY_KEY = ["categories"] as const;

export function categoriesQueryKey(status: CategoryStatus) {
	return [...CATEGORIES_QUERY_KEY, status] as const;
}

export function categoriesQueryOptions(status: CategoryStatus) {
	return {
		queryKey: categoriesQueryKey(status),
		queryFn: () => listCategories(status),
		staleTime: 30_000,
	};
}

export function createNewCategory(
	body: CreateCategoryBody,
): Promise<CategoryResponse> {
	return createCategory(body);
}

export function editCategory(
	id: string,
	body: UpdateCategoryBody,
): Promise<CategoryResponse> {
	return updateCategory(id, body);
}

export function archiveExistingCategory(id: string): Promise<CategoryResponse> {
	return archiveCategory(id);
}

export function deleteExistingCategory(id: string): Promise<CategoryResponse> {
	return deleteCategory(id);
}

export function restoreTrashedCategory(
	id: string,
	body: RestoreCategoryBody = {},
): Promise<CategoryResponse> {
	return restoreCategory(id, body);
}

export type { CategoryListResponse, CategoryResponse, CategoryStatus };

// Maps known category error codes to user-facing copy. `fallback` names the
// action that failed when the API is unreachable.
export function getCategoriesErrorMessage(
	error: unknown,
	fallback: string,
): string {
	if (error instanceof ApiError) {
		if (error.code === "CATEGORY_NAME_TAKEN") {
			return "A category with this name already exists. Try a different name.";
		}
		if (error.code === "CATEGORY_TYPE_LOCKED") {
			return "This category has transactions, so its type can no longer be changed.";
		}
		return error.message;
	}
	return fallback;
}
