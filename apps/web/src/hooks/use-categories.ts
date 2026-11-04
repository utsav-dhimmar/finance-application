import type {
	CategoryStatus,
	CreateCategoryBody,
	UpdateCategoryBody,
} from "@finance-application/schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ACTIVITY_QUERY_KEY } from "@/services/transfers-service";
import { REPORTS_QUERY_KEY } from "@/services/reports-service";
import { TRANSACTIONS_QUERY_KEY } from "@/services/transactions-service";
import {
	archiveExistingCategory,
	CATEGORIES_QUERY_KEY,
	categoriesQueryOptions,
	createNewCategory,
	deleteExistingCategory,
	destroyCategory,
	editCategory,
	restoreTrashedCategory,
} from "@/services/categories-service";

export function useCategories(status: CategoryStatus) {
	return useQuery(categoriesQueryOptions(status));
}

// Every mutation invalidates the whole ["categories"] prefix so every tab's
// cache refreshes together. Category names appear inside transaction rows and
// the unified activity feed (resolved at read time), and the report
// breakdown groups by category, so those families refresh too.
function useInvalidateCategoryRelated() {
	const queryClient = useQueryClient();
	return () => {
		queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
		queryClient.invalidateQueries({ queryKey: TRANSACTIONS_QUERY_KEY });
		queryClient.invalidateQueries({ queryKey: ACTIVITY_QUERY_KEY });
		queryClient.invalidateQueries({ queryKey: REPORTS_QUERY_KEY });
	};
}

export function useCreateCategory() {
	const invalidate = useInvalidateCategoryRelated();
	return useMutation({
		mutationFn: (body: CreateCategoryBody) => createNewCategory(body),
		onSuccess: invalidate,
	});
}

export function useUpdateCategory() {
	const invalidate = useInvalidateCategoryRelated();
	return useMutation({
		mutationFn: ({ id, body }: { id: string; body: UpdateCategoryBody }) =>
			editCategory(id, body),
		onSuccess: invalidate,
	});
}

export function useArchiveCategory() {
	const invalidate = useInvalidateCategoryRelated();
	return useMutation({
		mutationFn: (id: string) => archiveExistingCategory(id),
		onSuccess: invalidate,
	});
}

export function useDeleteCategory() {
	const invalidate = useInvalidateCategoryRelated();
	return useMutation({
		mutationFn: (id: string) => deleteExistingCategory(id),
		onSuccess: invalidate,
	});
}

export function useRestoreCategory() {
	const invalidate = useInvalidateCategoryRelated();
	return useMutation({
		mutationFn: ({ id, newName }: { id: string; newName?: string }) =>
			restoreTrashedCategory(id, newName ? { newName } : {}),
		onSuccess: invalidate,
	});
}

// Permanent deletion from trash: irreversible, gate-checked server-side on
// zero referencing transactions in any status.
export function usePermanentlyDeleteCategory() {
	const invalidate = useInvalidateCategoryRelated();
	return useMutation({
		mutationFn: (id: string) => destroyCategory(id),
		onSuccess: invalidate,
	});
}
