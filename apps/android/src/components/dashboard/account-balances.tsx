import type { AccountResponse } from "@finance-application/schemas";
import { StyleSheet, Text, View } from "react-native";

import { ACCOUNT_TYPE_LABELS } from "@/lib/account-labels";
import type { CurrencyDisplayDefinition } from "@/lib/format";
import { formatMinorUnits, tabularNums } from "@/lib/format";
import { hairline, spacing, type ThemeColors, typography } from "@/theme";
import { useThemeColors } from "@/use-theme-colors";

export interface AccountBalancesProps {
	accounts: AccountResponse[];
	combinedBalanceMinor: number;
	display: CurrencyDisplayDefinition;
}

/**
 * The active accounts with their current balances and the combined balance
 * across active accounts — the web dashboard's balances section. With no
 * accounts it renders the zero combined balance and no rows; the screen
 * layers the onboarding state on top.
 */
export function AccountBalances({
	accounts,
	combinedBalanceMinor,
	display,
}: AccountBalancesProps) {
	const c = useThemeColors();
	const styles = createStyles(c);
	return (
		<View style={styles.section}>
			<View style={styles.header}>
				<Text style={styles.title}>Accounts</Text>
				<Text style={styles.combinedLabel}>
					{"Combined balance "}
					<Text style={[styles.combinedAmount, tabularNums]}>
						{formatMinorUnits(combinedBalanceMinor, display)}
					</Text>
				</Text>
			</View>
			{accounts.map((account) => (
				<View key={account.id} style={[styles.row, hairline(c.border)]}>
					<View style={styles.rowIdentity}>
						<Text numberOfLines={1} style={styles.name}>
							{account.name}
						</Text>
						<Text style={styles.type}>{ACCOUNT_TYPE_LABELS[account.type]}</Text>
					</View>
					<Text style={[styles.balance, tabularNums]}>
						{formatMinorUnits(account.currentBalanceMinor, display)}
					</Text>
				</View>
			))}
		</View>
	);
}

function createStyles(c: ThemeColors) {
	return StyleSheet.create({
		balance: {
			color: c.foreground,
			fontSize: typography.sizeSm,
			fontWeight: typography.weightBold,
		},
		combinedAmount: {
			color: c.foreground,
			fontWeight: typography.weightBold,
		},
		combinedLabel: {
			color: c.mutedForeground,
			fontSize: typography.sizeSm,
		},
		header: {
			alignItems: "center",
			flexDirection: "row",
			gap: spacing.md,
			justifyContent: "space-between",
		},
		name: {
			color: c.foreground,
			fontSize: typography.sizeSm,
			fontWeight: typography.weightMedium,
		},
		row: {
			alignItems: "center",
			backgroundColor: c.background,
			flexDirection: "row",
			gap: spacing.md,
			justifyContent: "space-between",
			marginTop: spacing.sm,
			padding: spacing.md,
		},
		rowIdentity: {
			flexShrink: 1,
		},
		section: {
			marginTop: spacing.xl,
		},
		title: {
			color: c.foreground,
			fontSize: typography.sizeMd,
			fontWeight: typography.weightBold,
		},
		type: {
			color: c.mutedForeground,
			fontSize: typography.sizeXs,
			marginTop: 2,
		},
	});
}
