import { ApiError } from "@finance-application/api-client";
import type { PreferencesResponse } from "@finance-application/schemas";
import { describe, expect, it } from "vitest";

import {
	changePreferences,
	getPreferencesErrorMessage,
	PREFERENCES_QUERY_KEY,
	preferencesQueryOptions,
} from "@/services/preferences-service";
import { jsonResponse } from "@/session/fetch-mock";
import { makeRegisteredMachine } from "./helpers";

const preferences: PreferencesResponse = {
	currencyCode: "INR",
	currencySymbol: "₹",
	minorUnitExponent: 2,
};

describe("preferences service", () => {
	it("exposes the shared preferences key", () => {
		expect(PREFERENCES_QUERY_KEY).toEqual(["preferences"]);
	});

	it("reads preferences through the session and updates with the parsed body", async () => {
		const { fetchMock } = makeRegisteredMachine({
			"GET /api/preferences": () => jsonResponse(200, preferences),
			"PATCH /api/preferences": (init?: RequestInit) => {
				const headers = init?.headers as Record<string, string> | undefined;
				expect(headers?.cookie).toContain("access-value-123");
				return jsonResponse(200, preferences);
			},
		});
		const options = preferencesQueryOptions();
		expect(options.staleTime).toBe(30_000);
		expect(await options.queryFn()).toEqual(preferences);
		await changePreferences({ currencyCode: "INR" });
		const calls = fetchMock.mock.calls as unknown as Array<
			[string, RequestInit]
		>;
		expect(JSON.parse(calls[1]?.[1]?.body as string)).toEqual({
			currencyCode: "INR",
		});
	});

	it("maps preference error codes to the web's user copy", () => {
		const fallback = "Could not save preferences. Is the API running?";
		expect(
			getPreferencesErrorMessage(
				new ApiError(422, "UNSUPPORTED_CURRENCY", "bad currency", []),
				fallback,
			),
		).toBe("That display currency is not supported.");
		expect(getPreferencesErrorMessage(new Error("nope"), fallback)).toBe(
			fallback,
		);
	});
});
