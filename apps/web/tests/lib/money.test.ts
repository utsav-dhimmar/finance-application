import { describe, expect, it } from "vitest";
import { formatMinorUnits, minorToMajorInput } from "../../src/lib/money";

describe("formatMinorUnits", () => {
	it("derives two fraction digits from an exponent of 2", () => {
		expect(
			formatMinorUnits(125050, { symbol: "₹", minorUnitExponent: 2 }),
		).toBe("₹1,250.50");
		expect(formatMinorUnits(5, { symbol: "₹", minorUnitExponent: 2 })).toBe(
			"₹0.05",
		);
	});

	it("derives zero fraction digits from an exponent of 0", () => {
		expect(formatMinorUnits(1250, { symbol: "¥", minorUnitExponent: 0 })).toBe(
			"¥1,250",
		);
		expect(formatMinorUnits(7, { symbol: "¥", minorUnitExponent: 0 })).toBe(
			"¥7",
		);
	});

	it("derives three fraction digits from an exponent of 3", () => {
		expect(
			formatMinorUnits(1250500, { symbol: "BHD", minorUnitExponent: 3 }),
		).toBe("BHD1,250.500");
		expect(formatMinorUnits(7, { symbol: "BHD", minorUnitExponent: 3 })).toBe(
			"BHD0.007",
		);
	});

	it("keeps the sign before the symbol for negatives", () => {
		expect(
			formatMinorUnits(-125050, { symbol: "₹", minorUnitExponent: 2 }),
		).toBe("-₹1,250.50");
		expect(formatMinorUnits(-7, { symbol: "¥", minorUnitExponent: 0 })).toBe(
			"-¥7",
		);
	});

	it("formats zero without a sign", () => {
		expect(formatMinorUnits(0, { symbol: "₹", minorUnitExponent: 2 })).toBe(
			"₹0.00",
		);
	});
});

describe("minorToMajorInput", () => {
	it("derives the major-unit decimal from the exponent", () => {
		expect(
			minorToMajorInput(125050, { symbol: "₹", minorUnitExponent: 2 }),
		).toBe("1250.50");
		expect(minorToMajorInput(1250, { symbol: "¥", minorUnitExponent: 0 })).toBe(
			"1250",
		);
		expect(
			minorToMajorInput(1250500, { symbol: "BHD", minorUnitExponent: 3 }),
		).toBe("1250.500");
	});

	it("keeps negatives parseable", () => {
		expect(
			minorToMajorInput(-125050, { symbol: "₹", minorUnitExponent: 2 }),
		).toBe("-1250.50");
	});
});
