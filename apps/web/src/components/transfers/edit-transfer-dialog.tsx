import type {
	TransferFormInput,
	TransferFormValues,
	TransferResponse,
	UpdateTransferBody,
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
import { ScrollArea } from "@finance-application/ui/components/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@finance-application/ui/components/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useAccounts } from "@/hooks/use-accounts";
import { useUpdateTransfer } from "@/hooks/use-transfers";
import { paiseToRupeeInput } from "@/lib/money";
import { getTransfersErrorMessage } from "@/services/transfers-service";

interface AccountOption {
	id: string;
	name: string;
	status: string;
}

interface EditTransferDialogProps {
	transfer: TransferResponse;
	onOpenChange: (open: boolean) => void;
}

export function EditTransferDialog({
	transfer,
	onOpenChange,
}: EditTransferDialogProps) {
	const update = useUpdateTransfer();
	const accounts = useAccounts("active");
	const form = useForm<TransferFormInput, unknown, TransferFormValues>({
		resolver: zodResolver(transferFormSchema),
		defaultValues: {
			amount: paiseToRupeeInput(transfer.amountMinor),
			date: transfer.date,
			sourceAccountId: transfer.sourceAccountId,
			destinationAccountId: transfer.destinationAccountId,
			notes: transfer.notes ?? "",
		},
	});

	function handleClose(next: boolean) {
		if (!next) {
			form.clearErrors("root");
		}
		onOpenChange(next);
	}

	const accountOptions = accounts.data?.accounts ?? [];
	// The transfer's own (possibly archived) sides stay selectable so an
	// unrelated edit does not force moving them; their names resolve by
	// reference and the server only validates changed sides.
	function eligibleSides(side: "source" | "destination"): AccountOption[] {
		const ownId =
			side === "source"
				? transfer.sourceAccountId
				: transfer.destinationAccountId;
		const ownName =
			side === "source"
				? transfer.sourceAccountName
				: transfer.destinationAccountName;
		const ownIsEligible = accountOptions.some(
			(account) => account.id === ownId,
		);
		const options: AccountOption[] = ownIsEligible
			? accountOptions
			: [
					{
						id: ownId,
						name: ownName ?? "Unavailable",
						status: "archived",
					},
					...accountOptions,
				];
		return options;
	}

	const onSubmit = form.handleSubmit((values) => {
		form.clearErrors("root");
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
				onSuccess: () => handleClose(false),
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
	});

	function sideSelect(
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
							items={eligibleSides(
								name === "sourceAccountId" ? "source" : "destination",
							).map((account) => ({
								value: account.id,
								label: account.name,
							}))}
							value={field.value}
							onValueChange={(value) => field.onChange(value)}
						>
							<SelectTrigger id={id}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{eligibleSides(
									name === "sourceAccountId" ? "source" : "destination",
								).map((account) => (
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
		);
	}

	return (
		<Dialog open onOpenChange={handleClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Edit transfer</DialogTitle>
					<DialogDescription>
						Amount, date, and both accounts rebalance atomically on save.
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
								name="amount"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid || undefined}>
										<FieldLabel htmlFor="edit-transfer-amount">
											Amount (₹)
										</FieldLabel>
										<Input
											id="edit-transfer-amount"
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
										<FieldLabel htmlFor="edit-transfer-date">Date</FieldLabel>
										<Input id="edit-transfer-date" type="date" {...field} />
										{fieldState.error && (
											<FieldError>{fieldState.error.message}</FieldError>
										)}
									</Field>
								)}
							/>
							{sideSelect(
								"edit-transfer-source",
								"From account (source)",
								"sourceAccountId",
							)}
							{sideSelect(
								"edit-transfer-destination",
								"To account (destination)",
								"destinationAccountId",
							)}
							<Controller
								name="notes"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid || undefined}>
										<FieldLabel htmlFor="edit-transfer-notes">Notes</FieldLabel>
										<Input
											id="edit-transfer-notes"
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
						</div>
					</ScrollArea>
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
