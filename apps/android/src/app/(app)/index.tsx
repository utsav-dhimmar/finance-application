import type { PeriodMode } from "@/components/dashboard/period";
import {
	currentMonthValue,
	currentYearValue,
	monthOptions,
	periodFromForm,
	periodLabel,
	yearOptions,
} from "@/components/dashboard/period";
import { AccountBalances } from "@/components/dashboard/account-balances";
import { CategoryBreakdown } from "@/components/dashboard/category-breakdown";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { SelectField } from "@/components/shared/select-field";
import { BoxyButton, BoxySegmentedRow } from "@/components/ui";
import { usePreferences } from "@/hooks/use-preferences";
import { useReportSummary } from "@/hooks/use-report-summary";
import { INR_DISPLAY, preferencesToDisplay } from "@/lib/format";
import { getReportsErrorMessage } from "@/services/reports-service";
import { hairline, spacing, type ThemeColors, typography } from "@/theme";
import { useThemeColors } from "@/use-theme-colors";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useState } from "react";

// The period state mirrors the web reducer: mode + month/year values, with
// the device's local clock picking the default current month.
export default function DashboardScreen() {
	const c = useThemeColors();
	const styles = createStyles(c);
	const [mode, setMode] = useState<PeriodMode>("month");
	const [monthValue, setMonthValue] = useState(currentMonthValue());
	const [yearValue, setYearValue] = useState(currentYearValue());
	const period = periodFromForm(mode, monthValue, yearValue);
	const report = useReportSummary(period);
	const preferences = usePreferences();
	const display = preferences.data
		? preferencesToDisplay(preferences.data)
		: INR_DISPLAY;

	const data = report.data;
	const periodLabelText = periodLabel(period);
	const hasAccounts = (data?.accounts.length ?? 0) > 0;

	return (
		<ScrollView contentContainerStyle={styles.content} style={styles.screen}>
			<Text style={styles.pageTitle}>Dashboard</Text>

			{/* Period selection: mode switch + month/year select */}
			<View style={[styles.modeRow, hairline(c.border)]}>
				<BoxySegmentedRow
					options={[
						{ value: "month", label: "Month" },
						{ value: "year", label: "Year" },
					]}
					value={mode}
					onValueChange={(next) => {
						setMode(next as PeriodMode);
					}}
				/>
			</View>
			{mode === "month" ? (
				<SelectField
					label="Month"
					options={monthOptions(yearValue)}
					value={monthValue}
					onValueChange={setMonthValue}
				/>
			) : (
				<SelectField
					label="Year"
					options={yearOptions()}
					value={yearValue}
					onValueChange={setYearValue}
				/>
			)}
			<Text style={styles.showing}>
				{"Showing "}
				<Text style={styles.showingPeriod}>{periodLabelText}</Text>
			</Text>

			{/* Error with retry */}
			{report.isError ? (
				<View
					accessibilityRole="alert"
					style={[styles.stateBox, hairline(c.border)]}
				>
					<Text style={styles.errorText}>
						{getReportsErrorMessage(
							report.error,
							"Could not load the report for this period.",
						)}
					</Text>
					<BoxyButton
						label="Retry"
						variant="outline"
						onPress={() => {
							void report.refetch();
						}}
					/>
				</View>
			) : null}

			{/* Summary cards */}
			{report.isPending ? (
				<View style={[styles.stateBox, hairline(c.border)]}>
					<Text style={styles.loadingText}>Loading...</Text>
				</View>
			) : data ? (
				<SummaryCards
					display={display}
					expenseMinor={data.expenseMinor}
					incomeMinor={data.incomeMinor}
					netCashFlowMinor={data.netCashFlowMinor}
					periodLabelText={periodLabelText}
				/>
			) : null}

			{/* Onboarding empty state when no accounts exist */}
			{data && !hasAccounts ? (
				<View style={[styles.stateBox, hairline(c.border)]}>
					<Text style={styles.emptyTitle}>No accounts added yet</Text>
					<Text style={styles.emptyNote}>
						Create your first checking, savings, credit, or cash account to
						begin tracking balances and reports.
					</Text>
				</View>
			) : null}

			{/* Expense breakdown bar list */}
			{data && data.categoryBreakdown.length > 0 ? (
				<CategoryBreakdown
					breakdown={data.categoryBreakdown}
					display={display}
					periodLabelText={periodLabelText}
				/>
			) : null}

			{/* Account balances: the section always renders when the summary is
			loaded — with a zero combined balance and no rows when the user has
			no active accounts (the android-ui spec's no-accounts scenario). */}
			{data ? (
				<AccountBalances
					accounts={data.accounts}
					combinedBalanceMinor={data.combinedBalanceMinor}
					display={display}
				/>
			) : null}
		</ScrollView>
	);
}

function createStyles(c: ThemeColors) {
	return StyleSheet.create({
		content: {
			padding: spacing.lg,
		},
		emptyNote: {
			color: c.mutedForeground,
			fontSize: typography.sizeXs,
			marginTop: spacing.xs,
			textAlign: "center",
		},
		emptyTitle: {
			color: c.foreground,
			fontSize: typography.sizeSm,
			fontWeight: typography.weightBold,
		},
		errorText: {
			color: c.destructive,
			fontSize: typography.sizeSm,
			fontWeight: typography.weightMedium,
		},
		loadingText: {
			color: c.mutedForeground,
			fontSize: typography.sizeSm,
		},
		modeRow: {
			flexDirection: "row",
			marginTop: spacing.lg,
		},
		pageTitle: {
			color: c.foreground,
			fontSize: typography.sizeXl,
			fontWeight: typography.weightBold,
		},
		screen: {
			backgroundColor: c.background,
			flex: 1,
		},
		showing: {
			color: c.mutedForeground,
			fontSize: typography.sizeSm,
			marginTop: spacing.md,
		},
		showingPeriod: {
			color: c.foreground,
			fontWeight: typography.weightMedium,
		},
		stateBox: {
			alignItems: "center",
			marginTop: spacing.lg,
			padding: spacing.lg,
		},
	});
}
