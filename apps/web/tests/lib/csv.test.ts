import { describe, expect, it } from "vitest";
import { CSV_BOM, escapeCsvField, toCsv } from "@/lib/csv";

describe("escapeCsvField", () => {
	it("passes plain values through verbatim", () => {
		expect(escapeCsvField("2026-01-15")).toBe("2026-01-15");
		expect(escapeCsvField("1250.50")).toBe("1250.50");
	});

	it("renders null and undefined as empty", () => {
		expect(escapeCsvField(null)).toBe("");
		expect(escapeCsvField(undefined)).toBe("");
		expect(escapeCsvField("")).toBe("");
	});

	it("quotes fields containing commas", () => {
		expect(escapeCsvField("a,b")).toBe('"a,b"');
	});

	it("quotes fields containing double quotes and doubles internal quotes", () => {
		expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
	});

	it("quotes fields containing newlines and carriage returns", () => {
		expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
		expect(escapeCsvField("a\rb")).toBe('"a\rb"');
	});

	it("leaves safe special characters unquoted", () => {
		expect(escapeCsvField("₹ semicolons; stay")).toBe("₹ semicolons; stay");
	});
});

describe("toCsv", () => {
	const headers = ["Date", "Description", "Amount"];

	it("starts with the UTF-8 BOM", () => {
		const csv = toCsv(headers, [["2026-01-15", "shop", "1250.50"]]);
		expect(csv.charCodeAt(0)).toBe(0xfeff);
		expect(csv.startsWith(CSV_BOM)).toBe(true);
	});

	it("renders the header row then CRLF-separated data rows", () => {
		const csv = toCsv(headers, [["2026-01-15", null, "1250.50"]]);
		expect(csv).toBe(
			`${CSV_BOM}Date,Description,Amount\r\n2026-01-15,,1250.50`,
		);
	});

	it("escapes fields inside data rows", () => {
		const csv = toCsv(headers, [["2026-01-15", 'a,"note"', "5"]]);
		expect(csv).toBe(
			`${CSV_BOM}Date,Description,Amount\r\n2026-01-15,"a,""note""",5`,
		);
	});

	it("keeps multi-line fields as single quoted fields", () => {
		const csv = toCsv(headers, [["2026-01-15", "line1\nline2", "5"]]);
		expect(csv).toBe(
			`${CSV_BOM}Date,Description,Amount\r\n2026-01-15,"line1\nline2",5`,
		);
	});

	it("separates multiple rows with CRLF", () => {
		const csv = toCsv(headers, [
			["2026-01-15", "one", "1"],
			["2026-01-16", "two", "2"],
		]);
		expect(csv).toBe(
			`${CSV_BOM}Date,Description,Amount\r\n2026-01-15,one,1\r\n2026-01-16,two,2`,
		);
	});
});
