import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { toast } from "sonner-native";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	useAccounts,
	useArchiveAccount,
	useCreateAccount,
	useDeleteAccount,
	usePermanentlyDeleteAccount,
	useRestoreAccount,
	useUpdateAccount,
} from "@/hooks/use-accounts";
import { ACCOUNTS_QUERY_KEY } from "@/services/accounts-service";
import { REPORTS_QUERY_KEY } from "@/services/reports-service";
import { jsonResponse } from "@/session/fetch-mock";
import { createTestQueryClient, HookWrapper } from "../helpers";
import { makeRegisteredMachine } from "../services/helpers";

vi.mock("sonner-native", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

const account = {
	id: "acc-1",
	name: "HDFC Bank",
	type: "bank",
	openingBalanceMinor: 100000,
	currentBalanceMinor: 125050,
	status: "active",
	archivedAt: null,
	deletedAt: null,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("useAccounts", () => {
	beforeEach(() => {
		vi.mocked(toast.success).mockClear();
		vi.mocked(toast.error).mockClear();
	});

	it("loads accounts for the requested status through the session", async () => {
		let sawCookie = false;
		makeRegisteredMachine({
			"GET /api/accounts": (init?: RequestInit) => {
				const headers = init?.headers as Record<string, string> | undefined;
				sawCookie = (headers?.cookie ?? "").includes("access-value-123");
				return jsonResponse(200, {
					accounts: [account],
					combinedBalanceMinor: 125050,
				});
			},
		});
		const { result } = await renderHook(() => useAccounts("active"), {
			wrapper: ({ children }: { children?: ReactNode }) => (
				<HookWrapper queryClient={createTestQueryClient()}>
					{children}
				</HookWrapper>
			),
		});
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data?.accounts).toHaveLength(1);
		expect(sawCookie).toBe(true);
	});

	it("creating an account invalidates the accounts family and toasts", async () => {
		makeRegisteredMachine({
			"POST /api/accounts": () => jsonResponse(201, account),
		});
		const queryClient = createTestQueryClient();
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
		const { result } = await renderHook(() => useCreateAccount(), {
			wrapper: ({ children }: { children?: ReactNode }) => (
				<HookWrapper queryClient={queryClient}>{children}</HookWrapper>
			),
		});
		result.current.mutate({
			name: "HDFC Bank",
			type: "bank",
			openingBalanceMinor: 0,
		});
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: ACCOUNTS_QUERY_KEY,
		});
		expect(toast.success).toHaveBeenCalledWith("Account created.");
	});

	it("maps a name-taken rejection to the service copy on the error toast", async () => {
		makeRegisteredMachine({
			"POST /api/accounts": () =>
				jsonResponse(409, {
					error: {
						code: "ACCOUNT_NAME_TAKEN",
						message: "account name taken",
						details: [],
					},
				}),
		});
		const { result } = await renderHook(() => useCreateAccount(), {
			wrapper: ({ children }: { children?: ReactNode }) => (
				<HookWrapper queryClient={createTestQueryClient()}>
					{children}
				</HookWrapper>
			),
		});
		result.current.mutate({
			name: "HDFC Bank",
			type: "bank",
			openingBalanceMinor: 0,
		});
		await waitFor(() => expect(result.current.isError).toBe(true));
		expect(toast.error).toHaveBeenCalledWith(
			"An account with this name already exists. Try a different name.",
		);
	});
});

// Every account mutation must invalidate the accounts family (all tabs) and
// the reports family (combined balances feed the dashboard summary), with a
// confirmation toast on success.
describe("useAccount mutation invalidations", () => {
	beforeEach(() => {
		vi.mocked(toast.success).mockClear();
		vi.mocked(toast.error).mockClear();
	});

	it("updating an account invalidates accounts and reports and toasts", async () => {
		makeRegisteredMachine({
			"PATCH /api/accounts/acc-1": () => jsonResponse(200, account),
		});
		const queryClient = createTestQueryClient();
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
		const { result } = await renderHook(() => useUpdateAccount(), {
			wrapper: ({ children }: { children?: ReactNode }) => (
				<HookWrapper queryClient={queryClient}>{children}</HookWrapper>
			),
		});
		result.current.mutate({ id: "acc-1", body: { name: "Renamed Bank" } });
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: ACCOUNTS_QUERY_KEY,
		});
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: REPORTS_QUERY_KEY,
		});
		expect(toast.success).toHaveBeenCalledWith("Account updated.");
	});

	it("archiving an account invalidates accounts and reports and toasts", async () => {
		makeRegisteredMachine({
			"POST /api/accounts/acc-1/archive": () => jsonResponse(200, account),
		});
		const queryClient = createTestQueryClient();
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
		const { result } = await renderHook(() => useArchiveAccount(), {
			wrapper: ({ children }: { children?: ReactNode }) => (
				<HookWrapper queryClient={queryClient}>{children}</HookWrapper>
			),
		});
		result.current.mutate("acc-1");
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: ACCOUNTS_QUERY_KEY,
		});
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: REPORTS_QUERY_KEY,
		});
		expect(toast.success).toHaveBeenCalledWith("Account archived.");
	});

	it("deleting an account invalidates accounts and reports and toasts", async () => {
		makeRegisteredMachine({
			"POST /api/accounts/acc-1/delete": () => jsonResponse(200, account),
		});
		const queryClient = createTestQueryClient();
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
		const { result } = await renderHook(() => useDeleteAccount(), {
			wrapper: ({ children }: { children?: ReactNode }) => (
				<HookWrapper queryClient={queryClient}>{children}</HookWrapper>
			),
		});
		result.current.mutate("acc-1");
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: ACCOUNTS_QUERY_KEY,
		});
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: REPORTS_QUERY_KEY,
		});
		expect(toast.success).toHaveBeenCalledWith("Account moved to trash.");
	});

	it("restoring an account invalidates accounts and reports and toasts", async () => {
		makeRegisteredMachine({
			"POST /api/accounts/acc-1/restore": () => jsonResponse(200, account),
		});
		const queryClient = createTestQueryClient();
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
		const { result } = await renderHook(() => useRestoreAccount(), {
			wrapper: ({ children }: { children?: ReactNode }) => (
				<HookWrapper queryClient={queryClient}>{children}</HookWrapper>
			),
		});
		result.current.mutate({ id: "acc-1" });
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: ACCOUNTS_QUERY_KEY,
		});
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: REPORTS_QUERY_KEY,
		});
		expect(toast.success).toHaveBeenCalledWith("Account restored.");
	});

	it("permanently deleting an account invalidates accounts and reports and toasts", async () => {
		makeRegisteredMachine({
			"DELETE /api/accounts/acc-1": () => jsonResponse(204, null),
		});
		const queryClient = createTestQueryClient();
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
		const { result } = await renderHook(() => usePermanentlyDeleteAccount(), {
			wrapper: ({ children }: { children?: ReactNode }) => (
				<HookWrapper queryClient={queryClient}>{children}</HookWrapper>
			),
		});
		result.current.mutate("acc-1");
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: ACCOUNTS_QUERY_KEY,
		});
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: REPORTS_QUERY_KEY,
		});
		expect(toast.success).toHaveBeenCalledWith("Account deleted permanently.");
	});
});
