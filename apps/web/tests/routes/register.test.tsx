import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RegisterPage } from "@/routes/register";
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

describe("/register", () => {
	it("shows the duplicate-email server error without navigating away", async () => {
		stubSessionApi({
			"/api/auth/register": () =>
				jsonResponse(409, {
					error: {
						code: "EMAIL_TAKEN",
						message: "Email is already registered",
						details: [],
					},
				}),
		});
		await renderRoute(<RegisterPage />, "/register");
		fillForm("taken@example.com", "s3cret-pw");
		fireEvent.click(screen.getByRole("button", { name: "Register" }));
		await waitFor(() =>
			expect(screen.getByRole("alert").textContent).toMatch(
				/already registered/i,
			),
		);
		expect(
			screen.getByText(/create your account/i),
		).toBeTruthy();
	});

	it("navigates to /dashboard on successful registration", async () => {
		stubSessionApi({
			"/api/auth/register": () =>
				jsonResponse(201, { id: "u1", email: "new@example.com" }),
		});
		await renderRoute(<RegisterPage />, "/register");
		fillForm("new@example.com", "s3cret-pw");
		fireEvent.click(screen.getByRole("button", { name: "Register" }));
		await waitFor(() =>
			expect(screen.getByText("Dashboard page")).toBeTruthy(),
		);
	});
});
