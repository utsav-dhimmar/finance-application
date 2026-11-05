import type { PreferencesResponse } from "@finance-application/schemas";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/client";
import { getPreferences, updatePreferences } from "../src/preferences";

const preferences: PreferencesResponse = {
	currencyCode: "INR",
	currencySymbol: "₹",
	minorUnitExponent: 2,
};

beforeEach(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn(
			async () =>
				new Response(JSON.stringify(preferences), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
		),
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("preferences client functions", () => {
	it("getPreferences fetches /api/preferences", async () => {
		await expect(getPreferences()).resolves.toEqual(preferences);
		expect(vi.mocked(fetch)).toHaveBeenCalledWith(
			"/api/preferences",
			expect.anything(),
		);
	});

	it("updatePreferences patches the body", async () => {
		const body = { currencyCode: "INR" as const };
		await expect(updatePreferences(body)).resolves.toEqual(preferences);
		expect(vi.mocked(fetch)).toHaveBeenCalledWith(
			"/api/preferences",
			expect.objectContaining({
				method: "PATCH",
				body: JSON.stringify(body),
			}),
		);
	});

	it("decodes the shared error envelope into an ApiError", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							error: {
								code: "UNSUPPORTED_CURRENCY",
								message: "That display currency is not supported",
								details: [],
							},
						}),
						{ status: 400, headers: { "content-type": "application/json" } },
					),
			),
		);
		const error = await updatePreferences({
			currencyCode: "INR",
		}).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(ApiError);
		expect((error as ApiError).status).toBe(400);
		expect((error as ApiError).code).toBe("UNSUPPORTED_CURRENCY");
	});
});
