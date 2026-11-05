import type { PreferencesResponse } from "@finance-application/schemas";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "@/routes/settings";
import { renderRoute } from "./helpers";

const sessionUser = { id: "u1", email: "user@example.com" };

const preferences: PreferencesResponse = {
	currencyCode: "INR",
	currencySymbol: "₹",
	minorUnitExponent: 2,
};

// Sonner's Toaster needs window.matchMedia, which jsdom lacks; the page
// surfaces its copy through the `toast` API, so the tests observe the calls
// directly instead of rendering the Toaster.
const { toastSuccess, toastError } = vi.hoisted(() => ({
	toastSuccess: vi.fn(),
	toastError: vi.fn(),
}));

vi.mock("sonner", () => ({
	toast: {
		success: toastSuccess,
		error: toastError,
	},
}));

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

type Override = (input: RequestInfo | string, init?: RequestInit) => Response;

// Signed-in session by default; tests override the endpoints they exercise.
// Overrides receive the request so they can discriminate by method. Any URL
// without an override returns 404 so accidental requests are visible.
function stubSettingsApi(
	overrides: Record<string, Override> = {},
): ReturnType<typeof vi.fn> {
	const fetchMock = vi.fn(
		async (input: RequestInfo | string, init?: RequestInit) => {
			const url = typeof input === "string" ? input : input.url;
			if (url === "/api/auth/me") {
				return jsonResponse(200, sessionUser);
			}
			const override = overrides[url];
			if (override) {
				return override(input, init);
			}
			return jsonResponse(404, {
				error: {
					code: "NOT_FOUND",
					message: "Resource not found",
					details: [],
				},
			});
		},
	);
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

function callsTo(
	fetchMock: ReturnType<typeof vi.fn>,
	url: string,
): Array<[string, RequestInit | undefined]> {
	return vi
		.mocked(fetchMock)
		.mock.calls.filter(
			([input]) => (typeof input === "string" ? input : input.url) === url,
		) as Array<[string, RequestInit | undefined]>;
}

beforeEach(() => {
	toastSuccess.mockClear();
	toastError.mockClear();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("/settings rendering", () => {
	it("renders the currency preference card with the Settings navigation entry", async () => {
		stubSettingsApi({
			"/api/preferences": () => jsonResponse(200, preferences),
		});
		await renderRoute(<SettingsPage />, "/settings");

		await waitFor(() =>
			expect(screen.getByText("Currency display")).toBeTruthy(),
		);
		expect(screen.getByRole("heading", { name: "Settings" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "Settings" })).toBeTruthy();
		// The display-only contract is stated on the card.
		expect(screen.getByText(/display-only/i)).toBeTruthy();
		// The example amount renders from the resolved definition.
		expect(screen.getByText("₹1,250.50")).toBeTruthy();
		// The select shows the active currency and only supported options.
		expect(screen.getByText("INR")).toBeTruthy();
	});

	it("shows the loading skeleton while preferences load", async () => {
		stubSettingsApi({
			"/api/preferences": () =>
				new Promise<Response>(() => {
					// Never resolves within the test: keeps the pending state.
				}) as unknown as Response,
		});
		await renderRoute(<SettingsPage />, "/settings");

		// The page renders the session shell; the card area shows the skeleton.
		await waitFor(() =>
			expect(screen.getByRole("heading", { name: "Settings" })).toBeTruthy(),
		);
		expect(screen.queryByText("Currency display")).toBeNull();
	});

	it("shows an error state with a working retry", async () => {
		const fetchMock = stubSettingsApi({
			"/api/preferences": () =>
				jsonResponse(500, {
					error: {
						code: "INTERNAL_ERROR",
						message: "Internal server error",
						details: [],
					},
				}),
		});
		await renderRoute(<SettingsPage />, "/settings");
		await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());

		vi.mocked(fetchMock).mockImplementation(async (input) => {
			const url = typeof input === "string" ? input : input.url;
			if (url === "/api/auth/me") {
				return jsonResponse(200, sessionUser);
			}
			if (url === "/api/preferences") {
				return jsonResponse(200, preferences);
			}
			return jsonResponse(404, {
				error: {
					code: "NOT_FOUND",
					message: "Resource not found",
					details: [],
				},
			});
		});
		fireEvent.click(screen.getByRole("button", { name: "Retry" }));
		await waitFor(() =>
			expect(screen.getByText("Currency display")).toBeTruthy(),
		);
	});
});

describe("/settings preference form", () => {
	it("submits the selected currency and confirms success", async () => {
		const fetchMock = stubSettingsApi({
			"/api/preferences": () => jsonResponse(200, preferences),
		});
		await renderRoute(<SettingsPage />, "/settings");
		await waitFor(() =>
			expect(screen.getByText("Currency display")).toBeTruthy(),
		);

		fireEvent.click(screen.getByRole("button", { name: "Save preference" }));
		await waitFor(() => {
			const calls = callsTo(fetchMock, "/api/preferences").filter(
				([, init]) => init?.method === "PATCH",
			);
			expect(calls).toHaveLength(1);
		});
		const patchCall = callsTo(fetchMock, "/api/preferences").find(
			([, init]) => init?.method === "PATCH",
		);
		expect(patchCall?.[1]?.body).toBe(JSON.stringify({ currencyCode: "INR" }));
		await waitFor(() =>
			expect(toastSuccess).toHaveBeenCalledWith(
				"Display currency set to INR (₹).",
			),
		);
		expect(toastError).not.toHaveBeenCalled();
	});

	it("surfaces the unsupported-currency 400 as an error", async () => {
		stubSettingsApi({
			"/api/preferences": (_input, init) => {
				if (init?.method === "PATCH") {
					return jsonResponse(400, {
						error: {
							code: "UNSUPPORTED_CURRENCY",
							message: "That display currency is not supported",
							details: [],
						},
					});
				}
				return jsonResponse(200, preferences);
			},
		});
		await renderRoute(<SettingsPage />, "/settings");
		await waitFor(() =>
			expect(screen.getByText("Currency display")).toBeTruthy(),
		);

		fireEvent.click(screen.getByRole("button", { name: "Save preference" }));
		// The error surfaces through the service's code-to-copy mapping.
		await waitFor(() =>
			expect(toastError).toHaveBeenCalledWith(
				"That display currency is not supported.",
			),
		);
		expect(toastSuccess).not.toHaveBeenCalled();
		// The form stays usable after the failure.
		expect(
			screen.getByRole("button", { name: "Save preference" }),
		).toBeTruthy();
	});

	it("keeps the submit button disabled while the update is pending", async () => {
		stubSettingsApi({
			"/api/preferences": (_input, init) => {
				if (init?.method === "PATCH") {
					return new Promise<Response>(() => {
						// Never resolves: keeps the mutation pending.
					}) as unknown as Response;
				}
				return jsonResponse(200, preferences);
			},
		});
		await renderRoute(<SettingsPage />, "/settings");
		await waitFor(() =>
			expect(screen.getByText("Currency display")).toBeTruthy(),
		);

		fireEvent.click(screen.getByRole("button", { name: "Save preference" }));
		await waitFor(() =>
			expect(
				(screen.getByRole("button", { name: "Saving..." }) as HTMLButtonElement)
					.disabled,
			).toBe(true),
		);
	});
});
