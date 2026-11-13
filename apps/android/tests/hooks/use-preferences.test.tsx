import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { toast } from "sonner-native";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePreferences, useUpdatePreferences } from "@/hooks/use-preferences";
import { jsonResponse } from "@/session/fetch-mock";
import { createTestQueryClient, HookWrapper } from "../helpers";
import { makeRegisteredMachine } from "../services/helpers";

vi.mock("sonner-native", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

const preferences = {
	currencyCode: "INR",
	currencySymbol: "₹",
	minorUnitExponent: 2,
};

describe("usePreferences", () => {
	beforeEach(() => {
		vi.mocked(toast.success).mockClear();
		vi.mocked(toast.error).mockClear();
	});

	it("loads preferences and updates them through the session", async () => {
		makeRegisteredMachine({
			"GET /api/preferences": () => jsonResponse(200, preferences),
			"PATCH /api/preferences": () => jsonResponse(200, preferences),
		});
		const queryClient = createTestQueryClient();
		const { result } = await renderHook(() => usePreferences(), {
			wrapper: ({ children }: { children?: ReactNode }) => (
				<HookWrapper queryClient={queryClient}>{children}</HookWrapper>
			),
		});
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data?.currencyCode).toBe("INR");

		const { result: mutation } = await renderHook(
			() => useUpdatePreferences(),
			{
				wrapper: ({ children }: { children?: ReactNode }) => (
					<HookWrapper queryClient={queryClient}>{children}</HookWrapper>
				),
			},
		);
		mutation.current.mutate({ currencyCode: "INR" });
		await waitFor(() => expect(mutation.current.isSuccess).toBe(true));
		expect(toast.success).toHaveBeenCalledWith("Preferences updated.");
	});
});
