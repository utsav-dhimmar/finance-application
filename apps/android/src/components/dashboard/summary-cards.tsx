import { StyleSheet, Text, View } from "react-native";

import type { CurrencyDisplayDefinition } from "@/lib/format";
import { formatMinorUnits, tabularNums } from "@/lib/format";
import { hairline, spacing, type ThemeColors, typography } from "@/theme";
import { useThemeColors } from "@/use-theme-colors";

export interface SummaryCardsProps {
	incomeMinor: number;
	expenseMinor: number;
	netCashFlowMinor: number;
	display: CurrencyDisplayDefinition;
	periodLabelText: string;
}

/**
 * The period's income, expenses, and net cash flow cards, with the web's
 * copy ("Received during …", "Spent during …", "Income minus expenses") and
 * its negative-net treatment: the figure keeps the formatter's leading sign
 * and renders in the destructive color when expenses exceed income.
 */
export function SummaryCards({
	incomeMinor,
	expenseMinor,
	netCashFlowMinor,
	display,
	periodLabelText,
}: SummaryCardsProps) {
	const c = useThemeColors();
	const styles = createStyles(c);
	const netNegative = netCashFlowMinor < 0;
	return (
		<View style={styles.row}>
			<View style={[styles.card, hairline(c.border)]}>
				<Text style={styles.cardLabel}>Income</Text>
				<Text style={[styles.amount, tabularNums]}>
					{formatMinorUnits(incomeMinor, display)}
				</Text>
				<Text style={styles.cardNote}>Received during {periodLabelText}</Text>
			</View>
			<View style={[styles.card, hairline(c.border)]}>
				<Text style={styles.cardLabel}>Expenses</Text>
				<Text style={[styles.amount, tabularNums]}>
					{formatMinorUnits(expenseMinor, display)}
				</Text>
				<Text style={styles.cardNote}>Spent during {periodLabelText}</Text>
			</View>
			<View style={[styles.card, hairline(c.border)]}>
				<Text style={styles.cardLabel}>Net cash flow</Text>
				<Text
					style={[
						styles.amount,
						tabularNums,
						netNegative && styles.netNegative,
					]}
				>
					{formatMinorUnits(netCashFlowMinor, display)}
				</Text>
				<Text style={styles.cardNote}>Income minus expenses</Text>
			</View>
		</View>
	);
}

function createStyles(c: ThemeColors) {
	return StyleSheet.create({
		amount: {
			color: c.foreground,
			fontSize: typography.sizeXl,
			fontWeight: typography.weightBold,
			marginTop: spacing.sm,
		},
		card: {
			backgroundColor: c.background,
			flex: 1,
			padding: spacing.lg,
		},
		cardLabel: {
			color: c.mutedForeground,
			fontSize: typography.sizeXs,
			fontWeight: typography.weightMedium,
			letterSpacing: 1,
			textTransform: "uppercase",
		},
		cardNote: {
			color: c.mutedForeground,
			fontSize: typography.sizeXs,
			marginTop: spacing.xs,
		},
		netNegative: {
			color: c.destructive,
		},
		row: {
			flexDirection: "row",
			gap: spacing.md,
		},
	});
}
