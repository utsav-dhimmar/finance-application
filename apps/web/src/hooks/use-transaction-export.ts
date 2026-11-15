import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type { ExportFilterSnapshot } from "@/lib/csv-export";
import {
	ExportCancelledError,
	exportTransactionsToCsv,
} from "@/lib/csv-export";

// Terminal "done" carries the outcome until the next export starts; the UI
// treats idle and done identically (button re-enabled with its idle label).
export type TransactionExportState =
	| { phase: "idle" }
	| { phase: "exporting"; fetchedRows: number }
	| { phase: "done"; rowCount: number | null };

function describeError(error: unknown): string {
	if (error instanceof Error && error.message) {
		return error.message;
	}
	return "Something went wrong";
}

// Drives the browser-side CSV export from the transactions page. The export
// itself runs only inside startExport (a click handler) — never during
// render, loaders, or prerendering. The filter snapshot and currency are
// frozen at call time so mid-export filter changes cannot affect the file.
export function useTransactionExport() {
	const [state, setState] = useState<TransactionExportState>({
		phase: "idle",
	});
	const controllerRef = useRef<AbortController | null>(null);

	const startExport = useCallback(
		(filters: ExportFilterSnapshot, currency: string) => {
			// The button is disabled while exporting; this guard is belt and
			// braces against double invocation.
			if (controllerRef.current !== null) {
				return;
			}
			// Freeze the snapshot: the loop keeps this copy, so later changes
			// to the page's filter state cannot alter the running export.
			const frozenFilters: ExportFilterSnapshot = { ...filters };
			const controller = new AbortController();
			controllerRef.current = controller;
			setState({ phase: "exporting", fetchedRows: 0 });
			void exportTransactionsToCsv({
				filters: frozenFilters,
				currency,
				signal: controller.signal,
				onProgress: (fetchedRows) => {
					if (controllerRef.current === controller) {
						setState({ phase: "exporting", fetchedRows });
					}
				},
			})
				.then((result) => {
					if (controllerRef.current !== controller) {
						return;
					}
					if (result.rowCount === 0) {
						toast.info("No transactions to export");
					}
					setState({ phase: "done", rowCount: result.rowCount });
				})
				.catch((error: unknown) => {
					if (controllerRef.current !== controller) {
						return;
					}
					if (error instanceof ExportCancelledError) {
						toast.info("Export cancelled");
					} else {
						toast.error(`Export failed: ${describeError(error)}`);
					}
					setState({ phase: "done", rowCount: null });
				})
				.finally(() => {
					if (controllerRef.current === controller) {
						controllerRef.current = null;
					}
				});
		},
		[],
	);

	const cancel = useCallback(() => {
		controllerRef.current?.abort();
	}, []);

	return { state, startExport, cancel };
}
