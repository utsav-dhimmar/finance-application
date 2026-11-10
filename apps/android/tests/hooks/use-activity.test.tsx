import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { useActivity } from "@/hooks/use-activity";
import { activityQueryKey } from "@/services/transfers-service";
import { jsonResponse } from "@/session/fetch-mock";
import { createTestQueryClient, HookWrapper } from "../helpers";
import { makeRegisteredMachine } from "../services/helpers";

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
