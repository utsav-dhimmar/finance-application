import type {
	ActivityItem,
	TransactionResponse,
	TransferResponse,
} from "@finance-application/schemas";

// The activity rows carry signed amounts (the effect on the row's account);
// transaction and transfer forms re-derive their unsigned API shape from
// them — the same conversion the web's /transactions route performs before
// opening an edit dialog.

export function transactionFromActivity(
	row: ActivityItem,
): TransactionResponse {
	return {
		id: row.id,
		// Transaction rows always carry their type; the fallback never fires.
		type: row.type ?? "expense",
		amountMinor: Math.abs(row.amountMinor),
		date: row.date,
		accountId: row.accountId,
		accountName: row.accountName,
		categoryId: row.categoryId ?? "",
		categoryName: row.categoryName,
		notes: row.notes,
		status: row.status,
		archivedAt: row.archivedAt,
		deletedAt: row.deletedAt,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

export function transferFromActivity(row: ActivityItem): TransferResponse {
	const outgoing = row.direction === "out";
	return {
		id: row.id,
		amountMinor: Math.abs(row.amountMinor),
		date: row.date,
		sourceAccountId: outgoing
			? row.accountId
			: (row.counterpartyAccountId ?? ""),
		sourceAccountName: outgoing ? row.accountName : row.counterpartyAccountName,
		destinationAccountId: outgoing
			? (row.counterpartyAccountId ?? "")
			: row.accountId,
		destinationAccountName: outgoing
			? row.counterpartyAccountName
			: row.accountName,
		notes: row.notes,
		status: row.status,
		archivedAt: row.archivedAt,
		deletedAt: row.deletedAt,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}
