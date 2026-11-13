import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { SelectField } from "@/components/shared/select-field";
import type {
	TransactionsFilterAction,
	TransactionsFilterState,
} from "@/components/transactions/filter-state";
import { calendarDateString, calendarDateValue } from "@/lib/calendar-date";
import { hairline, spacing, type ThemeColors, typography } from "@/theme";
import { useThemeColors } from "@/use-theme-colors";

// The "all" sentinels keep the select values non-empty; the reducer stores
// "" for "no filter", so the option values map back like the web's.
const ALL_TYPES = "all-types";
const ALL_ACCOUNTS = "all-accounts";
const ALL_CATEGORIES = "all-categories";

const TYPE_OPTIONS = [
	{ value: ALL_TYPES, label: "All types" },
	{ value: "income", label: "Income" },
	{ value: "expense", label: "Expense" },
	{ value: "transfer", label: "Transfers" },
];

export interface ActivityFiltersProps {
	state: Pick<
		TransactionsFilterState,
		"type" | "accountId" | "categoryId" | "from" | "to" | "searchInput"
	>;
	accounts: Array<{ id: string; name: string }>;
	categories: Array<{ id: string; name: string }>;
	onAction: (action: TransactionsFilterAction) => void;
}

/**
 * The activity filter row: debounced search, from/to date pickers
 * (string YYYY-MM-DD in state — the picker's value derives from the string
 * and is written back as a string), and the type/account/category selects.
 * The type change clears the category through the reducer, mirroring the
 * web's rule that transfers carry no category.
 */
export function ActivityFilters({
	state,
	accounts,
	categories,
	onAction,
}: ActivityFiltersProps) {
	const c = useThemeColors();
	const styles = createStyles(c);
	const [pickerField, setPickerField] = useState<"from" | "to" | null>(null);

	const typeValue = state.type || ALL_TYPES;
	const accountValue = state.accountId || ALL_ACCOUNTS;
	const categoryValue = state.categoryId || ALL_CATEGORIES;

	return (
		<View style={styles.wrap}>
			<TextInput
				accessibilityLabel="Search transactions"
				autoCapitalize="none"
				placeholder="Search notes, account, category…"
				placeholderTextColor={c.mutedForeground}
				onChangeText={(value) => {
					onAction({ type: "setSearchInput", value });
				}}
				style={[styles.search, hairline(c.border)]}
				value={state.searchInput}
			/>
			<View style={styles.row}>
				<View style={styles.half}>
					<Text style={styles.label}>From</Text>
					<PressableDate
						label="From date"
						value={state.from}
						placeholder="Any date"
						onPress={() => {
							setPickerField("from");
						}}
					/>
				</View>
				<View style={styles.half}>
					<Text style={styles.label}>To</Text>
					<PressableDate
						label="To date"
						value={state.to}
						placeholder="Any date"
						onPress={() => {
							setPickerField("to");
						}}
					/>
				</View>
			</View>
			<View style={styles.row}>
				<SelectField
					label="Type filter"
					options={TYPE_OPTIONS}
					value={typeValue}
					onValueChange={(next) => {
						onAction({
							type: "setType",
							value: next === ALL_TYPES ? "" : next,
						});
					}}
				/>
			</View>
			<View style={styles.row}>
				<SelectField
					label="Account filter"
					placeholder="All accounts"
					options={[
						{ value: ALL_ACCOUNTS, label: "All accounts" },
						...accounts.map((account) => ({
							value: account.id,
							label: account.name,
						})),
					]}
					value={accountValue}
					onValueChange={(next) => {
						onAction({
							type: "setAccount",
							value: next === ALL_ACCOUNTS ? "" : next,
						});
					}}
				/>
			</View>
			<View style={styles.row}>
				<SelectField
					label="Category filter"
					placeholder="All categories"
					options={[
						{ value: ALL_CATEGORIES, label: "All categories" },
						...categories.map((category) => ({
							value: category.id,
							label: category.name,
						})),
					]}
					value={categoryValue}
					onValueChange={(next) => {
						onAction({
							type: "setCategory",
							value: next === ALL_CATEGORIES ? "" : next,
						});
					}}
				/>
			</View>
			{pickerField !== null ? (
				<DateTimePicker
					mode="date"
					onChange={(_, selected) => {
						setPickerField(null);
						if (selected) {
							onAction({
								type: pickerField === "from" ? "setFrom" : "setTo",
								value: calendarDateString(selected),
							});
						}
					}}
					value={
						calendarDateValue(pickerField === "from" ? state.from : state.to) ??
						new Date()
					}
				/>
			) : null}
		</View>
	);
}

function PressableDate({
	label,
	value,
	placeholder,
	onPress,
}: {
	label: string;
	value: string;
	placeholder: string;
	onPress: () => void;
}) {
	const c = useThemeColors();
	const styles = createStyles(c);
	return (
		<Pressable
			accessibilityLabel={label}
			accessibilityRole="button"
			onPress={onPress}
			style={({ pressed }) => [
				styles.dateField,
				hairline(c.border),
				pressed && styles.pressed,
			]}
		>
			<Text
				style={[styles.dateText, !value && styles.placeholderText]}
				numberOfLines={1}
			>
				{value || placeholder}
			</Text>
		</Pressable>
	);
}

function createStyles(c: ThemeColors) {
	return StyleSheet.create({
		dateField: {
			borderRadius: 0,
			marginTop: spacing.xs,
			padding: spacing.md,
		},
		dateText: {
			color: c.foreground,
			fontSize: typography.sizeMd,
		},
		half: {
			flex: 1,
		},
		label: {
			color: c.mutedForeground,
			fontSize: typography.sizeXs,
			textTransform: "uppercase",
		},
		placeholderText: {
			color: c.mutedForeground,
		},
		pressed: {
			opacity: 0.9,
		},
		row: {
			flexDirection: "row",
			gap: spacing.sm,
			marginTop: spacing.sm,
		},
		search: {
			borderRadius: 0,
			color: c.foreground,
			fontSize: typography.sizeMd,
			padding: spacing.md,
		},
		wrap: {
			marginTop: spacing.lg,
		},
	});
}
