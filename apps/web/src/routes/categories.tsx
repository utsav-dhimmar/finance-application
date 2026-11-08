import { ApiError } from "@finance-application/api-client";
import type { CategoryResponse } from "@finance-application/schemas";
import { Button } from "@finance-application/ui/components/button";
import { Skeleton } from "@finance-application/ui/components/skeleton";
import {
	Tabs,
	TabsList,
	TabsTrigger,
} from "@finance-application/ui/components/tabs";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Tags } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { CategoryCard } from "@/components/categories/category-card";
import { CategoryFormDialog } from "@/components/categories/category-form-dialog";
import { ConfirmCategoryLifecycleDialog } from "@/components/categories/confirm-category-lifecycle-dialog";
import { RestoreCategoryNameDialog } from "@/components/categories/restore-category-name-dialog";
import { useMe } from "@/hooks/use-auth";
import {
	useArchiveCategory,
	useCategories,
	useDeleteCategory,
	useRestoreCategory,
} from "@/hooks/use-categories";
import { getCategoriesErrorMessage } from "@/services/categories-service";

export const Route = createFileRoute("/categories")({
	component: CategoriesPage,
});

type CategoriesTab = "active" | "archived" | "deleted";

const TABS: CategoriesTab[] = ["active", "archived", "deleted"];

const TAB_LABELS: Record<CategoriesTab, string> = {
	active: "Active",
	archived: "Archived",
	deleted: "Trash",
};

const EMPTY_MESSAGES: Record<CategoriesTab, string> = {
	active:
		"No categories yet. Add your first category to organize transactions.",
	archived: "No archived categories.",
	deleted: "Trash is empty.",
};

export function CategoriesPage() {
	const navigate = useNavigate();
	const me = useMe();
	const [tab, setTab] = useState<CategoriesTab>("active");
	const categories = useCategories(tab);
	const archive = useArchiveCategory();
	const remove = useDeleteCategory();
	const restore = useRestoreCategory();

	const [createOpen, setCreateOpen] = useState(false);
	const [editing, setEditing] = useState<CategoryResponse | null>(null);
	const [confirming, setConfirming] = useState<{
		action: "archive" | "delete";
		category: CategoryResponse;
	} | null>(null);
	const [renaming, setRenaming] = useState<CategoryResponse | null>(null);

	// Guard: unauthenticated visitors are sent to /login without ever seeing
	// category data.
	useEffect(() => {
		if (me.data === null) {
			navigate({ to: "/login" });
		}
	}, [me.data, navigate]);

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

	function handleConfirmLifecycle() {
		if (!confirming) {
			return;
		}
		const { action, category } = confirming;
		const mutation = action === "archive" ? archive : remove;
		mutation.mutate(category.id, {
			onSuccess: (updated) => {
				setConfirming(null);
				toast.success(
					action === "archive"
						? `Category "${updated.name}" archived.`
						: `Category "${updated.name}" moved to trash.`,
				);
			},
			onError: (error) => {
				setConfirming(null);
				toast.error(
					getCategoriesErrorMessage(
						error,
						"The change failed. Is the API running?",
					),
				);
			},
		});
	}

	if (me.isPending || me.data === undefined) {
		return (
			<main className="flex min-h-screen items-center justify-center p-8">
				<p
					aria-live="polite"
					className="text-sm text-muted-foreground animate-pulse"
				>
					Loading...
				</p>
			</main>
		);
	}

	if (me.data === null) {
		return null;
	}

	return (
		<div className="flex min-h-screen flex-col bg-background">
			<AppHeader />
			<main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 sm:p-6 md:p-8">
				{/* Page Header */}
				<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
							Categories
						</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							Organize income and expenses across all your accounts.
						</p>
					</div>
					<Button
						onClick={() => setCreateOpen(true)}
						className="self-start sm:self-auto gap-1.5 shadow-xs"
					>
						<Plus aria-hidden="true" className="size-4" />
						Add category
					</Button>
				</div>

				{/* Status Filter Tabs */}
				<div className="flex items-center">
					<Tabs
						value={tab}
						onValueChange={(value) => setTab(value as CategoriesTab)}
					>
						<TabsList className="bg-muted/70 p-1">
							{TABS.map((status) => (
								<TabsTrigger
									key={status}
									value={status}
									className="px-3 text-xs"
								>
									{TAB_LABELS[status]}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				</div>

				{/* Categories Content / Skeletons / Grid */}
				{categories.isPending ? (
					<div
						className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
						aria-hidden="true"
					>
						<Skeleton className="h-40 w-full rounded-xl" />
						<Skeleton className="h-40 w-full rounded-xl" />
						<Skeleton className="h-40 w-full rounded-xl" />
					</div>
				) : categories.isError ? (
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
				) : categories.data.categories.length === 0 ? (
					<div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card/40 p-12 text-center">
						<div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
							<Tags aria-hidden="true" className="size-5" />
						</div>
						<p className="mt-3 text-sm text-muted-foreground">
							{EMPTY_MESSAGES[tab]}
						</p>
						{tab === "active" && (
							<Button
								variant="outline"
								size="sm"
								className="mt-4 gap-1.5"
								onClick={() => setCreateOpen(true)}
							>
								<Plus aria-hidden="true" className="size-3.5" />
								Add your first category
							</Button>
						)}
					</div>
				) : (
					<ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{categories.data.categories.map((category) => (
							<li key={category.id} className="flex">
								<div className="w-full">
									<CategoryCard
										category={category}
										onEdit={setEditing}
										onArchive={(target) => {
											setConfirming({
												action: "archive",
												category: target,
											});
										}}
										onDelete={(target) => {
											setConfirming({
												action: "delete",
												category: target,
											});
										}}
										onRestore={handleRestore}
									/>
								</div>
							</li>
						))}
					</ul>
				)}
			</main>

			<CategoryFormDialog open={createOpen} onOpenChange={setCreateOpen} />
			{editing && (
				<CategoryFormDialog
					open={Boolean(editing)}
					category={editing}
					onOpenChange={(open) => {
						if (!open) {
							setEditing(null);
						}
					}}
				/>
			)}
			{confirming && (
				<ConfirmCategoryLifecycleDialog
					action={confirming.action}
					category={confirming.category}
					pending={archive.isPending || remove.isPending}
					onConfirm={handleConfirmLifecycle}
					onOpenChange={(open) => {
						if (!open) {
							setConfirming(null);
						}
					}}
				/>
			)}
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
		</div>
	);
}
