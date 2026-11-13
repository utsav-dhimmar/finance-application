// Calendar-date helpers for the shared YYYY-MM-DD rule: dates cross the wire
// as plain calendar strings (no time, no timezone), so the date picker's
// value is derived from the string and written back as a string using LOCAL
// calendar fields — never an ISO round-trip that could shift the day.

/** Today's local calendar date as YYYY-MM-DD. */
export function todayString(): string {
	return calendarDateString(new Date());
}

/** A Date's local calendar fields as YYYY-MM-DD. */
export function calendarDateString(date: Date): string {
	const year = String(date.getFullYear()).padStart(4, "0");
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/** Parses YYYY-MM-DD into a local-noon Date for the picker, or undefined. */
export function calendarDateValue(value: string): Date | undefined {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) {
		return undefined;
	}
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	// Noon avoids any DST edge at midnight when the picker reads the fields.
	const date = new Date(year, (month ?? 1) - 1, day ?? 1, 12, 0, 0, 0);
	if (
		date.getFullYear() !== year ||
		date.getMonth() !== (month ?? 1) - 1 ||
		date.getDate() !== day
	) {
		return undefined;
	}
	return date;
}
