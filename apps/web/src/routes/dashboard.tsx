import type {
	ActivityItem,
	ReportPeriodQuery,
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
import { Input } from "@finance-application/ui/components/input";
import { Skeleton } from "@finance-application/ui/components/skeleton";
import {
	Tabs,
	TabsList,
	TabsTrigger,
} from "@finance-application/ui/components/tabs";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	ArrowDownRight,
	ArrowLeftRight,
	ArrowUpRight,
	CreditCard,
	Plus,
	RefreshCw,
	Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AppHeader, SafeLink } from "@/components/app-header";
import { ExpensesByCategoryChart } from "@/components/charts/expenses-by-category-chart";
import { IncomeExpenseComparisonChart } from "@/components/charts/income-expense-comparison-chart";
import { IncomeExpenseSplitChart } from "@/components/charts/income-expense-split-chart";
import { useMe } from "@/hooks/use-auth";
import { useReportSummary } from "@/hooks/use-reports";
import { useActivity } from "@/hooks/use-transfers";
import { formatPaise } from "@/lib/money";
import { TRANSACTION_TYPE_LABELS } from "@/lib/transaction-labels";
import { getReportsErrorMessage } from "@/services/reports-service";

export const Route = createFileRoute("/dashboard")({
	component: DashboardPage,
});

type PeriodMode = "month" | "year";

const MONTH_NAMES = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

// The browser's local clock picks the default period (the current month);
// stored dates are calendar text and stay untouched by timezones.
function currentMonthValue(): string {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function periodFromForm(
	mode: PeriodMode,
	month: string,
	year: string,
): ReportPeriodQuery {
	return mode === "month" ? { month } : { year };
}

function periodLabel(period: ReportPeriodQuery): string {
	if (period.month !== undefined) {
		const monthIndex = Number(period.month.slice(5, 7)) - 1;
		return `${MONTH_NAMES[monthIndex] ?? period.month} ${period.month.slice(0, 4)}`;
	}
	if (period.year !== undefined) {
		return period.year;
	}
	return "Custom range";
}

// Signed display for a unified-history row: income credits, expenses and
// source-side transfers debit, destination-side transfers credit.
function formatActivityAmount(item: ActivityItem): string {
	const signed =
		item.kind === "transfer"
			? item.direction === "in"
				? Math.abs(item.amountMinor)
				: -Math.abs(item.amountMinor)
			: item.type === "income"
				? Math.abs(item.amountMinor)
				: -Math.abs(item.amountMinor);
	const formatted = formatPaise(Math.abs(signed));
	return signed < 0 ? `−${formatted}` : `+${formatted}`;
}

function activityDescription(item: ActivityItem): string {
	if (item.kind === "transfer") {
		return item.direction === "in"
			? `Transfer in from ${item.counterpartyAccountName ?? "another account"}`
			: `Transfer out to ${item.counterpartyAccountName ?? "another account"}`;
	}
	const typeLabel = item.type
		? TRANSACTION_TYPE_LABELS[item.type]
		: "Transaction";
	return item.categoryName
		? `${typeLabel} · ${item.categoryName}`
		: `${typeLabel} · ${item.accountName ?? "account"}`;
}

const ACTIVITY_FEED_ROWS = 8;

export function DashboardPage() {
	const navigate = useNavigate();
	const me = useMe();
	const [mode, setMode] = useState<PeriodMode>("month");
	const [monthValue, setMonthValue] = useState(currentMonthValue());
	const [yearValue, setYearValue] = useState(String(new Date().getFullYear()));
	const period = periodFromForm(mode, monthValue, yearValue);
	const report = useReportSummary(period);
	const activity = useActivity({});

	// Guard: unauthenticated visitors are sent to /login without ever seeing
	// dashboard content.
	useEffect(() => {
		if (me.data === null) {
			navigate({ to: "/login" });
		}
	}, [me.data, navigate]);

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

	const reportData = report.data;
	const activeAccounts = reportData?.accounts ?? [];
	const hasAccounts = activeAccounts.length > 0;
	const periodHasActivity =
		(reportData?.incomeMinor ?? 0) !== 0 ||
		(reportData?.expenseMinor ?? 0) !== 0 ||
		(reportData?.categoryBreakdown.length ?? 0) > 0;
	const activityRows =
		activity.data?.activity.slice(0, ACTIVITY_FEED_ROWS) ?? [];

	return (
		<div className="flex min-h-screen flex-col bg-background">
			<AppHeader />
			<main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-6 md:p-8">
				{/* Top greeting & status */}
				<div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
							Dashboard
						</h1>
						<p aria-live="polite" className="text-sm text-muted-foreground">
							Signed in as{" "}
							<strong className="font-medium text-foreground">
								{me.data.email}
							</strong>
						</p>
					</div>
					<div className="flex items-center gap-2 pt-2 sm:pt-0">
						<SafeLink to="/transactions">
							<Button size="sm" className="gap-1.5 shadow-xs">
								<Plus aria-hidden="true" className="size-3.5" />
								Record transaction
							</Button>
						</SafeLink>
						<SafeLink to="/accounts">
							<Button size="sm" variant="outline" className="shadow-xs">
								Manage Accounts
							</Button>
						</SafeLink>
					</div>
				</div>

				{/* Period selector */}
				<section
					aria-label="Reporting period"
					className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
				>
					<div className="flex  gap-2">
						<Tabs
							value={mode}
							onValueChange={(next) => {
								if (next === "month" || next === "year") {
									setMode(next);
								}
							}}
						>
							<TabsList aria-label="Period view">
								<TabsTrigger value="month">Month</TabsTrigger>
								<TabsTrigger value="year">Year</TabsTrigger>
							</TabsList>
						</Tabs>
						{mode === "month" ? (
							<Input
								type="month"
								aria-label="Period month"
								value={monthValue}
								onChange={(event) => setMonthValue(event.target.value)}
								className="w-44"
							/>
						) : (
							<Input
								type="number"
								aria-label="Period year"
								min={2000}
								max={2100}
								value={yearValue}
								onChange={(event) => setYearValue(event.target.value)}
								className="w-32"
							/>
						)}
					</div>
					<p className="text-sm text-muted-foreground sm:pb-2">
						Showing{" "}
						<span className="font-medium text-foreground">
							{periodLabel(period)}
						</span>
					</p>
				</section>

				{/* Error with retry */}
				{report.isError && (
					<Card className="border-destructive/40 bg-destructive/5">
						<CardContent className="flex flex-col items-start gap-3 p-5">
							<p className="text-sm text-destructive">
								{getReportsErrorMessage(
									report.error,
									"Could not load the report for this period.",
								)}
							</p>
							<Button
								variant="outline"
								size="sm"
								className="gap-1.5"
								onClick={() => {
									report.refetch().catch(() => {
										// The query's error state already reports the failure.
									});
								}}
							>
								<RefreshCw aria-hidden="true" className="size-3.5" />
								Retry
							</Button>
						</CardContent>
					</Card>
				)}

				{/* Income / expense / net summary cards */}
				{report.isPending ? (
					<div
						className="grid grid-cols-1 gap-4 sm:grid-cols-3"
						aria-hidden="true"
					>
						<Skeleton className="h-32 w-full rounded-xl" />
						<Skeleton className="h-32 w-full rounded-xl" />
						<Skeleton className="h-32 w-full rounded-xl" />
					</div>
				) : reportData !== undefined ? (
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<Card className="p-5">
							<CardHeader className="flex flex-row items-center justify-between pb-2">
								<CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
									Income
								</CardTitle>
								<ArrowUpRight
									aria-hidden="true"
									className="size-4 text-emerald-600"
								/>
							</CardHeader>
							<CardContent>
								<div className="font-mono text-2xl font-semibold tracking-tight text-foreground tabular-nums">
									{formatPaise(reportData.incomeMinor)}
								</div>
								<CardDescription className="mt-1 text-xs text-muted-foreground">
									Received during {periodLabel(period)}
								</CardDescription>
							</CardContent>
						</Card>
						<Card className="p-5">
							<CardHeader className="flex flex-row items-center justify-between pb-2">
								<CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
									Expenses
								</CardTitle>
								<ArrowDownRight
									aria-hidden="true"
									className="size-4 text-red-600"
								/>
							</CardHeader>
							<CardContent>
								<div className="font-mono text-2xl font-semibold tracking-tight text-foreground tabular-nums">
									{formatPaise(reportData.expenseMinor)}
								</div>
								<CardDescription className="mt-1 text-xs text-muted-foreground">
									Spent during {periodLabel(period)}
								</CardDescription>
							</CardContent>
						</Card>
						<Card className="p-5">
							<CardHeader className="flex flex-row items-center justify-between pb-2">
								<CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
									Net cash flow
								</CardTitle>
								<Wallet aria-hidden="true" className="size-4 text-foreground" />
							</CardHeader>
							<CardContent>
								<div
									className={`font-mono text-2xl font-semibold tracking-tight tabular-nums ${
										reportData.netCashFlowMinor < 0
											? "text-red-600"
											: "text-foreground"
									}`}
								>
									{formatPaise(reportData.netCashFlowMinor)}
								</div>
								<CardDescription className="mt-1 text-xs text-muted-foreground">
									Income minus expenses
								</CardDescription>
							</CardContent>
						</Card>
					</div>
				) : null}

				{/* Onboarding empty state when no accounts exist */}
				{!report.isPending && reportData !== undefined && !hasAccounts && (
					<div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card/40 p-8 text-center">
						<div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
							<CreditCard aria-hidden="true" className="size-5" />
						</div>
						<h2 className="mt-3 text-base font-semibold tracking-tight text-foreground">
							No accounts added yet
						</h2>
						<p className="mt-1 max-w-sm text-xs text-muted-foreground">
							Create your first checking, savings, credit, or cash account to
							begin tracking balances and reports.
						</p>
						<SafeLink to="/accounts" className="mt-4">
							<Button size="sm">Add your first account</Button>
						</SafeLink>
					</div>
				)}

				{/* Charts, or the explicit zero state */}
				{!report.isPending && reportData !== undefined && !periodHasActivity ? (
					<div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card/40 p-8 text-center">
						<h2 className="text-base font-semibold tracking-tight text-foreground">
							No activity this period
						</h2>
						<p className="mt-1 max-w-sm text-sm text-muted-foreground">
							No income or expenses were recorded in {periodLabel(period)}.
							Record a transaction to see reports here.
						</p>
					</div>
				) : reportData !== undefined ? (
					<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
						{reportData.categoryBreakdown.length > 0 && (
							<Card className="p-5">
								<CardHeader className="pb-2">
									<CardTitle className="text-base font-semibold tracking-tight text-foreground">
										Expenses by category
									</CardTitle>
									<CardDescription className="text-xs text-muted-foreground">
										Category shares of expenses in {periodLabel(period)}
									</CardDescription>
								</CardHeader>
								<CardContent>
									<ExpensesByCategoryChart
										breakdown={reportData.categoryBreakdown}
									/>
								</CardContent>
							</Card>
						)}
						{(reportData.incomeMinor !== 0 ||
							reportData.expenseMinor !== 0) && (
							<Card className="p-5">
								<CardHeader className="pb-2">
									<CardTitle className="text-base font-semibold tracking-tight text-foreground">
										Income vs expenses
									</CardTitle>
									<CardDescription className="text-xs text-muted-foreground">
										What came in against what went out in {periodLabel(period)}
									</CardDescription>
								</CardHeader>
								<CardContent>
									<IncomeExpenseSplitChart
										incomeMinor={reportData.incomeMinor}
										expenseMinor={reportData.expenseMinor}
									/>
								</CardContent>
							</Card>
						)}
						<Card className="p-5 lg:col-span-2">
							<CardHeader className="pb-2">
								<CardTitle className="text-base font-semibold tracking-tight text-foreground">
									Income vs expenses over time
								</CardTitle>
								<CardDescription className="text-xs text-muted-foreground">
									Each sub-period of {periodLabel(period)}, zero periods shown
									as zero
								</CardDescription>
							</CardHeader>
							<CardContent>
								<IncomeExpenseComparisonChart series={reportData.comparison} />
							</CardContent>
						</Card>
					</div>
				) : null}

				{/* Account balances */}
				{reportData !== undefined && hasAccounts && (
					<section
						aria-label="Account balances"
						className="flex flex-col gap-3"
					>
						<div className="flex items-center justify-between">
							<h2 className="text-base font-semibold tracking-tight text-foreground">
								Accounts
							</h2>
							<p className="text-sm text-muted-foreground">
								Combined balance{" "}
								<span className="font-mono font-semibold text-foreground tabular-nums">
									{formatPaise(reportData.combinedBalanceMinor)}
								</span>
							</p>
						</div>
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{activeAccounts.map((account) => (
								<Card key={account.id} className="p-4">
									<div className="flex items-center justify-between gap-2">
										<div className="min-w-0">
											<p className="truncate text-sm font-medium text-foreground">
												{account.name}
											</p>
											<p className="text-xs capitalize text-muted-foreground">
												{account.type}
											</p>
										</div>
										<div className="flex items-center gap-2">
											<Badge variant="outline" className="capitalize">
												{account.status}
											</Badge>
											<span className="font-mono text-sm font-semibold text-foreground tabular-nums">
												{formatPaise(account.currentBalanceMinor)}
											</span>
										</div>
									</div>
								</Card>
							))}
						</div>
					</section>
				)}

				{/* Recent activity feed */}
				<section aria-label="Recent activity" className="flex flex-col gap-3">
					<div className="flex items-center justify-between">
						<h2 className="text-base font-semibold tracking-tight text-foreground">
							Recent activity
						</h2>
						<SafeLink to="/transactions">
							<Button variant="ghost" size="sm">
								View all transactions
							</Button>
						</SafeLink>
					</div>
					{activity.isPending ? (
						<div className="flex flex-col gap-2" aria-hidden="true">
							<Skeleton className="h-12 w-full rounded-lg" />
							<Skeleton className="h-12 w-full rounded-lg" />
							<Skeleton className="h-12 w-full rounded-lg" />
						</div>
					) : activity.isError ? (
						<p className="rounded-lg border border-border/70 bg-card/40 p-4 text-xs text-muted-foreground">
							{getReportsErrorMessage(
								activity.error,
								"Could not load recent activity.",
							)}
						</p>
					) : activityRows.length === 0 ? (
						<p className="rounded-lg border border-border/70 bg-card/40 p-4 text-xs text-muted-foreground">
							No activity yet. Transactions and transfers appear here.
						</p>
					) : (
						<ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/70 bg-card/40">
							{activityRows.map((item) => (
								<li
									key={`${item.kind}:${item.id}:${item.direction ?? ""}`}
									className="flex items-center justify-between gap-3 p-3"
								>
									<div className="flex min-w-0 items-center gap-3">
										<div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
											{item.kind === "transfer" ? (
												<ArrowLeftRight aria-hidden="true" className="size-4" />
											) : item.type === "income" ? (
												<ArrowUpRight
													aria-hidden="true"
													className="size-4 text-emerald-600"
												/>
											) : (
												<ArrowDownRight
													aria-hidden="true"
													className="size-4 text-red-600"
												/>
											)}
										</div>
										<div className="min-w-0">
											<p className="truncate text-sm text-foreground">
												{activityDescription(item)}
											</p>
											<p className="text-xs text-muted-foreground">
												{item.date}
												{item.status !== "active"
													? ` · ${item.status === "archived" ? "Archived" : "Deleted"}`
													: ""}
											</p>
										</div>
									</div>
									<span
										className={`font-mono text-sm tabular-nums ${
											item.kind === "transfer"
												? item.direction === "in"
													? "text-emerald-600"
													: "text-red-600"
												: item.type === "income"
													? "text-emerald-600"
													: "text-red-600"
										}`}
									>
										{formatActivityAmount(item)}
									</span>
								</li>
							))}
						</ul>
					)}
				</section>
			</main>
		</div>
	);
}
