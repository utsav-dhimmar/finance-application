import {
	amountInputSchema,
	type RecurringExpenseResponse,
} from "@finance-application/schemas";
import { Badge } from "@finance-application/ui/components/badge";
import { Button } from "@finance-application/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
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
import { AlertCircle, CalendarClock, Check, Clock, SkipForward } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SafeLink } from "@/components/app-header";
import {
	useDueRecurringExpenses,
	usePostDueRecurringExpense,
	useSkipRecurringExpense,
} from "@/hooks/use-recurring-expenses";
import { formatPaise } from "@/lib/money";
import { uuidV7 } from "@/lib/uuid";

export function DueRecurringExpensesCard({
	className,
}: {
	className?: string;
}) {
	const { data, isLoading } = useDueRecurringExpenses();
	const postDue = usePostDueRecurringExpense();
	const skip = useSkipRecurringExpense();

	const [editingItem, setEditingItem] =
		useState<RecurringExpenseResponse | null>(null);
	const [editAmount, setEditAmount] = useState("");
	const [editDate, setEditDate] = useState("");
	const [editNotes, setEditNotes] = useState("");

	const dueList = data?.recurringExpenses ?? [];
	if (isLoading || dueList.length === 0) {
		return null;
	}

	function handlePostQuick(item: RecurringExpenseResponse) {
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
					toast.success(
						`Recorded payment of ${formatPaise(item.amountMinor)} for ${item.name}.`,
					);
				},
				onError: () => {
					toast.error("Could not post recurring transaction.");
				},
			},
		);
	}

	function handleSkip(item: RecurringExpenseResponse) {
		skip.mutate(item.id, {
			onSuccess: () => {
				toast.info(`Skipped occurrence for ${item.name}.`);
			},
			onError: () => {
				toast.error("Could not skip occurrence.");
			},
		});
	}

	function openEditModal(item: RecurringExpenseResponse) {
		setEditingItem(item);
		setEditAmount((item.amountMinor / 100).toFixed(2));
		setEditDate(item.nextDueDate);
		setEditNotes(item.notes ?? "");
	}

	function handleConfirmCustomPost() {
		if (!editingItem) return;
		const parsedResult = amountInputSchema.safeParse(editAmount);
		if (!parsedResult.success || parsedResult.data <= 0) {
			toast.error("Please enter a valid positive amount.");
			return;
		}
		const parsedPaise = parsedResult.data;

		postDue.mutate(
			{
				id: editingItem.id,
				body: {
					transactionId: uuidV7(),
					amountMinor: parsedPaise,
					date: editDate || editingItem.nextDueDate,
					notes: editNotes.trim() ? editNotes.trim() : null,
				},
			},
			{
				onSuccess: () => {
					toast.success(
						`Recorded payment of ${formatPaise(parsedPaise)} for ${editingItem.name}.`,
					);
					setEditingItem(null);
				},
				onError: () => {
					toast.error("Could not post recurring transaction.");
				},
			},
		);
	}

	return (
		<>
			<Card
				className={`rounded-none border border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/20 ${className ?? ""}`}
			>
				<CardHeader className="flex flex-row items-center justify-between pb-2">
					<div className="flex items-center gap-2">
						<CalendarClock className="h-5 w-5 text-amber-500" />
						<div>
							<CardTitle className="text-base font-semibold tracking-tight">
								Due Recurring Expenses
							</CardTitle>
							<CardDescription className="text-xs">
								Expenses waiting for your review and one-click ledger recording
							</CardDescription>
						</div>
					</div>
					<Badge
						variant="outline"
						className="rounded-none border-amber-500 text-amber-600 dark:text-amber-400 font-mono text-xs"
					>
						{dueList.length} due
					</Badge>
				</CardHeader>
				<CardContent className="space-y-3 pt-2">
					<div className="divide-y divide-border/40 border border-border/40 bg-background">
						{dueList.map((item) => (
							<div
								key={item.id}
								className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 gap-3"
							>
								<div className="space-y-1">
									<div className="flex items-center gap-2">
										<span className="font-medium text-sm">
											{item.name}
										</span>
										{item.isOverdue ? (
											<Badge
												variant="destructive"
												className="rounded-none text-[10px] px-1 py-0 flex items-center gap-1"
											>
												<AlertCircle className="h-3 w-3" />
												Overdue ({Math.abs(item.daysUntilDue ?? 0)}d)
											</Badge>
										) : (
											<Badge
												variant="secondary"
												className="rounded-none text-[10px] px-1 py-0 flex items-center gap-1"
											>
												<Clock className="h-3 w-3" />
												Due today
											</Badge>
										)}
									</div>
									<div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
										<span>
											Account:{" "}
											<strong className="text-foreground font-normal">
												{item.accountName ?? "—"}
											</strong>
										</span>
										<span>
											Category:{" "}
											<strong className="text-foreground font-normal">
												{item.categoryName ?? "—"}
											</strong>
										</span>
										<span>
											Cadence: Every {item.intervalMonths} mo
										</span>
										<span>Due: {item.nextDueDate}</span>
									</div>
								</div>

								<div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
									<div className="flex flex-col items-end mr-2">
										<span className="font-mono text-base font-semibold tabular-nums text-foreground">
											{formatPaise(item.amountMinor)}
										</span>
										<span className="text-[10px] uppercase tracking-wide text-muted-foreground">
											expected
										</span>
									</div>
									<div className="flex items-center gap-1">
										<Button
											size="sm"
											variant="default"
											className="rounded-none h-8 text-xs gap-1"
											disabled={postDue.isPending}
											onClick={() => handlePostQuick(item)}
										>
											<Check className="h-3.5 w-3.5" />
											Record
										</Button>
										<Button
											size="sm"
											variant="outline"
											className="rounded-none h-8 text-xs"
											disabled={postDue.isPending}
											onClick={() => openEditModal(item)}
										>
											Edit
										</Button>
										<Button
											size="sm"
											variant="ghost"
											className="rounded-none h-8 text-xs text-muted-foreground gap-1 hover:text-foreground"
											disabled={skip.isPending}
											onClick={() => handleSkip(item)}
										>
											<SkipForward className="h-3.5 w-3.5" />
											Skip
										</Button>
									</div>
								</div>
							</div>
						))}
					</div>
					<div className="text-right pt-1">
						<SafeLink
							to="/recurring-expenses"
							className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
						>
							Manage all recurring rules →
						</SafeLink>
					</div>
				</CardContent>
			</Card>

			{/* Custom Post Modal */}
			<Dialog
				open={Boolean(editingItem)}
				onOpenChange={(open) => !open && setEditingItem(null)}
			>
				<DialogContent className="rounded-none max-w-md">
					<DialogHeader>
						<DialogTitle className="rounded-none">
							Record Recurring Payment
						</DialogTitle>
						<DialogDescription>
							Adjust the actual payment date, amount, or notes for this
							occurrence before recording into ledger. The expected amount is
							pre-filled; the actual expense can differ every cycle.
						</DialogDescription>
					</DialogHeader>

					{editingItem && (
						<div className="space-y-4 py-2">
							<Field>
								<FieldLabel>Expense</FieldLabel>
								<Input value={editingItem.name} disabled className="rounded-none" />
							</Field>

							<Field>
								<FieldLabel htmlFor="edit-post-amount">
									Actual Amount (₹)
								</FieldLabel>
								<Input
									id="edit-post-amount"
									value={editAmount}
									onChange={(e) => setEditAmount(e.target.value)}
									className="rounded-none font-mono"
								/>
							</Field>

							<Field>
								<FieldLabel htmlFor="edit-post-date">
									Payment Date
								</FieldLabel>
								<Input
									id="edit-post-date"
									type="date"
									value={editDate}
									onChange={(e) => setEditDate(e.target.value)}
									className="rounded-none"
								/>
							</Field>

							<Field>
								<FieldLabel htmlFor="edit-post-notes">
									Notes (optional)
								</FieldLabel>
								<Input
									id="edit-post-notes"
									placeholder="Optional notes for this occurrence"
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
							disabled={postDue.isPending}
							onClick={handleConfirmCustomPost}
						>
							{postDue.isPending ? "Recording..." : "Confirm & Record"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
