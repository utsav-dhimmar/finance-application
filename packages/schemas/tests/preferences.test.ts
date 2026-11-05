import { describe, expect, it } from "vitest";
import {
	currencyCodeSchema,
	preferencesResponseSchema,
	supportedCurrencyCodes,
	updatePreferencesBodySchema,
} from "../src/preferences";

describe("currencyCodeSchema", () => {
	it("accepts the supported currency", () => {
		expect(currencyCodeSchema.parse("INR")).toBe("INR");
	});

	it("exposes INR as the only initially supported code", () => {
		expect(supportedCurrencyCodes).toEqual(["INR"]);
	});

	it.each(["USD", "EUR", "inr", "", "  INR"])("rejects %s", (input) => {
		expect(() => currencyCodeSchema.parse(input)).toThrow();
	});
});

describe("preferencesResponseSchema", () => {
	it("parses a resolved INR response", () => {
		expect(
			preferencesResponseSchema.parse({
				currencyCode: "INR",
				currencySymbol: "₹",
				minorUnitExponent: 2,
			}),
		).toEqual({
			currencyCode: "INR",
			currencySymbol: "₹",
			minorUnitExponent: 2,
		});
	});

	it.each([
		[
			"unknown code",
			{ currencyCode: "USD", currencySymbol: "$", minorUnitExponent: 2 },
		],
		["missing symbol", { currencyCode: "INR", minorUnitExponent: 2 }],
		[
			"blank symbol",
			{ currencyCode: "INR", currencySymbol: "", minorUnitExponent: 2 },
		],
		[
			"negative exponent",
			{ currencyCode: "INR", currencySymbol: "₹", minorUnitExponent: -1 },
		],
		[
			"non-integer exponent",
			{ currencyCode: "INR", currencySymbol: "₹", minorUnitExponent: 1.5 },
		],
	])("rejects %s", (_label, body) => {
		expect(() => preferencesResponseSchema.parse(body)).toThrow();
	});
});

describe("updatePreferencesBodySchema", () => {
	it("accepts a valid currency update", () => {
		expect(updatePreferencesBodySchema.parse({ currencyCode: "INR" })).toEqual({
			currencyCode: "INR",
		});
	});

	it.each([
		["unsupported currency", { currencyCode: "USD" }],
		["blank currency", { currencyCode: "" }],
		["missing currency", {}],
	])("rejects %s", (_label, body) => {
		expect(() => updatePreferencesBodySchema.parse(body)).toThrow();
	});

	it("rejects unknown fields instead of ignoring them", () => {
		expect(() =>
			updatePreferencesBodySchema.parse({
				currencyCode: "INR",
				theme: "dark",
			}),
		).toThrow();
	});
});
