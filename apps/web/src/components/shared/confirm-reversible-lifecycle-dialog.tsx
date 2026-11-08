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

interface ConfirmReversibleLifecycleDialogProps {
	action: "archive" | "delete";
	entityName: string;
	noun: string;
	archiveDescription: string;
	deleteDescription: string;
	pending: boolean;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
}

// The confirm dialog for reversible entity lifecycle actions (archive and
// soft delete). Domain copy differs per entity kind, so callers supply the
// descriptions; the structure and confirm flow are shared.
export function ConfirmReversibleLifecycleDialog({
	action,
	entityName,
	noun,
	archiveDescription,
	deleteDescription,
	pending,
	onConfirm,
	onOpenChange,
}: ConfirmReversibleLifecycleDialogProps) {
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
						{isArchive ? "Archive" : "Delete"} "{entityName}"?
					</AlertDialogTitle>
					<AlertDialogDescription>
						{isArchive ? archiveDescription : deleteDescription}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction onClick={onConfirm} disabled={pending}>
						{isArchive ? `Archive ${noun}` : `Delete ${noun}`}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
