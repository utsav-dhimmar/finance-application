import type { AccountResponse } from "@finance-application/schemas";
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

export type LifecycleAction = "archive" | "delete";

interface ConfirmLifecycleDialogProps {
	action: LifecycleAction;
	account: AccountResponse;
	pending: boolean;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
}

// Destructive actions always confirm. Both are reversible, which the copy
// says explicitly so confirming is an informed choice.
export function ConfirmLifecycleDialog({
	action,
	account,
	pending,
	onConfirm,
	onOpenChange,
}: ConfirmLifecycleDialogProps) {
	const isArchive = action === "archive";
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
						{isArchive ? "Archive" : "Delete"} "{account.name}"?
					</AlertDialogTitle>
					<AlertDialogDescription>
						{isArchive
							? "Archived accounts leave lists and balance summaries but keep their history. You can restore this account from the Archived tab."
							: "Deleted accounts move to Trash and keep their history. You can restore this account from the Trash tab."}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction onClick={onConfirm} disabled={pending}>
						{isArchive ? "Archive account" : "Delete account"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
