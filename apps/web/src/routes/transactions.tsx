import { ApiError } from "@finance-application/api-client";
import type {
	ListTransactionsQuery,
	TransactionResponse,
} from "@finance-application/schemas";
import { Button } from "@finance-application/ui/components/button";
import { Input } from "@finance-application/ui/components/input";
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
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger,
		SelectValue,
	} from "@finance-application/ui/components/select";
	import {
		Tabs,
		TabsList,
		TabsTrigger,
	} from "@finance-application/ui/components/tabs";
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	ChevronLeft,
	ChevronRight,
	Eye,
	Pencil,
	Plus,
	RotateCcw,
	Receipt,
	Search,
	Trash2,
} from "lucide-react";
import { useEffect, useMemo, useReducer, useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { ConfirmTransactionLifecycleDialog } from "@/components/transactions/confirm-transaction-lifecycle-dialog";
import { CreateTransactionDialog } from "@/components/transactions/create-transaction-dialog";
import { EditTransactionDialog } from "@/components/transactions/edit-transaction-dialog";
import { RestoreTransactionDialog } from "@/components/transactions/restore-transaction-dialog";
import { TransactionDetailDialog } from "@/components/transactions/transaction-detail-dialog";
import {
	useAccounts,
} from "@/hooks/use-accounts";
import {
	useCategories,
} from "@/hooks/use-categories";
import {
	useArchiveTransaction,
	useDeleteTransaction,
	usePermanentlyDeleteTransaction,
	useRestoreTransaction,
	useTransactions,
} from "@/hooks/use-transactions";
import { useDebounce } from "@/hooks/use-debounce";
import { useMe } from "@/hooks/use-auth";
import { formatPaise } from "@/lib/money";
import { TRANSACTION_TYPE_LABELS } from "@/lib/transaction-labels";
import { getTransactionsErrorMessage } from "@/services/transactions-service";

export const Route = createFileRoute("/transactions")({
	component: TransactionsPage,
});

type TransactionsTab = "active" | "archived" | "deleted";

const TAB_LABELS: Record<TransactionsTab, string> = {
	active: "Active",
	archived: "Archived",
	deleted: "Trash",
};

const EMPTY_MESSAGES: Record<TransactionsTab, string> = {
	active: "No transactions yet. Record your first income or expense.",
	archived: "No archived transactions.",
	deleted: "Trash is empty.",
};

const PAGE_SIZE = 20;

const columnHelper = createColumnHelper<TransactionResponse>();

function formatSignedAmount(transaction: TransactionResponse): string {
	const sign = transaction.type === "income" ? "+" : "−";
	return `${sign}${formatPaise(transaction.amountMinor)}`;
}

// The "all" sentinels keep Base UI's controlled value non-empty; the reducer
// stores "" for "no filter", so the Select value derives and maps back.
const ALL_TYPES = "all-types";
const ALL_ACCOUNTS = "all-accounts";
const ALL_CATEGORIES = "all-categories";

const TYPE_FILTER_ITEMS = [
	{ value: ALL_TYPES, label: "All types" },
	{ value: "income", label: "Income" },
	{ value: "expense", label: "Expense" },
];

// All list-shaping state lives in one reducer: every filter change resets the
// page, the type change invalidates the chosen category, and the search input
// updates freely until the debounce lands it in `q`.
interface TransactionsFilterState {
	tab: TransactionsTab;
	type: string;
	accountId: string;
	categoryId: string;
	from: string;
	to: string;
	searchInput: string;
	q: string;
	page: number;
}

const initialFilterState: TransactionsFilterState = {
	tab: "active",
	type: "",
	accountId: "",
	categoryId: "",
	from: "",
	to: "",
	searchInput: "",
	q: "",
	page: 1,
};

type TransactionsFilterAction =
	| { type: "setTab"; value: TransactionsTab }
	| { type: "setType"; value: string }
	| { type: "setAccount"; value: string }
	| { type: "setCategory"; value: string }
	| { type: "setFrom"; value: string }
	| { type: "setTo"; value: string }
	| { type: "setSearchInput"; value: string }
	| { type: "applyDebouncedQuery"; value: string }
	| { type: "setPage"; value: number };

function transactionsFilterReducer(
	state: TransactionsFilterState,
	action: TransactionsFilterAction,
): TransactionsFilterState {
	switch (action.type) {
		case "setTab":
			if (action.value === state.tab) {
				return state;
			}
			return { ...state, tab: action.value, page: 1 };
		case "setType":
			return { ...state, type: action.value, categoryId: "", page: 1 };
		case "setAccount":
			return { ...state, accountId: action.value, page: 1 };
		case "setCategory":
			return { ...state, categoryId: action.value, page: 1 };
		case "setFrom":
			return { ...state, from: action.value, page: 1 };
		case "setTo":
			return { ...state, to: action.value, page: 1 };
		case "setSearchInput":
			return { ...state, searchInput: action.value };
		case "applyDebouncedQuery": {
			const q = action.value.trim();
			if (q === state.q) {
				return state;
			}
			return { ...state, q, page: 1 };
		}
		case "setPage":
			return { ...state, page: Math.max(1, action.value) };
	}
}

export function TransactionsPage() {
	const navigate = useNavigate();
	const me = useMe();

	const [filterState, dispatchFilter] = useReducer(
		transactionsFilterReducer,
		initialFilterState,
	);
	// The raw input stays responsive; the query lands via the shared debounce.
	const debouncedSearch = useDebounce(filterState.searchInput, 300);
	useEffect(() => {
		dispatchFilter({ type: "applyDebouncedQuery", value: debouncedSearch });
	}, [debouncedSearch]);

	const filters: Partial<ListTransactionsQuery> = useMemo(
		() => ({
			status: filterState.tab,
			...(filterState.type
				? { type: filterState.type as ListTransactionsQuery["type"] }
				: {}),
			...(filterState.accountId
				? { accountId: filterState.accountId }
				: {}),
			...(filterState.categoryId
				? { categoryId: filterState.categoryId }
				: {}),
			...(filterState.from ? { from: filterState.from } : {}),
			...(filterState.to ? { to: filterState.to } : {}),
			...(filterState.q ? { q: filterState.q } : {}),
			page: filterState.page,
			pageSize: PAGE_SIZE,
		}),
		[filterState],
	);

	const transactions = useTransactions(filters);
	const accounts = useAccounts("active");
	const categories = useCategories("active");

	const archive = useArchiveTransaction();
	const remove = useDeleteTransaction();
	const restore = useRestoreTransaction();
	const destroy = usePermanentlyDeleteTransaction();

	const [createOpen, setCreateOpen] = useState(false);
	const [editing, setEditing] = useState<TransactionResponse | null>(null);
	const [viewing, setViewing] = useState<TransactionResponse | null>(null);
	const [confirming, setConfirming] = useState<{
		action: "archive" | "delete" | "permanent";
		transaction: TransactionResponse;
	} | null>(null);
	const [renaming, setRenaming] = useState<TransactionResponse | null>(null);

	// Guard: unauthenticated visitors are sent to /login without ever seeing
	// transaction data.
	useEffect(() => {
		if (me.data === null) {
			navigate({ to: "/login" });
		}
	}, [me.data, navigate]);

	function handleRestore(transaction: TransactionResponse) {
		restore.mutate(
			{ id: transaction.id },
			{
				onSuccess: () => {
					toast.success("Transaction restored.");
				},
				onError: (error) => {
					if (
						error instanceof ApiError &&
						error.code === "RESTORE_CONFLICT"
					) {
						setRenaming(transaction);
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
		if (!renaming) {
			return;
		}
		restore.mutate(
			{ id: renaming.id, ...reassignment },
			{
				onSuccess: () => {
					setRenaming(null);
					toast.success("Transaction restored.");
				},
				onError: (error) => {
					if (
						error instanceof ApiError &&
						error.code === "RESTORE_CONFLICT" &&
						(reassignment.accountId || reassignment.categoryId)
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

	function handleConfirmLifecycle() {
		if (!confirming) {
			return;
		}
		const { action, transaction } = confirming;
		const mutation =
			action === "archive"
				? archive
				: action === "delete"
					? remove
					: destroy;
		mutation.mutate(transaction.id, {
			onSuccess: () => {
				setConfirming(null);
				toast.success(
					action === "archive"
						? "Transaction archived."
						: action === "delete"
							? "Transaction moved to trash."
							: "Transaction permanently deleted.",
				);
			},
			onError: (error) => {
				setConfirming(null);
				toast.error(
					getTransactionsErrorMessage(
						error,
						"The change failed. Is the API running?",
					),
				);
			},
		});
	}

	const data = transactions.data;

	// "All" entries for the filter selects, led by their sentinel values.
	const accountFilterItems = [
		{ value: ALL_ACCOUNTS, label: "All accounts" },
		...(accounts.data?.accounts ?? []).map((account) => ({
			value: account.id,
			label: account.name,
		})),
	];
	const categoryFilterItems = [
		{ value: ALL_CATEGORIES, label: "All categories" },
		...(categories.data?.categories ?? []).map((category) => ({
			value: category.id,
			label: category.name,
		})),
	];

	const columns = [
			columnHelper.accessor("date", { header: "Date" }),
			columnHelper.accessor("type", {
				header: "Type",
				cell: (info) => TRANSACTION_TYPE_LABELS[info.getValue()],
			}),
			columnHelper.display({
				id: "amount",
				header: "Amount",
				cell: ({ row }) => (
					<span
						className={`font-mono tabular-nums ${
							row.original.type === "income"
								? "text-foreground"
								: "text-foreground"
						}`}
					>
						{formatSignedAmount(row.original)}
					</span>
				),
			}),
			columnHelper.accessor((row) => row.accountName ?? "Unavailable", {
				id: "account",
				header: "Account",
			}),
			columnHelper.accessor((row) => row.categoryName ?? "Unavailable", {
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
							{transaction.status === "active" && (
								<>
									<Button
										size="sm"
										variant="ghost"
										className="h-7 px-2 text-xs"
										onClick={() => setEditing(transaction)}
									>
										<Pencil aria-hidden="true" className="size-3.5" />
										Edit
									</Button>
									<Button
										size="sm"
										variant="ghost"
										className="h-7 px-2 text-xs"
										onClick={() => {
											setConfirming({ action: "archive", transaction });
										}}
									>
										Archive
									</Button>
									<Button
										size="sm"
										variant="ghost"
										className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
										onClick={() => {
											setConfirming({ action: "delete", transaction });
										}}
									>
										<Trash2 aria-hidden="true" className="size-3.5" />
										Delete
									</Button>
								</>
							)}
							{(transaction.status === "archived" ||
								transaction.status === "deleted") && (
								<>
									<Button
										size="sm"
										variant="ghost"
										className="h-7 gap-1.5 px-2 text-xs"
										onClick={() => handleRestore(transaction)}
									>
										<RotateCcw aria-hidden="true" className="size-3.5" />
										Restore
									</Button>
									{transaction.status === "deleted" && (
										<Button
											size="sm"
											variant="ghost"
											className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
											onClick={() => {
												setConfirming({
													action: "permanent",
													transaction,
												});
											}}
										>
											Delete forever
										</Button>
									)}
								</>
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

	if (me.isPending || me.data === undefined) {
		return (
			<main className="flex min-h-screen items-center justify-center p-8">
				<p aria-live="polite" className="text-sm text-muted-foreground animate-pulse">
					Loading...
				</p>
			</main>
		);
	}

	if (me.data === null) {
		return null;
	}

	const total = data?.total ?? 0;
	const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

	return (
		<div className="flex min-h-screen flex-col bg-background">
			<AppHeader />
			<main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-6 md:p-8">
				{/* Page Header */}
				<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
							Transactions
						</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							{total} transaction{total === 1 ? "" : "s"} in this view.
						</p>
					</div>
					<Button onClick={() => setCreateOpen(true)} className="gap-1.5 shadow-xs">
						<Plus aria-hidden="true" className="size-4" />
						Record transaction
					</Button>
				</div>

				{/* Status tabs */}
				<div className="flex items-center">
					<Tabs
						value={filterState.tab}
						onValueChange={(value) => {
							dispatchFilter({ type: "setTab", value: value as TransactionsTab });
						}}
					>
						<TabsList className="bg-muted/70 p-1">
							{(Object.keys(TAB_LABELS) as TransactionsTab[]).map((status) => (
								<TabsTrigger key={status} value={status} className="px-3 text-xs">
									{TAB_LABELS[status]}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				</div>

				{/* Filter bar */}
				<div className="grid grid-cols-2 gap-3 md:grid-cols-7">
					<div className="relative col-span-2">
						<Search
							aria-hidden="true"
							className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
						/>
						<Input
							aria-label="Search transactions"
							placeholder="Search notes, account, category…"
							className="pl-8"
							value={filterState.searchInput}
							onChange={(event) =>
								dispatchFilter({
									type: "setSearchInput",
									value: event.target.value,
								})
							}
						/>
					</div>
					<Input
						aria-label="From date"
						type="date"
						value={filterState.from}
						onChange={(event) => {
							dispatchFilter({ type: "setFrom", value: event.target.value });
						}}
					/>
					<Input
						aria-label="To date"
						type="date"
						value={filterState.to}
						onChange={(event) => {
							dispatchFilter({ type: "setTo", value: event.target.value });
						}}
					/>
					<Select
						items={TYPE_FILTER_ITEMS}
						value={filterState.type || ALL_TYPES}
						onValueChange={(value) =>
							dispatchFilter({
								type: "setType",
								value: value === ALL_TYPES || value === null ? "" : value,
							})
						}

					>
						<SelectTrigger aria-label="Type filter" className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{TYPE_FILTER_ITEMS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select
						items={accountFilterItems}
						value={filterState.accountId || ALL_ACCOUNTS}
						onValueChange={(value) =>
							dispatchFilter({
								type: "setAccount",
								value: value === ALL_ACCOUNTS || value === null ? "" : value,
							})
						}
					>
						<SelectTrigger aria-label="Account filter" className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{accountFilterItems.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select
						items={categoryFilterItems}
						value={filterState.categoryId || ALL_CATEGORIES}
						onValueChange={(value) =>
							dispatchFilter({
								type: "setCategory",
								value: value === ALL_CATEGORIES || value === null ? "" : value,
							})
						}
					>
						<SelectTrigger
							aria-label="Category filter"
							className="col-span-2 w-full md:col-span-1"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{categoryFilterItems.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{/* Table content / states */}
				{transactions.isPending ? (
					<div className="flex flex-col gap-2" aria-hidden="true">
						{[0, 1, 2, 3, 4].map((index) => (
							<Skeleton key={index} className="h-10 w-full rounded-md" />
						))}
					</div>
				) : transactions.isError ? (
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
				) : (data?.transactions.length ?? 0) === 0 ? (
					<div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card/40 p-12 text-center">
						<div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
							<Receipt aria-hidden="true" className="size-5" />
						</div>
						<p className="mt-3 text-sm text-muted-foreground">
							{EMPTY_MESSAGES[filterState.tab]}
						</p>
						{filterState.tab === "active" && (
							<Button
								variant="outline"
								size="sm"
								className="mt-4 gap-1.5"
								onClick={() => setCreateOpen(true)}
							>
								<Plus aria-hidden="true" className="size-3.5" />
								Record your first transaction
							</Button>
						)}
					</div>
				) : (
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
										<TableRow key={row.id}>
											{row.getVisibleCells().map((cell) => (
												<TableCell key={cell.id}>
													{flexRender(
														cell.column.columnDef.cell,
														cell.getContext(),
													)}
												</TableCell>
											))}
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
						{/* Pagination */}
						<div className="flex items-center justify-between">
							<p className="text-sm text-muted-foreground">
								Page {filterState.page} of {pageCount} · {total} total
							</p>
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="sm"
									disabled={filterState.page <= 1}
									onClick={() =>
									dispatchFilter({
										type: "setPage",
										value: filterState.page - 1,
									})
								}
								>
									<ChevronLeft aria-hidden="true" className="size-4" />
									Prev
								</Button>
								<Button
									variant="outline"
									size="sm"
									disabled={filterState.page >= pageCount}
									onClick={() =>
										dispatchFilter({
											type: "setPage",
											value: Math.min(pageCount, filterState.page + 1),
										})
									}
								>
									Next
									<ChevronRight aria-hidden="true" className="size-4" />
								</Button>
							</div>
						</div>
					</>
				)}
			</main>

			<CreateTransactionDialog open={createOpen} onOpenChange={setCreateOpen} />
			{editing && (
				<EditTransactionDialog
					transaction={editing}
					onOpenChange={(open) => {
						if (!open) {
							setEditing(null);
						}
					}}
				/>
			)}
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
			{confirming && (
				<ConfirmTransactionLifecycleDialog
					action={confirming.action}
					transactionLabel={`${TRANSACTION_TYPE_LABELS[confirming.transaction.type]} of ${formatSignedAmount(confirming.transaction)} on ${confirming.transaction.date}`}
					pending={
						archive.isPending || remove.isPending || destroy.isPending
					}
					onConfirm={handleConfirmLifecycle}
					onOpenChange={(open) => {
						if (!open) {
							setConfirming(null);
						}
					}}
				/>
			)}
			{renaming && (
				<RestoreTransactionDialog
					transaction={renaming}
					pending={restore.isPending}
					onSubmit={handleRestoreWithReassignment}
					onOpenChange={(open) => {
						if (!open) {
							setRenaming(null);
						}
					}}
				/>
			)}
		</div>
	);
}
