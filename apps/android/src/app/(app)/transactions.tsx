import type { ActivityItem, ActivityKind } from "@finance-application/schemas";
import {
	ActivityIndicator,
	FlatList,
	Pressable,
	RefreshControl,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { useEffect, useMemo, useReducer, useState } from "react";

import { ActivityFilters } from "@/components/activity/activity-filters";
import { ActivityRow } from "@/components/activity/activity-row";
import {
	transactionFromActivity,
	transferFromActivity,
} from "@/components/activity/activity-convert";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { TransactionFormDialog } from "@/components/transactions/transaction-form-dialog";
import {
	activityFeedFilters,
	transactionsFilterReducer,
	initialFilterState,
	type TransactionsTab,
} from "@/components/transactions/filter-state";
import { TransferFormDialog } from "@/components/transfers/transfer-form-dialog";
import { useAccounts } from "@/hooks/use-accounts";
import { useActivityFeed } from "@/hooks/use-activity";
import { useCategories } from "@/hooks/use-categories";
import { usePreferences } from "@/hooks/use-preferences";
import { useDebounce } from "@/hooks/use-debounce";
import {
	useArchiveTransaction,
	useDeleteTransaction,
	useRestoreTransaction,
} from "@/hooks/use-transactions";
import {
	useArchiveTransfer,
	useDeleteTransfer,
	useRestoreTransfer,
} from "@/hooks/use-transfers";
import { INR_DISPLAY, preferencesToDisplay } from "@/lib/format";
import { hairline, spacing, type ThemeColors, typography } from "@/theme";
import { useThemeColors } from "@/use-theme-colors";

const TAB_LABELS: Record<TransactionsTab, string> = {
	active: "Active",
	archived: "Archived",
	deleted: "Trash",
};

const EMPTY_MESSAGES: Record<TransactionsTab, string> = {
	active: "No transactions yet. Record your first income or expense.",
	archived: "No archived transactions.",
	deleted: "Trash is empty.",
};

// Lifecycle confirm copy, matching the web's ConfirmTransactionLifecycleDialog
// word for word (archive and delete are reversible; the copy says so).
function lifecycleCopy(
	action: "archive" | "delete",
	noun: string,
): { title: string; description: string; confirmLabel: string } {
	const isArchive = action === "archive";
	return {
		title: `${isArchive ? "Archive" : "Delete"} this ${noun}?`,
		description: isArchive
			? `Archived ${noun}s leave the active list but keep their balance effect and stay in reports. You can restore it from the Archived tab.`
			: `Deleted ${noun}s move to Trash and their balance effect reverses. You can restore it from the Trash tab.`,
		confirmLabel: `${isArchive ? "Archive" : "Delete"} ${noun}`,
	};
}

interface ConfirmingState {
	action: "archive" | "delete";
	kind: ActivityKind;
	id: string;
}

export default function TransactionsScreen() {
	const c = useThemeColors();
	const styles = createStyles(c);

	const [filterState, dispatchFilter] = useReducer(
		transactionsFilterReducer,
		initialFilterState,
	);
	// The raw input stays responsive; the query lands via the shared debounce.
	const debouncedSearch = useDebounce(filterState.searchInput, 300);
	useEffect(() => {
		dispatchFilter({ type: "applyDebouncedQuery", value: debouncedSearch });
	}, [debouncedSearch]);

	const feedFilters = useMemo(
		() => activityFeedFilters(filterState),
		[filterState],
	);
	const activity = useActivityFeed(feedFilters);
	const accounts = useAccounts("active");
	const categories = useCategories("active");
	const preferences = usePreferences();
	const display = preferences.data
		? preferencesToDisplay(preferences.data)
		: INR_DISPLAY;

	// Transaction mutations.
	const archiveTransaction = useArchiveTransaction();
	const deleteTransaction = useDeleteTransaction();
	const restoreTransaction = useRestoreTransaction();
	// Transfer mutations.
	const archiveTransfer = useArchiveTransfer();
	const deleteTransfer = useDeleteTransfer();
	const restoreTransfer = useRestoreTransfer();

	const [createOpen, setCreateOpen] = useState(false);
	const [createTransferOpen, setCreateTransferOpen] = useState(false);
	const [editing, setEditing] = useState<{
		kind: ActivityKind;
		row: ActivityItem;
	} | null>(null);
	const [confirming, setConfirming] = useState<ConfirmingState | null>(null);

	const rows = useMemo(
		() => activity.data?.pages.flatMap((page) => page.activity) ?? [],
		[activity.data],
	);
	const total = activity.data?.pages[0]?.total ?? 0;
	const lifecyclePending =
		archiveTransaction.isPending ||
		deleteTransaction.isPending ||
		archiveTransfer.isPending ||
		deleteTransfer.isPending;

	// The hooks own the toasts; restore has no conflict prompt on mobile —
	// the service's RESTORE_CONFLICT copy explains the reassignment need.
	function handleRestore(kind: ActivityKind, row: ActivityItem): void {
		if (kind === "transfer") {
			restoreTransfer.mutate({ id: row.id });
		} else {
			restoreTransaction.mutate({ id: row.id });
		}
	}

	function handleConfirmLifecycle(): void {
		if (!confirming) {
			return;
		}
		const { action, kind, id } = confirming;
		const mutation =
			kind === "transfer"
				? action === "archive"
					? archiveTransfer
					: deleteTransfer
				: action === "archive"
					? archiveTransaction
					: deleteTransaction;
		mutation.mutate(id, {
			onSuccess: () => {
				setConfirming(null);
			},
			onError: () => {
				setConfirming(null);
			},
		});
	}

	const confirmingCopy = confirming
		? lifecycleCopy(
				confirming.action,
				confirming.kind === "transfer" ? "transfer" : "transaction",
			)
		: null;

	return (
		<View style={styles.screen}>
			<FlatList
				contentContainerStyle={styles.content}
				data={rows}
				keyExtractor={(item) =>
					`${item.kind}:${item.id}:${item.direction ?? ""}`
				}
				refreshControl={
					<RefreshControl
						refreshing={activity.isRefetching}
						onRefresh={() => {
							void activity.refetch();
						}}
						tintColor={c.primary}
						colors={[c.primary]}
					/>
				}
				renderItem={({ item }) => (
					<ActivityRow
						display={display}
						item={item}
						onArchive={(row) => {
							setConfirming({
								action: "archive",
								kind: row.kind,
								id: row.id,
							});
						}}
						onDelete={(row) => {
							setConfirming({
								action: "delete",
								kind: row.kind,
								id: row.id,
							});
						}}
						onEdit={(row) => {
							setEditing({ kind: row.kind, row });
						}}
						onRestore={(row) => {
							handleRestore(row.kind, row);
						}}
					/>
				)}
				ListEmptyComponent={
					activity.isPending ? (
						<View style={styles.centered}>
							<Text style={styles.mutedText}>Loading...</Text>
						</View>
					) : activity.isError ? (
						<View
							accessibilityRole="alert"
							style={[styles.stateBox, hairline(c.border)]}
						>
							<Text style={styles.errorText}>
								Could not load transactions. Is the API running?
							</Text>
							<PressableRetry
								label="Retry"
								onPress={() => {
									void activity.refetch();
								}}
							/>
						</View>
					) : (
						<View style={[styles.stateBox, hairline(c.border)]}>
							<Text style={styles.mutedText}>
								{EMPTY_MESSAGES[filterState.tab]}
							</Text>
							{filterState.tab === "active" ? (
								<PressableRetry
									label="Record your first transaction"
									onPress={() => {
										setCreateOpen(true);
									}}
								/>
							) : null}
						</View>
					)
				}
				ListFooterComponent={
					rows.length > 0 && activity.hasNextPage ? (
						<PressableRetry
							label={activity.isFetchingNextPage ? "Loading..." : "Load more"}
							disabled={activity.isFetchingNextPage}
							onPress={() => {
								void activity.fetchNextPage();
							}}
						/>
					) : undefined
				}
				ListHeaderComponent={
					<View>
						<View style={styles.pageHeader}>
							<View style={styles.titleBlock}>
								<Text style={styles.pageTitle}>Transactions</Text>
								<Text style={styles.subtitle}>
									{total} record{total === 1 ? "" : "s"} in this view.
								</Text>
							</View>
							<PressableNewButton
								label="New transfer"
								variant="outline"
								onPress={() => {
									setCreateTransferOpen(true);
								}}
							/>
							<PressableNewButton
								label="Record transaction"
								variant="primary"
								onPress={() => {
									setCreateOpen(true);
								}}
							/>
						</View>
						<View style={[styles.tabsRow, hairline(c.border)]}>
							{(Object.keys(TAB_LABELS) as TransactionsTab[]).map((status) => {
								const selected = filterState.tab === status;
								return (
									<Pressable
										key={status}
										accessibilityRole="tab"
										accessibilityState={{ selected }}
										onPress={() => {
											dispatchFilter({ type: "setTab", value: status });
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
						<ActivityFilters
							accounts={(accounts.data?.accounts ?? []).map((account) => ({
								id: account.id,
								name: account.name,
							}))}
							categories={(categories.data?.categories ?? []).map(
								(category) => ({ id: category.id, name: category.name }),
							)}
							onAction={dispatchFilter}
							state={filterState}
						/>
					</View>
				}
			/>

			{createOpen ? (
				<TransactionFormDialog
					display={display}
					onOpenChange={setCreateOpen}
					open
				/>
			) : null}
			{createTransferOpen ? (
				<TransferFormDialog
					display={display}
					onOpenChange={setCreateTransferOpen}
					open
				/>
			) : null}
			{editing && editing.kind === "transaction" ? (
				<TransactionFormDialog
					display={display}
					onOpenChange={(next) => {
						if (!next) {
							setEditing(null);
						}
					}}
					open
					transaction={transactionFromActivity(editing.row)}
				/>
			) : null}
			{editing && editing.kind === "transfer" ? (
				<TransferFormDialog
					display={display}
					onOpenChange={(next) => {
						if (!next) {
							setEditing(null);
						}
					}}
					open
					transfer={transferFromActivity(editing.row)}
				/>
			) : null}
			{confirming && confirmingCopy ? (
				<ConfirmDialog
					confirmLabel={confirmingCopy.confirmLabel}
					description={confirmingCopy.description}
					onCancel={() => {
						setConfirming(null);
					}}
					onConfirm={handleConfirmLifecycle}
					pending={lifecyclePending}
					title={confirmingCopy.title}
					visible
				/>
			) : null}
		</View>
	);
}

// Small inline row controls kept outside the screen's JSX for readability.
function PressableNewButton({
	label,
	variant,
	onPress,
}: {
	label: string;
	variant: "primary" | "outline";
	onPress: () => void;
}) {
	const c = useThemeColors();
	const styles = createStyles(c);
	return (
		<Pressable
			accessibilityRole="button"
			onPress={onPress}
			style={({ pressed }) => [
				styles.newButton,
				variant === "primary" ? styles.newButtonPrimary : hairline(c.border),
				pressed && styles.pressed,
			]}
		>
			<Text
				style={[
					styles.newButtonText,
					variant === "primary" && styles.newButtonTextPrimary,
				]}
			>
				{label}
			</Text>
		</Pressable>
	);
}

function PressableRetry({
	label,
	onPress,
	disabled = false,
}: {
	label: string;
	onPress: () => void;
	disabled?: boolean;
}) {
	const c = useThemeColors();
	const styles = createStyles(c);
	return (
		<Pressable
			accessibilityRole="button"
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }) => [
				styles.retryButton,
				hairline(c.border),
				disabled && styles.disabled,
				pressed && !disabled && styles.pressed,
			]}
		>
			{disabled ? (
				<ActivityIndicator color={c.foreground} size="small" />
			) : (
				<Text style={styles.retryText}>{label}</Text>
			)}
		</Pressable>
	);
}

function createStyles(c: ThemeColors) {
	return StyleSheet.create({
		centered: {
			alignItems: "center",
			paddingVertical: spacing.xxl,
		},
		content: {
			padding: spacing.lg,
			gap: spacing.md,
		},
		disabled: {
			opacity: 0.5,
		},
		errorText: {
			color: c.destructive,
			fontSize: typography.sizeSm,
			fontWeight: typography.weightMedium,
		},
		mutedText: {
			color: c.mutedForeground,
			fontSize: typography.sizeSm,
			textAlign: "center",
		},
		newButton: {
			alignItems: "center",
			borderRadius: 0,
			padding: spacing.md,
		},
		newButtonPrimary: {
			backgroundColor: c.primary,
		},
		newButtonText: {
			color: c.foreground,
			fontSize: typography.sizeSm,
			fontWeight: typography.weightMedium,
		},
		newButtonTextPrimary: {
			color: c.primaryForeground,
		},
		pageHeader: {
			flexDirection: "row",
			flexWrap: "wrap",
			gap: spacing.sm,
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
		stateBox: {
			alignItems: "center",
			paddingVertical: spacing.xxl,
			paddingHorizontal: spacing.lg,
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
		titleBlock: {
			flexGrow: 1,
		},
	});
}
