import type { TransactionResponse } from "@finance-application/schemas";
import { Badge } from "@finance-application/ui/components/badge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@finance-application/ui/components/dialog";
import { Separator } from "@finance-application/ui/components/separator";
import { formatPaise } from "@/lib/money";
import {
	TRANSACTION_STATUS_LABELS,
	TRANSACTION_TYPE_LABELS,
} from "@/lib/transaction-labels";

interface TransactionDetailDialogProps {
	transaction: TransactionResponse;
	onOpenChange: (open: boolean) => void;
}

function DetailRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-start justify-between gap-4">
			<span className="text-sm text-muted-foreground">{label}</span>
			<span className="text-right text-sm font-medium text-foreground">
				{value}
			</span>
		</div>
	);
}

// Full transaction details, including lifecycle state. References resolve by
// id even when the underlying record is archived or deleted; a permanently
// removed reference displays as unavailable rather than failing the view.
export function TransactionDetailDialog({
	transaction,
	onOpenChange,
}: TransactionDetailDialogProps) {
	const sign = transaction.type === "income" ? "+" : "−";
	return (
		<Dialog
			open
			onOpenChange={(next) => {
				if (!next) {
					onOpenChange(false);
				}
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Transaction details</DialogTitle>
					<DialogDescription>
						{TRANSACTION_TYPE_LABELS[transaction.type]} on {transaction.date}
					</DialogDescription>
				</DialogHeader>
				<div className="flex items-center justify-between">
					<span className="font-mono text-2xl font-semibold tracking-tight text-foreground tabular-nums">
						{sign}
						{formatPaise(transaction.amountMinor)}
					</span>
					<Badge variant={transaction.status === "active" ? "secondary" : "outline"}>
						{TRANSACTION_STATUS_LABELS[transaction.status]}
					</Badge>
				</div>
				<Separator />
				<div className="flex flex-col gap-2">
					<DetailRow label="Type" value={TRANSACTION_TYPE_LABELS[transaction.type]} />
					<DetailRow
						label="Date"
						value={transaction.date}
					/>
					<DetailRow
						label="Account"
						value={transaction.accountName ?? "Unavailable"}
					/>
					<DetailRow
						label="Category"
						value={transaction.categoryName ?? "Unavailable"}
					/>
					<DetailRow label="Notes" value={transaction.notes ?? "—"} />
					{transaction.archivedAt && (
						<DetailRow label="Archived at" value={transaction.archivedAt} />
					)}
					{transaction.deletedAt && (
						<DetailRow label="Deleted at" value={transaction.deletedAt} />
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
