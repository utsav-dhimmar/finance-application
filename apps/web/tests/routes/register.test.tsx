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

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("/register", () => {
	it("shows the duplicate-email server error without navigating away", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				jsonResponse(409, {
					error: {
						code: "EMAIL_TAKEN",
						message: "Email is already registered",
						details: [],
					},
				}),
			),
		);
		await renderRoute(<RegisterPage />, "/register");
		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "taken@example.com" },
		});
		fireEvent.change(screen.getByLabelText("Password"), {
			target: { value: "s3cret-pw" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Register" }));
		await waitFor(() =>
			expect(screen.getByRole("alert").textContent).toMatch(
				/already registered/i,
			),
		);
		expect(
			screen.getByRole("heading", { name: /create your account/i }),
		).toBeTruthy();
	});

	it("navigates to /dashboard on successful registration", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				jsonResponse(201, { id: "u1", email: "new@example.com" }),
			),
		);
		await renderRoute(<RegisterPage />, "/register");
		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "new@example.com" },
		});
		fireEvent.change(screen.getByLabelText("Password"), {
			target: { value: "s3cret-pw" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Register" }));
		await waitFor(() =>
			expect(screen.getByText("Dashboard page")).toBeTruthy(),
		);
	});
});
