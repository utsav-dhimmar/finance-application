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
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { useAccounts } from "@/hooks/use-accounts";
import { useCreateTransfer, useUpdateTransfer } from "@/hooks/use-transfers";
import { formatPaise, paiseToRupeeInput } from "@/lib/money";
import { uuidV7 } from "@/lib/uuid";
import { getTransfersErrorMessage } from "@/services/transfers-service";

interface AccountOption {
	id: string;
	name: string;
	status: string;
}

export interface TransferFormDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	transfer?: TransferResponse | null;
}

export function TransferFormDialog({
	open,
	onOpenChange,
	transfer,
}: TransferFormDialogProps) {
	const isEdit = Boolean(transfer);
	const create = useCreateTransfer();
	const update = useUpdateTransfer();
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

	useEffect(() => {
		if (open) {
			form.reset(
				transfer
					? {
							amount: paiseToRupeeInput(transfer.amountMinor),
							date: transfer.date,
							sourceAccountId: transfer.sourceAccountId,
							destinationAccountId: transfer.destinationAccountId,
							notes: transfer.notes ?? "",
						}
					: {
							amount: "",
							date: new Date().toISOString().slice(0, 10),
							sourceAccountId: "",
							destinationAccountId: "",
							notes: "",
						},
			);
			form.clearErrors("root");
		}
	}, [open, transfer, form]);

	function handleOpenChange(next: boolean) {
		if (!next) {
			form.clearErrors("root");
		}
		onOpenChange(next);
	}

	const accountOptions = accounts.data?.accounts ?? [];

	function eligibleSides(side: "source" | "destination"): AccountOption[] {
		if (!transfer) return accountOptions;
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

	const sourceOptions = eligibleSides("source");
	const destOptions = eligibleSides("destination");

	const chosenSource = sourceOptions.find((a) => a.id === selectedSource);
	const chosenDestination = destOptions.find(
		(a) => a.id === selectedDestination,
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
					onSuccess: (createdTransfer) => {
						handleOpenChange(false);
						toast.success(
							`Transfer of ${formatPaise(createdTransfer.amountMinor)} recorded.`,
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
		}
	});

	const isPending = isEdit ? update.isPending : create.isPending;
	const idPrefix = isEdit ? "edit-transfer" : "transfer";

	function sideSelect(
		id: string,
		label: string,
		name: "sourceAccountId" | "destinationAccountId",
		options: AccountOption[],
	) {
		return (
			<Controller
				name={name}
				control={form.control}
				render={({ field, fieldState }) => (
					<Field data-invalid={fieldState.invalid || undefined}>
						<FieldLabel htmlFor={id}>{label}</FieldLabel>
						<Select
							items={options.map((account) => ({
								value: account.id,
								label: account.name,
							}))}
							value={field.value}
							onValueChange={(value) => field.onChange(value)}
						>
							<SelectTrigger id={id}>
								<SelectValue
									placeholder={isEdit ? undefined : "Choose an account"}
								/>
							</SelectTrigger>
							<SelectContent>
								{options.map((account) => (
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
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{isEdit ? "Edit transfer" : "Record transfer"}
					</DialogTitle>
					<DialogDescription>
						{isEdit
							? "Amount, date, and both accounts rebalance atomically on save."
							: "Money moves between two of your accounts. Transfers are never income or expense."}
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
										<Input id={`${idPrefix}-date`} type="date" {...field} />
										{fieldState.error && (
											<FieldError>{fieldState.error.message}</FieldError>
										)}
									</Field>
								)}
							/>
							{sideSelect(
								isEdit ? "edit-transfer-source" : "transfer-source",
								"From account (source)",
								"sourceAccountId",
								sourceOptions,
							)}
							{sideSelect(
								isEdit ? "edit-transfer-destination" : "transfer-destination",
								"To account (destination)",
								"destinationAccountId",
								destOptions,
							)}
							<Controller
								name="notes"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid || undefined}>
										<FieldLabel htmlFor={`${idPrefix}-notes`}>
											{isEdit ? "Notes" : "Notes (optional)"}
										</FieldLabel>
										<Input
											id={`${idPrefix}-notes`}
											placeholder={isEdit ? undefined : "What was this for?"}
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
							{!isEdit && chosenSource && chosenDestination && (
								<p className="text-sm text-muted-foreground">
									Money moves from {chosenSource.name} to{" "}
									{chosenDestination.name}.
								</p>
							)}
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
									: "Record transfer"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
