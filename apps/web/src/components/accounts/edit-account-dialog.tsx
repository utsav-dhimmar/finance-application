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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@finance-application/ui/components/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useUpdateAccount } from "@/hooks/use-accounts";
import { paiseToRupeeInput } from "@/lib/money";
import { getAccountsErrorMessage } from "@/services/accounts-service";
import { ACCOUNT_TYPE_OPTIONS } from "@/components/accounts/create-account-dialog";

interface EditAccountDialogProps {
	account: AccountResponse;
	onOpenChange: (open: boolean) => void;
}

export function EditAccountDialog({
	account,
	onOpenChange,
}: EditAccountDialogProps) {
	const update = useUpdateAccount();
	const form = useForm<AccountFormInput, unknown, AccountFormValues>({
		resolver: zodResolver(accountFormSchema),
		defaultValues: {
			name: account.name,
			type: account.type,
			openingBalance: paiseToRupeeInput(account.openingBalanceMinor),
		},
	});

	function handleClose(next: boolean) {
		if (!next) {
			form.clearErrors("root");
		}
		onOpenChange(next);
	}

	const onSubmit = form.handleSubmit((values) => {
		form.clearErrors("root");
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
				onSuccess: () => handleClose(false),
				onError: (error) => {
					// Server-side lock and conflict 409s surface inline so the
					// user sees exactly which rule rejected the edit.
					form.setError("root", {
						message: getAccountsErrorMessage(
							error,
							"Could not save the account. Is the API running?",
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
					<DialogTitle>Edit "{account.name}"</DialogTitle>
					<DialogDescription>
						Opening balance and type lock once the account has transactions.
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
								<FieldLabel htmlFor="edit-account-name">Name</FieldLabel>
								<Input id="edit-account-name" {...field} />
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
							<Field>
								<FieldLabel htmlFor="edit-account-type">Type</FieldLabel>
								<Select
									items={ACCOUNT_TYPE_OPTIONS}
									value={field.value}
									onValueChange={(value) => field.onChange(value)}
								>
									<SelectTrigger id="edit-account-type">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{ACCOUNT_TYPE_OPTIONS.map((option) => (
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
						name="openingBalance"
						control={form.control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid || undefined}>
								<FieldLabel htmlFor="edit-account-opening-balance">
									Opening balance (₹)
								</FieldLabel>
								<Input
									id="edit-account-opening-balance"
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
