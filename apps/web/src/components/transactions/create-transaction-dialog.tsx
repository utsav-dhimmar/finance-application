import type {
	AccountResponse,
	CategoryResponse,
	TransactionFormInput,
	TransactionFormValues,
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
import { toast } from "sonner";
import { useAccounts } from "@/hooks/use-accounts";
import { useCategories } from "@/hooks/use-categories";
import { useCreateTransaction } from "@/hooks/use-transactions";
import { formatPaise } from "@/lib/money";
import { TRANSACTION_TYPE_LABELS } from "@/lib/transaction-labels";
import { uuidV7 } from "@/lib/uuid";
import { getTransactionsErrorMessage } from "@/services/transactions-service";

export const TRANSACTION_TYPE_OPTIONS = (
	Object.keys(TRANSACTION_TYPE_LABELS) as Array<
		keyof typeof TRANSACTION_TYPE_LABELS
	>
).map((type) => ({ value: type, label: TRANSACTION_TYPE_LABELS[type] }));

interface CreateTransactionDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function CreateTransactionDialog({
	open,
	onOpenChange,
}: CreateTransactionDialogProps) {
	const create = useCreateTransaction();
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
		},
	});
	const selectedType = form.watch("type");
	const selectedAccountId = form.watch("accountId");

	function handleOpenChange(next: boolean) {
		if (!next) {
			form.reset();
			form.clearErrors("root");
		}
		onOpenChange(next);
	}

	// Only active accounts accept postings; only active categories of the
	// matching type are selectable (spec: write-time eligibility).
	const accountOptions: AccountResponse[] = accounts.data?.accounts ?? [];
	const categoryOptions: CategoryResponse[] = (
		categories.data?.categories ?? []
	).filter((category) => category.type === selectedType);
	const chosenAccount = accountOptions.find(
		(account) => account.id === selectedAccountId,
	);

	const onSubmit = form.handleSubmit((values) => {
		form.clearErrors("root");
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
				onSuccess: (transaction) => {
					handleOpenChange(false);
					toast.success(
						`${TRANSACTION_TYPE_LABELS[transaction.type]} of ${formatPaise(transaction.amountMinor)} recorded.`,
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
	});

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Record transaction</DialogTitle>
					<DialogDescription>
						Income credits the account; expenses debit it. Amounts are in ₹.
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
								<FieldLabel htmlFor="transaction-type">Type</FieldLabel>
								<Select
									items={TRANSACTION_TYPE_OPTIONS}
									value={field.value}
									onValueChange={(value) => {
										field.onChange(value);
										// The chosen category must match the new type.
										form.setValue("categoryId", "");
									}}
								>
									<SelectTrigger id="transaction-type">
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
								<FieldLabel htmlFor="transaction-amount">Amount (₹)</FieldLabel>
								<Input
									id="transaction-amount"
									inputMode="decimal"
									placeholder="0.00"
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
								<FieldLabel htmlFor="transaction-date">Date</FieldLabel>
								<Input id="transaction-date" type="date" {...field} />
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
								<FieldLabel htmlFor="transaction-account">
									{selectedType === "income" ? "To account" : "From account"}
								</FieldLabel>
								<Select
									items={accountOptions.map((account) => ({
										value: account.id,
										label: account.name,
									}))}
									value={field.value}
									onValueChange={(value) => field.onChange(value)}
								>
									<SelectTrigger id="transaction-account">
										<SelectValue placeholder="Choose an account" />
									</SelectTrigger>
									<SelectContent>
										{accountOptions.map((account) => (
											<SelectItem key={account.id} value={account.id}>
												{account.name}
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
								<FieldLabel htmlFor="transaction-category">
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
									<SelectTrigger id="transaction-category">
										<SelectValue placeholder="Choose a category" />
									</SelectTrigger>
									<SelectContent>
										{categoryOptions.map((category) => (
											<SelectItem key={category.id} value={category.id}>
												{category.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{fieldState.error ? (
									<FieldError>{fieldState.error.message}</FieldError>
								) : (
									<p className="text-sm text-muted-foreground">
										Only active{" "}
										{TRANSACTION_TYPE_LABELS[selectedType].toLowerCase()}{" "}
										categories are listed.
									</p>
								)}
							</Field>
						)}
					/>
					<Controller
						name="notes"
						control={form.control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid || undefined}>
								<FieldLabel htmlFor="transaction-notes">
									Notes (optional)
								</FieldLabel>
								<Input
									id="transaction-notes"
									placeholder="What was this for?"
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
					{chosenAccount && (
						<p className="text-sm text-muted-foreground">
							{chosenAccount.name} balance: affected by this transaction.
						</p>
					)}
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => handleOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={create.isPending}>
							{create.isPending ? "Recording..." : "Record transaction"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
