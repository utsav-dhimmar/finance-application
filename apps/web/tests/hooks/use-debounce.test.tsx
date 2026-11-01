import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDebounce } from "@/hooks/use-debounce";

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe("useDebounce", () => {
	it("returns the initial value before the delay elapses", () => {
		vi.useFakeTimers();
		const { result } = renderHook(() => useDebounce("a", 300));
		expect(result.current).toBe("a");
	});

	it("updates after the value has been stable for the delay", () => {
		vi.useFakeTimers();
		const { result, rerender } = renderHook(
			({ value }: { value: string }) => useDebounce(value, 300),
			{ initialProps: { value: "a" } },
		);
		rerender({ value: "ab" });
		act(() => {
			vi.advanceTimersByTime(299);
		});
		expect(result.current).toBe("a");
		act(() => {
			vi.advanceTimersByTime(1);
		});
		expect(result.current).toBe("ab");
	});

	it("restarts the delay on every change", () => {
		vi.useFakeTimers();
		const { result, rerender } = renderHook(
			({ value }: { value: string }) => useDebounce(value, 300),
			{ initialProps: { value: "a" } },
		);
		rerender({ value: "ab" });
		act(() => {
			vi.advanceTimersByTime(200);
		});
		rerender({ value: "abc" });
		act(() => {
			vi.advanceTimersByTime(200);
		});
		// The second change reset the timer, so nothing landed yet.
		expect(result.current).toBe("a");
		act(() => {
			vi.advanceTimersByTime(100);
		});
		expect(result.current).toBe("abc");
	});

	it("works with non-string values", () => {
		vi.useFakeTimers();
		const { result, rerender } = renderHook(
			({ value }: { value: number }) => useDebounce(value, 100),
			{ initialProps: { value: 1 } },
		);
		rerender({ value: 42 });
		act(() => {
			vi.advanceTimersByTime(100);
		});
		expect(result.current).toBe(42);
	});
});
