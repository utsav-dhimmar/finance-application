import type {
	CreateRecurringExpenseBody,
	RecurringExpenseResponse,
	RecurringExpenseStatus,
	UpdateRecurringExpenseBody,
} from "@finance-application/schemas";
import { amountInputSchema } from "@finance-application/schemas";
import { Badge } from "@finance-application/ui/components/badge";
import { Button } from "@finance-application/ui/components/button";
import {
	Card,
	CardContent,
} from "@finance-application/ui/components/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@finance-application/ui/components/dialog";
import {
	Field,
	FieldLabel,
} from "@finance-application/ui/components/field";
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
	CalendarClock,
	Check,
	Pause,
	Pencil,
	Play,
	Plus,
	XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { DueRecurringExpensesCard } from "@/components/recurring-expenses/due-recurring-expenses-card";
import { useAccounts } from "@/hooks/use-accounts";
import { useMe } from "@/hooks/use-auth";
import { useCategories } from "@/hooks/use-categories";
import {
	useCancelRecurringExpense,
	useCreateRecurringExpense,
	usePauseRecurringExpense,
	usePostDueRecurringExpense,
	useRecurringExpenses,
	useResumeRecurringExpense,
	useUpdateRecurringExpense,
} from "@/hooks/use-recurring-expenses";
import { formatPaise, paiseToRupeeInput } from "@/lib/money";
import { uuidV7 } from "@/lib/uuid";

export const Route = createFileRoute("/recurring-expenses")({
	component: RecurringExpensesPage,
});

type StatusFilter = "all" | RecurringExpenseStatus;

const CADENCE_OPTIONS = [
	{ value: "1", label: "Every 1 month (Monthly)" },
	{ value: "2", label: "Every 2 months (Bi-monthly)" },
	{ value: "3", label: "Every 3 months (Quarterly)" },
	{ value: "6", label: "Every 6 months (Semi-annually)" },
	{ value: "12", label: "Every 12 months (Annually)" },
];

export function RecurringExpensesPage() {
	const navigate = useNavigate();
	const me = useMe();
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

	const queryFilter = statusFilter === "all" ? {} : { status: statusFilter };
	const { data, isLoading } = useRecurringExpenses(queryFilter);
	const accounts = useAccounts("active");
	const categories = useCategories("active");

	const createRule = useCreateRecurringExpense();
	const updateRule = useUpdateRecurringExpense();
	const pauseRule = usePauseRecurringExpense();
	const resumeRule = useResumeRecurringExpense();
	const cancelRule = useCancelRecurringExpense();
	const postDue = usePostDueRecurringExpense();

	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editingItem, setEditingItem] =
		useState<RecurringExpenseResponse | null>(null);

	// Create Form State
	const [createName, setCreateName] = useState("");
	const [createAmount, setCreateAmount] = useState("");
	const [createInterval, setCreateInterval] = useState("1");
	const [createAccountId, setCreateAccountId] = useState("");
	const [createCategoryId, setCreateCategoryId] = useState("");
	const [createStartDate, setCreateStartDate] = useState(
		new Date().toISOString().slice(0, 10),
	);
	const [createEndDate, setCreateEndDate] = useState("");
	const [createNotes, setCreateNotes] = useState("");

	// Edit Form State
	const [editName, setEditName] = useState("");
	const [editAmount, setEditAmount] = useState("");
	const [editInterval, setEditInterval] = useState("1");
	const [editAccountId, setEditAccountId] = useState("");
	const [editCategoryId, setEditCategoryId] = useState("");
	const [editEndDate, setEditEndDate] = useState("");
	const [editNotes, setEditNotes] = useState("");

	useEffect(() => {
		if (me.isPending) return;
		if (!me.data) {
			navigate({ to: "/login" });
		}
	}, [me.data, me.isPending, navigate]);

	if (me.isPending || !me.data) {
		return (
			<div className="flex min-h-screen flex-col bg-background">
				<AppHeader />
				<main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center p-6">
					<Skeleton className="h-40 w-full rounded-none" />
				</main>
			</div>
		);
	}

	const expenseCategories = (categories.data?.categories ?? []).filter(
		(c) => c.type === "expense",
	);
	const accountList = accounts.data?.accounts ?? [];

	function handleOpenCreate() {
		setCreateName("");
		setCreateAmount("");
		setCreateInterval("1");
		setCreateAccountId(accountList[0]?.id ?? "");
		setCreateCategoryId(expenseCategories[0]?.id ?? "");
		setCreateStartDate(new Date().toISOString().slice(0, 10));
		setCreateEndDate("");
		setCreateNotes("");
		setIsCreateOpen(true);
	}

	function handleCreateSubmit() {
		if (!createName.trim()) {
			toast.error("Please enter a name.");
			return;
		}
		const parsedAmount = amountInputSchema.safeParse(createAmount);
		if (!parsedAmount.success || parsedAmount.data <= 0) {
			toast.error("Please enter a valid positive amount.");
			return;
		}
		if (!createAccountId) {
			toast.error("Please select an account.");
			return;
		}
		if (!createCategoryId) {
			toast.error("Please select a category.");
			return;
		}

		const body: CreateRecurringExpenseBody = {
			id: uuidV7(),
			name: createName.trim(),
			amountMinor: parsedAmount.data,
			intervalMonths: Number(createInterval),
			startDate: createStartDate,
			sourceAccountId: createAccountId,
			categoryId: createCategoryId,
			endDate: createEndDate || null,
			notes: createNotes.trim() ? createNotes.trim() : null,
		};

		createRule.mutate(body, {
			onSuccess: (res) => {
				toast.success(`Recurring rule "${res.name}" created.`);
				setIsCreateOpen(false);
			},
			onError: () => {
				toast.error("Failed to create recurring expense.");
			},
		});
	}

	function handleOpenEdit(item: RecurringExpenseResponse) {
		setEditingItem(item);
		setEditName(item.name);
		setEditAmount(paiseToRupeeInput(item.amountMinor));
		setEditInterval(String(item.intervalMonths));
		setEditAccountId(item.sourceAccountId);
		setEditCategoryId(item.categoryId);
		setEditEndDate(item.endDate ?? "");
		setEditNotes(item.notes ?? "");
	}

	function handleEditSubmit() {
		if (!editingItem) return;
		if (!editName.trim()) {
			toast.error("Please enter a name.");
			return;
		}
		const parsedAmount = amountInputSchema.safeParse(editAmount);
		if (!parsedAmount.success || parsedAmount.data <= 0) {
			toast.error("Please enter a valid positive amount.");
			return;
		}

		const body: UpdateRecurringExpenseBody = {
			name: editName.trim(),
			amountMinor: parsedAmount.data,
			intervalMonths: Number(editInterval),
			sourceAccountId: editAccountId,
			categoryId: editCategoryId,
			endDate: editEndDate || null,
			notes: editNotes.trim() ? editNotes.trim() : null,
		};

		updateRule.mutate(
			{ id: editingItem.id, body },
			{
				onSuccess: (res) => {
					toast.success(`Recurring rule "${res.name}" updated.`);
					setEditingItem(null);
				},
				onError: () => {
					toast.error("Failed to update recurring expense.");
				},
			},
		);
	}

	function handleTogglePause(item: RecurringExpenseResponse) {
		if (item.status === "active") {
			pauseRule.mutate(item.id, {
				onSuccess: () => toast.info(`Paused "${item.name}".`),
				onError: () => toast.error("Could not pause rule."),
			});
		} else if (item.status === "paused") {
			resumeRule.mutate(item.id, {
				onSuccess: () => toast.success(`Resumed "${item.name}".`),
				onError: () => toast.error("Could not resume rule."),
			});
		}
	}

	function handleCancel(item: RecurringExpenseResponse) {
		if (confirm(`Cancel recurring rule "${item.name}"? Past recorded transactions will not be deleted.`)) {
			cancelRule.mutate(item.id, {
				onSuccess: () => toast.info(`Cancelled "${item.name}".`),
				onError: () => toast.error("Could not cancel rule."),
			});
		}
	}

	function handleQuickPost(item: RecurringExpenseResponse) {
		postDue.mutate(
			{
				id: item.id,
				body: {
					transactionId: uuidV7(),
					amountMinor: item.amountMinor,
					date: item.nextDueDate,
				},
			},
			{
				onSuccess: () => {
					toast.success(`Recorded payment for ${item.name}.`);
				},
				onError: () => {
					toast.error("Could not post recurring transaction.");
				},
			},
		);
	}

	const rules = data?.recurringExpenses ?? [];

	return (
		<div className="flex min-h-screen flex-col bg-background">
			<AppHeader />
			<main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-6 md:p-8">
				{/* Page Header */}
				<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
							Recurring Expenses
						</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							Track duration-driven repeating bills, subscriptions, and scheduled expenses.
						</p>
					</div>
					<Button
						onClick={handleOpenCreate}
						className="rounded-none gap-1.5 shadow-xs"
					>
						<Plus aria-hidden="true" className="size-4" />
						New recurring rule
					</Button>
				</div>

				{/* Due Recurring Banner */}
				<DueRecurringExpensesCard />

				{/* Status Filter Tabs */}
				<div className="flex items-center">
					<Tabs
						value={statusFilter}
						onValueChange={(val) => setStatusFilter(val as StatusFilter)}
					>
						<TabsList className="rounded-none">
							<TabsTrigger value="all" className="rounded-none">
								All ({rules.length})
							</TabsTrigger>
							<TabsTrigger value="active" className="rounded-none">
								Active
							</TabsTrigger>
							<TabsTrigger value="paused" className="rounded-none">
								Paused
							</TabsTrigger>
							<TabsTrigger value="completed" className="rounded-none">
								Completed
							</TabsTrigger>
							<TabsTrigger value="cancelled" className="rounded-none">
								Cancelled
							</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>

				{/* Main Rules Table */}
				{isLoading ? (
					<Skeleton className="h-64 w-full rounded-none" />
				) : rules.length === 0 ? (
					<Card className="rounded-none border border-border">
						<CardContent className="flex flex-col items-center justify-center p-12 text-center">
							<CalendarClock className="size-10 text-muted-foreground/60 mb-3" />
							<p className="text-base font-medium text-foreground">
								No recurring expenses found
							</p>
							<p className="text-xs text-muted-foreground mt-1 max-w-sm">
								Create a recurring expense rule to automate scheduled reminders and one-click ledger postings.
							</p>
							<Button
								variant="outline"
								onClick={handleOpenCreate}
								className="rounded-none mt-4 gap-1 text-xs"
							>
								<Plus className="size-3.5" />
								Add recurring expense
							</Button>
						</CardContent>
					</Card>
				) : (
					<div className="border border-border bg-card">
						<Table>
							<TableHeader>
								<TableRow className="rounded-none border-b border-border bg-muted/40">
									<TableHead className="font-semibold text-xs">Name</TableHead>
									<TableHead className="font-semibold text-xs">
										Expected
									</TableHead>
									<TableHead className="font-semibold text-xs">Cadence</TableHead>
									<TableHead className="font-semibold text-xs">Category</TableHead>
									<TableHead className="font-semibold text-xs">Account</TableHead>
									<TableHead className="font-semibold text-xs">Next Due</TableHead>
									<TableHead className="font-semibold text-xs">Status</TableHead>
									<TableHead className="font-semibold text-xs text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rules.map((rule) => {
									const isDueNow =
										rule.status === "active" &&
										rule.nextDueDate <= new Date().toISOString().slice(0, 10);
									return (
										<TableRow
											key={rule.id}
											className="rounded-none border-b border-border/50 hover:bg-muted/30"
										>
											<TableCell className="font-medium text-sm">
												<div>{rule.name}</div>
												{rule.notes && (
													<div className="text-xs text-muted-foreground line-clamp-1">
														{rule.notes}
													</div>
												)}
											</TableCell>
											<TableCell className="font-mono tabular-nums font-semibold text-sm">
												{formatPaise(rule.amountMinor)}
											</TableCell>
											<TableCell className="text-xs">
												<Badge variant="outline" className="rounded-none font-normal text-xs">
													Every {rule.intervalMonths} mo
												</Badge>
											</TableCell>
											<TableCell className="text-xs text-muted-foreground">
												{rule.categoryName ?? "—"}
											</TableCell>
											<TableCell className="text-xs text-muted-foreground">
												{rule.accountName ?? "—"}
											</TableCell>
											<TableCell className="text-xs">
												<div className="flex items-center gap-1.5 font-mono">
													<span>{rule.nextDueDate}</span>
													{isDueNow && (
														<Badge
															variant="destructive"
															className="rounded-none text-[10px] px-1 py-0"
														>
															Due
														</Badge>
													)}
												</div>
											</TableCell>
											<TableCell className="text-xs">
												<Badge
													variant={
														rule.status === "active"
															? "default"
															: rule.status === "paused"
																? "secondary"
																: "outline"
													}
													className="rounded-none text-xs capitalize"
												>
													{rule.status}
												</Badge>
											</TableCell>
											<TableCell className="text-right">
												<div className="flex items-center justify-end gap-1">
													{rule.status === "active" && (
														<Button
															size="sm"
															variant="ghost"
															className="rounded-none h-7 px-2 text-xs gap-1"
															title="Post due transaction"
															onClick={() => handleQuickPost(rule)}
														>
															<Check className="size-3.5" />
															Record
														</Button>
													)}
													<Button
														size="sm"
														variant="ghost"
														className="rounded-none h-7 px-2 text-xs gap-1"
														title="Edit parameters & duration cadence"
														onClick={() => handleOpenEdit(rule)}
													>
														<Pencil className="size-3.5" />
														Edit
													</Button>
													{(rule.status === "active" ||
														rule.status === "paused") && (
														<Button
															size="sm"
															variant="ghost"
															className="rounded-none h-7 px-2 text-xs gap-1"
															title={rule.status === "active" ? "Pause" : "Resume"}
															onClick={() => handleTogglePause(rule)}
														>
															{rule.status === "active" ? (
																<Pause className="size-3.5" />
															) : (
																<Play className="size-3.5" />
															)}
														</Button>
													)}
													{rule.status !== "cancelled" && (
														<Button
															size="sm"
															variant="ghost"
															className="rounded-none h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
															title="Cancel rule"
															onClick={() => handleCancel(rule)}
														>
															<XCircle className="size-3.5" />
														</Button>
													)}
												</div>
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</div>
				)}
			</main>

			{/* Create Dialog */}
			<Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
				<DialogContent className="rounded-none max-w-lg">
					<DialogHeader>
						<DialogTitle className="rounded-none">New Recurring Expense</DialogTitle>
						<DialogDescription>
							Schedule a repeating expense with duration cadence in months. The
							expected amount pre-fills each occurrence; the actual expense can
							differ every cycle.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-2">
						<Field>
							<FieldLabel htmlFor="create-rule-name">Name</FieldLabel>
							<Input
								id="create-rule-name"
								placeholder="e.g. Netflix, Rent, Gym"
								value={createName}
								onChange={(e) => setCreateName(e.target.value)}
								className="rounded-none"
							/>
						</Field>

						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<Field>
									<FieldLabel htmlFor="create-rule-amount">
										Expected amount (₹)
									</FieldLabel>
									<Input
										id="create-rule-amount"
										placeholder="0.00"
										value={createAmount}
										onChange={(e) => setCreateAmount(e.target.value)}
										className="rounded-none font-mono"
									/>
								</Field>

							<Field>
								<FieldLabel htmlFor="create-rule-interval">Duration Cadence</FieldLabel>
								<Select
									items={CADENCE_OPTIONS}
									value={createInterval}
									onValueChange={(val) => {
										if (val) setCreateInterval(val);
									}}
								>
									<SelectTrigger id="create-rule-interval" className="rounded-none">
										<SelectValue placeholder="Select cadence" />
									</SelectTrigger>
									<SelectContent className="rounded-none">
										{CADENCE_OPTIONS.map((opt) => (
											<SelectItem key={opt.value} value={opt.value}>
												{opt.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
						</div>

						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<Field>
								<FieldLabel htmlFor="create-rule-account">Source Account</FieldLabel>
								<Select
									items={accountList.map((a) => ({ value: a.id, label: a.name }))}
									value={createAccountId}
									onValueChange={(val) => {
										if (val) setCreateAccountId(val);
									}}
								>
									<SelectTrigger id="create-rule-account" className="rounded-none">
										<SelectValue placeholder="Select account" />
									</SelectTrigger>
									<SelectContent className="rounded-none">
										{accountList.map((a) => (
											<SelectItem key={a.id} value={a.id}>
												{a.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>

							<Field>
								<FieldLabel htmlFor="create-rule-category">Category</FieldLabel>
								<Select
									items={expenseCategories.map((c) => ({ value: c.id, label: c.name }))}
									value={createCategoryId}
									onValueChange={(val) => {
										if (val) setCreateCategoryId(val);
									}}
								>
									<SelectTrigger id="create-rule-category" className="rounded-none">
										<SelectValue placeholder="Select category" />
									</SelectTrigger>
									<SelectContent className="rounded-none">
										{expenseCategories.map((c) => (
											<SelectItem key={c.id} value={c.id}>
												{c.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
						</div>

						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<Field>
								<FieldLabel htmlFor="create-rule-start">Start Date</FieldLabel>
								<Input
									id="create-rule-start"
									type="date"
									value={createStartDate}
									onChange={(e) => setCreateStartDate(e.target.value)}
									className="rounded-none"
								/>
							</Field>

							<Field>
								<FieldLabel htmlFor="create-rule-end">End Date (optional)</FieldLabel>
								<Input
									id="create-rule-end"
									type="date"
									value={createEndDate}
									onChange={(e) => setCreateEndDate(e.target.value)}
									className="rounded-none"
								/>
							</Field>
						</div>

						<Field>
							<FieldLabel htmlFor="create-rule-notes">Notes (optional)</FieldLabel>
							<Input
								id="create-rule-notes"
								placeholder="Optional notes or reference number"
								value={createNotes}
								onChange={(e) => setCreateNotes(e.target.value)}
								className="rounded-none"
							/>
						</Field>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							className="rounded-none"
							onClick={() => setIsCreateOpen(false)}
						>
							Cancel
						</Button>
						<Button
							type="button"
							className="rounded-none"
							disabled={createRule.isPending}
							onClick={handleCreateSubmit}
						>
							{createRule.isPending ? "Creating..." : "Create recurring rule"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Edit Dialog */}
			<Dialog
				open={Boolean(editingItem)}
				onOpenChange={(open) => !open && setEditingItem(null)}
			>
				<DialogContent className="rounded-none max-w-lg">
					<DialogHeader>
						<DialogTitle className="rounded-none">
							Edit Recurring Expense
						</DialogTitle>
						<DialogDescription>
							Adjust duration cadence, expected amount, or parameters. Changing cadence recalculates future due dates while keeping past transactions intact.
						</DialogDescription>
					</DialogHeader>

					{editingItem && (
						<div className="space-y-4 py-2">
							<Field>
								<FieldLabel htmlFor="edit-rule-name">Name</FieldLabel>
								<Input
									id="edit-rule-name"
									value={editName}
									onChange={(e) => setEditName(e.target.value)}
									className="rounded-none"
								/>
							</Field>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<Field>
									<FieldLabel htmlFor="edit-rule-amount">
										Expected amount (₹)
									</FieldLabel>
									<Input
										id="edit-rule-amount"
										value={editAmount}
										onChange={(e) => setEditAmount(e.target.value)}
										className="rounded-none font-mono"
									/>
								</Field>

								<Field>
									<FieldLabel htmlFor="edit-rule-interval">Duration Cadence</FieldLabel>
									<Select
										items={CADENCE_OPTIONS}
										value={editInterval}
										onValueChange={(val) => {
											if (val) setEditInterval(val);
										}}
									>
										<SelectTrigger id="edit-rule-interval" className="rounded-none">
											<SelectValue placeholder="Select cadence" />
										</SelectTrigger>
										<SelectContent className="rounded-none">
											{CADENCE_OPTIONS.map((opt) => (
												<SelectItem key={opt.value} value={opt.value}>
													{opt.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</Field>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<Field>
									<FieldLabel htmlFor="edit-rule-account">Source Account</FieldLabel>
									<Select
										items={accountList.map((a) => ({ value: a.id, label: a.name }))}
										value={editAccountId}
										onValueChange={(val) => {
											if (val) setEditAccountId(val);
										}}
									>
										<SelectTrigger id="edit-rule-account" className="rounded-none">
											<SelectValue placeholder="Select account" />
										</SelectTrigger>
										<SelectContent className="rounded-none">
											{accountList.map((a) => (
												<SelectItem key={a.id} value={a.id}>
													{a.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</Field>

								<Field>
									<FieldLabel htmlFor="edit-rule-category">Category</FieldLabel>
									<Select
										items={expenseCategories.map((c) => ({ value: c.id, label: c.name }))}
										value={editCategoryId}
										onValueChange={(val) => {
											if (val) setEditCategoryId(val);
										}}
									>
										<SelectTrigger id="edit-rule-category" className="rounded-none">
											<SelectValue placeholder="Select category" />
										</SelectTrigger>
										<SelectContent className="rounded-none">
											{expenseCategories.map((c) => (
												<SelectItem key={c.id} value={c.id}>
													{c.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</Field>
							</div>

							<Field>
								<FieldLabel htmlFor="edit-rule-end">End Date (optional)</FieldLabel>
								<Input
									id="edit-rule-end"
									type="date"
									value={editEndDate}
									onChange={(e) => setEditEndDate(e.target.value)}
									className="rounded-none"
								/>
							</Field>

							<Field>
								<FieldLabel htmlFor="edit-rule-notes">Notes (optional)</FieldLabel>
								<Input
									id="edit-rule-notes"
									value={editNotes}
									onChange={(e) => setEditNotes(e.target.value)}
									className="rounded-none"
								/>
							</Field>
						</div>
					)}

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							className="rounded-none"
							onClick={() => setEditingItem(null)}
						>
							Cancel
						</Button>
						<Button
							type="button"
							className="rounded-none"
							disabled={updateRule.isPending}
							onClick={handleEditSubmit}
						>
							{updateRule.isPending ? "Saving..." : "Save changes"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
