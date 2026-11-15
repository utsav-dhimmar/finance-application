import type { ExportTransactionRow } from "@finance-application/schemas";
import { ApiError } from "@finance-application/api-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	buildTransactionsCsv,
	ExportCancelledError,
	exportFilename,
	exportRowToCsvCells,
	exportTransactionsToCsv,
	triggerCsvDownload,
} from "@/lib/csv-export";

const UUID_V7 = "018f6a2c-9b7d-7ce2-8f3a-1d4e5f6a7b8c";

function makeRow(
	overrides: Partial<ExportTransactionRow> = {},
): ExportTransactionRow {
	return {
		id: UUID_V7,
		date: "2026-01-15",
		createdAt: "2026-01-16T00:00:00.000Z",
		type: "expense",
		amountMinor: 125050,
		notes: "weekly shop",
		status: "active",
		accountName: "HDFC Bank",
		categoryName: "Groceries",
		...overrides,
	};
}

describe("exportRowToCsvCells", () => {
	it("maps the raw fields onto the CSV columns in order", () => {
		const cells = exportRowToCsvCells(makeRow(), "INR");
		expect(cells).toEqual([
			"2026-01-15",
			"weekly shop",
			"Groceries",
			"HDFC Bank",
			"expense",
			"1250.50",
			"INR",
			"active",
		]);
	});

	it("formats amounts from paise with integer-only math", () => {
		expect(
			exportRowToCsvCells(makeRow({ amountMinor: 125050 }), "INR")[5],
		).toBe("1250.50");
		expect(exportRowToCsvCells(makeRow({ amountMinor: 5 }), "INR")[5]).toBe(
			"0.05",
		);
	});

	it("keeps null names and notes as null for the serializer to empty", () => {
		const cells = exportRowToCsvCells(
			makeRow({ notes: null, categoryName: null, accountName: null }),
			"INR",
		);
		expect(cells.slice(1, 4)).toEqual([null, null, null]);
	});
});

describe("buildTransactionsCsv", () => {
	it("renders the human-readable header and BOM", () => {
		const csv = buildTransactionsCsv([makeRow()], "INR");
		const [headerLine, dataLine] = csv
			.slice(1) // drop the BOM
			.split("\r\n");
		expect(headerLine).toBe(
			"Date,Description,Category,Account,Type,Amount,Currency,Status",
		);
		expect(dataLine).toBe(
			"2026-01-15,weekly shop,Groceries,HDFC Bank,expense,1250.50,INR,active",
		);
		expect(csv.charCodeAt(0)).toBe(0xfeff);
	});
});

describe("exportFilename", () => {
	it("uses the local calendar date", () => {
		// Month is 0-based: 10 → November.
		expect(exportFilename(new Date(2026, 10, 15, 23, 5))).toBe(
			"transactions-2026-11-15.csv",
		);
		expect(exportFilename(new Date(2026, 0, 5))).toBe(
			"transactions-2026-01-05.csv",
		);
	});
});

describe("triggerCsvDownload", () => {
	let createObjectURL: ReturnType<typeof vi.fn<(blob: Blob) => string>>;
	let revokeObjectURL: ReturnType<typeof vi.fn<(url: string) => void>>;
	let clickedAnchor: HTMLAnchorElement | null;
	// Read through a function so TS control flow does not narrow the
	// closure-assigned variable to null.
	const clicked = () => clickedAnchor;

	beforeEach(() => {
		createObjectURL = vi.fn(() => "blob:mock-url");
		revokeObjectURL = vi.fn();
		Object.defineProperty(URL, "createObjectURL", {
			value: createObjectURL,
			configurable: true,
			writable: true,
		});
		Object.defineProperty(URL, "revokeObjectURL", {
			value: revokeObjectURL,
			configurable: true,
			writable: true,
		});
		clickedAnchor = null;
		vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
			this: HTMLAnchorElement,
		) {
			clickedAnchor = this;
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("downloads a text/csv blob with the given filename and frees the URL", () => {
		triggerCsvDownload("name,amount\n", "transactions-2026-11-15.csv");

		expect(createObjectURL).toHaveBeenCalledTimes(1);
		const blob = createObjectURL.mock.calls.at(0)?.[0];
		expect(blob).toBeInstanceOf(Blob);
		expect(blob?.type).toBe("text/csv;charset=utf-8;");
		expect(clicked()).not.toBeNull();
		expect(clicked()?.download).toBe("transactions-2026-11-15.csv");
		expect(clicked()?.href).toContain("blob:mock-url");
		expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
	});

	it("defaults the filename to the export date", () => {
		triggerCsvDownload("a,b\n");
		expect(clicked()?.download).toMatch(
			/^transactions-\d{4}-\d{2}-\d{2}\.csv$/,
		);
	});
});

describe("exportTransactionsToCsv", () => {
	function chunkOf(
		rows: ExportTransactionRow[],
		nextCursor: string | null,
	): { transactions: ExportTransactionRow[]; nextCursor: string | null } {
		return { transactions: rows, nextCursor };
	}

	const filters = { status: "active" as const, q: "shop" };
	const currency = "INR";

	it("walks chunks in order, reports progress, and triggers the download", async () => {
		const fetchChunk = vi
			.fn()
			.mockResolvedValueOnce(
				chunkOf([makeRow({ id: "a" }), makeRow({ id: "b" })], "cursor-1"),
			)
			.mockResolvedValueOnce(chunkOf([makeRow({ id: "c" })], null));
		const onProgress = vi.fn();
		const download = vi
			.spyOn(HTMLAnchorElement.prototype, "click")
			.mockImplementation(() => {});
		vi.stubGlobal("URL", {
			...URL,
			createObjectURL: vi.fn(() => "blob:loop"),
			revokeObjectURL: vi.fn(),
		});

		try {
			const result = await exportTransactionsToCsv({
				filters,
				currency,
				onProgress,
				fetchChunk,
			});

			expect(result).toEqual({ rowCount: 3, filename: expect.any(String) });
			expect(fetchChunk).toHaveBeenCalledTimes(2);
			const firstCall = fetchChunk.mock.calls.at(0);
			const secondCall = fetchChunk.mock.calls.at(1);
			expect(firstCall).toBeDefined();
			expect(secondCall).toBeDefined();
			expect(firstCall?.[0]).toEqual({ status: "active", q: "shop" });
			expect(secondCall?.[0]).toEqual({
				status: "active",
				q: "shop",
				cursor: "cursor-1",
			});
			expect(onProgress).toHaveBeenNthCalledWith(1, 2);
			expect(onProgress).toHaveBeenNthCalledWith(2, 3);
			expect(download).toHaveBeenCalledTimes(1);
		} finally {
			vi.unstubAllGlobals();
			vi.restoreAllMocks();
		}
	});

	it("resolves rowCount 0 on an empty export without downloading", async () => {
		const fetchChunk = vi.fn().mockResolvedValue(chunkOf([], null));
		const createObjectURL = vi.fn();

		try {
			vi.stubGlobal("URL", {
				...URL,
				createObjectURL,
				revokeObjectURL: vi.fn(),
			});
			const result = await exportTransactionsToCsv({
				filters,
				currency,
				fetchChunk,
			});
			expect(result).toEqual({ rowCount: 0, filename: null });
			expect(createObjectURL).not.toHaveBeenCalled();
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("surfaces the failed chunk's ApiError unchanged", async () => {
		const failure = new ApiError(500, "INTERNAL_ERROR", "Chunk exploded", []);
		const fetchChunk = vi.fn().mockRejectedValue(failure);
		await expect(
			exportTransactionsToCsv({ filters, currency, fetchChunk }),
		).rejects.toThrow("Chunk exploded");
		await expect(
			exportTransactionsToCsv({ filters, currency, fetchChunk }),
		).rejects.toMatchObject({ status: 500, code: "INTERNAL_ERROR" });
	});

	it("throws ExportCancelledError when the signal aborts mid-loop", async () => {
		const controller = new AbortController();
		const fetchChunk = vi.fn().mockImplementation(async () => {
			controller.abort();
			throw new DOMException("The operation was aborted.", "AbortError");
		});
		await expect(
			exportTransactionsToCsv({
				filters,
				currency,
				fetchChunk,
				signal: controller.signal,
			}),
		).rejects.toThrow(ExportCancelledError);
	});

	it("throws ExportCancelledError for a signal already aborted between chunks", async () => {
		const controller = new AbortController();
		controller.abort();
		const fetchChunk = vi.fn();
		await expect(
			exportTransactionsToCsv({
				filters,
				currency,
				fetchChunk,
				signal: controller.signal,
			}),
		).rejects.toThrow(ExportCancelledError);
		expect(fetchChunk).not.toHaveBeenCalled();
	});
});
