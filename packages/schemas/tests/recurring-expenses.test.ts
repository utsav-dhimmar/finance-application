import { describe, expect, it } from "vitest";
import {
	createRecurringExpenseBodySchema,
	postDueRecurringExpenseBodySchema,
	recurringExpenseIntervalSchema,
	recurringExpenseNameSchema,
	updateRecurringExpenseBodySchema,
} from "../src/recurring-expenses";

const UUID_V7 = "018f6a2c-9b7d-7ce2-8f3a-1d4e5f6a7b8c";
const UUID_V4 = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("recurringExpenseIntervalSchema", () => {
	it("accepts valid positive month intervals", () => {
		expect(recurringExpenseIntervalSchema.parse(1)).toBe(1);
		expect(recurringExpenseIntervalSchema.parse(2)).toBe(2);
		expect(recurringExpenseIntervalSchema.parse(3)).toBe(3);
		expect(recurringExpenseIntervalSchema.parse(6)).toBe(6);
		expect(recurringExpenseIntervalSchema.parse(12)).toBe(12);
	});

	it.each([0, -1, 1.5, 121])("rejects invalid interval %i", (val) => {
		expect(() => recurringExpenseIntervalSchema.parse(val)).toThrow();
	});
});

describe("recurringExpenseNameSchema", () => {
	it("trims and accepts valid names", () => {
		expect(recurringExpenseNameSchema.parse("  Netflix  ")).toBe("Netflix");
	});

	it("rejects empty or whitespace names", () => {
		expect(() => recurringExpenseNameSchema.parse("")).toThrow();
		expect(() => recurringExpenseNameSchema.parse("   ")).toThrow();
	});
});

describe("createRecurringExpenseBodySchema", () => {
	const valid = {
		id: UUID_V7,
		name: "Gym Membership",
		amountMinor: 300000,
		intervalMonths: 3,
		startDate: "2026-01-01",
		sourceAccountId: "acc-1",
		categoryId: "cat-1",
		endDate: "2026-12-31",
		notes: "Quarterly gym",
	};

	it("accepts valid recurring expense", () => {
		const parsed = createRecurringExpenseBodySchema.parse(valid);
		expect(parsed.id).toBe(UUID_V7);
		expect(parsed.intervalMonths).toBe(3);
	});

	it("rejects non-UUIDv7 id", () => {
		expect(() =>
			createRecurringExpenseBodySchema.parse({ ...valid, id: UUID_V4 }),
		).toThrow();
	});

	it("rejects endDate before startDate", () => {
		expect(() =>
			createRecurringExpenseBodySchema.parse({
				...valid,
				startDate: "2026-06-01",
				endDate: "2026-05-01",
			}),
		).toThrow();
	});

	it("allows null or omitted endDate", () => {
		const withoutEnd = createRecurringExpenseBodySchema.parse({
			...valid,
			endDate: null,
		});
		expect(withoutEnd.endDate).toBeNull();
	});
});

describe("updateRecurringExpenseBodySchema", () => {
	it("accepts partial updates", () => {
		const parsed = updateRecurringExpenseBodySchema.parse({
			intervalMonths: 6,
			amountMinor: 500000,
		});
		expect(parsed.intervalMonths).toBe(6);
		expect(parsed.amountMinor).toBe(500000);
	});
});

describe("postDueRecurringExpenseBodySchema", () => {
	it("accepts valid post due body with transactionId", () => {
		const parsed = postDueRecurringExpenseBodySchema.parse({
			transactionId: UUID_V7,
			amountMinor: 300000,
			date: "2026-04-01",
		});
		expect(parsed.transactionId).toBe(UUID_V7);
		expect(parsed.amountMinor).toBe(300000);
	});

	it("rejects missing transactionId", () => {
		expect(() => postDueRecurringExpenseBodySchema.parse({})).toThrow();
	});
});
