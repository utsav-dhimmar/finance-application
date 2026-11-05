import { ApiError } from "@finance-application/api-client";
import type { PreferencesResponse } from "@finance-application/schemas";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePreferences, useUpdatePreferences } from "@/hooks/use-preferences";
import {
	getPreferencesErrorMessage,
	preferencesQueryOptions,
} from "@/services/preferences-service";

const preferences: PreferencesResponse = {
	currencyCode: "INR",
	currencySymbol: "₹",
	minorUnitExponent: 2,
};

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function renderWithProvider<TResult>(hook: () => TResult) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	const view = renderHook(hook, {
		wrapper: ({ children }: { children: React.ReactNode }) => (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		),
	});
	return { view, queryClient };
}

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("usePreferences", () => {
	it("fetches the preferences", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => jsonResponse(200, preferences)),
		);
		const { view } = renderWithProvider(usePreferences);
		await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
		expect(view.result.current.data).toEqual(preferences);
	});

	it("exposes the shared query key", () => {
		expect(preferencesQueryOptions().queryKey).toEqual(["preferences"]);
	});
});

describe("useUpdatePreferences", () => {
	it("patches the body and invalidates the preferences key", async () => {
		const fetchMock = vi.fn(
			async (input: RequestInfo | string, _init?: RequestInit) => {
				const url = typeof input === "string" ? input : input.url;
				if (url === "/api/preferences") {
					return jsonResponse(200, preferences);
				}
				return jsonResponse(404, {
					error: { code: "NOT_FOUND", message: "nope", details: [] },
				});
			},
		);
		vi.stubGlobal("fetch", fetchMock);

		const { view, queryClient } = renderWithProvider(useUpdatePreferences);
		queryClient.setQueryData(["preferences"], preferences);
		act(() => {
			view.result.current.mutate({ currencyCode: "INR" });
		});
		await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
		const patchCall = vi
			.mocked(fetchMock)
			.mock.calls.find(
				([input, requestInit]) =>
					(typeof input === "string" ? input : input.url) ===
						"/api/preferences" && requestInit?.method === "PATCH",
			);
		expect(patchCall).toBeDefined();
		const requestInit = patchCall?.[1] as RequestInit;
		expect(requestInit.body).toBe(JSON.stringify({ currencyCode: "INR" }));
		await waitFor(() =>
			expect(queryClient.getQueryState(["preferences"])?.isInvalidated).toBe(
				true,
			),
		);
	});
});

describe("getPreferencesErrorMessage", () => {
	it("maps the unsupported-currency code to friendly copy", () => {
		const error = new ApiError(
			400,
			"UNSUPPORTED_CURRENCY",
			"That display currency is not supported",
			[],
		);
		expect(getPreferencesErrorMessage(error, "fallback")).toMatch(
			/not supported/i,
		);
	});

	it("falls back for unknown errors", () => {
		expect(getPreferencesErrorMessage(new Error("boom"), "Save failed")).toBe(
			"Save failed",
		);
	});
});
