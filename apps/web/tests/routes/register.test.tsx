import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RegisterPage } from "@/routes/register";
import { renderRoute } from "./helpers";

afterEach(() => {
	vi.unstubAllGlobals();
});

// Registration is permanently closed: the page offers no form, only the
// closed notice and the way back to /login.
describe("/register (closed)", () => {
	it("shows the closed notice without any registration form", async () => {
		await renderRoute(<RegisterPage />, "/register");
		expect(screen.getByText(/registration is closed/i)).toBeTruthy();
		expect(
			screen.getByText(/single-user and new registrations are not accepted/i),
		).toBeTruthy();
		expect(screen.queryByLabelText("Email")).toBeNull();
		expect(screen.queryByLabelText("Password")).toBeNull();
		expect(screen.queryByRole("button", { name: "Register" })).toBeNull();
	});

	it("links the visitor to /login", async () => {
		await renderRoute(<RegisterPage />, "/register");
		expect(screen.getByText(/go to log in/i)).toBeTruthy();
	});

	it("renders without any registration request", async () => {
		const fetchMock = vi.fn(async (_input: RequestInfo | string) =>
			new Response(JSON.stringify({
				error: {
					code: "UNAUTHENTICATED",
					message: "Authentication required",
					details: [],
				},
			}), { status: 401, headers: { "content-type": "application/json" } }),
		);
		vi.stubGlobal("fetch", fetchMock);
		await renderRoute(<RegisterPage />, "/register");
		// The session probe may run against the stubbed fetch; the page itself
		// must never POST a registration.
		const registerCalls = fetchMock.mock.calls.filter(
			([input]) =>
				typeof input === "string" && input.includes("/api/auth/register"),
		);
		expect(registerCalls).toHaveLength(0);
	});
});
