import type {
	AccountResponse,
	CategoryResponse,
	TransactionResponse,
	TransferResponse,
} from "@finance-application/schemas";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArchivePage } from "@/routes/archive";
import { renderRoute } from "./helpers";

const sessionUser = { id: "u1", email: "user@example.com" };

function makeAccount(
	overrides: Partial<AccountResponse> & { id: string },
): AccountResponse {
	return {
		name: overrides.id,
		nameNormalized: (overrides.name ?? overrides.id).toLowerCase(),
		userId: "u1",
		type: "bank",
		openingBalanceMinor: 125050,
		currentBalanceMinor: 125050,
		status: "active",
		archivedAt: null,
		deletedAt: null,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		...overrides,
	} as AccountResponse;
}

function makeCategory(
	overrides: Partial<CategoryResponse> & { id: string },
): CategoryResponse {
	return {
		name: overrides.id,
		nameNormalized: (overrides.name ?? overrides.id).toLowerCase(),
		userId: "u1",
		type: "expense",
		color: null,
		icon: null,
		status: "active",
		archivedAt: null,
		deletedAt: null,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		...overrides,
	} as CategoryResponse;
}

function makeTransaction(
	overrides: Partial<TransactionResponse> & { id: string },
): TransactionResponse {
	return {
		type: "expense",
		amountMinor: 25000,
		date: "2026-01-15",
		accountId: "acc-1",
		accountName: "HDFC Bank",
		categoryId: "cat-1",
		categoryName: "Groceries",
		notes: null,
		status: "active",
		archivedAt: null,
		deletedAt: null,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		...overrides,
	} as TransactionResponse;
}

function makeTransfer(
	overrides: Partial<TransferResponse> & { id: string },
): TransferResponse {
	return {
		amountMinor: 10000,
		date: "2026-01-20",
		sourceAccountId: "acc-1",
		sourceAccountName: "HDFC Bank",
		destinationAccountId: "acc-2",
		destinationAccountName: "Pocket",
		notes: null,
		status: "active",
		archivedAt: null,
		deletedAt: null,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		...overrides,
	} as TransferResponse;
}

const archivedAccount = makeAccount({
	id: "acc-3",
	name: "Old Bank",
	status: "archived",
	archivedAt: "2026-01-02T00:00:00.000Z",
});
const archivedCategory = makeCategory({
	id: "cat-3",
	name: "Old Subscriptions",
	status: "archived",
	archivedAt: "2026-01-02T00:00:00.000Z",
});
const archivedTransaction = makeTransaction({
	id: "txn-3",
	status: "archived",
	archivedAt: "2026-01-02T00:00:00.000Z",
});
const archivedTransfer = makeTransfer({
	id: "trf-3",
	status: "archived",
	archivedAt: "2026-01-02T00:00:00.000Z",
});

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

// Signed-in session by default; tests override the endpoints they exercise.
// Any URL without an override returns 404 so accidental requests are visible.
function stubLifecycleApi(
	overrides: Record<string, () => Response> = {},
): ReturnType<typeof vi.fn> {
	const fetchMock = vi.fn(async (input: RequestInfo | string) => {
		const url = typeof input === "string" ? input : input.url;
		if (url === "/api/auth/me") {
			return jsonResponse(200, sessionUser);
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

describe("/archive rendering states", () => {
	it("lists archived accounts under the accounts tab by default", async () => {
		stubLifecycleApi({
			"/api/accounts?status=archived": () =>
				jsonResponse(200, {
					accounts: [archivedAccount],
					combinedBalanceMinor: 0,
				}),
		});
		await renderRoute(<ArchivePage />, "/archive");

		await waitFor(() => expect(screen.getByText("Old Bank")).toBeTruthy());
		expect(screen.getByRole("heading", { name: "Archive" })).toBeTruthy();
		// Archived cards offer Restore, not Edit.
		expect(screen.getByRole("button", { name: "Restore" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
	});

	it("shows the empty state when the archive slice is empty", async () => {
		stubLifecycleApi({
			"/api/accounts?status=archived": () =>
				jsonResponse(200, { accounts: [], combinedBalanceMinor: 0 }),
		});
		await renderRoute(<ArchivePage />, "/archive");

		await waitFor(() =>
			expect(screen.getByText("No archived accounts.")).toBeTruthy(),
		);
	});

	it("shows an error state with a working retry", async () => {
		const fetchMock = stubLifecycleApi({
			"/api/accounts?status=archived": () =>
				jsonResponse(500, {
					error: {
						code: "INTERNAL_ERROR",
						message: "Internal server error",
						details: [],
					},
				}),
		});
		await renderRoute(<ArchivePage />, "/archive");
		await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());

		vi.mocked(fetchMock).mockImplementation(async (input) => {
			const url = typeof input === "string" ? input : input.url;
			if (url === "/api/auth/me") {
				return jsonResponse(200, sessionUser);
			}
			if (url === "/api/accounts?status=archived") {
				return jsonResponse(200, {
					accounts: [archivedAccount],
					combinedBalanceMinor: 0,
				});
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
		await waitFor(() => expect(screen.getByText("Old Bank")).toBeTruthy());
	});
});

describe("/archive record-type tabs", () => {
	it("switches to the categories tab and fetches its archived slice", async () => {
		const fetchMock = stubLifecycleApi({
			"/api/categories?status=archived": () =>
				jsonResponse(200, { categories: [archivedCategory] }),
		});
		await renderRoute(<ArchivePage />, "/archive");
		await waitFor(() =>
			expect(screen.getByRole("tab", { name: "Categories" })).toBeTruthy(),
		);
		fireEvent.click(screen.getByRole("tab", { name: "Categories" }));

		await waitFor(() =>
			expect(screen.getByText("Old Subscriptions")).toBeTruthy(),
		);
		expect(callsTo(fetchMock, "/api/categories?status=archived")).toHaveLength(
			1,
		);
	});

	it("switches to the transactions tab and fetches its archived slice", async () => {
		const fetchMock = stubLifecycleApi({
			"/api/transactions?status=archived&page=1&pageSize=20": () =>
				jsonResponse(200, {
					transactions: [archivedTransaction],
					page: 1,
					pageSize: 20,
					total: 1,
				}),
		});
		await renderRoute(<ArchivePage />, "/archive");
		await waitFor(() =>
			expect(screen.getByRole("tab", { name: "Transactions" })).toBeTruthy(),
		);
		fireEvent.click(screen.getByRole("tab", { name: "Transactions" }));

		await waitFor(() => expect(screen.getByText("2026-01-15")).toBeTruthy());
		expect(screen.getByText("₹250.00")).toBeTruthy();
		expect(screen.getByText("Groceries")).toBeTruthy();
		expect(
			callsTo(
				fetchMock,
				"/api/transactions?status=archived&page=1&pageSize=20",
			),
		).toHaveLength(1);
	});

	it("switches to the transfers tab and fetches its archived slice", async () => {
		stubLifecycleApi({
			"/api/transfers?status=archived&page=1&pageSize=20": () =>
				jsonResponse(200, {
					transfers: [archivedTransfer],
					page: 1,
					pageSize: 20,
					total: 1,
				}),
		});
		await renderRoute(<ArchivePage />, "/archive");
		await waitFor(() =>
			expect(screen.getByRole("tab", { name: "Transfers" })).toBeTruthy(),
		);
		fireEvent.click(screen.getByRole("tab", { name: "Transfers" }));

		await waitFor(() => expect(screen.getByText("2026-01-20")).toBeTruthy());
		expect(screen.getByText("HDFC Bank")).toBeTruthy();
		expect(screen.getByText("Pocket")).toBeTruthy();
	});
});

describe("/archive restore wiring", () => {
	it("restores an archived account, prompting a new name when taken", async () => {
		let restoreCalls = 0;
		const fetchMock = stubLifecycleApi({
			"/api/accounts?status=archived": () =>
				jsonResponse(200, {
					accounts: [archivedAccount],
					combinedBalanceMinor: 0,
				}),
			"/api/accounts/acc-3/restore": () => {
				restoreCalls += 1;
				if (restoreCalls === 1) {
					return jsonResponse(409, {
						error: {
							code: "ACCOUNT_NAME_TAKEN",
							message: "An account with this name already exists",
							details: [],
						},
					});
				}
				return jsonResponse(200, { ...archivedAccount, status: "active" });
			},
		});
		await renderRoute(<ArchivePage />, "/archive");
		await waitFor(() => expect(screen.getByText("Old Bank")).toBeTruthy());

		fireEvent.click(screen.getByRole("button", { name: "Restore" }));
		await waitFor(() => {
			const calls = callsTo(fetchMock, "/api/accounts/acc-3/restore");
			expect(calls).toHaveLength(1);
		});

		// The conflict opens the rename prompt.
		await waitFor(() =>
			expect(screen.getByText("Choose a new name")).toBeTruthy(),
		);
		fireEvent.change(screen.getByLabelText("New name"), {
			target: { value: "Recovered Bank" },
		});
		fireEvent.click(
			within(screen.getByRole("dialog")).getByRole("button", {
				name: "Restore",
			}),
		);
		await waitFor(() => {
			const calls = callsTo(fetchMock, "/api/accounts/acc-3/restore");
			expect(calls).toHaveLength(2);
		});
		const [, secondInit] = callsTo(
			fetchMock,
			"/api/accounts/acc-3/restore",
		)[1] as [string, RequestInit];
		expect(secondInit.body).toBe(JSON.stringify({ newName: "Recovered Bank" }));
	});

	it("restores an archived transaction", async () => {
		const fetchMock = stubLifecycleApi({
			"/api/transactions?status=archived&page=1&pageSize=20": () =>
				jsonResponse(200, {
					transactions: [archivedTransaction],
					page: 1,
					pageSize: 20,
					total: 1,
				}),
			"/api/transactions/txn-3/restore": () =>
				jsonResponse(200, { ...archivedTransaction, status: "active" }),
		});
		await renderRoute(<ArchivePage />, "/archive");
		await waitFor(() =>
			expect(screen.getByRole("tab", { name: "Transactions" })).toBeTruthy(),
		);
		fireEvent.click(screen.getByRole("tab", { name: "Transactions" }));
		await waitFor(() => expect(screen.getByText("2026-01-15")).toBeTruthy());

		fireEvent.click(screen.getByRole("button", { name: "Restore" }));
		await waitFor(() => {
			const calls = callsTo(fetchMock, "/api/transactions/txn-3/restore");
			expect(calls).toHaveLength(1);
		});
		const [, init] = callsTo(
			fetchMock,
			"/api/transactions/txn-3/restore",
		)[0] as [string, RequestInit];
		expect(init.method).toBe("POST");
	});
});
