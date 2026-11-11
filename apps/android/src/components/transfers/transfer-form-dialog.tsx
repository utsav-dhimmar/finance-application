import type {
	TransferFormInput,
	TransferFormValues,
	TransferResponse,
	UpdateTransferBody,
} from "@finance-application/schemas";
import { transferFormSchema } from "@finance-application/schemas";
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
import { useCreateTransfer, useUpdateTransfer } from "@/hooks/use-transfers";
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
import { uuidV7 } from "@/lib/uuid";
import { getTransfersErrorMessage } from "@/services/transfers-service";
import { hairline, spacing, type ThemeColors, typography } from "@/theme";
import { useThemeColors } from "@/use-theme-colors";

export interface TransferFormDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	transfer?: TransferResponse | null;
	display: CurrencyDisplayDefinition;
}

/**
 * Unified create/edit transfer dialog (one component, mode-switched like the
 * web's): amount, calendar date, source and destination accounts, and notes.
 * The shared transferFormSchema's source ≠ destination refinement surfaces
 * its message on the destination field — the rule lives in the schema, not
 * in ad-hoc UI logic.
 */
export function TransferFormDialog({
	open,
	onOpenChange,
	transfer = null,
	display,
}: TransferFormDialogProps) {
	const c = useThemeColors();
	const styles = createStyles(c);
	const isEdit = Boolean(transfer);
	const create = useCreateTransfer();
	const update = useUpdateTransfer();
	const accounts = useAccounts("active");

	const form = useForm<TransferFormInput, unknown, TransferFormValues>({
		resolver: zodResolver(transferFormSchema),
		defaultValues: {
			amount: "",
			date: todayString(),
			sourceAccountId: "",
			destinationAccountId: "",
			notes: "",
		},
	});

	const [datePickerOpen, setDatePickerOpen] = useState(false);

	useEffect(() => {
		if (open) {
			form.reset(
				transfer
					? {
							amount: minorToMajorInput(transfer.amountMinor, display),
							date: transfer.date,
							sourceAccountId: transfer.sourceAccountId,
							destinationAccountId: transfer.destinationAccountId,
							notes: transfer.notes ?? "",
						}
					: {
							amount: "",
							date: todayString(),
							sourceAccountId: "",
							destinationAccountId: "",
							notes: "",
						},
			);
			form.clearErrors("root");
		}
	}, [open, transfer, display, form]);

	function handleOpenChange(next: boolean): void {
		if (!next) {
			form.clearErrors("root");
		}
		onOpenChange(next);
	}

	const accountOptions = accounts.data?.accounts ?? [];

	// A side's own account stays selectable even when it is no longer active,
	// so a transfer touching an archived account remains editable.
	function sideOptions(ownId: string, ownName: string | null): SelectOption[] {
		const options: SelectOption[] = accountOptions.map((account) => ({
			value: account.id,
			label:
				account.status === "active"
					? account.name
					: `${account.name} (archived)`,
		}));
		if (ownId !== "" && !accountOptions.some((a) => a.id === ownId)) {
			options.unshift({
				value: ownId,
				label: `${ownName ?? "Unavailable"} (archived)`,
			});
		}
		return options;
	}

	const sourceOptions = sideOptions(
		transfer?.sourceAccountId ?? "",
		transfer?.sourceAccountName ?? null,
	);
	const destinationOptions = sideOptions(
		transfer?.destinationAccountId ?? "",
		transfer?.destinationAccountName ?? null,
	);

	const onSubmit = form.handleSubmit((values) => {
		form.clearErrors("root");
		if (transfer) {
			const body: UpdateTransferBody = {
				amountMinor: values.amount,
				date: values.date,
				sourceAccountId: values.sourceAccountId,
				destinationAccountId: values.destinationAccountId,
				notes: values.notes ? values.notes : null,
			};
			update.mutate(
				{ id: transfer.id, body },
				{
					onSuccess: () => {
						handleOpenChange(false);
					},
					onError: (error) => {
						form.setError("root", {
							message: getTransfersErrorMessage(
								error,
								"Could not save the transfer. Is the API running?",
							),
						});
					},
				},
			);
		} else {
			create.mutate(
				{
					id: uuidV7(),
					amountMinor: values.amount,
					date: values.date,
					sourceAccountId: values.sourceAccountId,
					destinationAccountId: values.destinationAccountId,
					notes: values.notes ? values.notes : undefined,
				},
				{
					onSuccess: () => {
						handleOpenChange(false);
					},
					onError: (error) => {
						form.setError("root", {
							message: getTransfersErrorMessage(
								error,
								"Could not record the transfer. Is the API running?",
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
							{isEdit ? "Edit transfer" : "New transfer"}
						</Text>
						<Text style={styles.description}>
							{isEdit
								? "Both sides are recalculated atomically."
								: `Move money between two different accounts. Amounts are in ${display.symbol}.`}
						</Text>
						{form.formState.errors.root?.message ? (
							<Text accessibilityRole="alert" style={styles.rootError}>
								{form.formState.errors.root.message}
							</Text>
						) : null}
						<ScrollView style={styles.scroll}>
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
											accessibilityLabel="Transfer date"
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
								name="sourceAccountId"
								render={({ field, fieldState }) => (
									<View style={styles.field}>
										<SelectField
											label="Source account"
											placeholder="Select source account"
											options={sourceOptions}
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
								name="destinationAccountId"
								render={({ field, fieldState }) => (
									<View style={styles.field}>
										<SelectField
											label="Destination account"
											placeholder="Select destination account"
											options={destinationOptions}
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
											: "Record transfer"}
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
	});
}
