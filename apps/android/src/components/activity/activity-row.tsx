import type { ActivityItem } from "@finance-application/schemas";
import { StyleSheet, Text, View } from "react-native";

import { EntityActions } from "@/components/shared/entity-card-parts";
import type { CurrencyDisplayDefinition } from "@/lib/format";
import { formatMinorUnits, tabularNums } from "@/lib/format";
import { TRANSACTION_TYPE_LABELS } from "@/lib/transaction-labels";
import { TRANSFER_DIRECTION_LABELS } from "@/lib/transfer-labels";
import { hairline, spacing, type ThemeColors, typography } from "@/theme";
import { useThemeColors } from "@/use-theme-colors";

export interface ActivityRowProps {
	item: ActivityItem;
	display: CurrencyDisplayDefinition;
	onEdit: (item: ActivityItem) => void;
	onArchive: (item: ActivityItem) => void;
	onDelete: (item: ActivityItem) => void;
	onRestore: (item: ActivityItem) => void;
}

// Signed amount for the row's account side, matching the web's
// formatSignedAmount: incomes credit (+), expenses debit (−), and a transfer
// shows its effect on the row's account (source −, destination +). The sign
// precedes the formatted currency; the magnitude uses the shared formatter.
export function formatSignedAmount(
	item: ActivityItem,
	display: CurrencyDisplayDefinition,
): string {
	const sign = item.amountMinor < 0 ? "−" : "+";
	return `${sign}${formatMinorUnits(Math.abs(item.amountMinor), display)}`;
}

/**
 * One activity-feed row: date, kind (transaction type or transfer with its
 * direction), category or counterparty account, the signed amount for the
 * row's account side, and the lifecycle actions. Rows render as-is — an
 * unscoped feed can contain the same transfer id twice (one row per side).
 */
export function ActivityRow({
	item,
	display,
	onEdit,
	onArchive,
	onDelete,
	onRestore,
}: ActivityRowProps) {
	const c = useThemeColors();
	const styles = createStyles(c);
	const kindLabel =
		item.kind === "transaction"
			? item.type
				? TRANSACTION_TYPE_LABELS[item.type]
				: "Transaction"
			: "Transfer";
	const counterparty =
		item.kind === "transaction"
			? (item.categoryName ?? "—")
			: (item.counterpartyAccountName ?? "Unavailable");
	return (
		<View style={[styles.card, hairline(c.border)]}>
			<View style={styles.metaRow}>
				<Text style={styles.date}>{item.date}</Text>
				<View style={styles.badgeRow}>
					<View style={styles.kindBadge}>
						<Text style={styles.kindBadgeText}>{kindLabel}</Text>
					</View>
					{item.kind === "transfer" ? (
						<View style={[styles.outlineBadge, hairline(c.border)]}>
							<Text style={styles.outlineBadgeText}>
								{TRANSFER_DIRECTION_LABELS[item.direction ?? "out"]}
							</Text>
						</View>
					) : null}
					{item.status !== "active" ? (
						<View style={[styles.outlineBadge, hairline(c.border)]}>
							<Text style={styles.outlineBadgeText}>
								{item.status === "archived" ? "Archived" : "Deleted"}
							</Text>
						</View>
					) : null}
				</View>
			</View>
			<Text style={[styles.amount, tabularNums]}>
				{formatSignedAmount(item, display)}
			</Text>
			<Text style={styles.detail} numberOfLines={1}>
				{counterparty}
			</Text>
			<Text style={styles.detail} numberOfLines={1}>
				{item.accountName ?? "Unavailable"}
			</Text>
			{item.notes ? (
				<Text style={styles.notes} numberOfLines={2}>
					{item.notes}
				</Text>
			) : null}
			<EntityActions
				status={item.status}
				onEdit={() => {
					onEdit(item);
				}}
				onArchive={() => {
					onArchive(item);
				}}
				onDelete={() => {
					onDelete(item);
				}}
				onRestore={() => {
					onRestore(item);
				}}
			/>
		</View>
	);
}

function createStyles(c: ThemeColors) {
	return StyleSheet.create({
		amount: {
			color: c.foreground,
			fontSize: typography.sizeLg,
			fontWeight: typography.weightBold,
			marginTop: spacing.sm,
		},
		badgeRow: {
			alignItems: "center",
			flexDirection: "row",
			flexWrap: "wrap",
			gap: spacing.xs,
		},
		card: {
			backgroundColor: c.background,
			padding: spacing.lg,
		},
		date: {
			color: c.mutedForeground,
			fontSize: typography.sizeXs,
		},
		detail: {
			color: c.foreground,
			fontSize: typography.sizeSm,
			marginTop: 2,
		},
		kindBadge: {
			backgroundColor: c.muted,
			borderRadius: 0,
			paddingVertical: 2,
			paddingHorizontal: spacing.sm,
		},
		kindBadgeText: {
			color: c.foreground,
			fontSize: typography.sizeXs,
			fontWeight: typography.weightMedium,
		},
		metaRow: {
			alignItems: "center",
			flexDirection: "row",
			gap: spacing.sm,
			justifyContent: "space-between",
		},
		notes: {
			color: c.mutedForeground,
			fontSize: typography.sizeXs,
			marginTop: spacing.xs,
		},
		outlineBadge: {
			borderRadius: 0,
			paddingVertical: 2,
			paddingHorizontal: spacing.sm,
		},
		outlineBadgeText: {
			color: c.mutedForeground,
			fontSize: typography.sizeXs,
			fontWeight: typography.weightMedium,
		},
	});
}
