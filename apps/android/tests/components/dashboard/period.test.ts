import { reportPeriodQuerySchema } from "@finance-application/schemas";
import { describe, expect, it } from "vitest";

import {
	currentMonthValue,
	currentYearValue,
	monthOptions,
	periodFromForm,
	periodLabel,
	yearOptions,
} from "@/components/dashboard/period";

describe("period defaults", () => {
	it("derives the current month from the local clock as YYYY-MM", () => {
		const now = new Date();
		const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
		expect(currentMonthValue()).toBe(expected);
		expect(currentMonthValue()).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
	});

	it("derives the current year as YYYY", () => {
		expect(currentYearValue()).toBe(String(new Date().getFullYear()));
		expect(currentYearValue()).toMatch(/^\d{4}$/);
	});
});

describe("periodFromForm", () => {
	it("produces schema-valid single-form periods", () => {
		const monthPeriod = periodFromForm("month", "2026-02", "2026");
		const yearPeriod = periodFromForm("year", "2026-02", "2026");
		expect(reportPeriodQuerySchema.safeParse(monthPeriod).success).toBe(true);
		expect(reportPeriodQuerySchema.safeParse(yearPeriod).success).toBe(true);
		// Exactly one form each, never both.
		expect(monthPeriod).toEqual({ month: "2026-02" });
		expect(yearPeriod).toEqual({ year: "2026" });
	});
});

describe("periodLabel", () => {
	it("labels months with the web's month-name table", () => {
		expect(periodLabel({ month: "2026-01" })).toBe("January 2026");
		expect(periodLabel({ month: "2025-12" })).toBe("December 2025");
	});

	it("labels years bare and custom ranges generically", () => {
		expect(periodLabel({ year: "2026" })).toBe("2026");
		expect(periodLabel({})).toBe("Custom range");
	});
});

describe("select options", () => {
	it("offers the twelve months of the active year", () => {
		const options = monthOptions("2026");
		expect(options).toHaveLength(12);
		expect(options[0]).toEqual({ value: "2026-01", label: "January" });
		expect(options[11]).toEqual({ value: "2026-12", label: "December" });
	});

	it("spans a rolling year window around the current year", () => {
		const options = yearOptions();
		const currentYear = new Date().getFullYear();
		// Ten years before through ten years after the current year: 21 options.
		expect(options).toHaveLength(21);
		expect(options[0]?.value).toBe(String(currentYear - 10));
		expect(options[options.length - 1]?.value).toBe(String(currentYear + 10));
		// The current year is among the offered options.
		expect(options.some((option) => option.value === String(currentYear))).toBe(
			true,
		);
	});
});
