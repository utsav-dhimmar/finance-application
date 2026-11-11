import type { CategoryBreakdownItem } from "@finance-application/schemas";
import { StyleSheet, Text, View } from "react-native";

import type { CurrencyDisplayDefinition } from "@/lib/format";
import { formatMinorUnits, tabularNums } from "@/lib/format";
import { spacing, type ThemeColors, typography } from "@/theme";
import { useThemeColors } from "@/use-theme-colors";

export interface CategoryBreakdownProps {
	breakdown: CategoryBreakdownItem[];
	display: CurrencyDisplayDefinition;
	periodLabelText: string;
}

// The web chart's fallback for a permanently deleted category row.
const DELETED_CATEGORY_LABEL = "Unavailable";

/**
 * The StyleSheet substitute for the web's expenses-by-category chart: one
 * row per category, largest total first (the API's order), each with its
 * formatted amount and a bar whose width is the category's clamped share of
 * the period's expenses. No chart library — a track view and a percentage
 * fill view in the boxy theme.
 */
export function CategoryBreakdown({
	breakdown,
	display,
	periodLabelText,
}: CategoryBreakdownProps) {
	const c = useThemeColors();
	const styles = createStyles(c);
	return (
		<View style={styles.section}>
			<Text style={styles.title}>Expenses by category</Text>
			<Text style={styles.note}>
				Category shares of expenses in {periodLabelText}
			</Text>
			{breakdown.map((item) => {
				// A display ratio, not money: clamp to 0–100 so a pathological
				// share can never push the bar past its track.
				const share = Math.min(100, Math.max(0, item.sharePercent));
				return (
					<View key={item.categoryId} style={styles.row}>
						<View style={styles.rowHeader}>
							<Text numberOfLines={1} style={styles.name}>
								{item.categoryName ?? DELETED_CATEGORY_LABEL}
							</Text>
							<Text style={[styles.amount, tabularNums]}>
								{formatMinorUnits(item.amountMinor, display)}
							</Text>
						</View>
						<View style={styles.track}>
							<View
								testID={`breakdown-fill-${item.categoryId}`}
								style={[styles.fill, { width: `${share}%` }]}
							/>
						</View>
					</View>
				);
			})}
		</View>
	);
}

function createStyles(c: ThemeColors) {
	return StyleSheet.create({
		amount: {
			color: c.foreground,
			fontSize: typography.sizeSm,
			fontWeight: typography.weightMedium,
		},
		fill: {
			backgroundColor: c.primary,
			borderRadius: 0,
			height: "100%",
		},
		name: {
			color: c.foreground,
			flexShrink: 1,
			fontSize: typography.sizeSm,
			fontWeight: typography.weightMedium,
		},
		note: {
			color: c.mutedForeground,
			fontSize: typography.sizeXs,
			marginTop: 2,
		},
		row: {
			marginTop: spacing.lg,
		},
		rowHeader: {
			alignItems: "center",
			flexDirection: "row",
			gap: spacing.md,
			justifyContent: "space-between",
		},
		section: {
			marginTop: spacing.xl,
		},
		title: {
			color: c.foreground,
			fontSize: typography.sizeMd,
			fontWeight: typography.weightBold,
		},
		track: {
			backgroundColor: c.muted,
			borderRadius: 0,
			height: 8,
			marginTop: spacing.xs,
		},
	});
}
