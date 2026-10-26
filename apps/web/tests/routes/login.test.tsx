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
		await renderRoute(<LoginPage />, "/login");
		fireEvent.click(screen.getByRole("button", { name: "Log in" }));
		expect(screen.getByRole("alert").textContent).toMatch(/valid email/i);
	});

	it("rejects a too-short password client-side", async () => {
		await renderRoute(<LoginPage />, "/login");
		fillForm("user@example.com", "short");
		fireEvent.click(screen.getByRole("button", { name: "Log in" }));
		expect(screen.getByRole("alert").textContent).toMatch(
			/at least 8 characters/i,
		);
	});

	it("shows the generic server error on invalid credentials", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				jsonResponse(401, {
					error: {
						code: "AUTH_INVALID_CREDENTIALS",
						message: "Invalid email or password",
						details: [],
					},
				}),
			),
		);
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
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | string) => {
				const url = typeof input === "string" ? input : input.url;
				if (url === "/api/auth/login") {
					return jsonResponse(200, { id: "u1", email: "user@example.com" });
				}
				return jsonResponse(200, { id: "u1", email: "user@example.com" });
			}),
		);
		await renderRoute(<LoginPage />, "/login");
		fillForm("user@example.com", "s3cret-pw");
		fireEvent.click(screen.getByRole("button", { name: "Log in" }));
		await waitFor(() =>
			expect(screen.getByText("Dashboard page")).toBeTruthy(),
		);
	});
});
