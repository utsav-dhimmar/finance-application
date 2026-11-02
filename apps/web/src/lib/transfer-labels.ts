import type {
	ActivityDirection,
	TransferStatus,
} from "@finance-application/schemas";

export const TRANSFER_DIRECTION_LABELS: Record<ActivityDirection, string> = {
	in: "In",
	out: "Out",
};

export const TRANSFER_STATUS_LABELS: Record<TransferStatus, string> = {
	active: "Active",
	archived: "Archived",
	deleted: "Deleted",
};
