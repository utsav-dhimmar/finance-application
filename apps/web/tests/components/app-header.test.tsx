import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppHeader } from "@/components/app-header";

function renderWithClient(ui: React.ReactElement) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
	);
}

describe("AppHeader responsive behavior", () => {
	it("renders mobile menu toggle button and toggles navigation menu", async () => {
		// Mock unauthenticated session fetch
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), {
					status: 401,
					headers: { "content-type": "application/json" },
				}),
			),
		);

		renderWithClient(<AppHeader />);

		const toggleButton = screen.getByRole("button", { name: "Open menu" });
		expect(toggleButton).toBeDefined();
		expect(toggleButton.getAttribute("aria-expanded")).toBe("false");

		// Open mobile menu
		fireEvent.click(toggleButton);
		expect(toggleButton.getAttribute("aria-expanded")).toBe("true");

		// Mobile menu contains sign in link
		const signInLinks = screen.getAllByRole("link", { name: /Sign in/i });
		expect(signInLinks.length).toBeGreaterThanOrEqual(1);

		// Click again to close
		fireEvent.click(screen.getByRole("button", { name: "Close menu" }));
		expect(toggleButton.getAttribute("aria-expanded")).toBe("false");
	});
});
