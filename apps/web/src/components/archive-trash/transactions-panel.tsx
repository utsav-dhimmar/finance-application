import { ApiError } from "@finance-application/api-client";
import type { TransactionResponse } from "@finance-application/schemas";
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
import { ChevronLeft, ChevronRight, Eye, Receipt } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmTransactionLifecycleDialog } from "@/components/transactions/confirm-transaction-lifecycle-dialog";
import { RestoreTransactionDialog } from "@/components/transactions/restore-transaction-dialog";
import { TransactionDetailDialog } from "@/components/transactions/transaction-detail-dialog";
import {
	usePermanentlyDeleteTransaction,
	useRestoreTransaction,
	useTransactions,
} from "@/hooks/use-transactions";
import { formatPaise } from "@/lib/money";
import { TRANSACTION_TYPE_LABELS } from "@/lib/transaction-labels";
import { getTransactionsErrorMessage } from "@/services/transactions-service";
import type { PanelMode } from "./accounts-panel";

const PAGE_SIZE = 20;

const columnHelper = createColumnHelper<TransactionResponse>();

interface TransactionsPanelProps {
	mode: PanelMode;
}

// The unified Archive/Trash slice for transactions: the paginated
// transaction list in the requested lifecycle state, with the established
// restore flow (reassignment on RESTORE_CONFLICT included), detail
// inspection, and — in trash mode — permanent deletion behind the typed
// confirmation.
export function TransactionsPanel({ mode }: TransactionsPanelProps) {
	const [page, setPage] = useState(1);
	const transactions = useTransactions({
		status: mode,
		page,
		pageSize: PAGE_SIZE,
	});
	const restore = useRestoreTransaction();
	const destroy = usePermanentlyDeleteTransaction();

	const [viewing, setViewing] = useState<TransactionResponse | null>(null);
	const [restoring, setRestoring] = useState<TransactionResponse | null>(null);
	const [confirming, setConfirming] = useState<TransactionResponse | null>(
		null,
	);

	function handleRestore(transaction: TransactionResponse) {
		restore.mutate(
			{ id: transaction.id },
			{
				onSuccess: () => {
					toast.success("Transaction restored.");
				},
				onError: (error) => {
					if (error instanceof ApiError && error.code === "RESTORE_CONFLICT") {
						setRestoring(transaction);
						return;
					}
					toast.error(
						getTransactionsErrorMessage(
							error,
							"Could not restore the transaction. Is the API running?",
						),
					);
				},
			},
		);
	}

	function handleRestoreWithReassignment(reassignment: {
		accountId?: string;
		categoryId?: string;
	}) {
		if (!restoring) {
			return;
		}
		const hadReassignment =
			reassignment.accountId !== undefined ||
			reassignment.categoryId !== undefined;
		restore.mutate(
			{
				id: restoring.id,
				accountId: reassignment.accountId,
				categoryId: reassignment.categoryId,
			},
			{
				onSuccess: () => {
					setRestoring(null);
					toast.success("Transaction restored.");
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
						getTransactionsErrorMessage(
							error,
							"Could not restore the transaction. Is the API running?",
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
				toast.success("Transaction permanently deleted.");
			},
			onError: (error) => {
				setConfirming(null);
				toast.error(
					getTransactionsErrorMessage(
						error,
						"Could not delete the transaction. Is the API running?",
					),
				);
			},
		});
	}

	const data = transactions.data;

	const columns = [
		columnHelper.accessor("date", { header: "Date" }),
		columnHelper.display({
			id: "type",
			header: "Type",
			cell: ({ row }) => TRANSACTION_TYPE_LABELS[row.original.type],
		}),
		columnHelper.display({
			id: "amount",
			header: "Amount",
			cell: ({ row }) => (
				<span className="font-mono tabular-nums text-foreground">
					{formatPaise(row.original.amountMinor)}
				</span>
			),
		}),
		columnHelper.accessor((row) => row.accountName ?? "Unavailable", {
			id: "account",
			header: "Account",
		}),
		columnHelper.accessor((row) => row.categoryName ?? "—", {
			id: "category",
			header: "Category",
		}),
		columnHelper.accessor((row) => row.notes ?? "—", {
			id: "notes",
			header: "Notes",
		}),
		columnHelper.display({
			id: "actions",
			header: "",
			cell: ({ row }) => {
				const transaction = row.original;
				return (
					<div className="flex items-center justify-end gap-1.5">
						<Button
							size="sm"
							variant="ghost"
							aria-label={`View transaction from ${transaction.date}`}
							className="h-7 px-2 text-xs"
							onClick={() => setViewing(transaction)}
						>
							<Eye aria-hidden="true" className="size-3.5" />
						</Button>
						<Button
							size="sm"
							variant="ghost"
							className="h-7 gap-1.5 px-2 text-xs"
							onClick={() => handleRestore(transaction)}
						>
							Restore
						</Button>
						{mode === "deleted" && (
							<Button
								size="sm"
								variant="ghost"
								className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
								onClick={() => setConfirming(transaction)}
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
		data: data?.transactions ?? [],
		columns,
		getCoreRowModel: getCoreRowModel(),
		manualPagination: true,
		pageCount: data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1,
	});

	if (transactions.isPending) {
		return (
			<div className="flex flex-col gap-2" aria-hidden="true">
				{[0, 1, 2, 3].map((index) => (
					<Skeleton key={index} className="h-10 w-full rounded-md" />
				))}
			</div>
		);
	}

	if (transactions.isError) {
		return (
			<div
				role="alert"
				className="flex flex-col items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-6"
			>
				<p className="text-sm font-medium text-destructive">
					Could not load transactions. Is the API running?
				</p>
				<Button
					variant="outline"
					size="sm"
					onClick={() => {
						transactions.refetch();
					}}
				>
					Retry
				</Button>
			</div>
		);
	}

	if ((data?.transactions.length ?? 0) === 0) {
		return (
			<div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card/40 p-12 text-center">
				<div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
					<Receipt aria-hidden="true" className="size-5" />
				</div>
				<p className="mt-3 text-sm text-muted-foreground">
					{mode === "archived"
						? "No archived transactions."
						: "Trash is empty."}
				</p>
			</div>
		);
	}

	const total = data?.total ?? 0;
	const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

	return (
		<>
			<div className="overflow-hidden rounded-xl border border-border/80">
				<Table>
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
			<div className="flex items-center justify-between">
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
				<TransactionDetailDialog
					transaction={viewing}
					onOpenChange={(open) => {
						if (!open) {
							setViewing(null);
						}
					}}
				/>
			)}
			{restoring && (
				<RestoreTransactionDialog
					transaction={restoring}
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
					noun="transaction"
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

function confirmLabel(transaction: TransactionResponse): string {
	return `${TRANSACTION_TYPE_LABELS[transaction.type]} of ${formatPaise(transaction.amountMinor)} on ${transaction.date}`;
}
