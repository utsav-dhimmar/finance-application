import { z } from "zod";
import { accountResponseSchema } from "./accounts";
import { transactionDateSchema } from "./transactions";

// Shared reporting contract: the period query, the summary response, and the
// comparison series, shared by the API, the web app, and the future mobile
// client. OpenAPI metadata for the API's route schema is layered on top in
// server/api/src/schemas — do not add transport concerns here. The inclusion
// rules (archived in, deleted out, transfers never) are specified behavior and
// live in the reporting service; these shapes only carry the data.

export const reportMonthSchema = z
	.string()
	.regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use a month in YYYY-MM format");

export const reportYearSchema = z
	.string()
	.regex(/^\d{4}$/, "Use a year in YYYY format");

// Exactly one period form: a month, a year, or an explicit inclusive from/to
// range. Combining forms, a half-open range, or a reversed range is rejected
// before any request is made. Date comparisons are pure YYYY-MM-DD string
// comparisons — lexicographic order is chronological order.
export const reportPeriodQuerySchema = z
	.object({
		month: reportMonthSchema.optional(),
		year: reportYearSchema.optional(),
		from: transactionDateSchema.optional(),
		to: transactionDateSchema.optional(),
	})
	.superRefine((values, ctx) => {
		const hasMonth = values.month !== undefined;
		const hasYear = values.year !== undefined;
		const hasFrom = values.from !== undefined;
		const hasTo = values.to !== undefined;
		if (hasMonth && hasYear) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Provide either a month or a year, not both",
				path: ["month"],
			});
			return;
		}
		if ((hasMonth || hasYear) && (hasFrom || hasTo)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "A month or year period cannot be combined with a date range",
				path: hasMonth ? ["month"] : ["year"],
			});
			return;
		}
		if (!hasMonth && !hasYear && (!hasFrom || !hasTo)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Provide a month, a year, or both from and to dates",
				path: hasFrom ? ["to"] : ["from"],
			});
			return;
		}
		if (hasFrom && hasTo && (values.from as string) > (values.to as string)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "The from date must be on or before the to date",
				path: ["to"],
			});
		}
	});

export type ReportPeriodQuery = z.infer<typeof reportPeriodQuerySchema>;

export interface ReportPeriodBounds {
	from: string;
	to: string;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number): boolean {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// Days in a calendar month (1–12), leap-year aware. Exported because the
// reporting service enumerates a period's days with the same rule.
export function daysInCalendarMonth(year: number, month: number): number {
	if (month === 2 && isLeapYear(year)) {
		return 29;
	}
	return DAYS_IN_MONTH[month - 1] ?? 0;
}

// Inclusive calendar bounds for a validated period, from pure string and
// integer arithmetic — no Date objects, so no timezone can shift a boundary
// (AGENTS.md date rule). Leap-year February comes out of the days-in-month
// rule, not a clock.
export function resolveReportPeriodBounds(
	period: ReportPeriodQuery,
): ReportPeriodBounds {
	if (period.month !== undefined) {
		const year = Number(period.month.slice(0, 4));
		const month = Number(period.month.slice(5, 7));
		const lastDay = daysInCalendarMonth(year, month);
		return {
			from: `${period.month}-01`,
			to: `${period.month}-${String(lastDay).padStart(2, "0")}`,
		};
	}
	if (period.year !== undefined) {
		return { from: `${period.year}-01-01`, to: `${period.year}-12-31` };
	}
	if (period.from === undefined || period.to === undefined) {
		// Unreachable behind the schema's refinement; a thrown error beats a
		// silently wrong bound if the resolver is ever called unvalidated.
		throw new Error(
			"Report period must be a month, a year, or a from/to date range",
		);
	}
	return { from: period.from, to: period.to };
}

export const categoryBreakdownItemSchema = z.object({
	categoryId: z.string(),
	// Resolved by reference regardless of the category's lifecycle state; null
	// only when the category row itself was permanently deleted from trash.
	categoryName: z.string().nullable(),
	amountMinor: z.number().int(),
	// The category's share of the period's total expenses, in percent rounded
	// to two decimals. A display ratio, not money — floats never carry amounts.
	sharePercent: z.number(),
});

// One sub-period of the comparison chart: a calendar month within a year view,
// a calendar day within a month view. Zero-value sub-periods are present with
// zero amounts, never missing.
export const comparisonSeriesSchema = z.object({
	label: z.string(),
	incomeMinor: z.number().int(),
	expenseMinor: z.number().int(),
});

export const reportSummaryResponseSchema = z.object({
	// The resolved inclusive bounds every total was computed over.
	periodFrom: z.string(),
	periodTo: z.string(),
	incomeMinor: z.number().int(),
	expenseMinor: z.number().int(),
	// Income minus expenses; negative when the period spent more than it earned.
	netCashFlowMinor: z.number().int(),
	// Expense-side breakdown, largest total first.
	categoryBreakdown: z.array(categoryBreakdownItemSchema),
	// Income-vs-expense pairs across the period's natural sub-periods.
	comparison: z.array(comparisonSeriesSchema),
	// Active accounts with derived current balances; the same shapes the
	// accounts endpoint returns.
	accounts: z.array(accountResponseSchema),
	// Combined current balance across active accounts only.
	combinedBalanceMinor: z.number().int(),
});

export type CategoryBreakdownItem = z.infer<typeof categoryBreakdownItemSchema>;
export type ComparisonSeries = z.infer<typeof comparisonSeriesSchema>;
export type ReportSummaryResponse = z.infer<typeof reportSummaryResponseSchema>;
