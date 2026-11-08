import type {
	AccountFormInput,
	AccountFormValues,
	AccountResponse,
} from "@finance-application/schemas";
import { accountFormSchema } from "@finance-application/schemas";
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
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { TypeSelectField } from "@/components/shared/type-select-field";
import { useCreateAccount, useUpdateAccount } from "@/hooks/use-accounts";
import { ACCOUNT_TYPE_LABELS } from "@/lib/account-labels";
import { paiseToRupeeInput } from "@/lib/money";
import { getAccountsErrorMessage } from "@/services/accounts-service";

const ACCOUNT_TYPE_OPTIONS = (
	Object.keys(ACCOUNT_TYPE_LABELS) as Array<keyof typeof ACCOUNT_TYPE_LABELS>
).map((type) => ({ value: type, label: ACCOUNT_TYPE_LABELS[type] }));

export interface AccountFormDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	account?: AccountResponse | null;
}

export function AccountFormDialog({
	open,
	onOpenChange,
	account,
}: AccountFormDialogProps) {
	const isEdit = Boolean(account);
	const create = useCreateAccount();
	const update = useUpdateAccount();

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
							openingBalance: paiseToRupeeInput(account.openingBalanceMinor),
						}
					: { name: "", type: "cash", openingBalance: "" },
			);
			form.clearErrors("root");
		}
	}, [open, account, form]);

	function handleOpenChange(next: boolean) {
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
					onSuccess: (createdAccount) => {
						handleOpenChange(false);
						toast.success(`Account "${createdAccount.name}" created.`);
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
	const idPrefix = isEdit ? "edit-account" : "account";

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{isEdit && account ? `Edit "${account.name}"` : "Add account"}
					</DialogTitle>
					<DialogDescription>
						{isEdit
							? "Opening balance and type lock once the account has transactions."
							: "Track money held in one place. Amounts are in ₹."}
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
					{form.formState.errors.root?.message && (
						<p role="alert" className="text-sm text-destructive">
							{form.formState.errors.root.message}
						</p>
					)}
					<Controller
						name="name"
						control={form.control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid || undefined}>
								<FieldLabel htmlFor={`${idPrefix}-name`}>Name</FieldLabel>
								<Input
									id={`${idPrefix}-name`}
									placeholder={isEdit ? undefined : "HDFC Bank"}
									autoComplete="off"
									{...field}
								/>
								{fieldState.error && (
									<FieldError>{fieldState.error.message}</FieldError>
								)}
							</Field>
						)}
					/>
					<Controller
						name="type"
						control={form.control}
						render={({ field }) => (
							<TypeSelectField
								idPrefix={idPrefix}
								options={ACCOUNT_TYPE_OPTIONS}
								value={field.value}
								onChange={(next) => field.onChange(next)}
							/>
						)}
					/>
					<Controller
						name="openingBalance"
						control={form.control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid || undefined}>
								<FieldLabel htmlFor={`${idPrefix}-opening-balance`}>
									Opening balance (₹)
								</FieldLabel>
								<Input
									id={`${idPrefix}-opening-balance`}
									inputMode="decimal"
									placeholder={isEdit ? undefined : "0.00"}
									className="font-mono tabular-nums"
									{...field}
								/>
								{fieldState.error ? (
									<FieldError>{fieldState.error.message}</FieldError>
								) : !isEdit ? (
									<p className="text-sm text-muted-foreground">
										Leave empty to start from zero.
									</p>
								) : null}
							</Field>
						)}
					/>
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
									: "Creating..."
								: isEdit
									? "Save changes"
									: "Create account"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
