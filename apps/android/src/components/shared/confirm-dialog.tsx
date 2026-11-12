import { BoxyConfirmDialog } from "@/components/ui";

export interface ConfirmDialogProps {
	visible: boolean;
	title: string;
	description: string;
	confirmLabel: string;
	cancelLabel?: string;
	pending?: boolean;
	onConfirm: () => void;
	onCancel: () => void;
}

/**
 * The boxy confirm modal shared by every destructive lifecycle action
 * (archive and soft delete today). Domain copy differs per entity kind, so
 * callers supply the strings; the structure and confirm flow are shared —
 * the mobile equivalent of the web's ConfirmReversibleLifecycleDialog.
 * Backed by the native Compose alert dialog (BoxyConfirmDialog).
 */
export function ConfirmDialog({
	visible,
	title,
	description,
	confirmLabel,
	cancelLabel = "Cancel",
	pending = false,
	onConfirm,
	onCancel,
}: ConfirmDialogProps) {
	return (
		<BoxyConfirmDialog
			open={visible}
			title={title}
			body={description}
			confirmLabel={confirmLabel}
			cancelLabel={cancelLabel}
			pending={pending}
			onConfirm={onConfirm}
			onCancel={onCancel}
		/>
	);
}
