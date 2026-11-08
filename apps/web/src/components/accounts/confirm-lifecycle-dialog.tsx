import type { AccountResponse } from "@finance-application/schemas";
import { ConfirmReversibleLifecycleDialog } from "@/components/shared/confirm-reversible-lifecycle-dialog";

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
	return (
		<ConfirmReversibleLifecycleDialog
			action={action}
			entityName={account.name}
			noun="account"
			archiveDescription="Archived accounts leave lists and balance summaries but keep their history. You can restore this account from the Archived tab."
			deleteDescription="Deleted accounts move to Trash and keep their history. You can restore this account from the Trash tab."
			pending={pending}
			onConfirm={onConfirm}
			onOpenChange={onOpenChange}
		/>
	);
}
