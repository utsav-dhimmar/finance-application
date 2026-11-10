import type {
	AccountResponse,
	CategoryResponse,
	TransactionFormInput,
	TransactionFormValues,
	TransactionResponse,
	UpdateTransactionBody,
} from "@finance-application/schemas";
import { transactionFormSchema } from "@finance-application/schemas";
import { Button } from "@finance-application/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@finance-application/ui/components/dialog";
import {
	Field,
	FieldError,
	FieldLabel,
} from "@finance-application/ui/components/field";
import { Input } from "@finance-application/ui/components/input";
import { ScrollArea } from "@finance-application/ui/components/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@finance-application/ui/components/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { useAccounts } from "@/hooks/use-accounts";
import { useCategories } from "@/hooks/use-categories";
import {
	useCreateTransaction,
	useUpdateTransaction,
} from "@/hooks/use-transactions";
import { formatPaise, paiseToRupeeInput } from "@/lib/money";
import { TRANSACTION_TYPE_LABELS } from "@/lib/transaction-labels";
import { uuidV7 } from "@/lib/uuid";
import { getTransactionsErrorMessage } from "@/services/transactions-service";

interface AccountOption {
	id: string;
	name: string;
	status: string;
}

const TRANSACTION_TYPE_OPTIONS = (
	Object.keys(TRANSACTION_TYPE_LABELS) as Array<
		keyof typeof TRANSACTION_TYPE_LABELS
	>
).map((type) => ({ value: type, label: TRANSACTION_TYPE_LABELS[type] }));

const INTERVAL_OPTIONS = [
	{ value: "1", label: "Every 1 month (Monthly)" },
	{ value: "2", label: "Every 2 months (Bi-monthly)" },
	{ value: "3", label: "Every 3 months (Quarterly)" },
	{ value: "6", label: "Every 6 months (Semi-annually)" },
	{ value: "12", label: "Every 12 months (Annually)" },
];

export interface TransactionFormDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	transaction?: TransactionResponse | null;
}

export function TransactionFormDialog({
	open,
	onOpenChange,
	transaction,
}: TransactionFormDialogProps) {
	const isEdit = Boolean(transaction);
	const create = useCreateTransaction();
	const update = useUpdateTransaction();
	const accounts = useAccounts("active");
	const categories = useCategories("active");

	const form = useForm<TransactionFormInput, unknown, TransactionFormValues>({
		resolver: zodResolver(transactionFormSchema),
		defaultValues: {
			type: "expense",
			amount: "",
			date: new Date().toISOString().slice(0, 10),
			accountId: "",
			categoryId: "",
			notes: "",
			isRecurring: false,
			recurrenceIntervalMonths: 1,
			recurrenceEndDate: "",
		},
	});

	const selectedType = form.watch("type");
	const selectedAccountId = form.watch("accountId");

	useEffect(() => {
		if (open) {
			form.reset(
				transaction
					? {
							type: transaction.type,
							amount: paiseToRupeeInput(transaction.amountMinor),
							date: transaction.date,
							accountId: transaction.accountId,
							categoryId: transaction.categoryId,
							notes: transaction.notes ?? "",
							isRecurring: false,
							recurrenceIntervalMonths: 1,
							recurrenceEndDate: "",
						}
					: {
							type: "expense",
							amount: "",
							date: new Date().toISOString().slice(0, 10),
							accountId: "",
							categoryId: "",
							notes: "",
							isRecurring: false,
							recurrenceIntervalMonths: 1,
							recurrenceEndDate: "",
						},
			);
			form.clearErrors("root");
		}
	}, [open, transaction, form]);

	function handleOpenChange(next: boolean) {
		if (!next) {
			form.clearErrors("root");
		}
		onOpenChange(next);
	}

	const accountOptions: AccountResponse[] = accounts.data?.accounts ?? [];
	const eligibleAccounts: AccountOption[] =
		transaction && !accountOptions.some((a) => a.id === transaction.accountId)
			? [
					{
						id: transaction.accountId,
						name: transaction.accountName ?? "Unavailable",
						status: "archived",
					},
					...accountOptions,
				]
			: accountOptions;

	const categoryOptions: CategoryResponse[] = (
		categories.data?.categories ?? []
	).filter((category) => category.type === selectedType);

	const chosenAccount = eligibleAccounts.find(
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
					recurrence:
						values.type === "expense" && values.isRecurring
							? {
									intervalMonths: values.recurrenceIntervalMonths,
									endDate: values.recurrenceEndDate || undefined,
								}
							: undefined,
				},
				{
					onSuccess: (createdTransaction) => {
						handleOpenChange(false);
						toast.success(
							`${TRANSACTION_TYPE_LABELS[createdTransaction.type]} of ${formatPaise(createdTransaction.amountMinor)} recorded.`,
						);
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
	const idPrefix = isEdit ? "edit-transaction" : "transaction";

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{isEdit ? "Edit transaction" : "Record transaction"}
					</DialogTitle>
					<DialogDescription>
						{isEdit
							? "Amounts, date, account, and category are recalculated atomically."
							: "Track income or expenses. Amounts are in ₹."}
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
					{form.formState.errors.root?.message && (
						<p role="alert" className="text-sm text-destructive">
							{form.formState.errors.root.message}
						</p>
					)}
					<ScrollArea className="max-h-[min(55dvh,420px)] -mx-1.5">
						<div className="flex flex-col gap-4 py-1.5 pl-1.5 pr-4">
							<Controller
								name="type"
								control={form.control}
								render={({ field }) => (
									<Field>
										<FieldLabel htmlFor={`${idPrefix}-type`}>Type</FieldLabel>
										<Select
											items={TRANSACTION_TYPE_OPTIONS}
											value={field.value}
											onValueChange={(value) => {
												field.onChange(value);
												form.setValue("categoryId", "");
											}}
										>
											<SelectTrigger id={`${idPrefix}-type`}>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{TRANSACTION_TYPE_OPTIONS.map((option) => (
													<SelectItem key={option.value} value={option.value}>
														{option.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</Field>
								)}
							/>
							<Controller
								name="amount"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid || undefined}>
										<FieldLabel htmlFor={`${idPrefix}-amount`}>
											Amount (₹)
										</FieldLabel>
										<Input
											id={`${idPrefix}-amount`}
											inputMode="decimal"
											placeholder={isEdit ? undefined : "0.00"}
											className="font-mono tabular-nums"
											{...field}
										/>
										{fieldState.error && (
											<FieldError>{fieldState.error.message}</FieldError>
										)}
									</Field>
								)}
							/>
							<Controller
								name="date"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid || undefined}>
										<FieldLabel htmlFor={`${idPrefix}-date`}>Date</FieldLabel>
										<Input
											id={`${idPrefix}-date`}
											type="date"
											className="font-mono"
											{...field}
										/>
										{fieldState.error && (
											<FieldError>{fieldState.error.message}</FieldError>
										)}
									</Field>
								)}
							/>
							<Controller
								name="accountId"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid || undefined}>
										<FieldLabel htmlFor={`${idPrefix}-account`}>
											Account
										</FieldLabel>
										<Select
											items={eligibleAccounts.map((a) => ({
												value: a.id,
												label:
													a.status === "archived"
														? `${a.name} (archived)`
														: a.name,
											}))}
											value={field.value}
											onValueChange={(value) => field.onChange(value)}
										>
											<SelectTrigger id={`${idPrefix}-account`}>
												<SelectValue placeholder="Select account" />
											</SelectTrigger>
											<SelectContent>
												{eligibleAccounts.map((account) => (
													<SelectItem key={account.id} value={account.id}>
														{account.name}
														{account.status === "archived" && " (archived)"}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										{fieldState.error ? (
											<FieldError>{fieldState.error.message}</FieldError>
										) : chosenAccount &&
											"currentBalanceMinor" in chosenAccount ? (
											<p className="text-xs text-muted-foreground">
												Current balance:{" "}
												<span className="font-mono tabular-nums">
													{formatPaise(
														chosenAccount.currentBalanceMinor as number,
													)}
												</span>
											</p>
										) : null}
									</Field>
								)}
							/>
							<Controller
								name="categoryId"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid || undefined}>
										<FieldLabel htmlFor={`${idPrefix}-category`}>
											Category
										</FieldLabel>
										<Select
											items={categoryOptions.map((c) => ({
												value: c.id,
												label: c.name,
											}))}
											value={field.value}
											onValueChange={(value) => field.onChange(value)}
										>
											<SelectTrigger id={`${idPrefix}-category`}>
												<SelectValue placeholder="Select category" />
											</SelectTrigger>
											<SelectContent>
												{categoryOptions.map((category) => (
													<SelectItem key={category.id} value={category.id}>
														{category.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										{fieldState.error && (
											<FieldError>{fieldState.error.message}</FieldError>
										)}
									</Field>
								)}
							/>
							{!isEdit && selectedType === "expense" && (
								<div className="border border-border p-3 space-y-3 bg-muted/20">
									<label className="flex items-center gap-2 cursor-pointer select-none">
										<input
											type="checkbox"
											className="h-4 w-4 rounded-none border border-input accent-primary cursor-pointer"
											checked={form.watch("isRecurring")}
											onChange={(e) =>
												form.setValue("isRecurring", e.target.checked)
											}
										/>
										<span className="text-sm font-medium">
											Repeat this expense (Recurring)
										</span>
									</label>

									{form.watch("isRecurring") && (
										<div className="space-y-3 pt-2 border-t border-border/50">
											<Controller
												name="recurrenceIntervalMonths"
												control={form.control}
												render={({ field }) => (
													<Field>
														<FieldLabel htmlFor={`${idPrefix}-recurrence-interval`}>
															Recurring Duration
														</FieldLabel>
														<Select
															items={INTERVAL_OPTIONS}
															value={String(field.value)}
															onValueChange={(val) =>
																field.onChange(Number(val))
															}
														>
															<SelectTrigger
																id={`${idPrefix}-recurrence-interval`}
															>
																<SelectValue placeholder="Select duration" />
															</SelectTrigger>
															<SelectContent>
																{INTERVAL_OPTIONS.map((opt) => (
																	<SelectItem
																		key={opt.value}
																		value={opt.value}
																	>
																		{opt.label}
																	</SelectItem>
																))}
															</SelectContent>
														</Select>
													</Field>
												)}
											/>

											<Controller
												name="recurrenceEndDate"
												control={form.control}
												render={({ field, fieldState }) => (
													<Field data-invalid={fieldState.invalid || undefined}>
														<FieldLabel
															htmlFor={`${idPrefix}-recurrence-end-date`}
														>
															End Date (optional)
														</FieldLabel>
														<Input
															id={`${idPrefix}-recurrence-end-date`}
															type="date"
															{...field}
														/>
														{fieldState.error && (
															<FieldError>{fieldState.error.message}</FieldError>
														)}
													</Field>
												)}
											/>
										</div>
									)}
								</div>
							)}
							<Controller
								name="notes"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid || undefined}>
										<FieldLabel htmlFor={`${idPrefix}-notes`}>
											Notes (optional)
										</FieldLabel>
										<Input
											id={`${idPrefix}-notes`}
											placeholder={
												isEdit ? undefined : "Optional context or vendor name"
											}
											autoComplete="off"
											{...field}
										/>
										{fieldState.error && (
											<FieldError>{fieldState.error.message}</FieldError>
										)}
									</Field>
								)}
							/>
						</div>
					</ScrollArea>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => handleOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending
								? isEdit
									? "Saving..."
									: "Recording..."
								: isEdit
									? "Save changes"
									: "Record transaction"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
