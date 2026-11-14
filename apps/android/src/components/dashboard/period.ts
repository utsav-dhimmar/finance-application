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
// year select offers a rolling window around the device's current year so the
// native dropdown menu stays usable (21 options instead of the web input's
// 2000–2100 range, which the reporting API still accepts).
const YEAR_WINDOW = 10;

export function monthOptions(year: string): SelectOption[] {
	return MONTH_NAMES.map((name, index) => ({
		value: `${year}-${String(index + 1).padStart(2, "0")}`,
		label: name,
	}));
}

export function yearOptions(): SelectOption[] {
	const currentYear = new Date().getFullYear();
	const options: SelectOption[] = [];
	for (
		let year = currentYear - YEAR_WINDOW;
		year <= currentYear + YEAR_WINDOW;
		year += 1
	) {
		options.push({ value: String(year), label: String(year) });
	}
	return options;
}
