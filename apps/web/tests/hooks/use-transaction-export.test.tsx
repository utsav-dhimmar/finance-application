import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { useTransactionExport } from "@/hooks/use-transaction-export";
import {
	ExportCancelledError,
	exportTransactionsToCsv,
} from "@/lib/csv-export";

vi.mock("sonner", () => ({
	toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/lib/csv-export", () => {
	class MockExportCancelledError extends Error {
		constructor() {
			super("Export cancelled");
			this.name = "ExportCancelledError";
		}
	}
	return {
		ExportCancelledError: MockExportCancelledError,
		exportTransactionsToCsv: vi.fn(),
	};
});

const mockedExport = vi.mocked(exportTransactionsToCsv);
const mockedToast = vi.mocked(toast);

const filters = {
	status: "active" as const,
	q: "shop",
	type: "expense" as const,
};
const currency = "INR";

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	cleanup();
});

describe("useTransactionExport", () => {
	it("starts idle, moves to exporting with progress, and finishes done", async () => {
		// Manual gates make each state transition deterministic: the mock
		// only advances when the test releases it.
		let releaseFirst!: () => void;
		let releaseSecond!: () => void;
		const firstChunk = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});
		const secondChunk = new Promise<void>((resolve) => {
			releaseSecond = resolve;
		});
		mockedExport.mockImplementation(async (options) => {
			await firstChunk;
			options.onProgress?.(2);
			await secondChunk;
			options.onProgress?.(5);
			return { rowCount: 5, filename: "transactions-2026-11-15.csv" };
		});

		const { result } = renderHook(() => useTransactionExport());
		expect(result.current.state).toEqual({ phase: "idle" });

		act(() => {
			result.current.startExport(filters, currency);
		});
		expect(result.current.state).toEqual({
			phase: "exporting",
			fetchedRows: 0,
		});
		expect(mockedExport).toHaveBeenCalledTimes(1);
		const firstCall = mockedExport.mock.calls.at(0);
		expect(firstCall).toBeDefined();
		expect(firstCall?.[0]).toMatchObject({
			filters,
			currency,
		});

		await act(async () => {
			releaseFirst();
		});
		await waitFor(() =>
			expect(result.current.state).toEqual({
				phase: "exporting",
				fetchedRows: 2,
			}),
		);
		await act(async () => {
			releaseSecond();
		});
		// The final onProgress(5) and completion land in the same React flush,
		// so the last observable state before done carries the full count.
		await waitFor(() =>
			expect(result.current.state).toEqual({ phase: "done", rowCount: 5 }),
		);
		expect(mockedToast.info).not.toHaveBeenCalled();
		expect(mockedToast.error).not.toHaveBeenCalled();
	});

	it("freezes the filter snapshot at call time", async () => {
		let captured: unknown;
		mockedExport.mockImplementation(async (options) => {
			captured = options.filters;
			return { rowCount: 1, filename: null };
		});
		const { result } = renderHook(() => useTransactionExport());
		const snapshot = { ...filters };
		act(() => {
			result.current.startExport(snapshot, currency);
		});
		// A caller mutating its own object afterwards cannot affect the run.
		snapshot.q = "changed";
		await waitFor(() => expect(result.current.state.phase).toBe("done"));
		expect(captured).toEqual(filters);
	});

	it("toasts the empty case without a download-worthy result", async () => {
		mockedExport.mockResolvedValue({ rowCount: 0, filename: null });
		const { result } = renderHook(() => useTransactionExport());
		act(() => {
			result.current.startExport(filters, currency);
		});
		await waitFor(() =>
			expect(result.current.state).toEqual({ phase: "done", rowCount: 0 }),
		);
		expect(mockedToast.info).toHaveBeenCalledWith("No transactions to export");
		expect(mockedToast.error).not.toHaveBeenCalled();
	});

	it("toasts a neutral cancellation on user abort", async () => {
		mockedExport.mockRejectedValue(new ExportCancelledError());
		const { result } = renderHook(() => useTransactionExport());
		act(() => {
			result.current.startExport(filters, currency);
		});
		await waitFor(() =>
			expect(result.current.state).toEqual({ phase: "done", rowCount: null }),
		);
		expect(mockedToast.info).toHaveBeenCalledWith("Export cancelled");
		expect(mockedToast.error).not.toHaveBeenCalled();
	});

	it("toasts a descriptive error carrying the failure message", async () => {
		mockedExport.mockRejectedValue(
			new Error("Export failed: request returned 500"),
		);
		const { result } = renderHook(() => useTransactionExport());
		act(() => {
			result.current.startExport(filters, currency);
		});
		await waitFor(() => expect(mockedToast.error).toHaveBeenCalled());
		expect(mockedToast.error).toHaveBeenCalledWith(
			"Export failed: Export failed: request returned 500",
		);
		expect(mockedToast.info).not.toHaveBeenCalled();
	});

	it("cancel aborts the in-flight export's signal", async () => {
		let capturedSignal: AbortSignal | undefined;
		mockedExport.mockImplementation(async (options) => {
			capturedSignal = options.signal;
			await new Promise((resolve) => setTimeout(resolve, 20));
			// Emulate the real loop: an abort after the in-flight chunk
			// surfaces as the distinct cancellation error.
			if (options.signal?.aborted) {
				throw new ExportCancelledError();
			}
			return { rowCount: 1, filename: "transactions-2026-11-15.csv" };
		});
		const { result } = renderHook(() => useTransactionExport());
		act(() => {
			result.current.startExport(filters, currency);
		});
		act(() => {
			result.current.cancel();
		});
		expect(capturedSignal?.aborted).toBe(true);
		await waitFor(() =>
			expect(result.current.state).toEqual({ phase: "done", rowCount: null }),
		);
		expect(mockedToast.info).toHaveBeenCalledWith("Export cancelled");
	});

	it("ignores a start while an export is already running", async () => {
		mockedExport.mockImplementation(
			async () =>
				new Promise((resolve) =>
					setTimeout(
						() =>
							resolve({ rowCount: 1, filename: "transactions-2026-11-15.csv" }),
						20,
					),
				),
		);
		const { result } = renderHook(() => useTransactionExport());
		act(() => {
			result.current.startExport(filters, currency);
			result.current.startExport(filters, currency);
		});
		expect(mockedExport).toHaveBeenCalledTimes(1);
		await waitFor(() => expect(result.current.state.phase).toBe("done"));
	});
});
