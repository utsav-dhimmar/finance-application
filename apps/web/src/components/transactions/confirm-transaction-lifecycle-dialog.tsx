import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@finance-application/ui/components/alert-dialog";
import {
	Field,
	FieldError,
	FieldLabel,
} from "@finance-application/ui/components/field";
import { Input } from "@finance-application/ui/components/input";
import { useState } from "react";

export type TransactionLifecycleAction = "archive" | "delete" | "permanent";

interface ConfirmTransactionLifecycleDialogProps {
	action: TransactionLifecycleAction;
	transactionLabel: string;
	pending: boolean;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
	// The record kind named in the copy; transfers reuse this dialog.
	noun?: string;
}

// Destructive actions always confirm. Archive and delete are reversible and
// the copy says so; permanent deletion is irreversible and requires typing
// DELETE so an accidental click cannot destroy financial history.
export function ConfirmTransactionLifecycleDialog({
	action,
	transactionLabel,
	pending,
	onConfirm,
	onOpenChange,
	noun = "transaction",
}: ConfirmTransactionLifecycleDialogProps) {
	const [confirmText, setConfirmText] = useState("");
	const [error, setError] = useState<string | null>(null);
	const isPermanent = action === "permanent";
	const isArchive = action === "archive";

	function handleConfirm() {
		if (isPermanent && confirmText !== "DELETE") {
			setError("Type DELETE to confirm permanent removal.");
			return;
		}
		setError(null);
		onConfirm();
	}

	return (
		<AlertDialog
			open
			onOpenChange={(next) => {
				if (!next) {
					onOpenChange(false);
				}
			}}
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						{isArchive
							? "Archive"
							: isPermanent
								? "Permanently delete"
								: "Delete"}{" "}
						this {noun}?
					</AlertDialogTitle>
					<AlertDialogDescription>
						{isArchive
							? `Archived ${noun}s leave the active list but keep their balance effect and stay in reports. You can restore it from the Archived tab.`
							: isPermanent
								? `"${transactionLabel}" will be removed from history forever. This cannot be undone.`
								: `Deleted ${noun}s move to Trash and their balance effect reverses. You can restore it from the Trash tab.`}
					</AlertDialogDescription>
				</AlertDialogHeader>
				{isPermanent && (
					<Field data-invalid={error !== null || undefined}>
						<FieldLabel htmlFor="confirm-permanent-delete">
							Type DELETE to confirm
						</FieldLabel>
						<Input
							id="confirm-permanent-delete"
							value={confirmText}
							onChange={(event) => setConfirmText(event.target.value)}
							autoComplete="off"
							className="font-mono"
						/>
						{error && <FieldError>{error}</FieldError>}
					</Field>
				)}
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={handleConfirm}
						disabled={pending || (isPermanent && confirmText !== "DELETE")}
					>
						{isArchive
							? `Archive ${noun}`
							: isPermanent
								? "Delete forever"
								: `Delete ${noun}`}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
