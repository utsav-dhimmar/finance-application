import { describe, expect, it } from "vitest";
import {
	addCalendarMonths,
	diffCalendarDays,
	getDaysInMonth,
} from "../src/date-utils";

describe("getDaysInMonth", () => {
	it("returns 31 days for January, March, May, July, August, October, December", () => {
		expect(getDaysInMonth(2026, 1)).toBe(31);
		expect(getDaysInMonth(2026, 3)).toBe(31);
		expect(getDaysInMonth(2026, 5)).toBe(31);
		expect(getDaysInMonth(2026, 7)).toBe(31);
		expect(getDaysInMonth(2026, 8)).toBe(31);
		expect(getDaysInMonth(2026, 10)).toBe(31);
		expect(getDaysInMonth(2026, 12)).toBe(31);
	});

	it("returns 30 days for April, June, September, November", () => {
		expect(getDaysInMonth(2026, 4)).toBe(30);
		expect(getDaysInMonth(2026, 6)).toBe(30);
		expect(getDaysInMonth(2026, 9)).toBe(30);
		expect(getDaysInMonth(2026, 11)).toBe(30);
	});

	it("correctly identifies leap years for February", () => {
		expect(getDaysInMonth(2026, 2)).toBe(28); // non-leap
		expect(getDaysInMonth(2024, 2)).toBe(29); // leap
		expect(getDaysInMonth(2000, 2)).toBe(29); // century leap
		expect(getDaysInMonth(1900, 2)).toBe(28); // century non-leap
	});
});

describe("addCalendarMonths", () => {
	it("advances standard dates by 1 month", () => {
		expect(addCalendarMonths("2026-05-15", 1)).toBe("2026-06-15");
	});

	it("advances by multi-month cadences (2, 3, 6, 12 months)", () => {
		expect(addCalendarMonths("2026-01-10", 2)).toBe("2026-03-10");
		expect(addCalendarMonths("2026-01-10", 3)).toBe("2026-04-10");
		expect(addCalendarMonths("2026-01-10", 6)).toBe("2026-07-10");
		expect(addCalendarMonths("2026-01-10", 12)).toBe("2027-01-10");
	});

	it("handles year rollover seamlessly", () => {
		expect(addCalendarMonths("2026-11-20", 2)).toBe("2027-01-20");
		expect(addCalendarMonths("2026-12-05", 1)).toBe("2027-01-05");
	});

	it("clamps day to 28 for non-leap February", () => {
		expect(addCalendarMonths("2026-01-31", 1)).toBe("2026-02-28");
		expect(addCalendarMonths("2026-01-30", 1)).toBe("2026-02-28");
		expect(addCalendarMonths("2026-01-29", 1)).toBe("2026-02-28");
	});

	it("clamps day to 29 for leap February", () => {
		expect(addCalendarMonths("2024-01-31", 1)).toBe("2024-02-29");
	});

	it("clamps day to 30 for 30-day months", () => {
		expect(addCalendarMonths("2026-03-31", 1)).toBe("2026-04-30");
		expect(addCalendarMonths("2026-05-31", 1)).toBe("2026-06-30");
		expect(addCalendarMonths("2026-08-31", 1)).toBe("2026-09-30");
		expect(addCalendarMonths("2026-10-31", 1)).toBe("2026-11-30");
	});

	it("throws on invalid date input", () => {
		expect(() => addCalendarMonths("invalid-date", 1)).toThrow();
	});
});

describe("diffCalendarDays", () => {
	it("calculates difference accurately across month boundaries", () => {
		expect(diffCalendarDays("2026-01-05", "2026-01-01")).toBe(4);
		expect(diffCalendarDays("2026-02-01", "2026-01-31")).toBe(1);
		expect(diffCalendarDays("2026-01-01", "2026-01-01")).toBe(0);
		expect(diffCalendarDays("2026-01-01", "2026-01-05")).toBe(-4);
	});
});
