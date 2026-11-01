import { describe, expect, it } from "vitest";
import {
	amountInputSchema,
	accountFormSchema,
	accountNameSchema,
	accountTypeSchema,
	createAccountBodySchema,
} from "../src/accounts";

describe("amountInputSchema", () => {
	it.each([
		["1250.50", 125050],
		["1250.5", 125050],
		["1250", 125000],
		["0.99", 99],
		["0", 0],
		["-12.34", -1234],
		["-0.01", -1],
		["007", 700],
		["", 0],
		[" 12.34 ", 1234],
		["99999999999.99", 9999999999999],
	])("parses %s to %i paise", (input, expected) => {
		expect(amountInputSchema.parse(input)).toBe(expected);
	});

	it.each([
		["1250.505"],
		["1,250.50"],
		["abc"],
		["12.3.4"],
		["--12"],
		["12."],
		["+12.34"],
		["₹12"],
	])("rejects %s", (input) => {
		expect(() => amountInputSchema.parse(input)).toThrow();
	});
});

describe("accountNameSchema", () => {
	it("trims surrounding whitespace", () => {
		expect(accountNameSchema.parse("  HDFC Bank  ")).toBe("HDFC Bank");
	});

	it.each(["", "   "])("rejects a blank name (%s)", (input) => {
		expect(() => accountNameSchema.parse(input)).toThrow();
	});

	it("rejects names beyond the length limit", () => {
		expect(() => accountNameSchema.parse("a".repeat(81))).toThrow();
		expect(accountNameSchema.parse("a".repeat(80))).toBe("a".repeat(80));
	});
});

describe("accountTypeSchema", () => {
	it("accepts the three supported types", () => {
		expect(accountTypeSchema.parse("cash")).toBe("cash");
		expect(accountTypeSchema.parse("bank")).toBe("bank");
		expect(accountTypeSchema.parse("wallet")).toBe("wallet");
	});

	it("rejects other types", () => {
		expect(() => accountTypeSchema.parse("credit")).toThrow();
	});
});

describe("createAccountBodySchema", () => {
	it("defaults the opening balance to zero", () => {
		expect(
			createAccountBodySchema.parse({ name: "Cash", type: "cash" }),
		).toEqual({ name: "Cash", type: "cash", openingBalanceMinor: 0 });
	});

	it("rejects a fractional opening balance", () => {
		expect(() =>
			createAccountBodySchema.parse({
				name: "Cash",
				type: "cash",
				openingBalanceMinor: 1250.5,
			}),
		).toThrow();
	});
});

describe("accountFormSchema", () => {
	it("maps a rupee string form input to a paise amount for the API body", () => {
		const values = accountFormSchema.parse({
			name: "Wallet",
			type: "wallet",
			openingBalance: "500.25",
		});
		expect(values).toEqual({
			name: "Wallet",
			type: "wallet",
			openingBalance: 50025,
		});
	});
});
