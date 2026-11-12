import { StyleSheet, View } from "react-native";

import { SelectField } from "@/components/shared/select-field";
import type {
	TransactionsFilterAction,
	TransactionsFilterState,
} from "@/components/transactions/filter-state";
import { BoxyDateField, BoxyTextField } from "@/components/ui";
import { spacing, type ThemeColors } from "@/theme";
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
	const styles = createStyles(useThemeColors());

	const typeValue = state.type || ALL_TYPES;
	const accountValue = state.accountId || ALL_ACCOUNTS;
	const categoryValue = state.categoryId || ALL_CATEGORIES;

	return (
		<View style={styles.wrap}>
			<BoxyTextField
				label="Search transactions"
				placeholder="Search notes, account, category…"
				value={state.searchInput}
				onChangeText={(value) => {
					onAction({ type: "setSearchInput", value });
				}}
			/>
			<View style={styles.row}>
				<View style={styles.half}>
					<BoxyDateField
						label="From"
						placeholder="Any date"
						value={state.from || null}
						onChange={(next) => {
							onAction({ type: "setFrom", value: next ?? "" });
						}}
					/>
				</View>
				<View style={styles.half}>
					<BoxyDateField
						label="To"
						placeholder="Any date"
						value={state.to || null}
						onChange={(next) => {
							onAction({ type: "setTo", value: next ?? "" });
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
		</View>
	);
}

function createStyles(_c: ThemeColors) {
	return StyleSheet.create({
		half: {
			flex: 1,
		},
		row: {
			flexDirection: "row",
			gap: spacing.sm,
			marginTop: spacing.sm,
		},
		wrap: {
			marginTop: spacing.lg,
		},
	});
}
