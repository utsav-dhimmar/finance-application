import { ApiError } from "@finance-application/api-client";
import type {
	ActivityItem,
	ListActivityQuery,
	TransactionResponse,
	TransferResponse,
} from "@finance-application/schemas";
import { Badge } from "@finance-application/ui/components/badge";
import { Button } from "@finance-application/ui/components/button";
import { Input } from "@finance-application/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@finance-application/ui/components/select";
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
	Tabs,
	TabsList,
	TabsTrigger,
} from "@finance-application/ui/components/tabs";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	createColumnHelper,
	flexRender,
	useTable,
} from "@tanstack/react-table";
import {
	ChevronLeft,
	ChevronRight,
	Eye,
	Pencil,
	Plus,
	Receipt,
	RotateCcw,
	Search,
	Trash2,
} from "lucide-react";
import { useEffect, useMemo, useReducer, useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { DueRecurringExpensesCard } from "@/components/recurring-expenses/due-recurring-expenses-card";
import { ConfirmTransactionLifecycleDialog } from "@/components/transactions/confirm-transaction-lifecycle-dialog";
import { RestoreTransactionDialog } from "@/components/transactions/restore-transaction-dialog";
import { TransactionDetailDialog } from "@/components/transactions/transaction-detail-dialog";
import { TransactionFormDialog } from "@/components/transactions/transaction-form-dialog";
import { RestoreTransferDialog } from "@/components/transfers/restore-transfer-dialog";
import { TransferDetailDialog } from "@/components/transfers/transfer-detail-dialog";
import { TransferFormDialog } from "@/components/transfers/transfer-form-dialog";
import { useAccounts } from "@/hooks/use-accounts";
import { useMe } from "@/hooks/use-auth";
import { useCategories } from "@/hooks/use-categories";
import { useDebounce } from "@/hooks/use-debounce";
import {
	useArchiveTransaction,
	useDeleteTransaction,
	usePermanentlyDeleteTransaction,
	useRestoreTransaction,
} from "@/hooks/use-transactions";
import {
	useActivity,
	useArchiveTransfer,
	useDeleteTransfer,
	usePermanentlyDeleteTransfer,
	useRestoreTransfer,
} from "@/hooks/use-transfers";
import { formatPaise } from "@/lib/money";
import {
	coreTableFeatures,
	type CoreTableFeatures,
} from "@/lib/table-features";
import { TRANSACTION_TYPE_LABELS } from "@/lib/transaction-labels";
import {
	TRANSFER_DIRECTION_LABELS,
	TRANSFER_STATUS_LABELS,
} from "@/lib/transfer-labels";
import { getTransactionsErrorMessage } from "@/services/transactions-service";
import { getTransfersErrorMessage } from "@/services/transfers-service";

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

const columnHelper = createColumnHelper<CoreTableFeatures, ActivityItem>();

// The activity rows carry signed amounts (the effect on the row's account);
// transactions and transfers re-derive their unsigned API shape from them.
function transactionFromActivity(row: ActivityItem): TransactionResponse {
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

function transferFromActivity(row: ActivityItem): TransferResponse {
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

function formatSignedAmount(item: ActivityItem): string {
	const sign = item.amountMinor < 0 ? "−" : "+";
	return `${sign}${formatPaise(Math.abs(item.amountMinor))}`;
}

// The "all" sentinels keep Base UI's controlled value non-empty; the reducer
// stores "" for "no filter", so the Select value derives and maps back.
const ALL_TYPES = "all-types";
const ALL_ACCOUNTS = "all-accounts";
const ALL_CATEGORIES = "all-categories";

// The type filter extends the transaction types with transfers: the
// activity feed's transfer-aware option.
const TYPE_FILTER_ITEMS = [
	{ value: ALL_TYPES, label: "All types" },
	{ value: "income", label: "Income" },
	{ value: "expense", label: "Expense" },
	{ value: "transfer", label: "Transfers" },
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

interface ConfirmingState {
	action: "archive" | "delete" | "permanent";
	kind: "transaction" | "transfer";
	id: string;
	label: string;
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

	const filters: Partial<ListActivityQuery> = useMemo(
		() => ({
			status: filterState.tab,
			...(filterState.type
				? { type: filterState.type as ListActivityQuery["type"] }
				: {}),
			...(filterState.accountId ? { accountId: filterState.accountId } : {}),
			...(filterState.categoryId ? { categoryId: filterState.categoryId } : {}),
			...(filterState.from ? { from: filterState.from } : {}),
			...(filterState.to ? { to: filterState.to } : {}),
			...(filterState.q ? { q: filterState.q } : {}),
			page: filterState.page,
			pageSize: PAGE_SIZE,
		}),
		[filterState],
	);

	const activity = useActivity(filters);
	const accounts = useAccounts("active");
	const categories = useCategories("active");

	// Transaction mutations.
	const archiveTransaction = useArchiveTransaction();
	const deleteTransaction = useDeleteTransaction();
	const restoreTransaction = useRestoreTransaction();
	const destroyTransaction = usePermanentlyDeleteTransaction();
	// Transfer mutations.
	const archiveTransfer = useArchiveTransfer();
	const deleteTransfer = useDeleteTransfer();
	const restoreTransfer = useRestoreTransfer();
	const destroyTransfer = usePermanentlyDeleteTransfer();

	const [createOpen, setCreateOpen] = useState(false);
	const [createTransferOpen, setCreateTransferOpen] = useState(false);
	const [editing, setEditing] = useState<{
		kind: "transaction" | "transfer";
		row: ActivityItem;
	} | null>(null);
	const [viewing, setViewing] = useState<{
		kind: "transaction" | "transfer";
		row: ActivityItem;
	} | null>(null);
	const [confirming, setConfirming] = useState<ConfirmingState | null>(null);
	const [restoring, setRestoring] = useState<{
		kind: "transaction" | "transfer";
		row: ActivityItem;
	} | null>(null);

	// Guard: unauthenticated visitors are sent to /login without ever seeing
	// transaction data.
	useEffect(() => {
		if (me.data === null) {
			navigate({ to: "/login" });
		}
	}, [me.data, navigate]);

	function handleRestore(kind: "transaction" | "transfer", row: ActivityItem) {
		const onSuccess = () => {
			toast.success(
				kind === "transfer" ? "Transfer restored." : "Transaction restored.",
			);
		};
		const onError = (error: unknown) => {
			if (error instanceof ApiError && error.code === "RESTORE_CONFLICT") {
				setRestoring({ kind, row });
				return;
			}
			toast.error(
				kind === "transfer"
					? getTransfersErrorMessage(
							error,
							"Could not restore the transfer. Is the API running?",
						)
					: getTransactionsErrorMessage(
							error,
							"Could not restore the transaction. Is the API running?",
						),
			);
		};
		if (kind === "transfer") {
			restoreTransfer.mutate({ id: row.id }, { onSuccess, onError });
		} else {
			restoreTransaction.mutate({ id: row.id }, { onSuccess, onError });
		}
	}

	function handleRestoreWithReassignment(reassignment: {
		accountId?: string;
		categoryId?: string;
		sourceAccountId?: string;
		destinationAccountId?: string;
	}) {
		if (!restoring) {
			return;
		}
		const { kind, row } = restoring;
		const hadReassignment =
			reassignment.accountId !== undefined ||
			reassignment.categoryId !== undefined ||
			reassignment.sourceAccountId !== undefined ||
			reassignment.destinationAccountId !== undefined;
		const onError = (error: unknown) => {
			if (
				error instanceof ApiError &&
				error.code === "RESTORE_CONFLICT" &&
				hadReassignment
			) {
				toast.error("Still conflicting: pick a different account or category.");
				return;
			}
			toast.error(
				kind === "transfer"
					? getTransfersErrorMessage(
							error,
							"Could not restore the transfer. Is the API running?",
						)
					: getTransactionsErrorMessage(
							error,
							"Could not restore the transaction. Is the API running?",
						),
			);
		};
		if (kind === "transfer") {
			restoreTransfer.mutate(
				{
					id: row.id,
					sourceAccountId: reassignment.sourceAccountId,
					destinationAccountId: reassignment.destinationAccountId,
				},
				{
					onSuccess: () => {
						setRestoring(null);
						toast.success("Transfer restored.");
					},
					onError,
				},
			);
		} else {
			restoreTransaction.mutate(
				{
					id: row.id,
					accountId: reassignment.accountId,
					categoryId: reassignment.categoryId,
				},
				{
					onSuccess: () => {
						setRestoring(null);
						toast.success("Transaction restored.");
					},
					onError,
				},
			);
		}
	}

	function handleConfirmLifecycle() {
		if (!confirming) {
			return;
		}
		const { action, kind, id } = confirming;
		const noun = kind === "transfer" ? "Transfer" : "Transaction";
		const successCopy =
			action === "archive"
				? `${noun} archived.`
				: action === "delete"
					? `${noun} moved to trash.`
					: `${noun} permanently deleted.`;
		const onSuccess = () => {
			setConfirming(null);
			toast.success(successCopy);
		};
		const onError = (error: unknown) => {
			setConfirming(null);
			toast.error(
				kind === "transfer"
					? getTransfersErrorMessage(
							error,
							"The change failed. Is the API running?",
						)
					: getTransactionsErrorMessage(
							error,
							"The change failed. Is the API running?",
						),
			);
		};
		if (kind === "transfer") {
			const mutation =
				action === "archive"
					? archiveTransfer
					: action === "delete"
						? deleteTransfer
						: destroyTransfer;
			mutation.mutate(id, { onSuccess, onError });
		} else {
			const mutation =
				action === "archive"
					? archiveTransaction
					: action === "delete"
						? deleteTransaction
						: destroyTransaction;
			mutation.mutate(id, { onSuccess, onError });
		}
	}

	const data = activity.data;

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

	const columns = columnHelper.columns([
		columnHelper.accessor("date", { header: "Date" }),
		columnHelper.display({
			id: "type",
			header: "Type",
			cell: ({ row }) => {
				const item = row.original;
				if (item.kind === "transaction") {
					return item.type ? TRANSACTION_TYPE_LABELS[item.type] : "—";
				}
				return (
					<span className="flex flex-wrap items-center gap-1.5">
						Transfer
						<Badge variant="outline" className="px-1.5 text-[11px]">
							{TRANSFER_DIRECTION_LABELS[item.direction ?? "out"]}
						</Badge>
						{item.status !== "active" && (
							<Badge variant="outline" className="px-1.5 text-[11px]">
								{TRANSFER_STATUS_LABELS[item.status]}
							</Badge>
						)}
					</span>
				);
			},
		}),
		columnHelper.display({
			id: "amount",
			header: "Amount",
			cell: ({ row }) => (
				<span className="font-mono tabular-nums text-foreground">
					{formatSignedAmount(row.original)}
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
				const item = row.original;
				const kind = item.kind;
				const noun = kind === "transfer" ? "transfer" : "transaction";
				return (
					<div className="flex items-center justify-end gap-1.5">
						<Button
							size="sm"
							variant="ghost"
							aria-label={`View ${noun} from ${item.date}`}
							className="h-7 px-2 text-xs"
							onClick={() => setViewing({ kind, row: item })}
						>
							<Eye aria-hidden="true" className="size-3.5" />
						</Button>
						{item.status === "active" && (
							<>
								<Button
									size="sm"
									variant="ghost"
									className="h-7 px-2 text-xs"
									onClick={() => setEditing({ kind, row: item })}
								>
									<Pencil aria-hidden="true" className="size-3.5" />
									Edit
								</Button>
								<Button
									size="sm"
									variant="ghost"
									className="h-7 px-2 text-xs"
									onClick={() => {
										setConfirming({
											action: "archive",
											kind,
											id: item.id,
											label: confirmLabel(item),
										});
									}}
								>
									Archive
								</Button>
								<Button
									size="sm"
									variant="ghost"
									className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
									onClick={() => {
										setConfirming({
											action: "delete",
											kind,
											id: item.id,
											label: confirmLabel(item),
										});
									}}
								>
									<Trash2 aria-hidden="true" className="size-3.5" />
									Delete
								</Button>
							</>
						)}
						{(item.status === "archived" || item.status === "deleted") && (
							<>
								<Button
									size="sm"
									variant="ghost"
									className="h-7 gap-1.5 px-2 text-xs"
									onClick={() => handleRestore(kind, item)}
								>
									<RotateCcw aria-hidden="true" className="size-3.5" />
									Restore
								</Button>
								{item.status === "deleted" && (
									<Button
										size="sm"
										variant="ghost"
										className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
										onClick={() => {
											setConfirming({
												action: "permanent",
												kind,
												id: item.id,
												label: confirmLabel(item),
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
	]);

	// Pagination is fully manual (server-side), so no table features or
	// pagination state are registered; the table instance only renders rows.
	const table = useTable({
		features: coreTableFeatures,
		data: data?.activity ?? [],
		columns,
	});

	if (me.isPending || me.data === undefined) {
		return (
			<main className="flex min-h-screen items-center justify-center p-8">
				<p
					aria-live="polite"
					className="text-sm text-muted-foreground animate-pulse"
				>
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
	const lifecyclePending =
		archiveTransaction.isPending ||
		deleteTransaction.isPending ||
		destroyTransaction.isPending ||
		archiveTransfer.isPending ||
		deleteTransfer.isPending ||
		destroyTransfer.isPending;

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
							{total} record{total === 1 ? "" : "s"} in this view.
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<Button
							variant="outline"
							onClick={() => setCreateTransferOpen(true)}
							className="gap-1.5 shadow-xs"
						>
							<Plus aria-hidden="true" className="size-4" />
							New transfer
						</Button>
						<Button
							onClick={() => setCreateOpen(true)}
							className="gap-1.5 shadow-xs"
						>
							<Plus aria-hidden="true" className="size-4" />
							Record transaction
						</Button>
					</div>
				</div>

				<DueRecurringExpensesCard />

				{/* Status tabs */}
				<div className="flex items-center">
					<Tabs
						value={filterState.tab}
						onValueChange={(value) => {
							dispatchFilter({
								type: "setTab",
								value: value as TransactionsTab,
							});
						}}
					>
						<TabsList className="bg-muted/70 p-1">
							{(Object.keys(TAB_LABELS) as TransactionsTab[]).map((status) => (
								<TabsTrigger
									key={status}
									value={status}
									className="px-3 text-xs"
								>
									{TAB_LABELS[status]}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				</div>

				{/* Filter bar */}
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
					<div className="relative sm:col-span-2">
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
						<SelectTrigger aria-label="Category filter" className="w-full">
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
				{activity.isPending ? (
					<div className="flex flex-col gap-2" aria-hidden="true">
						{[0, 1, 2, 3, 4].map((index) => (
							<Skeleton key={index} className="h-10 w-full rounded-md" />
						))}
					</div>
				) : activity.isError ? (
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
								activity.refetch();
							}}
						>
							Retry
						</Button>
					</div>
				) : (data?.activity.length ?? 0) === 0 ? (
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
						<div className="w-full overflow-x-auto rounded-xl border border-border/80">
							<Table className="min-w-160">
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
										<TableRow
											key={`${row.original.kind}:${row.original.id}:${row.original.direction ?? ""}`}
										>
											{row.getAllCells().map((cell) => (
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
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

			<TransactionFormDialog open={createOpen} onOpenChange={setCreateOpen} />
			<TransferFormDialog
				open={createTransferOpen}
				onOpenChange={setCreateTransferOpen}
			/>
			{editing &&
				(editing.kind === "transaction" ? (
					<TransactionFormDialog
						open
						transaction={transactionFromActivity(editing.row)}
						onOpenChange={(open) => {
							if (!open) {
								setEditing(null);
							}
						}}
					/>
				) : (
					<TransferFormDialog
						open
						transfer={transferFromActivity(editing.row)}
						onOpenChange={(open) => {
							if (!open) {
								setEditing(null);
							}
						}}
					/>
				))}
			{viewing &&
				(viewing.kind === "transaction" ? (
					<TransactionDetailDialog
						transaction={transactionFromActivity(viewing.row)}
						onOpenChange={(open) => {
							if (!open) {
								setViewing(null);
							}
						}}
					/>
				) : (
					<TransferDetailDialog
						transfer={transferFromActivity(viewing.row)}
						onOpenChange={(open) => {
							if (!open) {
								setViewing(null);
							}
						}}
					/>
				))}
			{confirming && (
				<ConfirmTransactionLifecycleDialog
					action={confirming.action}
					noun={confirming.kind === "transfer" ? "transfer" : "transaction"}
					transactionLabel={confirming.label}
					pending={lifecyclePending}
					onConfirm={handleConfirmLifecycle}
					onOpenChange={(open) => {
						if (!open) {
							setConfirming(null);
						}
					}}
				/>
			)}
			{restoring &&
				(restoring.kind === "transaction" ? (
					<RestoreTransactionDialog
						transaction={transactionFromActivity(restoring.row)}
						pending={restoreTransaction.isPending}
						onSubmit={handleRestoreWithReassignment}
						onOpenChange={(open) => {
							if (!open) {
								setRestoring(null);
							}
						}}
					/>
				) : (
					<RestoreTransferDialog
						transfer={transferFromActivity(restoring.row)}
						pending={restoreTransfer.isPending}
						onSubmit={handleRestoreWithReassignment}
						onOpenChange={(open) => {
							if (!open) {
								setRestoring(null);
							}
						}}
					/>
				))}
		</div>
	);
}

function confirmLabel(item: ActivityItem): string {
	if (item.kind === "transfer") {
		const direction =
			item.direction === "in"
				? `into ${item.accountName ?? "account"}`
				: `out of ${item.accountName ?? "account"}`;
		return `Transfer of ${formatPaise(Math.abs(item.amountMinor))} ${direction} on ${item.date}`;
	}
	return `${item.type ? TRANSACTION_TYPE_LABELS[item.type] : "Transaction"} of ${formatSignedAmount(item)} on ${item.date}`;
}
