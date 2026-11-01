import type { CategoryResponse } from "@finance-application/schemas";
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
						{isArchive ? "Archive" : "Delete"} "{category.name}"?
					</AlertDialogTitle>
					<AlertDialogDescription>
						{isArchive
							? "Archived categories leave lists and transaction selection but keep their history. You can restore this category from the Archived tab."
							: "Deleted categories move to Trash and keep their history. You can restore this category from the Trash tab."}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction onClick={onConfirm} disabled={pending}>
						{isArchive ? "Archive category" : "Delete category"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
