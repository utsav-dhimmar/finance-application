// RFC 4180-compliant CSV serialization for the browser-side export. Pure
// string building — no DOM access — so it is unit-testable anywhere and can
// never touch the network or trigger a download by itself.

// A field containing a comma, double quote, or newline must be quoted with
// internal quotes doubled; null and undefined render as empty. Everything
// else passes through verbatim.
export function escapeCsvField(value: string | null | undefined): string {
	if (value === null || value === undefined) {
		return "";
	}
	if (/[",\n\r]/.test(value)) {
		return `"${value.replaceAll('"', '""')}"`;
	}
	return value;
}

// UTF-8 BOM (U+FEFF): Excel and Google Sheets rely on it to render non-ASCII
// characters — currency symbols such as the rupee sign — without mojibake.
// Built from its code point so the source file stays pure ASCII.
export const CSV_BOM = String.fromCharCode(0xfeff);

// Builds the full CSV text: BOM first, then the header row, then one line
// per data row, CRLF-terminated per RFC 4180.
export function toCsv(
	headers: readonly string[],
	rows: readonly (readonly (string | null | undefined)[])[],
): string {
	const lines = [
		headers.map(escapeCsvField).join(","),
		...rows.map((row) => row.map(escapeCsvField).join(",")),
	];
	return `${CSV_BOM}${lines.join("\r\n")}`;
}
