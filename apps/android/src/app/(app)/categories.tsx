import { ApiError } from "@finance-application/api-client";
import {
	categoryNameSchema,
	type CategoryResponse,
} from "@finance-application/schemas";
import { useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	RefreshControl,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";

import { CategoryCard } from "@/components/categories/category-card";
import { CategoryFormDialog } from "@/components/categories/category-form-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RestoreNameDialog } from "@/components/shared/restore-name-dialog";
import {
	useArchiveCategory,
	useCategories,
	useDeleteCategory,
	useRestoreCategory,
} from "@/hooks/use-categories";
import { hairline, spacing, type ThemeColors, typography } from "@/theme";
import { useThemeColors } from "@/use-theme-colors";

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

// Domain copy for the reversible lifecycle confirmations, matching the web's
// ConfirmCategoryLifecycleDialog word for word.
const ARCHIVE_DESCRIPTION =
	"Archived categories leave lists and transaction selection but keep their history. You can restore this category from the Archived tab.";
const DELETE_DESCRIPTION =
	"Deleted categories move to Trash and keep their history. You can restore this category from the Trash tab.";

export default function CategoriesScreen() {
	const c = useThemeColors();
	const styles = createStyles(c);
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

	function openCreate(): void {
		setCreateOpen(true);
	}

	// The hooks own the toasts; the screen only reacts to the restore's
	// name-conflict rejection by opening the rename prompt.
	function handleRestore(category: CategoryResponse): void {
		restore.mutate(
			{ id: category.id },
			{
				onError: (error) => {
					if (
						error instanceof ApiError &&
						error.code === "CATEGORY_NAME_TAKEN"
					) {
						setRenaming(category);
					}
				},
			},
		);
	}

	function handleRestoreWithName(newName: string): void {
		if (!renaming) {
			return;
		}
		restore.mutate(
			{ id: renaming.id, newName },
			{
				onSuccess: () => {
					setRenaming(null);
				},
			},
		);
	}

	function handleConfirmLifecycle(): void {
		if (!confirming) {
			return;
		}
		const { action, category } = confirming;
		const mutation = action === "archive" ? archive : remove;
		mutation.mutate(category.id, {
			onSuccess: () => {
				setConfirming(null);
			},
			onError: () => {
				setConfirming(null);
			},
		});
	}

	return (
		<View style={styles.screen}>
			<ScrollView
				contentContainerStyle={styles.content}
				refreshControl={
					<RefreshControl
						refreshing={categories.isRefetching}
						onRefresh={() => {
							void categories.refetch();
						}}
						tintColor={c.primary}
						colors={[c.primary]}
					/>
				}
			>
				<View style={styles.pageHeader}>
					<Text style={styles.pageTitle}>Categories</Text>
					<Pressable
						accessibilityRole="button"
						onPress={openCreate}
						style={({ pressed }) => [
							styles.addButton,
							pressed && styles.pressed,
						]}
					>
						<Text style={styles.addButtonText}>Add category</Text>
					</Pressable>
				</View>
				<Text style={styles.subtitle}>
					Organize income and expenses across all your accounts.
				</Text>
				<View style={[styles.tabsRow, hairline(c.border)]}>
					{TABS.map((status) => {
						const selected = tab === status;
						return (
							<Pressable
								key={status}
								accessibilityRole="tab"
								accessibilityState={{ selected }}
								onPress={() => {
									setTab(status);
								}}
								style={[styles.tab, selected && styles.tabActive]}
							>
								<Text
									style={[styles.tabText, selected && styles.tabTextActive]}
								>
									{TAB_LABELS[status]}
								</Text>
							</Pressable>
						);
					})}
				</View>
				{categories.isPending ? (
					<View style={styles.centered}>
						<ActivityIndicator color={c.primary} />
						<Text style={styles.loadingText}>Loading...</Text>
					</View>
				) : categories.isError ? (
					<View
						accessibilityRole="alert"
						style={[styles.errorBox, hairline(c.border)]}
					>
						<Text style={styles.errorText}>
							Could not load categories. Is the API running?
						</Text>
						<Pressable
							accessibilityRole="button"
							onPress={() => {
								void categories.refetch();
							}}
							style={({ pressed }) => [
								styles.retryButton,
								hairline(c.border),
								pressed && styles.pressed,
							]}
						>
							<Text style={styles.retryText}>Retry</Text>
						</Pressable>
					</View>
				) : categories.data.categories.length === 0 ? (
					<View style={[styles.emptyBox, hairline(c.border)]}>
						<Text style={styles.emptyText}>{EMPTY_MESSAGES[tab]}</Text>
						{tab === "active" ? (
							<Pressable
								accessibilityRole="button"
								onPress={openCreate}
								style={({ pressed }) => [
									styles.retryButton,
									hairline(c.border),
									pressed && styles.pressed,
								]}
							>
								<Text style={styles.retryText}>Add your first category</Text>
							</Pressable>
						) : null}
					</View>
				) : (
					<View style={styles.cardList}>
						{categories.data.categories.map((category) => (
							<CategoryCard
								key={category.id}
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
						))}
					</View>
				)}
			</ScrollView>

			{createOpen ? (
				<CategoryFormDialog open onOpenChange={setCreateOpen} />
			) : null}
			{editing ? (
				<CategoryFormDialog
					open
					category={editing}
					onOpenChange={(next) => {
						if (!next) {
							setEditing(null);
						}
					}}
				/>
			) : null}
			{confirming ? (
				<ConfirmDialog
					visible
					title={`${confirming.action === "archive" ? "Archive" : "Delete"} "${confirming.category.name}"?`}
					description={
						confirming.action === "archive"
							? ARCHIVE_DESCRIPTION
							: DELETE_DESCRIPTION
					}
					confirmLabel={
						confirming.action === "archive"
							? "Archive category"
							: "Delete category"
					}
					pending={archive.isPending || remove.isPending}
					onConfirm={handleConfirmLifecycle}
					onCancel={() => {
						setConfirming(null);
					}}
				/>
			) : null}
			{renaming ? (
				<RestoreNameDialog
					visible
					entityName={renaming.name}
					noun="category"
					nameSchema={categoryNameSchema}
					pending={restore.isPending}
					onSubmit={handleRestoreWithName}
					onCancel={() => {
						setRenaming(null);
					}}
				/>
			) : null}
		</View>
	);
}

function createStyles(c: ThemeColors) {
	return StyleSheet.create({
		addButton: {
			backgroundColor: c.primary,
			borderRadius: 0,
			padding: spacing.md,
		},
		addButtonText: {
			color: c.primaryForeground,
			fontSize: typography.sizeSm,
			fontWeight: typography.weightMedium,
		},
		cardList: {
			gap: spacing.md,
		},
		centered: {
			alignItems: "center",
			paddingVertical: spacing.xxl,
		},
		content: {
			padding: spacing.lg,
		},
		emptyBox: {
			alignItems: "center",
			paddingVertical: spacing.xxl,
			paddingHorizontal: spacing.lg,
		},
		emptyText: {
			color: c.mutedForeground,
			fontSize: typography.sizeSm,
			textAlign: "center",
		},
		errorBox: {
			padding: spacing.lg,
		},
		errorText: {
			color: c.destructive,
			fontSize: typography.sizeSm,
			fontWeight: typography.weightMedium,
		},
		loadingText: {
			color: c.mutedForeground,
			fontSize: typography.sizeSm,
			marginTop: spacing.md,
		},
		pageHeader: {
			alignItems: "flex-start",
			flexDirection: "row",
			gap: spacing.md,
			justifyContent: "space-between",
		},
		pageTitle: {
			color: c.foreground,
			fontSize: typography.sizeXl,
			fontWeight: typography.weightBold,
		},
		pressed: {
			opacity: 0.9,
		},
		retryButton: {
			alignItems: "center",
			borderRadius: 0,
			marginTop: spacing.md,
			padding: spacing.md,
		},
		retryText: {
			color: c.foreground,
			fontSize: typography.sizeSm,
			fontWeight: typography.weightMedium,
		},
		screen: {
			backgroundColor: c.background,
			flex: 1,
		},
		subtitle: {
			color: c.mutedForeground,
			fontSize: typography.sizeSm,
			marginTop: spacing.xs,
		},
		tab: {
			alignItems: "center",
			borderRadius: 0,
			flex: 1,
			padding: spacing.sm,
		},
		tabActive: {
			backgroundColor: c.muted,
		},
		tabText: {
			color: c.mutedForeground,
			fontSize: typography.sizeSm,
		},
		tabTextActive: {
			color: c.foreground,
			fontWeight: typography.weightMedium,
		},
		tabsRow: {
			flexDirection: "row",
			marginTop: spacing.lg,
		},
	});
}
