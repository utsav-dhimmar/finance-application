import type {
	ExportTransactionRow,
	ExportTransactionsQuery,
} from "@finance-application/schemas";
import { fetchTransactionsExportChunk } from "@finance-application/api-client";
import { paiseToRupeeInput } from "@/lib/money";
import { toCsv } from "@/lib/csv";

// Browser-only CSV export orchestration. Everything here runs on demand from
// a user event handler — never in route loaders or beforeLoad, which may
// execute during build-time prerendering where fetch/DOM do not exist.

export const CSV_HEADERS = [
	"Date",
	"Description",
	"Category",
	"Account",
	"Type",
	"Amount",
	"Currency",
	"Status",
] as const;

// The page's filter state at the moment the user starts an export. Frozen
// into the export loop so changing filters mid-export cannot silently skip
// or duplicate rows.
export type ExportFilterSnapshot = Omit<
	ExportTransactionsQuery,
	"cursor" | "limit"
>;

// Maps one raw export row onto CSV cells. Amounts convert from integer paise
// to a decimal string with pure integer arithmetic (no binary float); null
// names/notes pass through for the serializer to render as empty cells.
export function exportRowToCsvCells(
	row: ExportTransactionRow,
	currency: string,
): (string | null | undefined)[] {
	return [
		row.date,
		row.notes,
		row.categoryName,
		row.accountName,
		row.type,
		paiseToRupeeInput(row.amountMinor),
		currency,
		row.status,
	];
}

export function buildTransactionsCsv(
	rows: readonly ExportTransactionRow[],
	currency: string,
): string {
	return toCsv(
		CSV_HEADERS,
		rows.map((row) => exportRowToCsvCells(row, currency)),
	);
}

// Local calendar date (not UTC) so the filename matches the user's day.
export function exportFilename(date: Date = new Date()): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `transactions-${year}-${month}-${day}.csv`;
}

// Downloads the CSV via a temporary object-URL anchor and immediately frees
// the URL. Browsers treat the `download` attribute as a save, not navigation.
export function triggerCsvDownload(
	csv: string,
	filename: string = exportFilename(),
): void {
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(url);
}

// Thrown when the user aborts an in-progress export — distinct from request
// failures so the UI can show a neutral "cancelled" message instead of an
// error.
export class ExportCancelledError extends Error {
	constructor() {
		super("Export cancelled");
		this.name = "ExportCancelledError";
	}
}

export interface ExportTransactionsOptions {
	filters: ExportFilterSnapshot;
	currency: string;
	signal?: AbortSignal;
	onProgress?: (fetchedRows: number) => void;
	// Injectable for tests; production code uses the real API client.
	fetchChunk?: typeof fetchTransactionsExportChunk;
}

export interface ExportTransactionsResult {
	rowCount: number;
	filename: string | null;
}

// Fetches every export chunk sequentially, feeding each response's cursor
// back until it reports exhaustion, then serializes the accumulated rows and
// triggers the download. Resolves with rowCount 0 (no download) when the
// filtered export is empty; throws the triggering ApiError when any chunk
// fails; throws ExportCancelledError when the signal aborts.
export async function exportTransactionsToCsv(
	options: ExportTransactionsOptions,
): Promise<ExportTransactionsResult> {
	const { filters, currency, signal, onProgress } = options;
	const fetchChunk = options.fetchChunk ?? fetchTransactionsExportChunk;

	const accumulated: ExportTransactionRow[] = [];
	let cursor: string | undefined;
	try {
		for (;;) {
			signal?.throwIfAborted();
			const chunk = await fetchChunk(
				cursor === undefined ? filters : { ...filters, cursor },
				{ signal },
			);
			accumulated.push(...chunk.transactions);
			onProgress?.(accumulated.length);
			if (chunk.nextCursor === null) {
				break;
			}
			cursor = chunk.nextCursor;
		}
	} catch (error) {
		// A user abort lands here as the fetch's AbortError; surface it as the
		// distinct cancellation outcome regardless of where the loop was.
		// Request failures propagate unchanged with their status/code/message.
		if (signal?.aborted) {
			throw new ExportCancelledError();
		}
		throw error;
	}

	if (accumulated.length === 0) {
		return { rowCount: 0, filename: null };
	}
	const filename = exportFilename();
	triggerCsvDownload(buildTransactionsCsv(accumulated, currency), filename);
	return { rowCount: accumulated.length, filename };
}
