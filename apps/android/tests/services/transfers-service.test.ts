import { ApiError } from "@finance-application/api-client";
import type { TransferResponse } from "@finance-application/schemas";
import { describe, expect, it } from "vitest";

import {
	ACTIVITY_QUERY_KEY,
	activityQueryKey,
	activityQueryOptions,
	createNewTransfer,
	getTransfersErrorMessage,
	TRANSFERS_QUERY_KEY,
	transfersQueryKey,
} from "@/services/transfers-service";
import { jsonResponse } from "@/session/fetch-mock";
import { makeRegisteredMachine } from "./helpers";

const transfer: TransferResponse = {
	id: "018f6a2c-9b7d-7ce2-8f3a-1d4e5f6a7b8d",
	amountMinor: 500000,
	date: "2026-01-16",
	sourceAccountId: "acc-1",
	sourceAccountName: "HDFC Bank",
	destinationAccountId: "acc-2",
	destinationAccountName: "Cash",
	notes: null,
	status: "active",
	archivedAt: null,
	deletedAt: null,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("transfers service", () => {
	it("exposes the transfers and activity key families", () => {
		expect(TRANSFERS_QUERY_KEY).toEqual(["transfers"]);
		expect(ACTIVITY_QUERY_KEY).toEqual(["activity"]);
		expect(transfersQueryKey({ status: "active" })).toEqual([
			"transfers",
			"status=active",
		]);
		expect(activityQueryKey({ accountId: "acc-1" })).toEqual([
			"activity",
			"accountId=acc-1",
		]);
	});

	it("lists activity through the session", async () => {
		const { fetchMock } = makeRegisteredMachine({
			"GET /api/activity": () =>
				jsonResponse(200, { activity: [], page: 1, pageSize: 20, total: 0 }),
		});
		const options = activityQueryOptions({ status: "active" });
		expect(options.staleTime).toBe(30_000);
		const result = await options.queryFn();
		expect(result.activity).toEqual([]);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("creates transfers through the documented endpoint", async () => {
		const { fetchMock } = makeRegisteredMachine({
			"POST /api/transfers": () => jsonResponse(201, transfer),
		});
		await createNewTransfer({
			id: "018f6a2c-9b7d-7ce2-8f3a-1d4e5f6a7b8d",
			amountMinor: 500000,
			date: "2026-01-16",
			sourceAccountId: "acc-1",
			destinationAccountId: "acc-2",
		});
		const calls = fetchMock.mock.calls as unknown as Array<
			[string, RequestInit]
		>;
		expect(calls[0]?.[0]).toContain("/api/transfers");
		expect(calls[0]?.[1]?.method).toBe("POST");
	});

	it("maps transfer error codes to the web's user copy", () => {
		const fallback = "Could not save the transfer. Is the API running?";
		expect(
			getTransfersErrorMessage(
				new ApiError(422, "SAME_ACCOUNT_TRANSFER", "same", []),
				fallback,
			),
		).toBe(
			"Choose two different accounts: source and destination must differ.",
		);
		expect(
			getTransfersErrorMessage(
				new ApiError(409, "ACCOUNT_INELIGIBLE", "account", []),
				fallback,
			),
		).toBe(
			"Transfers need active accounts. Archived or deleted accounts cannot be used.",
		);
		expect(
			getTransfersErrorMessage(
				new ApiError(409, "RESTORE_CONFLICT", "conflict", []),
				fallback,
			),
		).toBe(
			"This transfer's account was deleted. Assign a replacement to restore it.",
		);
		expect(getTransfersErrorMessage(new Error("nope"), fallback)).toBe(
			fallback,
		);
	});
});
