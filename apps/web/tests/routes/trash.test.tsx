import type {
	AccountResponse,
	CategoryResponse,
	TransactionResponse,
} from "@finance-application/schemas";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TrashPage } from "@/routes/trash";
import { renderRoute } from "./helpers";

// Sonner's Toaster needs window.matchMedia, which jsdom lacks; the mutation
// hooks surface their copy through the `toast` API, so the tests observe the
// calls directly instead of rendering the Toaster.
const { toastSuccess, toastError } = vi.hoisted(() => ({
	toastSuccess: vi.fn(),
	toastError: vi.fn(),
}));

vi.mock("sonner", () => ({
	toast: {
		success: toastSuccess,
		error: toastError,
	},
}));

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

const deletedAccount = makeAccount({
	id: "acc-4",
	name: "Trashed Bank",
	status: "deleted",
	deletedAt: "2026-01-02T00:00:00.000Z",
});
const deletedCategory = makeCategory({
	id: "cat-4",
	name: "Trashed Subscriptions",
	type: "expense",
	status: "deleted",
	deletedAt: "2026-01-02T00:00:00.000Z",
});
const deletedTransaction = makeTransaction({
	id: "txn-4",
	status: "deleted",
	deletedAt: "2026-01-02T00:00:00.000Z",
});
const activeAccount = makeAccount({ id: "acc-1", name: "HDFC Bank" });
const activeCategory = makeCategory({ id: "cat-1", name: "Groceries" });

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function noContentResponse(): Response {
	return new Response(null, { status: 204 });
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

async function openTrash(
	overrides: Record<string, () => Response> = {},
): Promise<ReturnType<typeof vi.fn>> {
	const fetchMock = stubLifecycleApi({
		"/api/accounts?status=deleted": () =>
			jsonResponse(200, { accounts: [deletedAccount], combinedBalanceMinor: 0 }),
		...overrides,
	});
	await renderRoute(<TrashPage />, "/trash");
	await waitFor(() => expect(screen.getByText("Trashed Bank")).toBeTruthy());
	return fetchMock;
}

beforeEach(() => {
	toastSuccess.mockClear();
	toastError.mockClear();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("/trash rendering", () => {
	it("lists trashed accounts with restore and delete-forever actions", async () => {
		await openTrash();

		expect(screen.getByRole("heading", { name: "Trash" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Restore" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Delete forever" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
	});

	it("shows the empty state when the trash slice is empty", async () => {
		stubLifecycleApi({
			"/api/accounts?status=deleted": () =>
				jsonResponse(200, { accounts: [], combinedBalanceMinor: 0 }),
		});
		await renderRoute(<TrashPage />, "/trash");

		await waitFor(() => expect(screen.getByText("Trash is empty.")).toBeTruthy());
	});
});

describe("/trash permanent deletion", () => {
	it("cancels without deleting", async () => {
		const fetchMock = await openTrash();

		fireEvent.click(screen.getByRole("button", { name: "Delete forever" }));
		await waitFor(() =>
			expect(screen.getByText(/permanently delete this account/i)).toBeTruthy(),
		);
		fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
		await waitFor(() =>
			expect(screen.queryByText(/permanently delete this account/i)).toBeNull(),
		);
		expect(callsTo(fetchMock, "/api/accounts/acc-4")).toHaveLength(0);
	});

	it("requires typing DELETE before confirming", async () => {
		const fetchMock = await openTrash({
			"/api/accounts/acc-4": () => noContentResponse(),
		});

		fireEvent.click(screen.getByRole("button", { name: "Delete forever" }));
		await waitFor(() =>
			expect(screen.getByText(/permanently delete this account/i)).toBeTruthy(),
		);
		// The confirm button stays disabled until DELETE is typed.
		const confirmButton = screen.getByRole("button", {
			name: "Delete forever",
		}) as HTMLButtonElement;
		expect(confirmButton.disabled).toBe(true);

		fireEvent.change(screen.getByLabelText(/type delete to confirm/i), {
			target: { value: "delete" },
		});
		expect(confirmButton.disabled).toBe(true);

		fireEvent.change(screen.getByLabelText(/type delete to confirm/i), {
			target: { value: "DELETE" },
		});
		await waitFor(() => expect(confirmButton.disabled).toBe(false));
		fireEvent.click(confirmButton);

		await waitFor(() => {
			const calls = callsTo(fetchMock, "/api/accounts/acc-4");
			expect(calls).toHaveLength(1);
		});
		const [, init] = callsTo(fetchMock, "/api/accounts/acc-4")[0] as [
			string,
			RequestInit,
		];
		expect(init.method).toBe("DELETE");
		expect(toastSuccess).toHaveBeenCalled();
		// The mutation invalidates the trash slice, so it refetches.
		await waitFor(() => {
			expect(callsTo(fetchMock, "/api/accounts?status=deleted").length).toBe(
				2,
			);
		});
	});

	it("surfaces the PERMANENT_DELETE_BLOCKED conflict with explanatory copy", async () => {
		const blockedMessage =
			"This account still has transactions or transfers referencing it — restore them, or permanently delete them from trash, before permanently deleting this account";
		const fetchMock = await openTrash({
			"/api/accounts/acc-4": () =>
				jsonResponse(409, {
					error: {
						code: "PERMANENT_DELETE_BLOCKED",
						message: blockedMessage,
						details: [],
					},
				}),
		});

		fireEvent.click(screen.getByRole("button", { name: "Delete forever" }));
		await waitFor(() =>
			expect(screen.getByText(/permanently delete this account/i)).toBeTruthy(),
		);
		fireEvent.change(screen.getByLabelText(/type delete to confirm/i), {
			target: { value: "DELETE" },
		});
		const confirmButton = screen.getByRole("button", {
			name: "Delete forever",
		}) as HTMLButtonElement;
		await waitFor(() => expect(confirmButton.disabled).toBe(false));
		fireEvent.click(confirmButton);

		// The conflict surfaces as a toast with the server's history-preservation
		// copy, and the record stays in trash.
		await waitFor(() => {
			expect(toastError).toHaveBeenCalledWith(blockedMessage);
		});
		expect(toastSuccess).not.toHaveBeenCalled();
		await waitFor(() => {
			expect(callsTo(fetchMock, "/api/accounts/acc-4")).toHaveLength(1);
		});
		expect(screen.getByText("Trashed Bank")).toBeTruthy();
	});

	it("permanently deletes a trashed transaction behind the typed confirmation", async () => {
		const fetchMock = await openTrash({
			"/api/transactions?status=deleted&page=1&pageSize=20": () =>
				jsonResponse(200, {
					transactions: [deletedTransaction],
					page: 1,
					pageSize: 20,
					total: 1,
				}),
		});
		fireEvent.click(screen.getByRole("tab", { name: "Transactions" }));
		await waitFor(() => expect(screen.getByText("2026-01-15")).toBeTruthy());

		fireEvent.click(screen.getByRole("button", { name: "Delete forever" }));
		await waitFor(() =>
			expect(screen.getByText(/permanently delete this transaction/i)).toBeTruthy(),
		);
		fireEvent.change(screen.getByLabelText(/type delete to confirm/i), {
			target: { value: "DELETE" },
		});
		const confirmButton = screen.getByRole("button", {
			name: "Delete forever",
		}) as HTMLButtonElement;
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
});

describe("/trash restore wiring", () => {
	it("restores a trashed account, prompting a new name when taken", async () => {
		let restoreCalls = 0;
		const fetchMock = await openTrash({
			"/api/accounts/acc-4/restore": () => {
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
				return jsonResponse(200, { ...deletedAccount, status: "active" });
			},
		});

		fireEvent.click(screen.getByRole("button", { name: "Restore" }));
		await waitFor(() => {
			const calls = callsTo(fetchMock, "/api/accounts/acc-4/restore");
			expect(calls).toHaveLength(1);
		});
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
			const calls = callsTo(fetchMock, "/api/accounts/acc-4/restore");
			expect(calls).toHaveLength(2);
		});
		const [, secondInit] = callsTo(
			fetchMock,
			"/api/accounts/acc-4/restore",
		)[1] as [string, RequestInit];
		expect(secondInit.body).toBe(JSON.stringify({ newName: "Recovered Bank" }));
	});

	it("restores a trashed category, prompting a new name when taken", async () => {
		let restoreCalls = 0;
		const fetchMock = stubLifecycleApi({
			"/api/categories?status=deleted": () =>
				jsonResponse(200, { categories: [deletedCategory] }),
			"/api/categories/cat-4/restore": () => {
				restoreCalls += 1;
				if (restoreCalls === 1) {
					return jsonResponse(409, {
						error: {
							code: "CATEGORY_NAME_TAKEN",
							message: "A category with this name already exists",
							details: [],
						},
					});
				}
				return jsonResponse(200, { ...deletedCategory, status: "active" });
			},
		});
		await renderRoute(<TrashPage />, "/trash");
		await waitFor(() =>
			expect(screen.getByRole("tab", { name: "Categories" })).toBeTruthy(),
		);
		fireEvent.click(screen.getByRole("tab", { name: "Categories" }));
		await waitFor(() =>
			expect(screen.getByText("Trashed Subscriptions")).toBeTruthy(),
		);

		fireEvent.click(screen.getByRole("button", { name: "Restore" }));
		await waitFor(() => {
			const calls = callsTo(fetchMock, "/api/categories/cat-4/restore");
			expect(calls).toHaveLength(1);
		});
		await waitFor(() =>
			expect(screen.getByText("Choose a new name")).toBeTruthy(),
		);
		fireEvent.change(screen.getByLabelText("New name"), {
			target: { value: "Recovered Subscriptions" },
		});
		fireEvent.click(
			within(screen.getByRole("dialog")).getByRole("button", {
				name: "Restore",
			}),
		);
		await waitFor(() => {
			const calls = callsTo(fetchMock, "/api/categories/cat-4/restore");
			expect(calls).toHaveLength(2);
		});
		const [, secondInit] = callsTo(
			fetchMock,
			"/api/categories/cat-4/restore",
		)[1] as [string, RequestInit];
		expect(secondInit.body).toBe(
			JSON.stringify({ newName: "Recovered Subscriptions" }),
		);
	});

	it("restores a trashed transaction, prompting reassignment on conflict", async () => {
		let restoreCalls = 0;
		const fetchMock = stubLifecycleApi({
			"/api/transactions?status=deleted&page=1&pageSize=20": () =>
				jsonResponse(200, {
					transactions: [deletedTransaction],
					page: 1,
					pageSize: 20,
					total: 1,
				}),
			// The reassignment dialog lists active accounts and categories.
			"/api/accounts?status=active": () =>
				jsonResponse(200, { accounts: [activeAccount], combinedBalanceMinor: 0 }),
			"/api/categories?status=active": () =>
				jsonResponse(200, { categories: [activeCategory] }),
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
				return jsonResponse(200, { ...deletedTransaction, status: "active" });
			},
		});
		await renderRoute(<TrashPage />, "/trash");
		await waitFor(() =>
			expect(screen.getByRole("tab", { name: "Transactions" })).toBeTruthy(),
		);
		fireEvent.click(screen.getByRole("tab", { name: "Transactions" }));
		await waitFor(() => expect(screen.getByText("2026-01-15")).toBeTruthy());

		fireEvent.click(screen.getByRole("button", { name: "Restore" }));
		await waitFor(() => {
			const calls = callsTo(fetchMock, "/api/transactions/txn-4/restore");
			expect(calls).toHaveLength(1);
		});

		// The reassignment prompt opens; submitting with unchanged references
		// retries the restore.
		await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
		fireEvent.click(
			within(screen.getByRole("dialog")).getByRole("button", {
				name: "Restore",
			}),
		);
		await waitFor(() => {
			const calls = callsTo(fetchMock, "/api/transactions/txn-4/restore");
			expect(calls).toHaveLength(2);
		});
	});
});
