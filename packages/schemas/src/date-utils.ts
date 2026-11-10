/**
 * Pure calendar date arithmetic utilities for YYYY-MM-DD date strings.
 * Avoids browser/driver timezone offset issues by operating purely in UTC calendar fields.
 */

/**
 * Calculates the number of days in a given calendar month.
 * @param year e.g. 2026
 * @param month 1-indexed month (1..12)
 */
export function getDaysInMonth(year: number, month: number): number {
	// Day 0 of the following month in UTC gives the last day of the target month
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Adds an integer number of calendar months to a YYYY-MM-DD date string,
 * safely clamping the day to the last valid day of the target month.
 *
 * Example:
 * - 2026-01-31 + 1 month -> 2026-02-28 (non-leap year)
 * - 2024-01-31 + 1 month -> 2024-02-29 (leap year)
 * - 2026-08-31 + 1 month -> 2026-09-30 (30-day month)
 * - 2026-11-15 + 3 months -> 2027-02-15 (year rollover)
 */
export function addCalendarMonths(dateStr: string, monthsToAdd: number): string {
	const [yearStr, monthStr, dayStr] = dateStr.split("-");
	const year = Number(yearStr);
	const month = Number(monthStr); // 1-indexed
	const day = Number(dayStr);

	if (
		Number.isNaN(year) ||
		Number.isNaN(month) ||
		Number.isNaN(day) ||
		month < 1 ||
		month > 12
	) {
		throw new Error(`Invalid calendar date: ${dateStr}`);
	}

	const totalMonths = year * 12 + (month - 1) + monthsToAdd;
	const targetYear = Math.floor(totalMonths / 12);
	const targetMonthIndex = ((totalMonths % 12) + 12) % 12; // 0-indexed (0..11)
	const targetMonth = targetMonthIndex + 1; // 1-indexed (1..12)

	const maxDaysInTargetMonth = getDaysInMonth(targetYear, targetMonth);
	const clampedDay = Math.min(day, maxDaysInTargetMonth);

	const yyyy = targetYear.toString().padStart(4, "0");
	const mm = targetMonth.toString().padStart(2, "0");
	const dd = clampedDay.toString().padStart(2, "0");

	return `${yyyy}-${mm}-${dd}`;
}

/**
 * Returns the calendar difference in whole days between two YYYY-MM-DD strings (to - from).
 * Positive if targetDate is in the future relative to fromDate, 0 if same day, negative if overdue.
 */
export function diffCalendarDays(targetDateStr: string, fromDateStr: string): number {
	const [tY, tM, tD] = targetDateStr.split("-").map(Number);
	const [fY, fM, fD] = fromDateStr.split("-").map(Number);

	const targetUtc = Date.UTC(tY ?? 0, (tM ?? 1) - 1, tD ?? 0);
	const fromUtc = Date.UTC(fY ?? 0, (fM ?? 1) - 1, fD ?? 0);

	const MS_PER_DAY = 1000 * 60 * 60 * 24;
	return Math.round((targetUtc - fromUtc) / MS_PER_DAY);
}
