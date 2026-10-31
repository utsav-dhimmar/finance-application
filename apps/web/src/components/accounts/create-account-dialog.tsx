import type {
	AccountFormInput,
	AccountFormValues,
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
import { toast } from "sonner";
import { ACCOUNT_TYPE_LABELS } from "@/lib/account-labels";
import { useCreateAccount } from "@/hooks/use-accounts";
import { getAccountsErrorMessage } from "@/services/accounts-service";

export const ACCOUNT_TYPE_OPTIONS = (
	Object.keys(ACCOUNT_TYPE_LABELS) as Array<keyof typeof ACCOUNT_TYPE_LABELS>
).map((type) => ({ value: type, label: ACCOUNT_TYPE_LABELS[type] }));

interface CreateAccountDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function CreateAccountDialog({
	open,
	onOpenChange,
}: CreateAccountDialogProps) {
	const create = useCreateAccount();
	const form = useForm<AccountFormInput, unknown, AccountFormValues>({
		resolver: zodResolver(accountFormSchema),
		defaultValues: { name: "", type: "cash", openingBalance: "" },
	});

	function handleOpenChange(next: boolean) {
		if (!next) {
			form.reset();
			form.clearErrors("root");
		}
		onOpenChange(next);
	}

	const onSubmit = form.handleSubmit((values) => {
		form.clearErrors("root");
		create.mutate(
			{
				name: values.name,
				type: values.type,
				openingBalanceMinor: values.openingBalance,
			},
			{
				onSuccess: (account) => {
					handleOpenChange(false);
					toast.success(`Account "${account.name}" created.`);
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
	});

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add account</DialogTitle>
					<DialogDescription>
						Track money held in one place. Amounts are in ₹.
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
								<FieldLabel htmlFor="account-name">Name</FieldLabel>
								<Input
									id="account-name"
									placeholder="HDFC Bank"
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
							<Field>
								<FieldLabel htmlFor="account-type">Type</FieldLabel>
								<Select
									items={ACCOUNT_TYPE_OPTIONS}
									value={field.value}
									onValueChange={(value) => field.onChange(value)}
								>
									<SelectTrigger id="account-type">
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
								<FieldLabel htmlFor="account-opening-balance">
									Opening balance (₹)
								</FieldLabel>
								<Input
									id="account-opening-balance"
									inputMode="decimal"
									placeholder="0.00"
									className="font-mono tabular-nums"
									{...field}
								/>
								{fieldState.error ? (
									<FieldError>{fieldState.error.message}</FieldError>
								) : (
									<p className="text-sm text-muted-foreground">
										Leave empty to start from zero.
									</p>
								)}
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
						<Button type="submit" disabled={create.isPending}>
							{create.isPending ? "Creating..." : "Create account"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
