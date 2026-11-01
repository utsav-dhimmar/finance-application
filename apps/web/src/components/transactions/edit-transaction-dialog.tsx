import type {
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@finance-application/ui/components/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { TRANSACTION_TYPE_OPTIONS } from "@/components/transactions/create-transaction-dialog";
import { useAccounts } from "@/hooks/use-accounts";
import { useCategories } from "@/hooks/use-categories";
import { useUpdateTransaction } from "@/hooks/use-transactions";
import { paiseToRupeeInput } from "@/lib/money";
import { TRANSACTION_TYPE_LABELS } from "@/lib/transaction-labels";
import { getTransactionsErrorMessage } from "@/services/transactions-service";

interface EditTransactionDialogProps {
	transaction: TransactionResponse;
	onOpenChange: (open: boolean) => void;
}

export function EditTransactionDialog({
	transaction,
	onOpenChange,
}: EditTransactionDialogProps) {
	const update = useUpdateTransaction();
	const accounts = useAccounts("active");
	const categories = useCategories("active");
	const form = useForm<TransactionFormInput, unknown, TransactionFormValues>({
		resolver: zodResolver(transactionFormSchema),
		defaultValues: {
			type: transaction.type,
			amount: paiseToRupeeInput(transaction.amountMinor),
			date: transaction.date,
			accountId: transaction.accountId,
			categoryId: transaction.categoryId,
			notes: transaction.notes ?? "",
		},
	});
	const selectedType = form.watch("type");

	function handleClose(next: boolean) {
		if (!next) {
			form.clearErrors("root");
		}
		onOpenChange(next);
	}

	const accountOptions = accounts.data?.accounts ?? [];
	// The transaction's own (possibly archived) account stays selectable so an
	// unrelated edit does not force moving it; its name resolves by reference.
	const ownAccountIsEligible = accountOptions.some(
		(account) => account.id === transaction.accountId,
	);
	const eligibleAccounts: AccountOption[] = ownAccountIsEligible
		? accountOptions
		: [
				{
					id: transaction.accountId,
					name: transaction.accountName ?? "Unavailable",
					status: "archived",
				},
				...accountOptions,
			];
	const categoryOptions = (categories.data?.categories ?? []).filter(
		(category) => category.type === selectedType,
	);

	const onSubmit = form.handleSubmit((values) => {
		form.clearErrors("root");
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
				onSuccess: () => handleClose(false),
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
	});

	return (
		<Dialog open onOpenChange={handleClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Edit transaction</DialogTitle>
					<DialogDescription>
						Amounts, date, account, and category are recalculated atomically.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
					{form.formState.errors.root?.message && (
						<p role="alert" className="text-sm text-destructive">
							{form.formState.errors.root.message}
						</p>
					)}
					<Controller
						name="type"
						control={form.control}
						render={({ field }) => (
							<Field>
								<FieldLabel htmlFor="edit-transaction-type">Type</FieldLabel>
								<Select
									items={TRANSACTION_TYPE_OPTIONS}
									value={field.value}
									onValueChange={(value) => {
										field.onChange(value);
										form.setValue("categoryId", "");
									}}
								>
									<SelectTrigger id="edit-transaction-type">
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
								<FieldLabel htmlFor="edit-transaction-amount">
									Amount (₹)
								</FieldLabel>
								<Input
									id="edit-transaction-amount"
									inputMode="decimal"
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
								<FieldLabel htmlFor="edit-transaction-date">Date</FieldLabel>
								<Input id="edit-transaction-date" type="date" {...field} />
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
								<FieldLabel htmlFor="edit-transaction-account">
									Account
								</FieldLabel>
								<Select
									items={eligibleAccounts.map((account) => ({
										value: account.id,
										label: account.name,
									}))}
									value={field.value}
									onValueChange={(value) => field.onChange(value)}
								>
									<SelectTrigger id="edit-transaction-account">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{eligibleAccounts.map((account) => (
											<SelectItem key={account.id} value={account.id}>
												{account.name}
												{account.status !== "active" ? " (archived)" : ""}
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
					<Controller
						name="categoryId"
						control={form.control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid || undefined}>
								<FieldLabel htmlFor="edit-transaction-category">
									Category (
									{TRANSACTION_TYPE_LABELS[selectedType].toLowerCase()})
								</FieldLabel>
								<Select
									items={categoryOptions.map((category) => ({
										value: category.id,
										label: category.name,
									}))}
									value={field.value}
									onValueChange={(value) => field.onChange(value)}
								>
									<SelectTrigger id="edit-transaction-category">
										<SelectValue />
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
					<Controller
						name="notes"
						control={form.control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid || undefined}>
								<FieldLabel htmlFor="edit-transaction-notes">Notes</FieldLabel>
								<Input
									id="edit-transaction-notes"
									autoComplete="off"
									{...field}
									value={field.value ?? ""}
								/>
								{fieldState.error && (
									<FieldError>{fieldState.error.message}</FieldError>
								)}
							</Field>
						)}
					/>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => handleClose(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={update.isPending}>
							{update.isPending ? "Saving..." : "Save changes"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

interface AccountOption {
	id: string;
	name: string;
	status: string;
}
