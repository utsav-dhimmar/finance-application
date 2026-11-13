import {
	accountFormSchema,
	type AccountFormInput,
	type AccountFormValues,
	type AccountResponse,
} from "@finance-application/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import {
	KeyboardAvoidingView,
	Modal,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";

import { useCreateAccount, useUpdateAccount } from "@/hooks/use-accounts";
import { ACCOUNT_TYPE_LABELS } from "@/lib/account-labels";
import {
	minorToMajorInput,
	type CurrencyDisplayDefinition,
	tabularNums,
} from "@/lib/format";
import { getAccountsErrorMessage } from "@/services/accounts-service";
import { hairline, spacing, type ThemeColors, typography } from "@/theme";
import { useThemeColors } from "@/use-theme-colors";

const ACCOUNT_TYPE_OPTIONS = (
	Object.keys(ACCOUNT_TYPE_LABELS) as Array<keyof typeof ACCOUNT_TYPE_LABELS>
).map((type) => ({ value: type, label: ACCOUNT_TYPE_LABELS[type] }));

export interface AccountFormDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	account?: AccountResponse | null;
	display: CurrencyDisplayDefinition;
}

/**
 * Unified create/edit account dialog (one component, mode-switched like the
 * web's dialog): the name and opening balance are text inputs, the type is a
 * segmented radio row, and everything validates against the shared
 * accountFormSchema before submission.
 */
export function AccountFormDialog({
	open,
	onOpenChange,
	account = null,
	display,
}: AccountFormDialogProps) {
	const c = useThemeColors();
	const styles = createStyles(c);
	const isEdit = Boolean(account);
	const create = useCreateAccount();
	const update = useUpdateAccount();

	// Form state is the schema's input type; submitted values are its parsed
	// output type — the same useForm<Input, unknown, Output> shape the web uses.
	const form = useForm<AccountFormInput, unknown, AccountFormValues>({
		resolver: zodResolver(accountFormSchema),
		defaultValues: { name: "", type: "cash", openingBalance: "" },
	});

	useEffect(() => {
		if (open) {
			form.reset(
				account
					? {
							name: account.name,
							type: account.type,
							openingBalance: minorToMajorInput(
								account.openingBalanceMinor,
								display,
							),
						}
					: { name: "", type: "cash", openingBalance: "" },
			);
			form.clearErrors("root");
		}
	}, [open, account, display, form]);

	function handleOpenChange(next: boolean): void {
		if (!next) {
			form.clearErrors("root");
		}
		onOpenChange(next);
	}

	const onSubmit = form.handleSubmit((values) => {
		form.clearErrors("root");
		if (account) {
			update.mutate(
				{
					id: account.id,
					body: {
						name: values.name,
						type: values.type,
						openingBalanceMinor: values.openingBalance,
					},
				},
				{
					onSuccess: () => {
						handleOpenChange(false);
					},
					onError: (error) => {
						form.setError("root", {
							message: getAccountsErrorMessage(
								error,
								"Could not save the account. Is the API running?",
							),
						});
					},
				},
			);
		} else {
			create.mutate(
				{
					name: values.name,
					type: values.type,
					openingBalanceMinor: values.openingBalance,
				},
				{
					onSuccess: () => {
						handleOpenChange(false);
					},
					onError: (error) => {
						form.setError("root", {
							message: getAccountsErrorMessage(
								error,
								"Could not create the account. Is the API running?",
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
							{isEdit && account ? `Edit "${account.name}"` : "Add account"}
						</Text>
						<Text style={styles.description}>
							{isEdit
								? "Opening balance and type lock once the account has transactions."
								: `Track money held in one place. Amounts are in ${display.symbol}.`}
						</Text>
						{form.formState.errors.root?.message ? (
							<Text accessibilityRole="alert" style={styles.rootError}>
								{form.formState.errors.root.message}
							</Text>
						) : null}
						<Controller
							control={form.control}
							name="name"
							render={({ field, fieldState }) => (
								<View style={styles.field}>
									<Text style={styles.label}>Name</Text>
									<TextInput
										accessibilityLabel="Account name"
										autoCapitalize="none"
										autoComplete="off"
										onChangeText={field.onChange}
										placeholder={isEdit ? undefined : "HDFC Bank"}
										style={styles.input}
										value={field.value}
									/>
									{fieldState.error ? (
										<Text style={styles.error}>{fieldState.error.message}</Text>
									) : null}
								</View>
							)}
						/>
						<Controller
							control={form.control}
							name="type"
							render={({ field }) => (
								<View style={styles.field}>
									<Text style={styles.label}>Type</Text>
									<View style={styles.typeRow}>
										{ACCOUNT_TYPE_OPTIONS.map((option) => {
											const checked = field.value === option.value;
											return (
												<Pressable
													key={option.value}
													accessibilityLabel={option.label}
													accessibilityRole="radio"
													accessibilityState={{ checked }}
													onPress={() => {
														field.onChange(option.value);
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
							)}
						/>
						<Controller
							control={form.control}
							name="openingBalance"
							render={({ field, fieldState }) => (
								<View style={styles.field}>
									<Text style={styles.label}>
										Opening balance ({display.symbol})
									</Text>
									<TextInput
										accessibilityLabel={`Opening balance (${display.symbol})`}
										autoCapitalize="none"
										inputMode="decimal"
										onChangeText={field.onChange}
										placeholder={isEdit ? undefined : "0.00"}
										style={[styles.input, tabularNums]}
										value={field.value}
									/>
									{fieldState.error ? (
										<Text style={styles.error}>{fieldState.error.message}</Text>
									) : !isEdit ? (
										<Text style={styles.helper}>
											Leave empty to start from zero.
										</Text>
									) : null}
								</View>
							)}
						/>
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
											: "Creating..."
										: isEdit
											? "Save changes"
											: "Create account"}
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
			marginTop: spacing.xl,
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
