import type { AccountResponse } from "@finance-application/schemas";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TransferFormDialog } from "@/components/transfers/transfer-form-dialog";

const accounts: AccountResponse[] = [
	{
		id: "acc-1",
		name: "HDFC Savings",
		type: "bank",
		openingBalanceMinor: 125050,
		currentBalanceMinor: 125050,
		status: "active",
		archivedAt: null,
		deletedAt: null,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
	},
	{
		id: "acc-2",
		name: "Cash Wallet",
		type: "cash",
		openingBalanceMinor: 50000,
		currentBalanceMinor: 50000,
		status: "active",
		archivedAt: null,
		deletedAt: null,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
	},
];

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function stubListFetch() {
	vi.stubGlobal(
		"fetch",
		vi.fn().mockImplementation((input: unknown) => {
			const url = String(input);
			if (url.includes("/api/accounts")) {
				return Promise.resolve(
					jsonResponse(200, { accounts, combinedBalanceMinor: 175050 }),
				);
			}
			return Promise.resolve(jsonResponse(404, { error: "NOT_FOUND" }));
		}),
	);
}

function renderDialog() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	render(
		<QueryClientProvider client={queryClient}>
			<TransferFormDialog open onOpenChange={() => {}} />
		</QueryClientProvider>,
	);
}

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("TransferFormDialog searchable selections", () => {
	it("renders search inputs for both account sides and populates them independently", async () => {
		stubListFetch();
		renderDialog();

		// Both triggers show the placeholder until a side is chosen; DOM order
		// is source then destination.
		const sideTriggers = await screen.findAllByRole("combobox", {
			name: /account/i,
		});
		expect(sideTriggers).toHaveLength(2);
		const [sourceTrigger, destinationTrigger] = sideTriggers;
		if (!sourceTrigger || !destinationTrigger) {
			throw new Error("Expected both side combobox triggers to render");
		}

		// Source side: open, search, select HDFC Savings.
		fireEvent.click(sourceTrigger);
		await screen.findAllByRole("option");
		fireEvent.change(screen.getByPlaceholderText("Search..."), {
			target: { value: "hdfc" },
		});
		fireEvent.click(screen.getByRole("option", { name: "HDFC Savings" }));
		await waitFor(() => {
			expect(sourceTrigger.textContent).toContain("HDFC Savings");
		});

		// Destination side: open, search, select Cash Wallet; the source side
		// keeps its own selection.
		fireEvent.click(destinationTrigger);
		await screen.findAllByRole("option");
		fireEvent.change(screen.getByPlaceholderText("Search..."), {
			target: { value: "cash" },
		});
		fireEvent.click(screen.getByRole("option", { name: "Cash Wallet" }));
		await waitFor(() => {
			expect(destinationTrigger.textContent).toContain("Cash Wallet");
		});
		expect(sourceTrigger.textContent).toContain("HDFC Savings");
	});
});
