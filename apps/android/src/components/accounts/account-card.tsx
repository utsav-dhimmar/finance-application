import type { AccountResponse } from "@finance-application/schemas";
import { StyleSheet, Text, View } from "react-native";

import {
	EntityActions,
	EntityBadges,
} from "@/components/shared/entity-card-parts";
import type { CurrencyDisplayDefinition } from "@/lib/format";
import { formatMinorUnits, tabularNums } from "@/lib/format";
import { ACCOUNT_TYPE_LABELS } from "@/lib/account-labels";
import { hairline, spacing, type ThemeColors, typography } from "@/theme";
import { useThemeColors } from "@/use-theme-colors";

export interface AccountCardProps {
	account: AccountResponse;
	display: CurrencyDisplayDefinition;
	onEdit: (account: AccountResponse) => void;
	onArchive: (account: AccountResponse) => void;
	onDelete: (account: AccountResponse) => void;
	onRestore: (account: AccountResponse) => void;
}

/** One account card: name, type and status badges, balances, and actions. */
export function AccountCard({
	account,
	display,
	onEdit,
	onArchive,
	onDelete,
	onRestore,
}: AccountCardProps) {
	const c = useThemeColors();
	const styles = createStyles(c);
	return (
		<View style={[styles.card, hairline(c.border)]}>
			<Text style={styles.name}>{account.name}</Text>
			<EntityBadges
				typeLabel={ACCOUNT_TYPE_LABELS[account.type]}
				isArchived={account.status === "archived"}
				isDeleted={account.status === "deleted"}
			/>
			<View style={styles.balanceBlock}>
				<Text style={[styles.balance, tabularNums]}>
					{formatMinorUnits(account.currentBalanceMinor, display)}
				</Text>
				{account.openingBalanceMinor !== account.currentBalanceMinor && (
					<Text style={[styles.opening, tabularNums]}>
						opening {formatMinorUnits(account.openingBalanceMinor, display)}
					</Text>
				)}
			</View>
			<EntityActions
				status={account.status}
				onEdit={() => {
					onEdit(account);
				}}
				onArchive={() => {
					onArchive(account);
				}}
				onDelete={() => {
					onDelete(account);
				}}
				onRestore={() => {
					onRestore(account);
				}}
			/>
		</View>
	);
}

function createStyles(c: ThemeColors) {
	return StyleSheet.create({
		balance: {
			color: c.foreground,
			fontSize: typography.sizeXl,
			fontWeight: typography.weightBold,
		},
		balanceBlock: {
			marginTop: spacing.md,
		},
		card: {
			backgroundColor: c.background,
			padding: spacing.lg,
		},
		name: {
			color: c.foreground,
			fontSize: typography.sizeMd,
			fontWeight: typography.weightBold,
		},
		opening: {
			color: c.mutedForeground,
			fontSize: typography.sizeXs,
			marginTop: 2,
		},
	});
}
