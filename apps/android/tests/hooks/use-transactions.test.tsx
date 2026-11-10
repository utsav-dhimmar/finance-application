import { QueryClient } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { toast } from "sonner-native";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	useCreateTransaction,
	useTransactions,
} from "@/hooks/use-transactions";
import { ACCOUNTS_QUERY_KEY } from "@/services/accounts-service";
import { CATEGORIES_QUERY_KEY } from "@/services/categories-service";
import { REPORTS_QUERY_KEY } from "@/services/reports-service";
import { TRANSACTIONS_QUERY_KEY } from "@/services/transactions-service";
import { ACTIVITY_QUERY_KEY } from "@/services/transfers-service";
import { jsonResponse } from "@/session/fetch-mock";
import { createTestQueryClient, HookWrapper } from "../helpers";
import { ACCESS, makeRegisteredMachine } from "../services/helpers";

vi.mock("sonner-native", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

const transaction = {
	id: "018f6a2c-9b7d-7ce2-8f3a-1d4e5f6a7b8c",
	type: "expense",
	amountMinor: 125050,
	date: "2026-01-15",
	accountId: "acc-1",
	accountName: "HDFC Bank",
	categoryId: "cat-1",
	categoryName: "Groceries",
	notes: null,
	status: "active",
	archivedAt: null,
	deletedAt: null,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("useTransactions", () => {
	beforeEach(() => {
		vi.mocked(toast.success).mockClear();
		vi.mocked(toast.error).mockClear();
	});

	it("loads the transaction list through the session", async () => {
		makeRegisteredMachine({
			"GET /api/transactions": () =>
				jsonResponse(200, {
					transactions: [transaction],
					page: 1,
					pageSize: 20,
					total: 1,
				}),
		});
		const { result } = await renderHook(
			() => useTransactions({ type: "expense" }),
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
		expect(result.current.data?.transactions).toHaveLength(1);
	});

	it("creating a transaction invalidates every related family", async () => {
		makeRegisteredMachine({
			"POST /api/transactions": () => jsonResponse(201, transaction),
		});
		const queryClient = createTestQueryClient();
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
		const { result } = await renderHook(() => useCreateTransaction(), {
			wrapper: ({ children }: { children?: ReactNode }) => (
				<HookWrapper queryClient={queryClient}>{children}</HookWrapper>
			),
		});

		result.current.mutate({
			id: transaction.id,
			type: "expense",
			amountMinor: 125050,
			date: "2026-01-15",
			accountId: "acc-1",
			categoryId: "cat-1",
		});
		await waitFor(() => expect(result.current.isSuccess).toBe(true), {
			timeout: 10_000,
		});

		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: TRANSACTIONS_QUERY_KEY,
		});
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: ACCOUNTS_QUERY_KEY,
		});
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: CATEGORIES_QUERY_KEY,
		});
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: ACTIVITY_QUERY_KEY,
		});
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: REPORTS_QUERY_KEY,
		});
	});

	it("shows a success toast without any sensitive content", async () => {
		makeRegisteredMachine({
			"POST /api/transactions": () => jsonResponse(201, transaction),
		});
		const { result } = await renderHook(() => useCreateTransaction(), {
			wrapper: ({ children }: { children?: ReactNode }) => (
				<HookWrapper queryClient={createTestQueryClient()}>
					{children}
				</HookWrapper>
			),
		});
		result.current.mutate({
			id: transaction.id,
			type: "expense",
			amountMinor: 125050,
			date: "2026-01-15",
			accountId: "acc-1",
			categoryId: "cat-1",
		});
		await waitFor(() => expect(result.current.isSuccess).toBe(true), {
			timeout: 10_000,
		});
		expect(toast.success).toHaveBeenCalledWith("Transaction recorded.");
	});

	it("shows the mapped user copy on failure, never the raw error", async () => {
		makeRegisteredMachine({
			"POST /api/transactions": () =>
				jsonResponse(409, {
					error: {
						code: "ACCOUNT_INELIGIBLE",
						message: "account ineligible",
						details: [],
					},
				}),
		});
		const { result } = await renderHook(() => useCreateTransaction(), {
			wrapper: ({ children }: { children?: ReactNode }) => (
				<HookWrapper queryClient={new QueryClient()}>{children}</HookWrapper>
			),
		});
		result.current.mutate({
			id: transaction.id,
			type: "expense",
			amountMinor: 125050,
			date: "2026-01-15",
			accountId: "acc-archived",
			categoryId: "cat-1",
		});
		await waitFor(() => expect(result.current.isError).toBe(true), {
			timeout: 10_000,
		});
		expect(toast.error).toHaveBeenCalledWith(
			"Transactions need an active account. Archived or deleted accounts cannot be used.",
		);
		const errorArg = vi.mocked(toast.error).mock.calls[0]?.[0];
		expect(errorArg).not.toContain("account ineligible");
		expect(errorArg).not.toContain(ACCESS);
	});
});
