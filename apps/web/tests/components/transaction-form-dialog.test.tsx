import type {
	AccountResponse,
	CategoryResponse,
} from "@finance-application/schemas";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TransactionFormDialog } from "@/components/transactions/transaction-form-dialog";

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

const categories: CategoryResponse[] = [
	{
		id: "cat-1",
		name: "Groceries",
		type: "expense",
		color: null,
		icon: null,
		status: "active",
		archivedAt: null,
		deletedAt: null,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
	},
	{
		id: "cat-2",
		name: "Dining",
		type: "expense",
		color: null,
		icon: null,
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
					jsonResponse(200, {
						accounts,
						combinedBalanceMinor: 175050,
					}),
				);
			}
			if (url.includes("/api/categories")) {
				return Promise.resolve(jsonResponse(200, { categories }));
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
			<TransactionFormDialog open onOpenChange={() => {}} />
		</QueryClientProvider>,
	);
}

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("TransactionFormDialog searchable selections", () => {
	it("renders searchable account and category comboboxes that report selection", async () => {
		stubListFetch();
		renderDialog();

		// Grab the triggers before any selection changes their content.
		const accountTrigger = await screen.findByRole("combobox", {
			name: /account/i,
		});
		const categoryTrigger = screen.getByRole("combobox", {
			name: /category/i,
		});

		// Account combobox: search narrows, selection updates the field.
		fireEvent.click(accountTrigger);
		const options = await screen.findAllByRole("option");
		expect(options).toHaveLength(2);
		const search = screen.getByPlaceholderText("Search...");
		fireEvent.change(search, { target: { value: "hdfc" } });
		const narrowed = screen.getAllByRole("option");
		expect(narrowed).toHaveLength(1);
		expect(narrowed[0]?.textContent).toContain("HDFC Savings");
		fireEvent.click(screen.getByRole("option", { name: "HDFC Savings" }));
		await waitFor(() => {
			expect(accountTrigger.textContent).toContain("HDFC Savings");
		});

		// Category combobox: search narrows, selection updates the field.
		fireEvent.click(categoryTrigger);
		const categoryOptions = await screen.findAllByRole("option");
		expect(categoryOptions).toHaveLength(2);
		const categorySearch = screen.getByPlaceholderText("Search...");
		fireEvent.change(categorySearch, { target: { value: "din" } });
		const narrowedCategories = screen.getAllByRole("option");
		expect(narrowedCategories).toHaveLength(1);
		expect(narrowedCategories[0]?.textContent).toContain("Dining");
		fireEvent.click(screen.getByRole("option", { name: "Dining" }));
		await waitFor(() => {
			expect(categoryTrigger.textContent).toContain("Dining");
		});
	});
});
