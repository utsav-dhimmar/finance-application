import {
	accountFormSchema,
	type AccountFormInput,
	type AccountFormValues,
	type AccountResponse,
} from "@finance-application/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { Host, ModalBottomSheet } from "@expo/ui/jetpack-compose";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";

import {
	BoxyButtonCore,
	BoxyColumn,
	BoxyFormField,
	BoxyRow,
	BoxySegmentedRow,
	BoxyText,
	BoxyTextFieldCore,
	type SelectOption,
} from "@/components/ui";
import { useCreateAccount, useUpdateAccount } from "@/hooks/use-accounts";
import { ACCOUNT_TYPE_LABELS } from "@/lib/account-labels";
import {
	minorToMajorInput,
	type CurrencyDisplayDefinition,
} from "@/lib/format";
import { getAccountsErrorMessage } from "@/services/accounts-service";
import { spacing } from "@/theme";
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
	const typeOptions: SelectOption[] = ACCOUNT_TYPE_OPTIONS;

	if (!open) {
		return null;
	}

	return (
		<Host style={{ flex: 1 }}>
			<ModalBottomSheet
				onDismissRequest={() => {
					handleOpenChange(false);
				}}
				containerColor={c.background}
				skipPartiallyExpanded
			>
				<BoxyColumn gap={spacing.lg}>
					<BoxyText variant="title">
						{isEdit && account ? `Edit "${account.name}"` : "Add account"}
					</BoxyText>
					<BoxyText variant="body" foreground={c.mutedForeground}>
						{isEdit
							? "Opening balance and type lock once the account has transactions."
							: `Track money held in one place. Amounts are in ${display.symbol}.`}
					</BoxyText>
					{form.formState.errors.root?.message ? (
						<BoxyText variant="body" foreground={c.destructive}>
							{form.formState.errors.root.message}
						</BoxyText>
					) : null}
					<Controller
						control={form.control}
						name="name"
						render={({ field, fieldState }) => (
							<BoxyFormField
								label="Name"
								error={fieldState.error?.message ?? null}
							>
								<BoxyTextFieldCore
									onChangeText={field.onChange}
									placeholder={isEdit ? undefined : "HDFC Bank"}
									value={field.value}
								/>
							</BoxyFormField>
						)}
					/>
					<Controller
						control={form.control}
						name="type"
						render={({ field }) => (
							<BoxyFormField label="Type">
								<BoxySegmentedRow
									options={typeOptions}
									value={field.value}
									onValueChange={field.onChange}
								/>
							</BoxyFormField>
						)}
					/>
					<Controller
						control={form.control}
						name="openingBalance"
						render={({ field, fieldState }) => (
							<BoxyFormField
								label={`Opening balance (${display.symbol})`}
								error={fieldState.error?.message ?? null}
								helper={
									!isEdit && !fieldState.error
										? "Leave empty to start from zero."
										: null
								}
							>
								<BoxyTextFieldCore
									onChangeText={field.onChange}
									placeholder={isEdit ? undefined : "0.00"}
									keyboardType="decimal"
									value={field.value}
								/>
							</BoxyFormField>
						)}
					/>
					<BoxyRow gap={spacing.sm}>
						<BoxyButtonCore
							label="Cancel"
							variant="ghost"
							onPress={() => {
								handleOpenChange(false);
							}}
						/>
						<BoxyButtonCore
							label={isEdit ? "Save changes" : "Create account"}
							onPress={() => {
								void onSubmit();
							}}
							pending={isPending}
						/>
					</BoxyRow>
				</BoxyColumn>
			</ModalBottomSheet>
		</Host>
	);
}
