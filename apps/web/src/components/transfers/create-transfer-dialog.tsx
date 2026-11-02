import type {
	TransferFormInput,
	TransferFormValues,
} from "@finance-application/schemas";
import { transferFormSchema } from "@finance-application/schemas";
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
import { useCreateTransfer } from "@/hooks/use-transfers";
import { formatPaise } from "@/lib/money";
import { uuidV7 } from "@/lib/uuid";
import { getTransfersErrorMessage } from "@/services/transfers-service";

interface CreateTransferDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function CreateTransferDialog({
	open,
	onOpenChange,
}: CreateTransferDialogProps) {
	const create = useCreateTransfer();
	const accounts = useAccounts("active");
	const form = useForm<TransferFormInput, unknown, TransferFormValues>({
		resolver: zodResolver(transferFormSchema),
		defaultValues: {
			amount: "",
			date: new Date().toISOString().slice(0, 10),
			sourceAccountId: "",
			destinationAccountId: "",
			notes: "",
		},
	});
	const selectedSource = form.watch("sourceAccountId");
	const selectedDestination = form.watch("destinationAccountId");

	function handleOpenChange(next: boolean) {
		if (!next) {
			form.reset();
			form.clearErrors("root");
		}
		onOpenChange(next);
	}

	// Only active accounts accept new postings (spec: write-time eligibility).
	const accountOptions = accounts.data?.accounts ?? [];
	const chosenSource = accountOptions.find(
		(account) => account.id === selectedSource,
	);
	const chosenDestination = accountOptions.find(
		(account) => account.id === selectedDestination,
	);

	const onSubmit = form.handleSubmit((values) => {
		form.clearErrors("root");
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
				onSuccess: (transfer) => {
					handleOpenChange(false);
					toast.success(
						`Transfer of ${formatPaise(transfer.amountMinor)} recorded.`,
					);
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
	});

	function accountSelect(
		id: string,
		label: string,
		name: "sourceAccountId" | "destinationAccountId",
	) {
		return (
			<Controller
				name={name}
				control={form.control}
				render={({ field, fieldState }) => (
					<Field data-invalid={fieldState.invalid || undefined}>
						<FieldLabel htmlFor={id}>{label}</FieldLabel>
						<Select
							items={accountOptions.map((account) => ({
								value: account.id,
								label: account.name,
							}))}
							value={field.value}
							onValueChange={(value) => field.onChange(value)}
						>
							<SelectTrigger id={id}>
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
		);
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Record transfer</DialogTitle>
					<DialogDescription>
						Money moves between two of your accounts. Transfers are never
						income or expense.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
					{form.formState.errors.root?.message && (
						<p role="alert" className="text-sm text-destructive">
							{form.formState.errors.root.message}
						</p>
					)}
					<Controller
						name="amount"
						control={form.control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid || undefined}>
								<FieldLabel htmlFor="transfer-amount">Amount (₹)</FieldLabel>
								<Input
									id="transfer-amount"
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
								<FieldLabel htmlFor="transfer-date">Date</FieldLabel>
								<Input id="transfer-date" type="date" {...field} />
								{fieldState.error && (
									<FieldError>{fieldState.error.message}</FieldError>
								)}
							</Field>
						)}
					/>
					{accountSelect(
						"transfer-source",
						"From account (source)",
						"sourceAccountId",
					)}
					{accountSelect(
						"transfer-destination",
						"To account (destination)",
						"destinationAccountId",
					)}
					<Controller
						name="notes"
						control={form.control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid || undefined}>
								<FieldLabel htmlFor="transfer-notes">
									Notes (optional)
								</FieldLabel>
								<Input
									id="transfer-notes"
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
					{chosenSource && chosenDestination && (
						<p className="text-sm text-muted-foreground">
							Money moves from {chosenSource.name} to {chosenDestination.name}.
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
							{create.isPending ? "Recording..." : "Record transfer"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
