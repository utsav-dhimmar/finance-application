import { describe, expect, it } from "vitest";
import {
	createTransactionBodySchema,
	listTransactionsQuerySchema,
	NOTES_MAX_LENGTH,
	restoreTransactionBodySchema,
	transactionAmountSchema,
	transactionDateSchema,
	transactionFormSchema,
	transactionIdSchema,
	updateTransactionBodySchema,
} from "../src/transactions";

const UUID_V7 = "018f6a2c-9b7d-7ce2-8f3a-1d4e5f6a7b8c";
const UUID_V4 = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("transactionAmountSchema", () => {
	it("accepts positive integer paise", () => {
		expect(transactionAmountSchema.parse(125050)).toBe(125050);
		expect(transactionAmountSchema.parse(1)).toBe(1);
	});

	it.each([0, -1, -125050, 12.5])("rejects %i", (input) => {
		expect(() => transactionAmountSchema.parse(input)).toThrow();
	});
});

describe("transactionDateSchema", () => {
	it.each(["2026-01-31", "2024-02-29", "2026-12-01"])("accepts %s", (input) => {
		expect(transactionDateSchema.parse(input)).toBe(input);
	});

	it.each([
		"2026-2-1",
		"2026-02-30",
		"2026-13-01",
		"2026-00-10",
		"2026-01-00",
		"2026/01/01",
		"",
	])("rejects %s", (input) => {
		expect(() => transactionDateSchema.parse(input)).toThrow();
	});
});

describe("transactionIdSchema", () => {
	it("accepts a UUIDv7", () => {
		expect(transactionIdSchema.parse(UUID_V7)).toBe(UUID_V7);
	});

	it("rejects a UUIDv4 and non-UUID strings", () => {
		expect(() => transactionIdSchema.parse(UUID_V4)).toThrow();
		expect(() => transactionIdSchema.parse("not-a-uuid")).toThrow();
	});
});

describe("transactionNotesSchema via create body", () => {
	it("trims notes", () => {
		const parsed = createTransactionBodySchema.parse({
			id: UUID_V7,
			type: "expense",
			amountMinor: 125050,
			date: "2026-01-15",
			accountId: "acc-1",
			categoryId: "cat-1",
			notes: "  weekly shop  ",
		});
		expect(parsed.notes).toBe("weekly shop");
	});

	it("rejects notes beyond the limit", () => {
		expect(() =>
			createTransactionBodySchema.parse({
				id: UUID_V7,
				type: "expense",
				amountMinor: 100,
				date: "2026-01-15",
				accountId: "acc-1",
				categoryId: "cat-1",
				notes: "a".repeat(NOTES_MAX_LENGTH + 1),
			}),
		).toThrow();
	});
});

describe("createTransactionBodySchema", () => {
	const valid = {
		id: UUID_V7,
		type: "expense",
		amountMinor: 125050,
		date: "2026-01-15",
		accountId: "acc-1",
		categoryId: "cat-1",
	};

	it("accepts a valid body", () => {
		expect(createTransactionBodySchema.parse(valid)).toMatchObject(valid);
	});

	it.each([
		["zero amount", { ...valid, amountMinor: 0 }],
		["negative amount", { ...valid, amountMinor: -5 }],
		["fractional amount", { ...valid, amountMinor: 10.5 }],
		["v4 id", { ...valid, id: UUID_V4 }],
		["bad date", { ...valid, date: "2026-02-30" }],
		["missing account", { ...valid, accountId: "" }],
		["unknown type", { ...valid, type: "transfer" }],
	])("rejects %s", (_label, body) => {
		expect(() => createTransactionBodySchema.parse(body)).toThrow();
	});
});

describe("updateTransactionBodySchema", () => {
	it("accepts a partial patch", () => {
		expect(updateTransactionBodySchema.parse({ amountMinor: 500 })).toEqual({
			amountMinor: 500,
		});
	});

	it("accepts null to clear notes", () => {
		expect(updateTransactionBodySchema.parse({ notes: null })).toEqual({
			notes: null,
		});
	});

	it("rejects a status change through the patch", () => {
		const parsed = updateTransactionBodySchema.parse({
			status: "archived",
		} as Record<string, unknown>);
		expect(parsed).not.toHaveProperty("status");
	});
});

describe("restoreTransactionBodySchema", () => {
	it("accepts empty reassignment", () => {
		expect(restoreTransactionBodySchema.parse({})).toEqual({});
	});

	it("accepts replacement references", () => {
		expect(
			restoreTransactionBodySchema.parse({
				accountId: "acc-2",
				categoryId: "cat-2",
			}),
		).toEqual({ accountId: "acc-2", categoryId: "cat-2" });
	});
});

describe("listTransactionsQuerySchema", () => {
	it("defaults status and pagination", () => {
		expect(listTransactionsQuerySchema.parse({})).toEqual({
			status: "active",
			page: 1,
			pageSize: 20,
		});
	});

	it("coerces page/pageSize from query strings and caps pageSize", () => {
		expect(
			listTransactionsQuerySchema.parse({ page: "2", pageSize: "100" }),
		).toMatchObject({ page: 2, pageSize: 100 });
		expect(() =>
			listTransactionsQuerySchema.parse({ pageSize: "101" }),
		).toThrow();
	});

	it("rejects an inverted date range shape only via consumers (from/to validated as dates)", () => {
		expect(
			listTransactionsQuerySchema.parse({
				from: "2026-01-01",
				to: "2026-01-31",
			}),
		).toMatchObject({ from: "2026-01-01", to: "2026-01-31" });
		expect(() =>
			listTransactionsQuerySchema.parse({ from: "2026-13-01" }),
		).toThrow();
	});
});

describe("transactionFormSchema", () => {
	it("maps a rupee string to paise and requires a positive amount", () => {
		const values = transactionFormSchema.parse({
			type: "expense",
			amount: "1250.50",
			date: "2026-01-15",
			accountId: "acc-1",
			categoryId: "cat-1",
		});
		expect(values.amount).toBe(125050);
		expect(() =>
			transactionFormSchema.parse({
				type: "expense",
				amount: "0",
				date: "2026-01-15",
				accountId: "acc-1",
				categoryId: "cat-1",
			}),
		).toThrow();
	});

	it("rejects empty references", () => {
		expect(() =>
			transactionFormSchema.parse({
				type: "expense",
				amount: "10",
				date: "2026-01-15",
				accountId: "",
				categoryId: "cat-1",
			}),
		).toThrow();
	});
});
