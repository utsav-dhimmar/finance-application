import type {
	CategoryListResponse,
	CategoryResponse,
	CategoryStatus,
	CreateCategoryBody,
	RestoreCategoryBody,
	UpdateCategoryBody,
} from "@finance-application/schemas";
import type { ApiClientOptions } from "./auth";
import { apiFetch } from "./client";

export function createCategory(
	body: CreateCategoryBody,
	options?: ApiClientOptions,
): Promise<CategoryResponse> {
	return apiFetch<CategoryResponse>(
		"/api/categories",
		{
			method: "POST",
			body: JSON.stringify(body),
		},
		options,
	);
}

export function listCategories(
	status: CategoryStatus = "active",
	options?: ApiClientOptions,
): Promise<CategoryListResponse> {
	const query = new URLSearchParams({ status });
	return apiFetch<CategoryListResponse>(
		`/api/categories?${query}`,
		{},
		options,
	);
}

export function getCategory(
	id: string,
	options?: ApiClientOptions,
): Promise<CategoryResponse> {
	return apiFetch<CategoryResponse>(`/api/categories/${id}`, {}, options);
}

export function updateCategory(
	id: string,
	body: UpdateCategoryBody,
	options?: ApiClientOptions,
): Promise<CategoryResponse> {
	return apiFetch<CategoryResponse>(
		`/api/categories/${id}`,
		{
			method: "PATCH",
			body: JSON.stringify(body),
		},
		options,
	);
}

export function archiveCategory(
	id: string,
	options?: ApiClientOptions,
): Promise<CategoryResponse> {
	return apiFetch<CategoryResponse>(
		`/api/categories/${id}/archive`,
		{
			method: "POST",
		},
		options,
	);
}

// Soft-delete: the category moves to trash and stays restorable; permanent
// deletion arrives with the archive/trash epic.
export function deleteCategory(
	id: string,
	options?: ApiClientOptions,
): Promise<CategoryResponse> {
	return apiFetch<CategoryResponse>(
		`/api/categories/${id}/delete`,
		{
			method: "POST",
		},
		options,
	);
}

export function restoreCategory(
	id: string,
	body: RestoreCategoryBody = {},
	options?: ApiClientOptions,
): Promise<CategoryResponse> {
	return apiFetch<CategoryResponse>(
		`/api/categories/${id}/restore`,
		{
			method: "POST",
			body: JSON.stringify(body),
		},
		options,
	);
}
