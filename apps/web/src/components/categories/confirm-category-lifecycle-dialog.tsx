import type { CategoryResponse } from "@finance-application/schemas";
import { ConfirmReversibleLifecycleDialog } from "@/components/shared/confirm-reversible-lifecycle-dialog";

export type CategoryLifecycleAction = "archive" | "delete";

interface ConfirmCategoryLifecycleDialogProps {
	action: CategoryLifecycleAction;
	category: CategoryResponse;
	pending: boolean;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
}

// Destructive actions always confirm. Both are reversible, which the copy
// says explicitly so confirming is an informed choice.
export function ConfirmCategoryLifecycleDialog({
	action,
	category,
	pending,
	onConfirm,
	onOpenChange,
}: ConfirmCategoryLifecycleDialogProps) {
	return (
		<ConfirmReversibleLifecycleDialog
			action={action}
			entityName={category.name}
			noun="category"
			archiveDescription="Archived categories leave lists and transaction selection but keep their history. You can restore this category from the Archived tab."
			deleteDescription="Deleted categories move to Trash and keep their history. You can restore this category from the Trash tab."
			pending={pending}
			onConfirm={onConfirm}
			onOpenChange={onOpenChange}
		/>
	);
}
