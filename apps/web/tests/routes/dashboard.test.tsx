import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "@/routes/dashboard";
import { renderRoute } from "./helpers";

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

const UNAUTHENTICATED = jsonResponse(401, {
	error: {
		code: "UNAUTHENTICATED",
		message: "Authentication required",
		details: [],
	},
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("/dashboard", () => {
	it("redirects unauthenticated visitors to /login without showing content", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => UNAUTHENTICATED.clone()),
		);
		await renderRoute(<DashboardPage />, "/dashboard");
		await waitFor(() => expect(screen.getByText("Login page")).toBeTruthy());
		expect(screen.queryByText(/signed in as/i)).toBeNull();
	});

	it("shows the signed-in user's email", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				jsonResponse(200, { id: "u1", email: "me@example.com" }),
			),
		);
		await renderRoute(<DashboardPage />, "/dashboard");
		await waitFor(() =>
			expect(screen.getAllByText(/me@example.com/).length).toBeGreaterThan(0),
		);
		expect(screen.getByText(/finance features will live here/i)).toBeTruthy();
	});

	it("signs out from the header and clears the session", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | string) => {
			const url = typeof input === "string" ? input : input.url;
			if (url === "/api/auth/logout") {
				return new Response(null, { status: 204 });
			}
			return jsonResponse(200, { id: "u1", email: "me@example.com" });
		});
		vi.stubGlobal("fetch", fetchMock);
		await renderRoute(<DashboardPage />, "/dashboard");
		await waitFor(() =>
			expect(screen.getAllByText(/me@example.com/).length).toBeGreaterThan(0),
		);

		fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
		await waitFor(() => {
			const called = fetchMock.mock.calls.some((call) => {
				const arg = call[0];
				return (typeof arg === "string" ? arg : arg.url) === "/api/auth/logout";
			});
			expect(called).toBe(true);
		});
	});
});
