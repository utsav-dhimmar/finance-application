import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "@/routes/login";
import { renderRoute } from "./helpers";

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

// 401s every session probe so the visitor is treated as signed out; tests
// override the endpoint they exercise via `overrides`.
function stubSessionApi(
	overrides: Record<string, () => Response> = {},
): ReturnType<typeof vi.fn> {
	const fetchMock = vi.fn(async (input: RequestInfo | string) => {
		const url = typeof input === "string" ? input : input.url;
		const override = overrides[url];
		if (override) {
			return override();
		}
		return jsonResponse(401, {
			error: {
				code: "UNAUTHENTICATED",
				message: "Authentication required",
				details: [],
			},
		});
	});
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

function fillForm(email: string, password: string): void {
	fireEvent.change(screen.getByLabelText("Email"), {
		target: { value: email },
	});
	fireEvent.change(screen.getByLabelText("Password"), {
		target: { value: password },
	});
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("/login", () => {
	it("validates fields before submitting", async () => {
		stubSessionApi();
		await renderRoute(<LoginPage />, "/login");
		fireEvent.click(screen.getByRole("button", { name: "Log in" }));
		await waitFor(() => {
			const alerts = screen.getAllByRole("alert");
			expect(
				alerts.some((alert) => /invalid email/i.test(alert.textContent ?? "")),
			).toBe(true);
		});
	});

	it("rejects a too-short password client-side", async () => {
		stubSessionApi();
		await renderRoute(<LoginPage />, "/login");
		fillForm("user@example.com", "short");
		fireEvent.click(screen.getByRole("button", { name: "Log in" }));
		await waitFor(() =>
			expect(screen.getByRole("alert").textContent).toMatch(/>=8|8 characters/i),
		);
	});

	it("shows the generic server error on invalid credentials", async () => {
		stubSessionApi({
			"/api/auth/login": () =>
				jsonResponse(401, {
					error: {
						code: "AUTH_INVALID_CREDENTIALS",
						message: "Invalid email or password",
						details: [],
					},
				}),
		});
		await renderRoute(<LoginPage />, "/login");
		fillForm("user@example.com", "wrong-pw-1");
		fireEvent.click(screen.getByRole("button", { name: "Log in" }));
		await waitFor(() =>
			expect(screen.getByRole("alert").textContent).toBe(
				"Invalid email or password",
			),
		);
	});

	it("navigates to /dashboard on successful login", async () => {
		stubSessionApi({
			"/api/auth/login": () =>
				jsonResponse(200, { id: "u1", email: "user@example.com" }),
		});
		await renderRoute(<LoginPage />, "/login");
		fillForm("user@example.com", "s3cret-pw");
		fireEvent.click(screen.getByRole("button", { name: "Log in" }));
		await waitFor(() =>
			expect(screen.getByText("Dashboard page")).toBeTruthy(),
		);
	});
});
