import { ApiError } from "@finance-application/api-client";
import type { CategoryResponse } from "@finance-application/schemas";
import { Button } from "@finance-application/ui/components/button";
import { Skeleton } from "@finance-application/ui/components/skeleton";
import { Tag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CategoryCard } from "@/components/categories/category-card";
import { RestoreCategoryNameDialog } from "@/components/categories/restore-category-name-dialog";
import { ConfirmTransactionLifecycleDialog } from "@/components/transactions/confirm-transaction-lifecycle-dialog";
import {
	useCategories,
	usePermanentlyDeleteCategory,
	useRestoreCategory,
} from "@/hooks/use-categories";
import { getCategoriesErrorMessage } from "@/services/categories-service";
import type { PanelMode } from "./accounts-panel";

interface CategoriesPanelProps {
	mode: PanelMode;
}

// The unified Archive/Trash slice for categories: the existing category cards
// in their archived or trashed state, with the established restore flow
// (rename-on-restore included) and, in trash mode, permanent deletion behind
// the typed confirmation.
export function CategoriesPanel({ mode }: CategoriesPanelProps) {
	const categories = useCategories(mode);
	const restore = useRestoreCategory();
	const destroy = usePermanentlyDeleteCategory();

	const [renaming, setRenaming] = useState<CategoryResponse | null>(null);
	const [confirming, setConfirming] = useState<CategoryResponse | null>(null);

	function handleRestore(category: CategoryResponse) {
		restore.mutate(
			{ id: category.id },
			{
				onSuccess: (restored) => {
					toast.success(`Category "${restored.name}" restored.`);
				},
				onError: (error) => {
					if (
						error instanceof ApiError &&
						error.code === "CATEGORY_NAME_TAKEN"
					) {
						setRenaming(category);
						return;
					}
					toast.error(
						getCategoriesErrorMessage(
							error,
							"Could not restore the category. Is the API running?",
						),
					);
				},
			},
		);
	}

	function handleRestoreWithName(newName: string) {
		if (!renaming) {
			return;
		}
		restore.mutate(
			{ id: renaming.id, newName },
			{
				onSuccess: (restored) => {
					setRenaming(null);
					toast.success(`Category "${restored.name}" restored.`);
				},
				onError: (error) => {
					toast.error(
						getCategoriesErrorMessage(
							error,
							"Could not restore the category. Is the API running?",
						),
					);
				},
			},
		);
	}

	function handleConfirmPermanentDelete() {
		if (!confirming) {
			return;
		}
		const label = confirming.name;
		destroy.mutate(confirming.id, {
			onSuccess: () => {
				setConfirming(null);
				toast.success(`Category "${label}" permanently deleted.`);
			},
			onError: (error) => {
				setConfirming(null);
				// A blocked deletion surfaces the history-preservation copy.
				toast.error(
					getCategoriesErrorMessage(
						error,
						"Could not delete the category. Is the API running?",
					),
				);
			},
		});
	}

	if (categories.isPending) {
		return (
			<div
				className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
				aria-hidden="true"
			>
				<Skeleton className="h-32 w-full rounded-xl" />
				<Skeleton className="h-32 w-full rounded-xl" />
				<Skeleton className="h-32 w-full rounded-xl" />
			</div>
		);
	}

	if (categories.isError) {
		return (
			<div
				role="alert"
				className="flex flex-col items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-6"
			>
				<p className="text-sm font-medium text-destructive">
					Could not load categories. Is the API running?
				</p>
				<Button
					variant="outline"
					size="sm"
					onClick={() => {
						categories.refetch();
					}}
				>
					Retry
				</Button>
			</div>
		);
	}

	if (categories.data.categories.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card/40 p-12 text-center">
				<div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
					<Tag aria-hidden="true" className="size-5" />
				</div>
				<p className="mt-3 text-sm text-muted-foreground">
					{mode === "archived"
						? "No archived categories."
						: "Trash is empty."}
				</p>
			</div>
		);
	}

	return (
		<>
			<ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{categories.data.categories.map((category) => (
					<li key={category.id} className="flex">
						<div className="w-full">
							<CategoryCard
								category={category}
								onEdit={() => {}}
								onArchive={() => {}}
								onDelete={() => {}}
								onRestore={handleRestore}
								onPermanentDelete={
									mode === "deleted" ? setConfirming : undefined
								}
							/>
						</div>
					</li>
				))}
			</ul>

			{renaming && (
				<RestoreCategoryNameDialog
					category={renaming}
					pending={restore.isPending}
					onSubmit={handleRestoreWithName}
					onOpenChange={(open) => {
						if (!open) {
							setRenaming(null);
						}
					}}
				/>
			)}
			{confirming && (
				<ConfirmTransactionLifecycleDialog
					action="permanent"
					noun="category"
					transactionLabel={confirming.name}
					pending={destroy.isPending}
					onConfirm={handleConfirmPermanentDelete}
					onOpenChange={(open) => {
						if (!open) {
							setConfirming(null);
						}
					}}
				/>
			)}
		</>
	);
}
