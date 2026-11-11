import type {
	AccountResponse,
	CategoryResponse,
	TransactionFormInput,
	TransactionFormValues,
	TransactionResponse,
	UpdateTransactionBody,
} from "@finance-application/schemas";
import { transactionFormSchema } from "@finance-application/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
	KeyboardAvoidingView,
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";

import {
	SelectField,
	type SelectOption,
} from "@/components/shared/select-field";
import { useAccounts } from "@/hooks/use-accounts";
import { useCategories } from "@/hooks/use-categories";
import {
	useCreateTransaction,
	useUpdateTransaction,
} from "@/hooks/use-transactions";
import {
	calendarDateString,
	calendarDateValue,
	todayString,
} from "@/lib/calendar-date";
import {
	minorToMajorInput,
	type CurrencyDisplayDefinition,
	tabularNums,
} from "@/lib/format";
import { TRANSACTION_TYPE_LABELS } from "@/lib/transaction-labels";
import { uuidV7 } from "@/lib/uuid";
import { getTransactionsErrorMessage } from "@/services/transactions-service";
import { hairline, spacing, type ThemeColors, typography } from "@/theme";
import { useThemeColors } from "@/use-theme-colors";

const TRANSACTION_TYPE_OPTIONS = (
	Object.keys(TRANSACTION_TYPE_LABELS) as Array<
		keyof typeof TRANSACTION_TYPE_LABELS
	>
).map((type) => ({ value: type, label: TRANSACTION_TYPE_LABELS[type] }));

export interface TransactionFormDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	transaction?: TransactionResponse | null;
	display: CurrencyDisplayDefinition;
}

/**
 * Unified create/edit transaction dialog (one component, mode-switched like
 * the web's): type, amount, calendar date, account, category, and notes —
 * all validated against the shared transactionFormSchema before submission.
 * The account and category selects are fed by the account/category queries;
 * the category options follow the selected type, and picking a type clears
 * the chosen category (web parity).
 */
export function TransactionFormDialog({
	open,
	onOpenChange,
	transaction = null,
	display,
}: TransactionFormDialogProps) {
	const c = useThemeColors();
	const styles = createStyles(c);
	const isEdit = Boolean(transaction);
	const create = useCreateTransaction();
	const update = useUpdateTransaction();
	const accounts = useAccounts("active");
	const categories = useCategories("active");

	// Form state is the schema's input type; submitted values are its parsed
	// output type — the same useForm<Input, unknown, Output> shape the web uses.
	const form = useForm<TransactionFormInput, unknown, TransactionFormValues>({
		resolver: zodResolver(transactionFormSchema),
		defaultValues: {
			type: "expense",
			amount: "",
			date: todayString(),
			accountId: "",
			categoryId: "",
			notes: "",
		},
	});

	const selectedType = form.watch("type");
	const selectedAccountId = form.watch("accountId");
	const [datePickerOpen, setDatePickerOpen] = useState(false);

	useEffect(() => {
		if (open) {
			form.reset(
				transaction
					? {
							type: transaction.type,
							amount: minorToMajorInput(transaction.amountMinor, display),
							date: transaction.date,
							accountId: transaction.accountId,
							categoryId: transaction.categoryId,
							notes: transaction.notes ?? "",
						}
					: {
							type: "expense",
							amount: "",
							date: todayString(),
							accountId: "",
							categoryId: "",
							notes: "",
						},
			);
			form.clearErrors("root");
		}
	}, [open, transaction, display, form]);

	function handleOpenChange(next: boolean): void {
		if (!next) {
			form.clearErrors("root");
		}
		onOpenChange(next);
	}

	const accountOptions: AccountResponse[] = accounts.data?.accounts ?? [];
	// The transaction's own account stays selectable even when it is no
	// longer active, so an archived-account transaction remains editable.
	const accountSelectOptions: SelectOption[] = accountOptions.map(
		(account) => ({
			value: account.id,
			label:
				account.status === "active"
					? account.name
					: `${account.name} (archived)`,
		}),
	);
	if (
		transaction &&
		!accountOptions.some((a) => a.id === transaction.accountId)
	) {
		accountSelectOptions.unshift({
			value: transaction.accountId,
			label: `${transaction.accountName ?? "Unavailable"} (archived)`,
		});
	}

	const categoryOptions: CategoryResponse[] = (
		categories.data?.categories ?? []
	).filter((category) => category.type === selectedType);

	const chosenAccount = accountOptions.find(
		(account) => account.id === selectedAccountId,
	);

	const onSubmit = form.handleSubmit((values) => {
		form.clearErrors("root");
		if (transaction) {
			const body: UpdateTransactionBody = {
				amountMinor: values.amount,
				date: values.date,
				accountId: values.accountId,
				categoryId: values.categoryId,
				notes: values.notes ? values.notes : null,
			};
			update.mutate(
				{ id: transaction.id, body },
				{
					onSuccess: () => {
						handleOpenChange(false);
					},
					onError: (error) => {
						form.setError("root", {
							message: getTransactionsErrorMessage(
								error,
								"Could not save the transaction. Is the API running?",
							),
						});
					},
				},
			);
		} else {
			create.mutate(
				{
					id: uuidV7(),
					type: values.type,
					amountMinor: values.amount,
					date: values.date,
					accountId: values.accountId,
					categoryId: values.categoryId,
					notes: values.notes ? values.notes : undefined,
				},
				{
					onSuccess: () => {
						handleOpenChange(false);
					},
					onError: (error) => {
						form.setError("root", {
							message: getTransactionsErrorMessage(
								error,
								"Could not record the transaction. Is the API running?",
							),
						});
					},
				},
			);
		}
	});

	const isPending = isEdit ? update.isPending : create.isPending;

	return (
		<Modal
			visible={open}
			transparent
			animationType="fade"
			onRequestClose={() => {
				handleOpenChange(false);
			}}
		>
			<View style={styles.backdrop}>
				<KeyboardAvoidingView behavior="padding">
					<View style={[styles.card, hairline(c.border)]}>
						<Text style={styles.title}>
							{isEdit ? "Edit transaction" : "Record transaction"}
						</Text>
						<Text style={styles.description}>
							{isEdit
								? "Amounts, date, account, and category are recalculated atomically."
								: `Track income or expenses. Amounts are in ${display.symbol}.`}
						</Text>
						{form.formState.errors.root?.message ? (
							<Text accessibilityRole="alert" style={styles.rootError}>
								{form.formState.errors.root.message}
							</Text>
						) : null}
						<ScrollView style={styles.scroll}>
							<View style={styles.field}>
								<Text style={styles.label}>Type</Text>
								<View style={styles.typeRow}>
									{TRANSACTION_TYPE_OPTIONS.map((option) => {
										const checked = form.watch("type") === option.value;
										return (
											<Pressable
												key={option.value}
												accessibilityLabel={option.label}
												accessibilityRole="radio"
												accessibilityState={{ checked }}
												onPress={() => {
													form.setValue("type", option.value);
													// A different type invalidates the chosen category.
													form.setValue("categoryId", "");
												}}
												style={[
													styles.typeOption,
													hairline(c.border),
													checked && styles.typeOptionActive,
												]}
											>
												<Text
													style={[
														styles.typeOptionText,
														checked && styles.typeOptionTextActive,
													]}
												>
													{option.label}
												</Text>
											</Pressable>
										);
									})}
								</View>
							</View>
							<Controller
								control={form.control}
								name="amount"
								render={({ field, fieldState }) => (
									<View style={styles.field}>
										<Text style={styles.label}>Amount ({display.symbol})</Text>
										<TextInput
											accessibilityLabel={`Amount (${display.symbol})`}
											autoCapitalize="none"
											inputMode="decimal"
											onChangeText={field.onChange}
											placeholder={isEdit ? undefined : "0.00"}
											style={[styles.input, tabularNums]}
											value={field.value}
										/>
										{fieldState.error ? (
											<Text style={styles.error}>
												{fieldState.error.message}
											</Text>
										) : null}
									</View>
								)}
							/>
							<Controller
								control={form.control}
								name="date"
								render={({ field, fieldState }) => (
									<View style={styles.field}>
										<Text style={styles.label}>Date</Text>
										<Pressable
											accessibilityLabel="Transaction date"
											accessibilityRole="button"
											onPress={() => {
												setDatePickerOpen(true);
											}}
											style={({ pressed }) => [
												styles.input,
												pressed && styles.pressed,
											]}
										>
											<Text style={styles.dateText}>{field.value}</Text>
										</Pressable>
										{fieldState.error ? (
											<Text style={styles.error}>
												{fieldState.error.message}
											</Text>
										) : null}
										{datePickerOpen ? (
											<DateTimePicker
												mode="date"
												onChange={(_, selected) => {
													setDatePickerOpen(false);
													if (selected) {
														field.onChange(calendarDateString(selected));
													}
												}}
												value={calendarDateValue(field.value) ?? new Date()}
											/>
										) : null}
									</View>
								)}
							/>
							<Controller
								control={form.control}
								name="accountId"
								render={({ field, fieldState }) => (
									<View style={styles.field}>
										<SelectField
											label="Account"
											placeholder="Select account"
											options={accountSelectOptions}
											value={field.value}
											onValueChange={field.onChange}
										/>
										{fieldState.error ? (
											<Text style={styles.error}>
												{fieldState.error.message}
											</Text>
										) : chosenAccount ? (
											<Text style={styles.helper}>
												Current balance:{" "}
												{minorToMajorInput(
													chosenAccount.currentBalanceMinor,
													display,
												)}
											</Text>
										) : null}
									</View>
								)}
							/>
							<Controller
								control={form.control}
								name="categoryId"
								render={({ field, fieldState }) => (
									<View style={styles.field}>
										<SelectField
											label="Category"
											placeholder="Select category"
											options={categoryOptions.map((category) => ({
												value: category.id,
												label: category.name,
											}))}
											value={field.value}
											onValueChange={field.onChange}
										/>
										{fieldState.error ? (
											<Text style={styles.error}>
												{fieldState.error.message}
											</Text>
										) : null}
									</View>
								)}
							/>
							<Controller
								control={form.control}
								name="notes"
								render={({ field, fieldState }) => (
									<View style={styles.field}>
										<Text style={styles.label}>Notes (optional)</Text>
										<TextInput
											accessibilityLabel="Notes"
											autoCapitalize="none"
											autoComplete="off"
											onChangeText={field.onChange}
											placeholder={
												isEdit ? undefined : "Optional context or vendor name"
											}
											style={styles.input}
											value={field.value ?? ""}
										/>
										{fieldState.error ? (
											<Text style={styles.error}>
												{fieldState.error.message}
											</Text>
										) : null}
									</View>
								)}
							/>
						</ScrollView>
						<View style={styles.footer}>
							<Pressable
								accessibilityRole="button"
								onPress={() => {
									handleOpenChange(false);
								}}
								style={({ pressed }) => [
									styles.footerButton,
									hairline(c.border),
									pressed && styles.pressed,
								]}
							>
								<Text style={styles.cancelText}>Cancel</Text>
							</Pressable>
							<Pressable
								accessibilityRole="button"
								disabled={isPending}
								onPress={() => {
									void onSubmit();
								}}
								style={({ pressed }) => [
									styles.footerButton,
									styles.submitButton,
									isPending && styles.disabled,
									pressed && !isPending && styles.pressed,
								]}
							>
								<Text style={styles.submitText}>
									{isPending
										? isEdit
											? "Saving..."
											: "Recording..."
										: isEdit
											? "Save changes"
											: "Record transaction"}
								</Text>
							</Pressable>
						</View>
					</View>
				</KeyboardAvoidingView>
			</View>
		</Modal>
	);
}

function createStyles(c: ThemeColors) {
	return StyleSheet.create({
		backdrop: {
			backgroundColor: "#00000080",
			flex: 1,
			justifyContent: "center",
			padding: spacing.lg,
		},
		cancelText: {
			color: c.foreground,
			fontSize: typography.sizeSm,
			fontWeight: typography.weightMedium,
		},
		card: {
			backgroundColor: c.background,
			padding: spacing.lg,
		},
		dateText: {
			color: c.foreground,
			fontSize: typography.sizeMd,
		},
		description: {
			color: c.mutedForeground,
			fontSize: typography.sizeSm,
			marginTop: spacing.xs,
		},
		disabled: {
			opacity: 0.5,
		},
		error: {
			color: c.destructive,
			fontSize: typography.sizeXs,
			marginTop: spacing.xs,
		},
		field: {
			marginTop: spacing.lg,
		},
		footer: {
			flexDirection: "row",
			justifyContent: "flex-end",
			marginTop: spacing.lg,
		},
		footerButton: {
			alignItems: "center",
			borderRadius: 0,
			padding: spacing.md,
		},
		helper: {
			color: c.mutedForeground,
			fontSize: typography.sizeXs,
			marginTop: spacing.xs,
		},
		input: {
			...hairline(c.border),
			color: c.foreground,
			fontSize: typography.sizeMd,
			marginTop: spacing.xs,
			padding: spacing.md,
		},
		label: {
			color: c.mutedForeground,
			fontSize: typography.sizeXs,
			textTransform: "uppercase",
		},
		pressed: {
			opacity: 0.9,
		},
		rootError: {
			color: c.destructive,
			fontSize: typography.sizeSm,
			marginTop: spacing.md,
		},
		scroll: {
			// Keep long forms scrollable inside the modal.
			flexGrow: 0,
		},
		submitButton: {
			backgroundColor: c.primary,
			marginLeft: spacing.sm,
		},
		submitText: {
			color: c.primaryForeground,
			fontSize: typography.sizeSm,
			fontWeight: typography.weightMedium,
		},
		title: {
			color: c.foreground,
			fontSize: typography.sizeLg,
			fontWeight: typography.weightBold,
		},
		typeOption: {
			alignItems: "center",
			borderRadius: 0,
			flex: 1,
			padding: spacing.md,
		},
		typeOptionActive: {
			backgroundColor: c.primary,
			borderColor: c.primary,
		},
		typeOptionText: {
			color: c.foreground,
			fontSize: typography.sizeSm,
		},
		typeOptionTextActive: {
			color: c.primaryForeground,
			fontWeight: typography.weightMedium,
		},
		typeRow: {
			flexDirection: "row",
			gap: spacing.sm,
			marginTop: spacing.xs,
		},
	});
}
