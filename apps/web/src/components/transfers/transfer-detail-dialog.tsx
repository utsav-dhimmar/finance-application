import type { TransferResponse } from "@finance-application/schemas";
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
import { TRANSFER_STATUS_LABELS } from "@/lib/transfer-labels";

interface TransferDetailDialogProps {
	transfer: TransferResponse;
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

// Full transfer details, including lifecycle state. References resolve by id
// even when the underlying account is archived or deleted; a permanently
// removed reference displays as unavailable rather than failing the view.
export function TransferDetailDialog({
	transfer,
	onOpenChange,
}: TransferDetailDialogProps) {
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
					<DialogTitle>Transfer details</DialogTitle>
					<DialogDescription>
						{transfer.sourceAccountName ?? "Unavailable"} →{" "}
						{transfer.destinationAccountName ?? "Unavailable"} on{" "}
						{transfer.date}
					</DialogDescription>
				</DialogHeader>
				<div className="flex items-center justify-between">
					<span className="font-mono text-2xl font-semibold tracking-tight text-foreground tabular-nums">
						{formatPaise(transfer.amountMinor)}
					</span>
					<Badge
						variant={transfer.status === "active" ? "secondary" : "outline"}
					>
						{TRANSFER_STATUS_LABELS[transfer.status]}
					</Badge>
				</div>
				<Separator />
				<div className="flex flex-col gap-2">
					<DetailRow label="Date" value={transfer.date} />
					<DetailRow
						label="From account"
						value={transfer.sourceAccountName ?? "Unavailable"}
					/>
					<DetailRow
						label="To account"
						value={transfer.destinationAccountName ?? "Unavailable"}
					/>
					<DetailRow label="Notes" value={transfer.notes ?? "—"} />
					{transfer.archivedAt && (
						<DetailRow label="Archived at" value={transfer.archivedAt} />
					)}
					{transfer.deletedAt && (
						<DetailRow label="Deleted at" value={transfer.deletedAt} />
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
