import { ApiError } from "@finance-application/api-client";
import type { TransferResponse } from "@finance-application/schemas";
import { Button } from "@finance-application/ui/components/button";
import { Skeleton } from "@finance-application/ui/components/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@finance-application/ui/components/table";
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { ArrowLeftRight, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmTransactionLifecycleDialog } from "@/components/transactions/confirm-transaction-lifecycle-dialog";
import { RestoreTransferDialog } from "@/components/transfers/restore-transfer-dialog";
import { TransferDetailDialog } from "@/components/transfers/transfer-detail-dialog";
import {
	usePermanentlyDeleteTransfer,
	useRestoreTransfer,
	useTransfers,
} from "@/hooks/use-transfers";
import { formatPaise } from "@/lib/money";
import { getTransfersErrorMessage } from "@/services/transfers-service";
import type { PanelMode } from "./accounts-panel";

const PAGE_SIZE = 20;

const columnHelper = createColumnHelper<TransferResponse>();

interface TransfersPanelProps {
	mode: PanelMode;
}

// The unified Archive/Trash slice for transfers: the paginated transfer list
// in the requested lifecycle state, with the established restore flow
// (reassignment on RESTORE_CONFLICT included), detail inspection, and — in
// trash mode — permanent deletion behind the typed confirmation.
export function TransfersPanel({ mode }: TransfersPanelProps) {
	const [page, setPage] = useState(1);
	const transfers = useTransfers({ status: mode, page, pageSize: PAGE_SIZE });
	const restore = useRestoreTransfer();
	const destroy = usePermanentlyDeleteTransfer();

	const [viewing, setViewing] = useState<TransferResponse | null>(null);
	const [restoring, setRestoring] = useState<TransferResponse | null>(null);
	const [confirming, setConfirming] = useState<TransferResponse | null>(null);

	function handleRestore(transfer: TransferResponse) {
		restore.mutate(
			{ id: transfer.id },
			{
				onSuccess: () => {
					toast.success("Transfer restored.");
				},
				onError: (error) => {
					if (error instanceof ApiError && error.code === "RESTORE_CONFLICT") {
						setRestoring(transfer);
						return;
					}
					toast.error(
						getTransfersErrorMessage(
							error,
							"Could not restore the transfer. Is the API running?",
						),
					);
				},
			},
		);
	}

	function handleRestoreWithReassignment(reassignment: {
		sourceAccountId?: string;
		destinationAccountId?: string;
	}) {
		if (!restoring) {
			return;
		}
		const hadReassignment =
			reassignment.sourceAccountId !== undefined ||
			reassignment.destinationAccountId !== undefined;
		restore.mutate(
			{
				id: restoring.id,
				sourceAccountId: reassignment.sourceAccountId,
				destinationAccountId: reassignment.destinationAccountId,
			},
			{
				onSuccess: () => {
					setRestoring(null);
					toast.success("Transfer restored.");
				},
				onError: (error) => {
					if (
						error instanceof ApiError &&
						error.code === "RESTORE_CONFLICT" &&
						hadReassignment
					) {
						toast.error(
							"Still conflicting: pick a different account or category.",
						);
						return;
					}
					toast.error(
						getTransfersErrorMessage(
							error,
							"Could not restore the transfer. Is the API running?",
						),
					);
				},
			},
		);
	}

	function handleConfirmPermanentDelete() {
		if (!confirming) {
			return;
		}
		destroy.mutate(confirming.id, {
			onSuccess: () => {
				setConfirming(null);
				toast.success("Transfer permanently deleted.");
			},
			onError: (error) => {
				setConfirming(null);
				toast.error(
					getTransfersErrorMessage(
						error,
						"Could not delete the transfer. Is the API running?",
					),
				);
			},
		});
	}

	const data = transfers.data;

	const columns = [
		columnHelper.accessor("date", { header: "Date" }),
		columnHelper.display({
			id: "amount",
			header: "Amount",
			cell: ({ row }) => (
				<span className="font-mono tabular-nums text-foreground">
					{formatPaise(row.original.amountMinor)}
				</span>
			),
		}),
		columnHelper.accessor((row) => row.sourceAccountName ?? "Unavailable", {
			id: "source",
			header: "From",
		}),
		columnHelper.accessor(
			(row) => row.destinationAccountName ?? "Unavailable",
			{
				id: "destination",
				header: "To",
			},
		),
		columnHelper.accessor((row) => row.notes ?? "—", {
			id: "notes",
			header: "Notes",
		}),
		columnHelper.display({
			id: "actions",
			header: "",
			cell: ({ row }) => {
				const transfer = row.original;
				return (
					<div className="flex items-center justify-end gap-1.5">
						<Button
							size="sm"
							variant="ghost"
							aria-label={`View transfer from ${transfer.date}`}
							className="h-7 px-2 text-xs"
							onClick={() => setViewing(transfer)}
						>
							<Eye aria-hidden="true" className="size-3.5" />
						</Button>
						<Button
							size="sm"
							variant="ghost"
							className="h-7 gap-1.5 px-2 text-xs"
							onClick={() => handleRestore(transfer)}
						>
							Restore
						</Button>
						{mode === "deleted" && (
							<Button
								size="sm"
								variant="ghost"
								className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
								onClick={() => setConfirming(transfer)}
							>
								Delete forever
							</Button>
						)}
					</div>
				);
			},
		}),
	];

	const table = useReactTable({
		data: data?.transfers ?? [],
		columns,
		getCoreRowModel: getCoreRowModel(),
		manualPagination: true,
		pageCount: data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1,
	});

	if (transfers.isPending) {
		return (
			<div className="flex flex-col gap-2" aria-hidden="true">
				{[0, 1, 2, 3].map((index) => (
					<Skeleton key={index} className="h-10 w-full rounded-md" />
				))}
			</div>
		);
	}

	if (transfers.isError) {
		return (
			<div
				role="alert"
				className="flex flex-col items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-6"
			>
				<p className="text-sm font-medium text-destructive">
					Could not load transfers. Is the API running?
				</p>
				<Button
					variant="outline"
					size="sm"
					onClick={() => {
						transfers.refetch();
					}}
				>
					Retry
				</Button>
			</div>
		);
	}

	if ((data?.transfers.length ?? 0) === 0) {
		return (
			<div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card/40 p-12 text-center">
				<div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
					<ArrowLeftRight aria-hidden="true" className="size-5" />
				</div>
				<p className="mt-3 text-sm text-muted-foreground">
					{mode === "archived" ? "No archived transfers." : "Trash is empty."}
				</p>
			</div>
		);
	}

	const total = data?.total ?? 0;
	const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

	return (
		<>
			<div className="w-full overflow-x-auto rounded-xl border border-border/80">
				<Table className="min-w-[640px]">
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<TableHead key={header.id}>
										{header.isPlaceholder
											? null
											: flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows.map((row) => (
							<TableRow key={row.original.id}>
								{row.getVisibleCells().map((cell) => (
									<TableCell key={cell.id}>
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</TableCell>
								))}
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<p className="text-sm text-muted-foreground">
					Page {page} of {pageCount} · {total} total
				</p>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						disabled={page <= 1}
						onClick={() => setPage((current) => Math.max(1, current - 1))}
					>
						<ChevronLeft aria-hidden="true" className="size-4" />
						Prev
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={page >= pageCount}
						onClick={() =>
							setPage((current) => Math.min(pageCount, current + 1))
						}
					>
						Next
						<ChevronRight aria-hidden="true" className="size-4" />
					</Button>
				</div>
			</div>

			{viewing && (
				<TransferDetailDialog
					transfer={viewing}
					onOpenChange={(open) => {
						if (!open) {
							setViewing(null);
						}
					}}
				/>
			)}
			{restoring && (
				<RestoreTransferDialog
					transfer={restoring}
					pending={restore.isPending}
					onSubmit={handleRestoreWithReassignment}
					onOpenChange={(open) => {
						if (!open) {
							setRestoring(null);
						}
					}}
				/>
			)}
			{confirming && (
				<ConfirmTransactionLifecycleDialog
					action="permanent"
					noun="transfer"
					transactionLabel={confirmLabel(confirming)}
					pending={destroy.isPending}
					onConfirm={handleConfirmPermanentDelete}
					onOpenChange={(open) => {
						if (!open) {
							setConfirming(null);
						}
					}}
				/>
			)}
		</>
	);
}

function confirmLabel(transfer: TransferResponse): string {
	return `Transfer of ${formatPaise(transfer.amountMinor)} from ${transfer.sourceAccountName ?? "account"} to ${transfer.destinationAccountName ?? "account"} on ${transfer.date}`;
}
