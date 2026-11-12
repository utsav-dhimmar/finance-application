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
import { useCategories } from "@/hooks/use-categories";
import {
	useCreateTransaction,
	useUpdateTransaction,
} from "@/hooks/use-transactions";
import { calendarDateString, todayString } from "@/lib/calendar-date";
import {
	minorToMajorInput,
	type CurrencyDisplayDefinition,
} from "@/lib/format";
import { TRANSACTION_TYPE_LABELS } from "@/lib/transaction-labels";
import { uuidV7 } from "@/lib/uuid";
import { getTransactionsErrorMessage } from "@/services/transactions-service";
import { spacing } from "@/theme";
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
 * the chosen category (web parity). The surface is the native bottom sheet
 * with Compose-only content (one Host; the cores carry no hosts).
 */
export function TransactionFormDialog({
	open,
	onOpenChange,
	transaction = null,
	display,
}: TransactionFormDialogProps) {
	const c = useThemeColors();
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
						{isEdit ? "Edit transaction" : "Record transaction"}
					</BoxyText>
					<BoxyText variant="body" foreground={c.mutedForeground}>
						{isEdit
							? "Amounts, date, account, and category are recalculated atomically."
							: `Track income or expenses. Amounts are in ${display.symbol}.`}
					</BoxyText>
					{form.formState.errors.root?.message ? (
						<BoxyText variant="body" foreground={c.destructive}>
							{form.formState.errors.root.message}
						</BoxyText>
					) : null}
					<BoxyFormField label="Type">
						<BoxyRow gap={spacing.sm}>
							{TRANSACTION_TYPE_OPTIONS.map((option) => (
								<BoxyButtonCore
									key={option.value}
									label={option.label}
									variant={
										form.watch("type") === option.value ? "primary" : "outline"
									}
									onPress={() => {
										form.setValue("type", option.value);
										// A different type invalidates the chosen category.
										form.setValue("categoryId", "");
									}}
								/>
							))}
						</BoxyRow>
					</BoxyFormField>
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
						name="accountId"
						render={({ field, fieldState }) => (
							<BoxyFormField
								label="Account"
								error={fieldState.error?.message ?? null}
								helper={
									fieldState.error
										? null
										: chosenAccount
											? `Current balance: ${minorToMajorInput(
													chosenAccount.currentBalanceMinor,
													display,
												)}`
											: null
								}
							>
								<BoxySelectMenuCore
									placeholder="Select account"
									options={accountSelectOptions}
									value={field.value}
									onValueChange={field.onChange}
								/>
							</BoxyFormField>
						)}
					/>
					<Controller
						control={form.control}
						name="categoryId"
						render={({ field, fieldState }) => (
							<BoxyFormField
								label="Category"
								error={fieldState.error?.message ?? null}
							>
								<BoxySelectMenuCore
									placeholder="Select category"
									options={categoryOptions.map((category) => ({
										value: category.id,
										label: category.name,
									}))}
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
							label={isEdit ? "Save changes" : "Record transaction"}
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
