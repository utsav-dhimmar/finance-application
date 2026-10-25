import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Home } from "@/routes/index";

function renderHome() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<Home />
		</QueryClientProvider>,
	);
}

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("landing page", () => {
	it("renders the application heading and design-system button", () => {
		vi.stubGlobal("fetch", () => new Promise(() => {}));
		renderHome();
		expect(
			screen.getByRole("heading", { name: "Finance Application" }),
		).toBeTruthy();
		expect(screen.getByRole("button", { name: /get started/i })).toBeTruthy();
	});

	it("displays the greeting message once loaded", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(JSON.stringify({ messages: ["Hello, utsav!"] }), {
						status: 200,
						headers: { "content-type": "application/json" },
					}),
			),
		);
		renderHome();
		expect(await screen.findByText("Hello, utsav!")).toBeTruthy();
	});

	it("shows an error fallback when the API is unreachable", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response("boom", { status: 500 })),
		);
		renderHome();
		expect(await screen.findByText(/greeting unavailable/i)).toBeTruthy();
	});
});
