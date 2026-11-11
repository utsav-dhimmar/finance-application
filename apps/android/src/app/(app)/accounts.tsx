import { ApiError } from "@finance-application/api-client";
import { accountNameSchema } from "@finance-application/schemas";
import type { AccountResponse } from "@finance-application/schemas";
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

import { AccountCard } from "@/components/accounts/account-card";
import { AccountFormDialog } from "@/components/accounts/account-form-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RestoreNameDialog } from "@/components/shared/restore-name-dialog";
import {
	useAccounts,
	useArchiveAccount,
	useDeleteAccount,
	useRestoreAccount,
} from "@/hooks/use-accounts";
import { usePreferences } from "@/hooks/use-preferences";
import {
	INR_DISPLAY,
	formatMinorUnits,
	preferencesToDisplay,
	tabularNums,
} from "@/lib/format";
import { hairline, spacing, type ThemeColors, typography } from "@/theme";
import { useThemeColors } from "@/use-theme-colors";

type AccountsTab = "active" | "archived" | "deleted";

const TABS: AccountsTab[] = ["active", "archived", "deleted"];

const TAB_LABELS: Record<AccountsTab, string> = {
	active: "Active",
	archived: "Archived",
	deleted: "Trash",
};

const EMPTY_MESSAGES: Record<AccountsTab, string> = {
	active: "No accounts yet. Add your first account to start tracking money.",
	archived: "No archived accounts.",
	deleted: "Trash is empty.",
};

// Domain copy for the reversible lifecycle confirmations, matching the web's
// ConfirmLifecycleDialog word for word.
const ARCHIVE_DESCRIPTION =
	"Archived accounts leave lists and balance summaries but keep their history. You can restore this account from the Archived tab.";
const DELETE_DESCRIPTION =
	"Deleted accounts move to Trash and keep their history. You can restore this account from the Trash tab.";

export default function AccountsScreen() {
	const c = useThemeColors();
	const styles = createStyles(c);
	const [tab, setTab] = useState<AccountsTab>("active");
	const accounts = useAccounts(tab);
	const archive = useArchiveAccount();
	const remove = useDeleteAccount();
	const restore = useRestoreAccount();
	const preferences = usePreferences();
	const display = preferences.data
		? preferencesToDisplay(preferences.data)
		: INR_DISPLAY;

	const [createOpen, setCreateOpen] = useState(false);
	const [editing, setEditing] = useState<AccountResponse | null>(null);
	const [confirming, setConfirming] = useState<{
		action: "archive" | "delete";
		account: AccountResponse;
	} | null>(null);
	const [renaming, setRenaming] = useState<AccountResponse | null>(null);

	function openCreate(): void {
		setCreateOpen(true);
	}

	// The hooks own the toasts; the screen only reacts to the restore's
	// name-conflict rejection by opening the rename prompt.
	function handleRestore(account: AccountResponse): void {
		restore.mutate(
			{ id: account.id },
			{
				onError: (error) => {
					if (
						error instanceof ApiError &&
						error.code === "ACCOUNT_NAME_TAKEN"
					) {
						setRenaming(account);
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
		const { action, account } = confirming;
		const mutation = action === "archive" ? archive : remove;
		mutation.mutate(account.id, {
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
						refreshing={accounts.isRefetching}
						onRefresh={() => {
							void accounts.refetch();
						}}
						tintColor={c.primary}
						colors={[c.primary]}
					/>
				}
			>
				<View style={styles.pageHeader}>
					<Text style={styles.pageTitle}>Accounts</Text>
					<Pressable
						accessibilityRole="button"
						onPress={openCreate}
						style={({ pressed }) => [
							styles.addButton,
							pressed && styles.pressed,
						]}
					>
						<Text style={styles.addButtonText}>Add account</Text>
					</Pressable>
				</View>
				{tab === "active" ? (
					<Text style={styles.subtitle}>
						{"Combined balance across active accounts: "}
						<Text style={[styles.balanceInline, tabularNums]}>
							{formatMinorUnits(
								accounts.data?.combinedBalanceMinor ?? 0,
								display,
							)}
						</Text>
					</Text>
				) : null}
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
				{accounts.isPending ? (
					<View style={styles.centered}>
						<ActivityIndicator color={c.primary} />
						<Text style={styles.loadingText}>Loading...</Text>
					</View>
				) : accounts.isError ? (
					<View
						accessibilityRole="alert"
						style={[styles.errorBox, hairline(c.border)]}
					>
						<Text style={styles.errorText}>
							Could not load accounts. Is the API running?
						</Text>
						<Pressable
							accessibilityRole="button"
							onPress={() => {
								void accounts.refetch();
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
				) : accounts.data.accounts.length === 0 ? (
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
								<Text style={styles.retryText}>Add your first account</Text>
							</Pressable>
						) : null}
					</View>
				) : (
					<View style={styles.cardList}>
						{accounts.data.accounts.map((account) => (
							<AccountCard
								key={account.id}
								account={account}
								display={display}
								onEdit={setEditing}
								onArchive={(target) => {
									setConfirming({
										action: "archive",
										account: target,
									});
								}}
								onDelete={(target) => {
									setConfirming({
										action: "delete",
										account: target,
									});
								}}
								onRestore={handleRestore}
							/>
						))}
					</View>
				)}
			</ScrollView>

			{createOpen ? (
				<AccountFormDialog
					open
					onOpenChange={setCreateOpen}
					display={display}
				/>
			) : null}
			{editing ? (
				<AccountFormDialog
					open
					account={editing}
					display={display}
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
					title={`${confirming.action === "archive" ? "Archive" : "Delete"} "${confirming.account.name}"?`}
					description={
						confirming.action === "archive"
							? ARCHIVE_DESCRIPTION
							: DELETE_DESCRIPTION
					}
					confirmLabel={
						confirming.action === "archive"
							? "Archive account"
							: "Delete account"
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
					noun="account"
					nameSchema={accountNameSchema}
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
		balanceInline: {
			color: c.foreground,
			fontWeight: typography.weightBold,
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
