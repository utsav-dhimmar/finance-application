import type { TransferResponse } from "@finance-application/schemas";
import { Button } from "@finance-application/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@finance-application/ui/components/dialog";
import { Field, FieldLabel } from "@finance-application/ui/components/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@finance-application/ui/components/select";
import { useState } from "react";
import { useAccounts } from "@/hooks/use-accounts";

interface RestoreTransferDialogProps {
	transfer: TransferResponse;
	pending: boolean;
	onSubmit: (reassignment: {
		sourceAccountId?: string;
		destinationAccountId?: string;
	}) => void;
	onOpenChange: (open: boolean) => void;
}

// Shown when a restore is rejected because one of the transfer's accounts was
// deleted: the user picks eligible replacements and the restore is retried
// with them. Both sides default to the current references; only changed
// values are sent.
export function RestoreTransferDialog({
	transfer,
	pending,
	onSubmit,
	onOpenChange,
}: RestoreTransferDialogProps) {
	const accounts = useAccounts("active");
	const [sourceAccountId, setSourceAccountId] = useState(
		transfer.sourceAccountId,
	);
	const [destinationAccountId, setDestinationAccountId] = useState(
		transfer.destinationAccountId,
	);

	const accountOptions = accounts.data?.accounts ?? [];

	return (
		<Dialog
			open
			onOpenChange={(next) => {
				if (!next) {
					onOpenChange(false);
				}
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Choose restore targets</DialogTitle>
					<DialogDescription>
						One of the transfer's accounts was deleted. Assign active
						replacements to restore it.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4">
					<Field>
						<FieldLabel htmlFor="restore-transfer-source">
							From account (source)
						</FieldLabel>
						<Select
							items={accountOptions.map((account) => ({
								value: account.id,
								label: account.name,
							}))}
							value={sourceAccountId}
							onValueChange={(value) => setSourceAccountId(value ?? "")}
						>
							<SelectTrigger id="restore-transfer-source">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{accountOptions.map((account) => (
									<SelectItem key={account.id} value={account.id}>
										{account.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel htmlFor="restore-transfer-destination">
							To account (destination)
						</FieldLabel>
						<Select
							items={accountOptions.map((account) => ({
								value: account.id,
								label: account.name,
							}))}
							value={destinationAccountId}
							onValueChange={(value) => setDestinationAccountId(value ?? "")}
						>
							<SelectTrigger id="restore-transfer-destination">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{accountOptions.map((account) => (
									<SelectItem key={account.id} value={account.id}>
										{account.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
				</div>
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button
						type="button"
						disabled={pending || accountOptions.length < 2}
						onClick={() => {
							onSubmit({
								...(sourceAccountId !== transfer.sourceAccountId
									? { sourceAccountId }
									: {}),
								...(destinationAccountId !== transfer.destinationAccountId
									? { destinationAccountId }
									: {}),
							});
						}}
					>
						{pending ? "Restoring..." : "Restore"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
