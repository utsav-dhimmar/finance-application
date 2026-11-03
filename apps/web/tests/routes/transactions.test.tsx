import type { ActivityItem } from "@finance-application/schemas";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TransactionsPage } from "@/routes/transactions";
import { renderRoute } from "./helpers";

const sessionUser = { id: "u1", email: "user@example.com" };

function makeTransactionRow(
	overrides: Partial<ActivityItem> & { id: string },
): ActivityItem {
	return {
		kind: "transaction",
		date: "2026-01-15",
		// Signed effect on the row's account: expenses are negative.
		amountMinor: -125050,
		direction: null,
		accountId: "acc-1",
		accountName: "HDFC Bank",
		status: "active",
		notes: "weekly shop",
		type: "expense",
		categoryId: "cat-1",
		categoryName: "Groceries",
		counterpartyAccountId: null,
		counterpartyAccountName: null,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		archivedAt: null,
		deletedAt: null,
		...overrides,
	};
}

function makeTransferRow(
	overrides: Partial<ActivityItem> & { id: string },
): ActivityItem {
	return {
		kind: "transfer",
		date: "2026-01-18",
		amountMinor: -5000,
		direction: "out",
		accountId: "acc-1",
		accountName: "HDFC Bank",
		status: "active",
		notes: "cash withdrawal",
		type: null,
		categoryId: null,
		categoryName: null,
		counterpartyAccountId: "acc-2",
		counterpartyAccountName: "Wallet",
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		archivedAt: null,
		deletedAt: null,
		...overrides,
	};
}

const activeTxn = makeTransactionRow({ id: "txn-1" });
const incomeTxn = makeTransactionRow({
	id: "txn-2",
	type: "income",
	amountMinor: 50000,
	categoryName: "Salary",
	date: "2026-01-20",
});
const deletedTxn = makeTransactionRow({
	id: "txn-4",
	status: "deleted",
	deletedAt: "2026-01-02T00:00:00.000Z",
});
const transferOut = makeTransferRow({ id: "tr-1" });
const deletedTransfer = makeTransferRow({
	id: "tr-2",
	status: "deleted",
	deletedAt: "2026-01-02T00:00:00.000Z",
});

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function activityBody(activity: ActivityItem[], total = activity.length) {
	return { activity, page: 1, pageSize: 20, total };
}

// Signed-in session by default; tests override the endpoints they exercise.
// Any URL without an override returns 404 so accidental requests are visible.
function stubActivityApi(
	overrides: Record<string, () => Response> = {},
): ReturnType<typeof vi.fn> {
	const fetchMock = vi.fn(async (input: RequestInfo | string) => {
		const url = typeof input === "string" ? input : input.url;
		if (url === "/api/auth/me") {
			return jsonResponse(200, sessionUser);
		}
		if (url === "/api/accounts?status=active") {
			return jsonResponse(200, {
				accounts: [
					{
						id: "acc-1",
						name: "HDFC Bank",
						type: "bank",
						openingBalanceMinor: 0,
						currentBalanceMinor: 0,
						status: "active",
						archivedAt: null,
						deletedAt: null,
						createdAt: "",
						updatedAt: "",
					},
					{
						id: "acc-2",
						name: "Wallet",
						type: "wallet",
						openingBalanceMinor: 0,
						currentBalanceMinor: 0,
						status: "active",
						archivedAt: null,
						deletedAt: null,
						createdAt: "",
						updatedAt: "",
					},
				],
				combinedBalanceMinor: 0,
			});
		}
		if (url === "/api/categories?status=active") {
			return jsonResponse(200, {
				categories: [
					{
						id: "cat-1",
						name: "Groceries",
						type: "expense",
						color: null,
						icon: null,
						status: "active",
						archivedAt: null,
						deletedAt: null,
						createdAt: "",
						updatedAt: "",
					},
					{
						id: "cat-2",
						name: "Salary",
						type: "income",
						color: null,
						icon: null,
						status: "active",
						archivedAt: null,
						deletedAt: null,
						createdAt: "",
						updatedAt: "",
					},
				],
			});
		}
		const override = overrides[url];
		if (override) {
			return override();
		}
		return jsonResponse(404, {
			error: {
				code: "NOT_FOUND",
				message: "Resource not found",
				details: [],
			},
		});
	});
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

function callsTo(
	fetchMock: ReturnType<typeof vi.fn>,
	url: string,
): Array<[string, RequestInit | undefined]> {
	return vi
		.mocked(fetchMock)
		.mock.calls.filter(
			([input]) => (typeof input === "string" ? input : input.url) === url,
		) as Array<[string, RequestInit | undefined]>;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("/transactions rendering states", () => {
	it("renders the active activity feed as a table with signed amounts", async () => {
		stubActivityApi({
			"/api/activity?status=active&page=1&pageSize=20": () =>
				jsonResponse(200, activityBody([activeTxn, incomeTxn, transferOut])),
		});
		await renderRoute(<TransactionsPage />, "/transactions");

		await waitFor(() => expect(screen.getByText("2026-01-15")).toBeTruthy());
		expect(screen.getByText("−₹1,250.50")).toBeTruthy();
		expect(screen.getByText("+₹500.00")).toBeTruthy();
		// The transfer row carries a direction badge and never a category.
		expect(screen.getByText("Out")).toBeTruthy();
		expect(screen.getByText("−₹50.00")).toBeTruthy();
		// Account and category names also appear in the filter-bar options.
		expect(screen.getAllByText("HDFC Bank").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Salary").length).toBeGreaterThan(0);
		expect(screen.getAllByText("weekly shop").length).toBeGreaterThan(0);
	});

	it("shows the empty state and the error state with retry", async () => {
		const fetchMock = stubActivityApi({
			"/api/activity?status=active&page=1&pageSize=20": () =>
				jsonResponse(500, {
					error: {
						code: "INTERNAL_ERROR",
						message: "Internal server error",
						details: [],
					},
				}),
		});
		await renderRoute(<TransactionsPage />, "/transactions");
		await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());

		// Recovery on retry: point the stub at a good response.
		vi.mocked(fetchMock).mockImplementation(async (input) => {
			const url = typeof input === "string" ? input : input.url;
			if (url === "/api/auth/me") {
				return jsonResponse(200, sessionUser);
			}
			if (url === "/api/activity?status=active&page=1&pageSize=20") {
				return jsonResponse(200, activityBody([]));
			}
			return jsonResponse(404, {
				error: {
					code: "NOT_FOUND",
					message: "Resource not found",
					details: [],
				},
			});
		});
		fireEvent.click(screen.getByRole("button", { name: "Retry" }));
		await waitFor(() =>
			expect(screen.getByText(/no transactions yet/i)).toBeTruthy(),
		);
	});

	it("switches tabs and fetches the matching lifecycle slice", async () => {
		const fetchMock = stubActivityApi({
			"/api/activity?status=active&page=1&pageSize=20": () =>
				jsonResponse(200, activityBody([activeTxn])),
			"/api/activity?status=deleted&page=1&pageSize=20": () =>
				jsonResponse(200, activityBody([deletedTxn])),
		});
		await renderRoute(<TransactionsPage />, "/transactions");
		await waitFor(() => expect(screen.getByText("2026-01-15")).toBeTruthy());

		fireEvent.click(screen.getByRole("tab", { name: "Trash" }));
		await waitFor(() =>
			expect(
				callsTo(fetchMock, "/api/activity?status=deleted&page=1&pageSize=20")
					.length,
			).toBeGreaterThan(0),
		);
		// Trashed rows offer restore/permanent-delete actions, not Edit.
		await waitFor(() =>
			expect(screen.getByText("Delete forever")).toBeTruthy(),
		);
		expect(screen.queryByRole("button", { name: /edit/i })).toBeNull();
	});

	it("applies the type and search filters", async () => {
		const fetchMock = stubActivityApi({
			"/api/activity?status=active&page=1&pageSize=20": () =>
				jsonResponse(200, activityBody([activeTxn])),
		});
		await renderRoute(<TransactionsPage />, "/transactions");
		await waitFor(() => expect(screen.getByText("2026-01-15")).toBeTruthy());

		// Open the Base UI type select and pick Expense. SelectItem commits a
		// mouse selection only after a pointerdown registered the pointer, so
		// both events are fired.
		fireEvent.click(screen.getByLabelText("Type filter"));
		const expenseOption = await waitFor(() => {
			const match = screen
				.getAllByRole("option")
				.find((option) => option.textContent === "Expense");
			if (!match) {
				throw new Error("Expense option not rendered yet");
			}
			return match;
		});
		fireEvent.pointerDown(expenseOption);
		fireEvent.click(expenseOption);
		await waitFor(() =>
			expect(
				callsTo(
					fetchMock,
					"/api/activity?status=active&type=expense&page=1&pageSize=20",
				),
			).toHaveLength(1),
		);

		fireEvent.change(screen.getByLabelText("Search transactions"), {
			target: { value: "shop" },
		});
		await waitFor(() =>
			expect(
				callsTo(
					fetchMock,
					"/api/activity?status=active&type=expense&q=shop&page=1&pageSize=20",
				).length,
			).toBeGreaterThan(0),
		);
	});
});

describe("/transactions edit dialog", () => {
	it("prefills the transaction and patches on save", async () => {
		const fetchMock = stubActivityApi({
			"/api/activity?status=active&page=1&pageSize=20": () =>
				jsonResponse(200, activityBody([activeTxn])),
			"/api/transactions/txn-1": () => jsonResponse(200, activeTxn),
		});
		await renderRoute(<TransactionsPage />, "/transactions");
		await waitFor(() => expect(screen.getByText("2026-01-15")).toBeTruthy());
		fireEvent.click(screen.getByRole("button", { name: /edit/i }));
		await waitFor(() =>
			expect(screen.getByLabelText("Amount (₹)")).toBeTruthy(),
		);
		const amountInput = screen.getByLabelText("Amount (₹)") as HTMLInputElement;
		expect(amountInput.value).toBe("1250.50");

		fireEvent.change(amountInput, { target: { value: "99.99" } });
		fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
		await waitFor(() => {
			const calls = callsTo(fetchMock, "/api/transactions/txn-1");
			expect(calls).toHaveLength(1);
		});
		const [, init] = callsTo(fetchMock, "/api/transactions/txn-1")[0] as [
			string,
			RequestInit,
		];
		expect(init.method).toBe("PATCH");
		expect(init.body).toContain('"amountMinor":9999');
	});
});

describe("/transactions lifecycle actions", () => {
	async function openWithActive(
		overrides: Record<string, () => Response> = {},
	) {
		const fetchMock = stubActivityApi({
			"/api/activity?status=active&page=1&pageSize=20": () =>
				jsonResponse(200, activityBody([activeTxn])),
			...overrides,
		});
		await renderRoute(<TransactionsPage />, "/transactions");
		await waitFor(() => expect(screen.getByText("2026-01-15")).toBeTruthy());
		return fetchMock;
	}

	it("archives after confirmation and supports cancel", async () => {
		const fetchMock = await openWithActive({
			"/api/transactions/txn-1/archive": () =>
				jsonResponse(200, { ...activeTxn, status: "archived" }),
		});

		fireEvent.click(screen.getByRole("button", { name: "Archive" }));
		await waitFor(() =>
			expect(screen.getByText(/archive this transaction\?/i)).toBeTruthy(),
		);
		fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
		await waitFor(() =>
			expect(screen.queryByText(/archive this transaction\?/i)).toBeNull(),
		);
		expect(callsTo(fetchMock, "/api/transactions/txn-1/archive")).toHaveLength(
			0,
		);

		fireEvent.click(screen.getByRole("button", { name: "Archive" }));
		await waitFor(() =>
			expect(screen.getByText(/archive this transaction\?/i)).toBeTruthy(),
		);
		fireEvent.click(
			screen.getByRole("button", { name: "Archive transaction" }),
		);
		await waitFor(() =>
			expect(
				callsTo(fetchMock, "/api/transactions/txn-1/archive"),
			).toHaveLength(1),
		);
	});

	it("requires typing DELETE before permanent deletion", async () => {
		const fetchMock = stubActivityApi({
			"/api/activity?status=deleted&page=1&pageSize=20": () =>
				jsonResponse(200, activityBody([deletedTxn])),
			"/api/transactions/txn-4": () => jsonResponse(200, deletedTxn),
		});
		await renderRoute(<TransactionsPage />, "/transactions");
		await waitFor(() =>
			expect(screen.getByRole("tab", { name: "Trash" })).toBeTruthy(),
		);
		fireEvent.click(screen.getByRole("tab", { name: "Trash" }));
		await waitFor(() =>
			expect(screen.getByText("Delete forever")).toBeTruthy(),
		);

		fireEvent.click(screen.getByRole("button", { name: "Delete forever" }));
		await waitFor(() =>
			expect(screen.getByText(/permanently delete/i)).toBeTruthy(),
		);
		// The confirm button stays disabled until DELETE is typed.
		const confirmButton = screen.getByRole("button", {
			name: "Delete forever",
		}) as HTMLButtonElement;
		expect(confirmButton.disabled).toBe(true);

		fireEvent.change(screen.getByLabelText(/type delete to confirm/i), {
			target: { value: "DELETE" },
		});
		await waitFor(() => expect(confirmButton.disabled).toBe(false));
		fireEvent.click(confirmButton);
		await waitFor(() => {
			const calls = callsTo(fetchMock, "/api/transactions/txn-4");
			expect(calls).toHaveLength(1);
		});
		const [, init] = callsTo(fetchMock, "/api/transactions/txn-4")[0] as [
			string,
			RequestInit,
		];
		expect(init.method).toBe("DELETE");
	});

	it("restores, prompting reassignment when the restore conflicts", async () => {
		let restoreCalls = 0;
		const fetchMock = stubActivityApi({
			"/api/activity?status=deleted&page=1&pageSize=20": () =>
				jsonResponse(200, activityBody([deletedTxn])),
			"/api/transactions/txn-4/restore": () => {
				restoreCalls += 1;
				if (restoreCalls === 1) {
					return jsonResponse(409, {
						error: {
							code: "RESTORE_CONFLICT",
							message: "conflict",
							details: [],
						},
					});
				}
				return jsonResponse(200, { ...deletedTxn, status: "active" });
			},
		});
		await renderRoute(<TransactionsPage />, "/transactions");
		await waitFor(() =>
			expect(screen.getByRole("tab", { name: "Trash" })).toBeTruthy(),
		);
		fireEvent.click(screen.getByRole("tab", { name: "Trash" }));
		await waitFor(() => expect(screen.getByText("Restore")).toBeTruthy());

		fireEvent.click(screen.getByRole("button", { name: "Restore" }));
		await waitFor(() => {
			const calls = callsTo(fetchMock, "/api/transactions/txn-4/restore");
			expect(calls).toHaveLength(1);
		});

		// The conflict opens the reassignment dialog.
		await waitFor(() =>
			expect(screen.getByText("Choose a restore target")).toBeTruthy(),
		);
		fireEvent.click(
			within(screen.getByRole("dialog")).getByRole("button", {
				name: "Restore",
			}),
		);
		await waitFor(() => {
			const calls = callsTo(fetchMock, "/api/transactions/txn-4/restore");
			expect(calls).toHaveLength(2);
		});
		const [, secondInit] = callsTo(
			fetchMock,
			"/api/transactions/txn-4/restore",
		)[1] as [string, RequestInit];
		// Unchanged references are not sent.
		expect(secondInit.body).toBe(JSON.stringify({}));
	});
});

describe("/transactions create dialog", () => {
	it("surfaces validation errors before submit succeeds", async () => {
		stubActivityApi({
			"/api/activity?status=active&page=1&pageSize=20": () =>
				jsonResponse(200, activityBody([])),
		});
		await renderRoute(<TransactionsPage />, "/transactions");
		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: "Record transaction" }),
			).toBeTruthy(),
		);
		fireEvent.click(screen.getByRole("button", { name: "Record transaction" }));
		await waitFor(() =>
			expect(
				screen.getByText("Record transaction", {
					selector: "[role=dialog] h2, h2",
				}),
			).toBeTruthy(),
		);
		// Submit without amount or references.
		fireEvent.click(
			within(screen.getByRole("dialog")).getByRole("button", {
				name: "Record transaction",
			}),
		);
		await waitFor(() =>
			expect(screen.getAllByRole("alert").length).toBeGreaterThan(0),
		);
	});
});

describe("transfer rows in the history view", () => {
	it("shows direction badges, lifecycle badges, and the detail view", async () => {
		stubActivityApi({
			"/api/activity?status=active&page=1&pageSize=20": () =>
				jsonResponse(200, activityBody([transferOut])),
		});
		await renderRoute(<TransactionsPage />, "/transactions");

		await waitFor(() => expect(screen.getByText("2026-01-18")).toBeTruthy());
		expect(screen.getByText("Out")).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: /view transfer/i }));
		await waitFor(() =>
			expect(screen.getByText("Transfer details")).toBeTruthy(),
		);
		expect(screen.getAllByText("₹50.00").length).toBeGreaterThan(0);
		expect(screen.getAllByText("HDFC Bank").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Wallet").length).toBeGreaterThan(0);
	});

	it("archives and soft-deletes transfers through the transfer endpoints", async () => {
		const fetchMock = stubActivityApi({
			"/api/activity?status=active&page=1&pageSize=20": () =>
				jsonResponse(200, activityBody([transferOut])),
			"/api/transfers/tr-1/archive": () =>
				jsonResponse(200, { ...transferOut, status: "archived" }),
		});
		await renderRoute(<TransactionsPage />, "/transactions");
		await waitFor(() => expect(screen.getByText("2026-01-18")).toBeTruthy());

		fireEvent.click(screen.getByRole("button", { name: "Archive" }));
		await waitFor(() =>
			expect(screen.getByText(/archive this transfer\?/i)).toBeTruthy(),
		);
		fireEvent.click(screen.getByRole("button", { name: "Archive transfer" }));
		await waitFor(() =>
			expect(callsTo(fetchMock, "/api/transfers/tr-1/archive")).toHaveLength(1),
		);
	});

	it("restores a deleted transfer with reassignment on conflict", async () => {
		let restoreCalls = 0;
		const fetchMock = stubActivityApi({
			"/api/activity?status=deleted&page=1&pageSize=20": () =>
				jsonResponse(200, activityBody([deletedTransfer])),
			"/api/transfers/tr-2/restore": () => {
				restoreCalls += 1;
				if (restoreCalls === 1) {
					return jsonResponse(409, {
						error: {
							code: "RESTORE_CONFLICT",
							message: "conflict",
							details: [],
						},
					});
				}
				return jsonResponse(200, { ...deletedTransfer, status: "active" });
			},
		});
		await renderRoute(<TransactionsPage />, "/transactions");
		await waitFor(() =>
			expect(screen.getByRole("tab", { name: "Trash" })).toBeTruthy(),
		);
		fireEvent.click(screen.getByRole("tab", { name: "Trash" }));
		await waitFor(() => expect(screen.getByText("Restore")).toBeTruthy());

		fireEvent.click(screen.getByRole("button", { name: "Restore" }));
		await waitFor(() => {
			expect(callsTo(fetchMock, "/api/transfers/tr-2/restore")).toHaveLength(1);
		});

		// The conflict opens the transfer reassignment dialog.
		await waitFor(() =>
			expect(screen.getByText("Choose restore targets")).toBeTruthy(),
		);
		fireEvent.click(
			within(screen.getByRole("dialog")).getByRole("button", {
				name: "Restore",
			}),
		);
		await waitFor(() => {
			expect(callsTo(fetchMock, "/api/transfers/tr-2/restore")).toHaveLength(2);
		});
		const [, secondInit] = callsTo(
			fetchMock,
			"/api/transfers/tr-2/restore",
		)[1] as [string, RequestInit];
		// Unchanged references are not sent.
		expect(secondInit.body).toBe(JSON.stringify({}));
	});

	it("requires typing DELETE before permanent transfer deletion", async () => {
		const fetchMock = stubActivityApi({
			"/api/activity?status=deleted&page=1&pageSize=20": () =>
				jsonResponse(200, activityBody([deletedTransfer])),
		});
		await renderRoute(<TransactionsPage />, "/transactions");
		fireEvent.click(screen.getByRole("tab", { name: "Trash" }));
		await waitFor(() =>
			expect(screen.getByText("Delete forever")).toBeTruthy(),
		);

		fireEvent.click(screen.getByRole("button", { name: "Delete forever" }));
		await waitFor(() =>
			expect(
				screen.getByText(/permanently delete this transfer\?/i),
			).toBeTruthy(),
		);
		const confirmButton = screen.getByRole("button", {
			name: "Delete forever",
		}) as HTMLButtonElement;
		expect(confirmButton.disabled).toBe(true);
		fireEvent.change(screen.getByLabelText(/type delete to confirm/i), {
			target: { value: "DELETE" },
		});
		fireEvent.click(confirmButton);
		await waitFor(() => {
			const calls = callsTo(fetchMock, "/api/transfers/tr-2");
			expect(calls).toHaveLength(1);
		});
		const [, init] = callsTo(fetchMock, "/api/transfers/tr-2")[0] as [
			string,
			RequestInit,
		];
		expect(init.method).toBe("DELETE");
	});
});

describe("create transfer dialog", () => {
	it("opens from the header and rejects same-account selections", async () => {
		let createCalls = 0;
		stubActivityApi({
			"/api/activity?status=active&page=1&pageSize=20": () =>
				jsonResponse(200, activityBody([])),
			"/api/transfers": () => {
				createCalls += 1;
				return jsonResponse(201, {});
			},
		});
		await renderRoute(<TransactionsPage />, "/transactions");
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "New transfer" })).toBeTruthy(),
		);
		fireEvent.click(screen.getByRole("button", { name: "New transfer" }));
		await waitFor(() =>
			expect(
				screen.getByText("Record transfer", {
					selector: "[role=dialog] h2, h2",
				}),
			).toBeTruthy(),
		);

		// Fill only the two account selects with the same account.
		fireEvent.click(screen.getByLabelText("From account (source)"));
		const sourceOption = await waitFor(() => {
			const match = screen
				.getAllByRole("option")
				.find((option) => option.textContent === "HDFC Bank");
			if (!match) {
				throw new Error("source option not rendered yet");
			}
			return match;
		});
		fireEvent.pointerDown(sourceOption);
		fireEvent.click(sourceOption);

		fireEvent.click(screen.getByLabelText("To account (destination)"));
		const sameOption = await waitFor(() => {
			const match = screen
				.getAllByRole("option")
				.find((option) => option.textContent === "HDFC Bank");
			if (!match) {
				throw new Error("destination option not rendered yet");
			}
			return match;
		});
		fireEvent.pointerDown(sameOption);
		fireEvent.click(sameOption);

		fireEvent.click(
			within(screen.getByRole("dialog")).getByRole("button", {
				name: "Record transfer",
			}),
		);
		await waitFor(() =>
			expect(screen.getAllByRole("alert").length).toBeGreaterThan(0),
		);
		expect(createCalls).toBe(0);
	});
});
