import { fireEvent, waitFor } from "@testing-library/react-native";
import type {
	AccountResponse,
	CategoryResponse,
} from "@finance-application/schemas";

import { toast } from "sonner-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TransactionsScreen from "@/app/(app)/transactions";
import { errorEnvelope, jsonResponse } from "@/session/fetch-mock";
import { renderWithProviders } from "../../helpers";
import { makeRegisteredMachine } from "../../services/helpers";

vi.mock("expo-crypto", () => ({
	getRandomValues: (bytes: Uint8Array) => bytes.fill(7),
}));
vi.mock("sonner-native", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@react-native-community/datetimepicker", () => ({
	default: () => null,
}));

const account: AccountResponse = {
	id: "acc-1",
	name: "HDFC Bank",
	type: "bank",
	openingBalanceMinor: 100000,
	currentBalanceMinor: 125050,
	status: "active",
	archivedAt: null,
	deletedAt: null,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

const category: CategoryResponse = {
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
};

const incomeCategory: CategoryResponse = {
	...category,
	id: "cat-2",
	name: "Salary",
	type: "income",
};

function activityRow(id: string, amountMinor: number, status = "active") {
	return {
		id,
		kind: "transaction",
		date: "2026-01-15",
		amountMinor,
		direction: null,
		accountId: "acc-1",
		accountName: "HDFC Bank",
		status,
		notes: null,
		type: "expense",
		categoryId: "cat-1",
		categoryName: "Groceries",
		counterpartyAccountId: null,
		counterpartyAccountName: null,
		createdAt: "2026-01-15T00:00:00.000Z",
		updatedAt: "2026-01-15T00:00:00.000Z",
		archivedAt: null,
		deletedAt: null,
	};
}

function baseHandlers(
	overrides: Record<string, unknown> = {},
): Parameters<typeof makeRegisteredMachine>[0] {
	return {
		"GET /api/accounts": () =>
			jsonResponse(200, { accounts: [account], combinedBalanceMinor: 125050 }),
		"GET /api/categories": () =>
			jsonResponse(200, { categories: [category, incomeCategory] }),
		"GET /api/preferences": () =>
			jsonResponse(200, {
				currencyCode: "INR",
				currencySymbol: "₹",
				minorUnitExponent: 2,
			}),
		"GET /api/activity": () =>
			jsonResponse(200, {
				activity: [activityRow("tx-1", -125050)],
				page: 1,
				pageSize: 20,
				total: 1,
			}),
		...overrides,
	} as Parameters<typeof makeRegisteredMachine>[0];
}

function findCall(
	fetchMock: { mock: { calls: unknown[][] } },
	method: string,
	suffix: string,
): unknown[] | undefined {
	return fetchMock.mock.calls.find(
		([input, init]) =>
			(init as RequestInit | undefined)?.method === method &&
			String(input).endsWith(suffix),
	);
}

beforeEach(() => {
	vi.mocked(toast.success).mockClear();
	vi.mocked(toast.error).mockClear();
});

describe("TransactionsScreen lifecycle", () => {
	it("renders the feed rows with signed amounts and record count", async () => {
		makeRegisteredMachine(baseHandlers());
		const { view } = await renderWithProviders(<TransactionsScreen />);
		await waitFor(() => expect(view.getByText("Groceries")).toBeOnTheScreen(), {
			timeout: 10_000,
		});
		expect(view.getByText("−₹1,250.50")).toBeOnTheScreen();
		expect(view.getByText("1 record in this view.")).toBeOnTheScreen();
		expect(
			view.getByRole("button", { name: "Record transaction" }),
		).toBeOnTheScreen();
		expect(view.getByRole("button", { name: "New transfer" }));
	});

	it("archives a transaction through the confirmation dialog", async () => {
		const { fetchMock } = makeRegisteredMachine(
			baseHandlers({
				"POST /api/transactions/tx-1/archive": () =>
					jsonResponse(200, { id: "tx-1", status: "archived" }),
			}),
		);
		const { view } = await renderWithProviders(<TransactionsScreen />);
		await waitFor(
			() =>
				expect(view.getByRole("button", { name: "Archive" })).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		await fireEvent.press(view.getByRole("button", { name: "Archive" }));
		await waitFor(
			() =>
				expect(view.getByText("Archive this transaction?")).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		expect(
			view.getByText(
				"Archived transactions leave the active list but keep their balance effect and stay in reports. You can restore it from the Archived tab.",
			),
		).toBeOnTheScreen();
		await fireEvent.press(
			view.getByRole("button", { name: "Archive transaction" }),
		);
		await waitFor(() => {
			expect(
				findCall(fetchMock, "POST", "/api/transactions/tx-1/archive"),
			).toBeDefined();
		});
		await waitFor(
			() => expect(view.queryByText("Archive this transaction?")).toBeNull(),
			{ timeout: 10_000 },
		);
		expect(toast.success).toHaveBeenCalledWith("Transaction archived.");
	});

	it("deletes a transaction through the confirmation dialog", async () => {
		const { fetchMock } = makeRegisteredMachine(
			baseHandlers({
				"POST /api/transactions/tx-1/delete": () =>
					jsonResponse(200, { id: "tx-1", status: "deleted" }),
			}),
		);
		const { view } = await renderWithProviders(<TransactionsScreen />);
		await waitFor(
			() =>
				expect(view.getByRole("button", { name: "Delete" })).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		await fireEvent.press(view.getByRole("button", { name: "Delete" }));
		await waitFor(
			() =>
				expect(view.getByText("Delete this transaction?")).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		await fireEvent.press(
			view.getByRole("button", { name: "Delete transaction" }),
		);
		await waitFor(() => {
			expect(
				findCall(fetchMock, "POST", "/api/transactions/tx-1/delete"),
			).toBeDefined();
		});
		expect(toast.success).toHaveBeenCalledWith("Transaction moved to trash.");
	});

	it("restores an archived transaction from the Archived tab", async () => {
		let status = "archived";
		const { fetchMock } = makeRegisteredMachine({
			...baseHandlers(),
			"GET /api/activity": () =>
				jsonResponse(200, {
					activity: [activityRow("tx-1", -125050, status)],
					page: 1,
					pageSize: 20,
					total: 1,
				}),
			"POST /api/transactions/tx-1/restore": () => {
				status = "active";
				return jsonResponse(200, { id: "tx-1", status: "active" });
			},
		} as Parameters<typeof makeRegisteredMachine>[0]);
		const { view } = await renderWithProviders(<TransactionsScreen />);
		await waitFor(
			() =>
				expect(view.getByRole("tab", { name: "Archived" })).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		await fireEvent.press(view.getByRole("tab", { name: "Archived" }));
		await waitFor(
			() =>
				expect(view.getByRole("button", { name: "Restore" })).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		await fireEvent.press(view.getByRole("button", { name: "Restore" }));
		await waitFor(() => {
			expect(
				findCall(fetchMock, "POST", "/api/transactions/tx-1/restore"),
			).toBeDefined();
		});
		const call = findCall(fetchMock, "POST", "/api/transactions/tx-1/restore");
		expect(JSON.parse(String((call?.[1] as RequestInit)?.body))).toEqual({});
		expect(toast.success).toHaveBeenCalledWith("Transaction restored.");
	});

	it("creates a transaction that then appears in the feed", async () => {
		let created = false;
		makeRegisteredMachine({
			...baseHandlers(),
			"GET /api/activity": () =>
				jsonResponse(200, {
					activity: created
						? [activityRow("tx-2", 500000), activityRow("tx-1", -125050)]
						: [activityRow("tx-1", -125050)],
					page: 1,
					pageSize: 20,
					total: created ? 2 : 1,
				}),
			"POST /api/transactions": () => {
				created = true;
				return jsonResponse(201, { id: "tx-2", status: "active" });
			},
		} as Parameters<typeof makeRegisteredMachine>[0]);
		const { view } = await renderWithProviders(<TransactionsScreen />);
		await waitFor(
			() =>
				expect(
					view.getByRole("button", { name: "Record transaction" }),
				).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		await fireEvent.press(
			view.getByRole("button", { name: "Record transaction" }),
		);
		await waitFor(
			() => expect(view.getByLabelText("Amount (₹)")).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		// Income type, then account + category through the select sheets.
		await fireEvent.press(view.getByRole("radio", { name: "Income" }));
		await fireEvent.press(view.getByLabelText("Account"));
		await waitFor(
			() => expect(view.getByLabelText("HDFC Bank")).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		await fireEvent.press(view.getByLabelText("HDFC Bank"));
		await fireEvent.press(view.getByLabelText("Category"));
		await waitFor(
			() => expect(view.getByLabelText("Salary")).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		await fireEvent.press(view.getByLabelText("Salary"));
		await fireEvent.changeText(view.getByLabelText("Amount (₹)"), "5000");
		// Two "Record transaction" buttons exist now (screen header + dialog
		// submit); the dialog's is the later one in the tree.
		const recordButtons = view.getAllByRole("button", {
			name: "Record transaction",
		});
		const submit = recordButtons[recordButtons.length - 1];
		if (!submit) {
			throw new Error("Record transaction submit button missing");
		}
		await fireEvent.press(submit);
		// The mutation invalidates the feed, so the new row appears below.
		await waitFor(
			() => expect(view.getByText("+₹5,000.00")).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		expect(toast.success).toHaveBeenCalledWith("Transaction recorded.");
	});
});

// The feed's rendering behaviors under FlashList: progressive pagination and
// the empty and error states. Pull-to-refresh shares its refetch handler with
// the retry button asserted here; the physical gesture is device-verified in
// the QA checklist.
describe("TransactionsScreen feed", () => {
	it("loads the next page beneath the feed and stops at the last page", async () => {
		let activityCalls = 0;
		const { fetchMock } = makeRegisteredMachine(
			baseHandlers({
				"GET /api/activity": () => {
					activityCalls++;
					if (activityCalls === 1) {
						return jsonResponse(200, {
							activity: Array.from({ length: 20 }, (_, index) =>
								activityRow(`tx-${index + 1}`, -(1000 + index * 100)),
							),
							page: 1,
							pageSize: 20,
							total: 25,
						});
					}
					return jsonResponse(200, {
						activity: Array.from({ length: 5 }, (_, index) =>
							activityRow(`tx-${21 + index}`, -(9000 + index * 100)),
						),
						page: 2,
						pageSize: 20,
						total: 25,
					});
				},
			}),
		);
		const { view } = await renderWithProviders(<TransactionsScreen />);
		// The subtitle reports the view's total (25), not the loaded page size.
		await waitFor(
			() => expect(view.getByText("25 records in this view.")).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		await fireEvent.press(view.getByRole("button", { name: "Load more" }));
		const pageTwo = fetchMock.mock.calls.find(([input]) =>
			String(input).includes("page=2"),
		);
		expect(pageTwo).toBeDefined();
		// The last page removes the footer: loaded rows (25) meet the total.
		await waitFor(
			() => expect(view.queryByText("Load more")).toBeNull(),
			{ timeout: 10_000 },
		);
	});

	it("shows the empty state with a create action when the feed has no rows", async () => {
		makeRegisteredMachine(
			baseHandlers({
				"GET /api/activity": () =>
					jsonResponse(200, {
						activity: [],
						page: 1,
						pageSize: 20,
						total: 0,
					}),
			}),
		);
		const { view } = await renderWithProviders(<TransactionsScreen />);
		await waitFor(
			() =>
				expect(
					view.getByText(
						"No transactions yet. Record your first income or expense.",
					),
				).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		expect(
			view.getByRole("button", { name: "Record your first transaction" }),
		).toBeOnTheScreen();
	});

	it("shows an error state and recovers through retry", async () => {
		let activityCalls = 0;
		const { fetchMock } = makeRegisteredMachine(
			baseHandlers({
				"GET /api/activity": () => {
					activityCalls++;
					if (activityCalls === 1) {
						return errorEnvelope(500, "INTERNAL", "boom");
					}
					return jsonResponse(200, {
						activity: [activityRow("tx-1", -125050)],
						page: 1,
						pageSize: 20,
						total: 1,
					});
				},
			}),
		);
		const { view } = await renderWithProviders(<TransactionsScreen />);
		await waitFor(
			() =>
				expect(
					view.getByText("Could not load transactions. Is the API running?"),
				).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		await fireEvent.press(view.getByRole("button", { name: "Retry" }));
		await waitFor(
			() => expect(view.getByText("Groceries")).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		expect(
			view.queryByText("Could not load transactions. Is the API running?"),
		).toBeNull();
		expect(activityCalls).toBe(2);
		expect(fetchMock).toBeDefined();
	});
});
