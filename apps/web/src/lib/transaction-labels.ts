import type { TransactionStatus, TransactionType } from "@finance-application/schemas";

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
	income: "Income",
	expense: "Expense",
};

export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
	active: "Active",
	archived: "Archived",
	deleted: "Deleted",
};
