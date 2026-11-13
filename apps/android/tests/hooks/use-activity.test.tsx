import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { ApiError } from "@finance-application/api-client";
import type { ListActivityQuery } from "@finance-application/schemas";

import { describe, expect, it } from "vitest";
import { useActivity, useActivityFeed } from "@/hooks/use-activity";
import { getTransactionsErrorMessage } from "@/services/transactions-service";
import { activityQueryKey } from "@/services/transfers-service";
import { jsonResponse } from "@/session/fetch-mock";
import { createTestQueryClient, HookWrapper } from "../helpers";
import { makeRegisteredMachine } from "../services/helpers";

function activityRow(id: string, amountMinor: number) {
	return {
		id,
		kind: "transaction",
		date: "2026-01-15",
		amountMinor,
		direction: null,
		accountId: "acc-1",
		accountName: "HDFC Bank",
		status: "active",
		notes: null,
		type: "expense",
		categoryId: "cat-1",
		categoryName: "Groceries",
		counterpartyAccountId: null,
		counterpartyAccountName: null,
		createdAt: "2026-01-15T00:00:00.000Z",
		updatedAt: "2026-01-15T00:00:00.000Z",
		archivedAt: null,
		deletedAt: null,
	};
}

function urls(fetchMock: { mock: { calls: unknown[][] } }): string[] {
	return fetchMock.mock.calls.map(([input]) => String(input));
}

describe("useActivity", () => {
	it("loads the unified activity feed scoped by filters", async () => {
		makeRegisteredMachine({
			"GET /api/activity": () =>
				jsonResponse(200, { activity: [], page: 1, pageSize: 20, total: 0 }),
		});
		const { result } = await renderHook(
			() => useActivity({ accountId: "acc-1" }),
			{
				wrapper: ({ children }: { children?: ReactNode }) => (
					<HookWrapper queryClient={createTestQueryClient()}>
						{children}
					</HookWrapper>
				),
			},
		);
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data?.activity).toEqual([]);
		expect(activityQueryKey({ accountId: "acc-1" })).toEqual([
			"activity",
			"accountId=acc-1",
		]);
	});
});

describe("useActivityFeed", () => {
	it("fetches the first page with the filters and default page size", async () => {
		const { fetchMock } = makeRegisteredMachine({
			"GET /api/activity": () =>
				jsonResponse(200, {
					activity: [activityRow("tx-1", -125050)],
					page: 1,
					pageSize: 20,
					total: 1,
				}),
		});
		const { result } = await renderHook(
			() => useActivityFeed({ status: "active", q: "groceries" }),
			{
				wrapper: ({ children }: { children?: ReactNode }) => (
					<HookWrapper queryClient={createTestQueryClient()}>
						{children}
					</HookWrapper>
				),
			},
		);
		await waitFor(() => expect(result.current.isSuccess).toBe(true), {
			timeout: 10_000,
		});
		expect(result.current.data?.pages[0]?.activity).toHaveLength(1);
		expect(result.current.hasNextPage).toBe(false);
		const requested = urls(fetchMock)[0] ?? "";
		expect(requested).toContain("/api/activity?");
		expect(requested).toContain("status=active");
		expect(requested).toContain("q=groceries");
		expect(requested).toContain("page=1");
		expect(requested).toContain("pageSize=20");
	});

	it("appends the next page on load-more with the filters preserved", async () => {
		let calls = 0;
		const { fetchMock } = makeRegisteredMachine({
			"GET /api/activity": () => {
				calls += 1;
				if (calls === 1) {
					return jsonResponse(200, {
						activity: [
							activityRow("tx-1", -125050),
							activityRow("tx-2", 50000),
						],
						page: 1,
						pageSize: 2,
						total: 3,
					});
				}
				return jsonResponse(200, {
					activity: [activityRow("tx-3", -10000)],
					page: 2,
					pageSize: 2,
					total: 3,
				});
			},
		});
		const { result } = await renderHook(
			() => useActivityFeed({ status: "active", accountId: "acc-1" }),
			{
				wrapper: ({ children }: { children?: ReactNode }) => (
					<HookWrapper queryClient={createTestQueryClient()}>
						{children}
					</HookWrapper>
				),
			},
		);
		await waitFor(() => expect(result.current.isSuccess).toBe(true), {
			timeout: 10_000,
		});
		expect(result.current.hasNextPage).toBe(true);
		result.current.fetchNextPage();
		await waitFor(() => expect(result.current.data?.pages).toHaveLength(2), {
			timeout: 10_000,
		});
		expect(result.current.data?.pages[1]?.activity).toHaveLength(1);
		expect(result.current.hasNextPage).toBe(false);
		// Both requests carry the same filters; only the page advances.
		const requested = urls(fetchMock);
		expect(requested[0]).toContain("page=1");
		expect(requested[1]).toContain("page=2");
		expect(requested[1]).toContain("accountId=acc-1");
	});

	it("restarts from page 1 when the filters change", async () => {
		const { fetchMock } = makeRegisteredMachine({
			"GET /api/activity": () =>
				jsonResponse(200, {
					activity: [activityRow("tx-1", -125050)],
					page: 1,
					pageSize: 20,
					total: 1,
				}),
		});
		const { result, rerender } = await renderHook(
			({ filters }: { filters: Partial<ListActivityQuery> }) =>
				useActivityFeed(filters),
			{
				wrapper: ({ children }: { children?: ReactNode }) => (
					<HookWrapper queryClient={createTestQueryClient()}>
						{children}
					</HookWrapper>
				),
				initialProps: { filters: { status: "active", q: "first" } },
			},
		);
		await waitFor(() => expect(result.current.isSuccess).toBe(true), {
			timeout: 10_000,
		});
		rerender({ filters: { status: "active", q: "second" } });
		await waitFor(
			() =>
				expect(urls(fetchMock).some((url) => url.includes("q=second"))).toBe(
					true,
				),
			{ timeout: 10_000 },
		);
		// The fresh list is page 1 only: no stale pages carry over.
		await waitFor(() => expect(result.current.data?.pages).toHaveLength(1), {
			timeout: 10_000,
		});
		expect(result.current.data?.pages[0]?.page).toBe(1);
		const second = urls(fetchMock).find((url) => url.includes("q=second"));
		expect(second).toContain("page=1");
	});

	it("surfaces query failures and maps them through the service copy", async () => {
		makeRegisteredMachine({
			"GET /api/activity": () =>
				jsonResponse(500, {
					error: {
						code: "INTERNAL_ERROR",
						message: "database unavailable",
						details: [],
					},
				}),
		});
		const { result } = await renderHook(
			() => useActivityFeed({ status: "active" }),
			{
				wrapper: ({ children }: { children?: ReactNode }) => (
					<HookWrapper queryClient={createTestQueryClient()}>
						{children}
					</HookWrapper>
				),
			},
		);
		await waitFor(() => expect(result.current.isError).toBe(true), {
			timeout: 10_000,
		});
		const error = result.current.error;
		expect(error).toBeInstanceOf(ApiError);
		// The screen maps the surfaced error through the domain service, so the
		// user copy is the service's wording, never the raw error.
		expect(
			getTransactionsErrorMessage(
				error,
				"Could not load transactions. Is the API running?",
			),
		).toBe("database unavailable");
	});
});
