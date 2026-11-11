import type { ReportPeriodQuery } from "@finance-application/schemas";

import type { SelectOption } from "@/components/shared/select-field";

// Dashboard period state, ported from the web's /dashboard route so labels
// and defaults read the same on both platforms. The device's local clock
// picks the default period (the current month); stored dates are calendar
// text and stay untouched by timezones.

export type PeriodMode = "month" | "year";

export const MONTH_NAMES = [
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

/** The current local calendar month as YYYY-MM. */
export function currentMonthValue(): string {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** The current local year as YYYY. */
export function currentYearValue(): string {
	return String(new Date().getFullYear());
}

export function periodFromForm(
	mode: PeriodMode,
	month: string,
	year: string,
): ReportPeriodQuery {
	return mode === "month" ? { month } : { year };
}

export function periodLabel(period: ReportPeriodQuery): string {
	if (period.month !== undefined) {
		const monthIndex = Number(period.month.slice(5, 7)) - 1;
		return `${MONTH_NAMES[monthIndex] ?? period.month} ${period.month.slice(0, 4)}`;
	}
	if (period.year !== undefined) {
		return period.year;
	}
	return "Custom range";
}

// The month select offers the twelve calendar months of the active year; the
// year select spans the same range the web's year input accepts (2000–2100).
const FIRST_YEAR = 2000;
const LAST_YEAR = 2100;

export function monthOptions(year: string): SelectOption[] {
	return MONTH_NAMES.map((name, index) => ({
		value: `${year}-${String(index + 1).padStart(2, "0")}`,
		label: name,
	}));
}

export function yearOptions(): SelectOption[] {
	const options: SelectOption[] = [];
	for (let year = FIRST_YEAR; year <= LAST_YEAR; year += 1) {
		options.push({ value: String(year), label: String(year) });
	}
	return options;
}
