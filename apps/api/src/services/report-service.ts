import type {
	ComparisonSeries,
	ReportPeriodQuery,
	ReportSummaryResponse,
} from "@finance-application/schemas";
import {
	daysInCalendarMonth,
	reportPeriodQuerySchema,
	resolveReportPeriodBounds,
} from "@finance-application/schemas";
import type { AccountService } from "@/services/account-service";

// One owner of every reporting inclusion rule: active and archived
// transactions count, soft-deleted ones never do, and transfers are
// structurally absent from the aggregation queries (different table), so they
// can never enter income, expense, or category totals. The balance section
// reuses the account service's list-with-balances — no duplicate balance math.

// The reporting query seam: three aggregations over the user's non-deleted
// transactions inside an inclusive calendar-date range. The transaction
// repository implements them in SQL; service unit tests substitute in-memory
// models of this contract, and the repository's integration tests verify that
// its SQL honors it.
export interface ReportTransactionQueries {
	sumTypeEffectsInRange(
		userId: string,
		from: string,
		to: string,
	): Promise<{ incomeMinor: number; expenseMinor: number }>;
	expenseByCategoryInRange(
		userId: string,
		from: string,
		to: string,
	): Promise<
		Array<{
			categoryId: string;
			categoryName: string | null;
			amountMinor: number;
		}>
	>;
	typeSumsPerDayInRange(
		userId: string,
		from: string,
		to: string,
	): Promise<Map<string, { incomeMinor: number; expenseMinor: number }>>;
}

export interface ReportServiceDeps {
	transactions: ReportTransactionQueries;
	// The balance section is the accounts endpoint's semantics, verbatim:
	// active accounts only, combined over active accounts.
	accounts: Pick<AccountService, "list">;
}

export type ReportSummaryOutcome =
	| { ok: true; value: ReportSummaryResponse }
	| { ok: false; code: "INVALID_PERIOD" };

type SubPeriodMode = "day" | "month";

function pad2(value: number): string {
	return String(value).padStart(2, "0");
}

// Calendar months (YYYY-MM) overlapping the range, earliest first.
function eachMonthBetween(from: string, to: string): string[] {
	const endYear = Number(to.slice(0, 4));
	const endMonth = Number(to.slice(5, 7));
	const months: string[] = [];
	let year = Number(from.slice(0, 4));
	let month = Number(from.slice(5, 7));
	while (year < endYear || (year === endYear && month <= endMonth)) {
		months.push(`${year}-${pad2(month)}`);
		month += 1;
		if (month > 12) {
			month = 1;
			year += 1;
		}
	}
	return months;
}

// Calendar dates (YYYY-MM-DD) inside the range, earliest first — pure string
// and integer arithmetic, so no timezone can shift a boundary.
function eachDayBetween(from: string, to: string): string[] {
	const days: string[] = [];
	for (const month of eachMonthBetween(from, to)) {
		const year = Number(month.slice(0, 4));
		const monthNumber = Number(month.slice(5, 7));
		const total = daysInCalendarMonth(year, monthNumber);
		for (let day = 1; day <= total; day += 1) {
			const date = `${month}-${pad2(day)}`;
			if (date >= from && date <= to) {
				days.push(date);
			}
		}
	}
	return days;
}

// The comparison chart's natural sub-periods: days within a month view,
// months within a year view. An explicit range stays daily up to a quarter
// (3 overlapping month keys) and collapses to monthly buckets beyond, so a
// multi-year range cannot produce hundreds of bars.
function subPeriodMode(period: ReportPeriodQuery, from: string, to: string) {
	if (period.month !== undefined) {
		return "day" as const;
	}
	if (period.year !== undefined) {
		return "month" as const;
	}
	return eachMonthBetween(from, to).length > 3
		? ("month" as const)
		: ("day" as const);
}

function buildComparison(
	mode: SubPeriodMode,
	from: string,
	to: string,
	perDay: Map<string, { incomeMinor: number; expenseMinor: number }>,
): ComparisonSeries[] {
	// Aggregate the per-day sums once under the bucket key, then fill every
	// expected bucket — empty sub-periods are present with zeros, never missing.
	const sumsByBucket = new Map<
		string,
		{ incomeMinor: number; expenseMinor: number }
	>();
	for (const [date, sums] of perDay) {
		const key = mode === "day" ? date : date.slice(0, 7);
		const existing = sumsByBucket.get(key);
		if (existing === undefined) {
			sumsByBucket.set(key, { ...sums });
		} else {
			existing.incomeMinor += sums.incomeMinor;
			existing.expenseMinor += sums.expenseMinor;
		}
	}
	const buckets =
		mode === "day" ? eachDayBetween(from, to) : eachMonthBetween(from, to);
	return buckets.map((label) => {
		const sums = sumsByBucket.get(label);
		return {
			label,
			incomeMinor: sums?.incomeMinor ?? 0,
			expenseMinor: sums?.expenseMinor ?? 0,
		};
	});
}

// The category's share of the period's expenses, in percent rounded to two
// decimals. A display ratio only — money itself never touches a float.
function sharePercent(amountMinor: number, expenseTotalMinor: number): number {
	if (expenseTotalMinor <= 0) {
		return 0;
	}
	return Math.round((amountMinor / expenseTotalMinor) * 10000) / 100;
}

export function createReportService(deps: ReportServiceDeps) {
	return {
		async summary(
			userId: string,
			period: ReportPeriodQuery,
		): Promise<ReportSummaryOutcome> {
			// The transport schema validates field formats; the service owns the
			// cross-field period rule (exactly one form, from ≤ to) and answers
			// INVALID_PERIOD so the API has one named code for a bad period.
			const parsed = reportPeriodQuerySchema.safeParse(period);
			if (!parsed.success) {
				return { ok: false, code: "INVALID_PERIOD" };
			}
			const bounds = resolveReportPeriodBounds(parsed.data);
			const [typeSums, breakdownRows, perDay, accountList] = await Promise.all([
				deps.transactions.sumTypeEffectsInRange(userId, bounds.from, bounds.to),
				deps.transactions.expenseByCategoryInRange(
					userId,
					bounds.from,
					bounds.to,
				),
				deps.transactions.typeSumsPerDayInRange(userId, bounds.from, bounds.to),
				deps.accounts.list(userId, "active"),
			]);
			const breakdown = breakdownRows.map((row) => ({
				categoryId: row.categoryId,
				categoryName: row.categoryName,
				amountMinor: row.amountMinor,
				sharePercent: sharePercent(row.amountMinor, typeSums.expenseMinor),
			}));
			const mode = subPeriodMode(parsed.data, bounds.from, bounds.to);
			return {
				ok: true,
				value: {
					periodFrom: bounds.from,
					periodTo: bounds.to,
					incomeMinor: typeSums.incomeMinor,
					expenseMinor: typeSums.expenseMinor,
					netCashFlowMinor: typeSums.incomeMinor - typeSums.expenseMinor,
					categoryBreakdown: breakdown,
					comparison: buildComparison(mode, bounds.from, bounds.to, perDay),
					accounts: accountList.accounts,
					combinedBalanceMinor: accountList.combinedBalanceMinor,
				},
			};
		},
	};
}

export type ReportService = ReturnType<typeof createReportService>;
