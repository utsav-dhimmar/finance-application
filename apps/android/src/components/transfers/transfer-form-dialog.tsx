import type {
	TransferFormInput,
	TransferFormValues,
	TransferResponse,
	UpdateTransferBody,
} from "@finance-application/schemas";
import { transferFormSchema } from "@finance-application/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import {
	DatePickerDialog,
	Host,
	ModalBottomSheet,
} from "@expo/ui/jetpack-compose";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import {
	BoxyButtonCore,
	BoxyColumn,
	BoxyFormField,
	BoxyRow,
	BoxySelectMenuCore,
	BoxyText,
	BoxyTextFieldCore,
	type SelectOption,
} from "@/components/ui";
import { useAccounts } from "@/hooks/use-accounts";
import { useCreateTransfer, useUpdateTransfer } from "@/hooks/use-transfers";
import { calendarDateString, todayString } from "@/lib/calendar-date";
import {
	minorToMajorInput,
	type CurrencyDisplayDefinition,
} from "@/lib/format";
import { uuidV7 } from "@/lib/uuid";
import { getTransfersErrorMessage } from "@/services/transfers-service";
import { spacing } from "@/theme";
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
						{isEdit ? "Edit transfer" : "New transfer"}
					</BoxyText>
					<BoxyText variant="body" foreground={c.mutedForeground}>
						{isEdit
							? "Both sides are recalculated atomically."
							: `Move money between two different accounts. Amounts are in ${display.symbol}.`}
					</BoxyText>
					{form.formState.errors.root?.message ? (
						<BoxyText variant="body" foreground={c.destructive}>
							{form.formState.errors.root.message}
						</BoxyText>
					) : null}
					<Controller
						control={form.control}
						name="amount"
						render={({ field, fieldState }) => (
							<BoxyFormField
								label={`Amount (${display.symbol})`}
								error={fieldState.error?.message ?? null}
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
					<Controller
						control={form.control}
						name="date"
						render={({ field, fieldState }) => (
							<BoxyFormField
								label="Date"
								error={fieldState.error?.message ?? null}
							>
								<BoxyButtonCore
									label={field.value}
									variant="outline"
									onPress={() => {
										setDatePickerOpen(true);
									}}
								/>
								{datePickerOpen ? (
									<DatePickerDialog
										initialDate={field.value}
										confirmButtonLabel="Done"
										dismissButtonLabel="Cancel"
										onDateSelected={(selected) => {
											setDatePickerOpen(false);
											field.onChange(calendarDateString(selected));
										}}
										onDismissRequest={() => {
											setDatePickerOpen(false);
										}}
									/>
								) : null}
							</BoxyFormField>
						)}
					/>
					<Controller
						control={form.control}
						name="sourceAccountId"
						render={({ field, fieldState }) => (
							<BoxyFormField
								label="Source account"
								error={fieldState.error?.message ?? null}
							>
								<BoxySelectMenuCore
									placeholder="Select source account"
									options={sourceOptions}
									value={field.value}
									onValueChange={field.onChange}
								/>
							</BoxyFormField>
						)}
					/>
					<Controller
						control={form.control}
						name="destinationAccountId"
						render={({ field, fieldState }) => (
							<BoxyFormField
								label="Destination account"
								error={fieldState.error?.message ?? null}
							>
								<BoxySelectMenuCore
									placeholder="Select destination account"
									options={destinationOptions}
									value={field.value}
									onValueChange={field.onChange}
								/>
							</BoxyFormField>
						)}
					/>
					<Controller
						control={form.control}
						name="notes"
						render={({ field, fieldState }) => (
							<BoxyFormField
								label="Notes (optional)"
								error={fieldState.error?.message ?? null}
							>
								<BoxyTextFieldCore
									onChangeText={field.onChange}
									placeholder={
										isEdit ? undefined : "Optional context or vendor name"
									}
									value={field.value ?? ""}
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
							label={isEdit ? "Save changes" : "Record transfer"}
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
