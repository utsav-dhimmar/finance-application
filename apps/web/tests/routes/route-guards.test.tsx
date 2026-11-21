import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { guardAuthenticated } from "@/lib/route-guards";
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

const ME = jsonResponse(200, { id: "u1", email: "me@example.com" });

afterEach(() => {
	vi.unstubAllGlobals();
});

// Router-level guard scenarios: the deep link is the memory history's
// initial entry, so the guard runs before any protected content renders.
describe("route guards (router level)", () => {
	it("deep link without a session redirects to /login before rendering protected content", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => UNAUTHENTICATED.clone()),
		);
		await renderRoute(<DashboardPage />, "/dashboard", {
			beforeLoad: guardAuthenticated,
		});
		await waitFor(() => expect(screen.getByText("Login page")).toBeTruthy());
		expect(screen.queryByText("Dashboard")).toBeNull();
		expect(screen.queryByText(/signed in as/i)).toBeNull();
	});

	it("deep link with a valid session stays on the protected route", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | string) => {
			const url = typeof input === "string" ? input : input.url;
			if (url === "/api/auth/me") {
				return ME.clone();
			}
			return jsonResponse(200, {
				activity: [],
				page: 1,
				pageSize: 20,
				total: 0,
				periodFrom: "2026-01-01",
				periodTo: "2026-01-31",
				incomeMinor: 0,
				expenseMinor: 0,
				netCashFlowMinor: 0,
				categoryBreakdown: [],
				comparison: [],
				accounts: [],
				combinedBalanceMinor: 0,
			});
		});
		vi.stubGlobal("fetch", fetchMock);
		await renderRoute(<DashboardPage />, "/dashboard", {
			beforeLoad: guardAuthenticated,
		});
		await waitFor(() =>
			expect(screen.getByRole("heading", { name: "Dashboard" })).toBeTruthy(),
		);
		expect(screen.queryByText("Login page")).toBeNull();
	});
});
