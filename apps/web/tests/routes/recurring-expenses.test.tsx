import type {
	AccountResponse,
	CategoryResponse,
} from "@finance-application/schemas";
import {
	cleanup,
	fireEvent,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecurringExpensesPage } from "@/routes/recurring-expenses";
import { renderRoute } from "./helpers";

const sessionUser = { id: "u1", email: "user@example.com" };

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

const expenseCategories: CategoryResponse[] = [
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

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("RecurringExpensesPage create-rule selections", () => {
	it("uses searchable comboboxes for account and category while cadence stays a plain select", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | string) => {
				const url = typeof input === "string" ? input : input.url;
				if (url === "/api/auth/me") {
					return jsonResponse(200, sessionUser);
				}
				if (url.startsWith("/api/recurring-expenses")) {
					return jsonResponse(200, { recurringExpenses: [] });
				}
				if (url.startsWith("/api/accounts")) {
					return jsonResponse(200, { accounts, combinedBalanceMinor: 175050 });
				}
				if (url.startsWith("/api/categories")) {
					return jsonResponse(200, { categories: expenseCategories });
				}
				return jsonResponse(404, {
					error: { code: "NOT_FOUND", message: "not found", details: [] },
				});
			}),
		);

		await renderRoute(<RecurringExpensesPage />, "/recurring-expenses");

		// Open the create dialog. The page renders behind an auth gate, so the
		// button appears only after the stubbed session query resolves — await
		// it instead of racing the query continuation.
		fireEvent.click(
			await screen.findByRole("button", { name: "New recurring rule" }),
		);
		const dialog = await screen.findByRole("dialog", {
			name: "New Recurring Expense",
		});

		// Identify the three controls by their stable ids.
		const comboboxes = within(dialog).getAllByRole("combobox");
		const accountTrigger = comboboxes.find(
			(el) => el.id === "create-rule-account",
		);
		const categoryTrigger = comboboxes.find(
			(el) => el.id === "create-rule-category",
		);
		const intervalTrigger = dialog.querySelector(
			"#create-rule-interval",
		) as HTMLElement;
		expect(intervalTrigger).toBeDefined();
		expect(categoryTrigger).toBeDefined();
		if (!accountTrigger || !categoryTrigger) {
			throw new Error("Expected account and category comboboxes in dialog");
		}

		// The cadence control's popup has no search input: it stays a plain select.
		fireEvent.click(intervalTrigger);
		const cadenceOptions = await screen.findAllByRole("option");
		expect(cadenceOptions.length).toBeGreaterThan(0);
		expect(cadenceOptions[0]?.textContent).toContain("Every 1 month");
		expect(screen.queryByPlaceholderText("Search...")).toBeNull();
		fireEvent.keyDown(intervalTrigger, { key: "Escape" });

		// Account combobox: popup contains a search input and lists the accounts.
		fireEvent.click(accountTrigger);
		expect(screen.getByPlaceholderText("Search...")).toBeDefined();
		const accountOptions = await screen.findAllByRole("option");
		expect(accountOptions).toHaveLength(2);
		fireEvent.change(screen.getByPlaceholderText("Search..."), {
			target: { value: "hdfc" },
		});
		const narrowed = screen.getAllByRole("option");
		expect(narrowed).toHaveLength(1);
		expect(narrowed[0]?.textContent).toContain("HDFC Savings");
		fireEvent.keyDown(screen.getByPlaceholderText("Search..."), {
			key: "Escape",
		});

		// Category combobox: searchable too.
		fireEvent.click(categoryTrigger);
		expect(screen.getByPlaceholderText("Search...")).toBeDefined();
		const categoryOptions = await screen.findAllByRole("option");
		expect(categoryOptions).toHaveLength(2);
		fireEvent.change(screen.getByPlaceholderText("Search..."), {
			target: { value: "din" },
		});
		const narrowedCategories = screen.getAllByRole("option");
		expect(narrowedCategories).toHaveLength(1);
		expect(narrowedCategories[0]?.textContent).toContain("Dining");
	});

	it("keeps the selection when an account combobox option is picked", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | string) => {
				const url = typeof input === "string" ? input : input.url;
				if (url === "/api/auth/me") {
					return jsonResponse(200, sessionUser);
				}
				if (url.startsWith("/api/recurring-expenses")) {
					return jsonResponse(200, { recurringExpenses: [] });
				}
				if (url.startsWith("/api/accounts")) {
					return jsonResponse(200, { accounts, combinedBalanceMinor: 175050 });
				}
				if (url.startsWith("/api/categories")) {
					return jsonResponse(200, { categories: expenseCategories });
				}
				return jsonResponse(404, {
					error: { code: "NOT_FOUND", message: "not found", details: [] },
				});
			}),
		);

		await renderRoute(<RecurringExpensesPage />, "/recurring-expenses");

		fireEvent.click(
			await screen.findByRole("button", { name: "New recurring rule" }),
		);
		const dialog = await screen.findByRole("dialog", {
			name: "New Recurring Expense",
		});

		// Wait for the accounts query so the dialog pre-selects the first one.
		await waitFor(() => {
			expect(
				within(dialog)
					.getAllByRole("combobox")
					.find((el) => el.id === "create-rule-account")?.textContent,
			).toContain("HDFC Savings");
		});

		const accountTrigger = within(dialog)
			.getAllByRole("combobox")
			.find((el) => el.id === "create-rule-account");
		if (!accountTrigger) {
			throw new Error("Expected the account combobox in dialog");
		}
		fireEvent.click(accountTrigger);
		fireEvent.click(await screen.findByRole("option", { name: "Cash Wallet" }));
		await waitFor(() => {
			expect(accountTrigger.textContent).toContain("Cash Wallet");
		});
	});
});
