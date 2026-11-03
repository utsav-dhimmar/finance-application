import { describe, expect, it } from "vitest";
import {
	categoryBreakdownItemSchema,
	comparisonSeriesSchema,
	reportPeriodQuerySchema,
	reportSummaryResponseSchema,
	resolveReportPeriodBounds,
} from "../src/reports";

describe("reportPeriodQuerySchema", () => {
	it("accepts a month form", () => {
		expect(reportPeriodQuerySchema.parse({ month: "2026-01" })).toEqual({
			month: "2026-01",
		});
	});

	it("accepts a year form", () => {
		expect(reportPeriodQuerySchema.parse({ year: "2026" })).toEqual({
			year: "2026",
		});
	});

	it("accepts an inclusive from/to range", () => {
		const period = { from: "2026-01-01", to: "2026-01-31" };
		expect(reportPeriodQuerySchema.parse(period)).toEqual(period);
	});

	it.each([
		["month and year together", { month: "2026-01", year: "2026" }],
		["month with from", { month: "2026-01", from: "2026-01-01" }],
		["month with to", { month: "2026-01", to: "2026-01-31" }],
		[
			"year with from/to",
			{ year: "2026", from: "2026-01-01", to: "2026-12-31" },
		],
		["half-open range (to only)", { to: "2026-01-31" }],
		["half-open range (from only)", { from: "2026-01-01" }],
		["empty query", {}],
	])("rejects %s", (_label, period) => {
		expect(() => reportPeriodQuerySchema.parse(period)).toThrow();
	});

	it.each([
		["month out of range", "2026-13"],
		["month zero", "2026-00"],
		["month not zero-padded", "2026-1"],
		["month too long", "2026-011"],
		["month not a month", "2026-ab"],
	])("rejects a malformed month (%s)", (_label, month) => {
		expect(() => reportPeriodQuerySchema.parse({ month })).toThrow();
	});

	it.each([
		["year too short", "26"],
		["year too long", "20261"],
		["year not numeric", "20x6"],
	])("rejects a malformed year (%s)", (_label, year) => {
		expect(() => reportPeriodQuerySchema.parse({ year })).toThrow();
	});

	it("rejects a reversed range", () => {
		expect(() =>
			reportPeriodQuerySchema.parse({ from: "2026-02-01", to: "2026-01-31" }),
		).toThrow(/from date must be on or before/);
	});

	it("accepts a single-day range", () => {
		const period = { from: "2026-01-15", to: "2026-01-15" };
		expect(reportPeriodQuerySchema.parse(period)).toEqual(period);
	});
});

describe("resolveReportPeriodBounds", () => {
	it("resolves a month to its first and last day", () => {
		expect(resolveReportPeriodBounds({ month: "2026-01" })).toEqual({
			from: "2026-01-01",
			to: "2026-01-31",
		});
		expect(resolveReportPeriodBounds({ month: "2026-04" })).toEqual({
			from: "2026-04-01",
			to: "2026-04-30",
		});
	});

	it("resolves leap-year February to 29 days", () => {
		expect(resolveReportPeriodBounds({ month: "2024-02" })).toEqual({
			from: "2024-02-01",
			to: "2024-02-29",
		});
	});

	it("resolves non-leap-year February to 28 days", () => {
		expect(resolveReportPeriodBounds({ month: "2026-02" })).toEqual({
			from: "2026-02-01",
			to: "2026-02-28",
		});
	});

	it("resolves a century non-leap year February to 28 days", () => {
		expect(resolveReportPeriodBounds({ month: "1900-02" })).toEqual({
			from: "1900-02-01",
			to: "1900-02-28",
		});
		expect(resolveReportPeriodBounds({ month: "2000-02" })).toEqual({
			from: "2000-02-01",
			to: "2000-02-29",
		});
	});

	it("resolves a year to its first and last day", () => {
		expect(resolveReportPeriodBounds({ year: "2026" })).toEqual({
			from: "2026-01-01",
			to: "2026-12-31",
		});
	});

	it("passes an explicit range through unchanged", () => {
		expect(
			resolveReportPeriodBounds({ from: "2025-07-04", to: "2026-01-09" }),
		).toEqual({ from: "2025-07-04", to: "2026-01-09" });
	});

	it("throws when called with an unvalidated period", () => {
		expect(() =>
			resolveReportPeriodBounds({
				from: "2026-01-01",
				to: undefined as unknown as string,
			}),
		).toThrow();
	});
});

describe("response schemas", () => {
	const breakdownItem = {
		categoryId: "cat-1",
		categoryName: "Groceries",
		amountMinor: 50000,
		sharePercent: 62.5,
	};

	it("accepts a breakdown item and a nullable name for a permanently deleted category", () => {
		expect(categoryBreakdownItemSchema.parse(breakdownItem)).toEqual(
			breakdownItem,
		);
		expect(
			categoryBreakdownItemSchema.parse({
				...breakdownItem,
				categoryName: null,
			}),
		).toEqual({ ...breakdownItem, categoryName: null });
	});

	it("rejects a breakdown item without its share", () => {
		const { sharePercent: _sharePercent, ...missing } = breakdownItem;
		expect(() => categoryBreakdownItemSchema.parse(missing)).toThrow();
	});

	it("accepts a comparison series with zero sub-periods", () => {
		expect(
			comparisonSeriesSchema.parse({
				label: "2026-01",
				incomeMinor: 0,
				expenseMinor: 0,
			}),
		).toEqual({ label: "2026-01", incomeMinor: 0, expenseMinor: 0 });
		expect(() =>
			comparisonSeriesSchema.parse({
				label: "2026-01",
				incomeMinor: 1.5,
				expenseMinor: 0,
			}),
		).toThrow();
	});

	it("accepts a full summary response", () => {
		const summary = {
			periodFrom: "2026-01-01",
			periodTo: "2026-01-31",
			incomeMinor: 100000,
			expenseMinor: 80000,
			netCashFlowMinor: 20000,
			categoryBreakdown: [breakdownItem],
			comparison: [{ label: "2026-01-01", incomeMinor: 0, expenseMinor: 0 }],
			accounts: [
				{
					id: "acc-1",
					name: "HDFC Bank",
					type: "bank",
					openingBalanceMinor: 100000,
					currentBalanceMinor: 120000,
					status: "active",
					archivedAt: null,
					deletedAt: null,
					createdAt: "2026-01-01T00:00:00.000Z",
					updatedAt: "2026-01-01T00:00:00.000Z",
				},
			],
			combinedBalanceMinor: 120000,
		};
		expect(reportSummaryResponseSchema.parse(summary)).toEqual(summary);
	});

	it("rejects a summary without the resolved period bounds", () => {
		expect(() =>
			reportSummaryResponseSchema.parse({
				incomeMinor: 0,
				expenseMinor: 0,
				netCashFlowMinor: 0,
				categoryBreakdown: [],
				comparison: [],
				accounts: [],
				combinedBalanceMinor: 0,
			}),
		).toThrow();
	});
});
