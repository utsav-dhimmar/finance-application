import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AccountResponse } from "@finance-application/schemas";
import { AccountsPage } from "@/routes/accounts";
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

const activeAccount = makeAccount({ id: "acc-1", name: "HDFC Bank" });
const walletAccount = makeAccount({
	id: "acc-2",
	name: "Pocket",
	type: "wallet",
	openingBalanceMinor: 30050,
	currentBalanceMinor: 30050,
});
const archivedAccount = makeAccount({
	id: "acc-3",
	name: "Old Bank",
	status: "archived",
	archivedAt: "2026-01-02T00:00:00.000Z",
});
const deletedAccount = makeAccount({
	id: "acc-4",
	name: "Trashed Bank",
	status: "deleted",
	deletedAt: "2026-01-02T00:00:00.000Z",
});

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function listBody(accounts: AccountResponse[], combined: number): unknown {
	return { accounts, combinedBalanceMinor: combined };
}

// Signed-in session by default; tests override the endpoints they exercise.
// Any URL without an override returns 404 so accidental requests are visible.
function stubAccountsApi(
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

describe("/accounts rendering states", () => {
	it("renders the active list with the combined balance", async () => {
		stubAccountsApi({
			"/api/accounts?status=active": () =>
				jsonResponse(200, listBody([activeAccount, walletAccount], 155100)),
		});
		await renderRoute(<AccountsPage />, "/accounts");

		await waitFor(() => expect(screen.getByText("HDFC Bank")).toBeTruthy());
		expect(screen.getByText("Pocket")).toBeTruthy();
		expect(
			screen.getByText(/combined balance across active accounts/i),
		).toBeTruthy();
		expect(screen.getByText("₹1,551.00")).toBeTruthy();
	});

	it("shows the active empty state when there are no accounts", async () => {
		stubAccountsApi({
			"/api/accounts?status=active": () => jsonResponse(200, listBody([], 0)),
		});
		await renderRoute(<AccountsPage />, "/accounts");

		await waitFor(() =>
			expect(screen.getByText(/no accounts yet/i)).toBeTruthy(),
		);
	});

	it("shows an error state with a working retry", async () => {
		const fetchMock = stubAccountsApi({
			"/api/accounts?status=active": () =>
				jsonResponse(500, {
					error: {
						code: "INTERNAL_ERROR",
						message: "Internal server error",
						details: [],
					},
				}),
		});
		await renderRoute(<AccountsPage />, "/accounts");
		await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());

		// Recovery on retry: point the stub at a good response.
		vi.mocked(fetchMock).mockImplementation(async (input) => {
			const url = typeof input === "string" ? input : input.url;
			if (url === "/api/auth/me") {
				return jsonResponse(200, sessionUser);
			}
			if (url === "/api/accounts?status=active") {
				return jsonResponse(200, listBody([activeAccount], 125050));
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
		await waitFor(() => expect(screen.getByText("HDFC Bank")).toBeTruthy());
	});

	it("switches tabs and fetches the matching lifecycle slice", async () => {
		stubAccountsApi({
			"/api/accounts?status=active": () =>
				jsonResponse(200, listBody([activeAccount], 125050)),
			"/api/accounts?status=archived": () =>
				jsonResponse(200, listBody([archivedAccount], 125050)),
		});
		await renderRoute(<AccountsPage />, "/accounts");
		await waitFor(() => expect(screen.getByText("HDFC Bank")).toBeTruthy());

		fireEvent.click(screen.getByRole("tab", { name: "Archived" }));
		await waitFor(() => expect(screen.getByText("Old Bank")).toBeTruthy());
		expect(screen.queryByText("HDFC Bank")).toBeNull();
		// Archived cards offer Restore, not Edit.
		expect(screen.getByRole("button", { name: "Restore" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
	});
});

describe("/accounts create dialog", () => {
	it("validates the name before submitting", async () => {
		stubAccountsApi({
			"/api/accounts?status=active": () => jsonResponse(200, listBody([], 0)),
		});
		await renderRoute(<AccountsPage />, "/accounts");
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "Add account" })).toBeTruthy(),
		);
		fireEvent.click(screen.getByRole("button", { name: "Add account" }));
		await waitFor(() =>
			expect(
				screen.getByText("Add account", { selector: "[role=dialog] h2, h2" }),
			).toBeTruthy(),
		);

		fireEvent.click(screen.getByRole("button", { name: "Create account" }));
		await waitFor(() =>
			expect(screen.getAllByRole("alert").length).toBeGreaterThan(0),
		);
	});

	it("submits a valid create and closes the dialog", async () => {
		const fetchMock = stubAccountsApi({
			"/api/accounts?status=active": () => jsonResponse(200, listBody([], 0)),
			"/api/accounts": () => jsonResponse(201, activeAccount),
		});
		await renderRoute(<AccountsPage />, "/accounts");
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "Add account" })).toBeTruthy(),
		);
		fireEvent.click(screen.getByRole("button", { name: "Add account" }));
		await waitFor(() => expect(screen.getByLabelText("Name")).toBeTruthy());

		fireEvent.change(screen.getByLabelText("Name"), {
			target: { value: "HDFC Bank" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Create account" }));

		await waitFor(() => {
			const calls = callsTo(fetchMock, "/api/accounts");
			expect(calls).toHaveLength(1);
		});
		const [, init] = callsTo(fetchMock, "/api/accounts")[0] as [
			string,
			RequestInit,
		];
		expect(init.method).toBe("POST");
		expect(init.body).toBe(
			JSON.stringify({
				name: "HDFC Bank",
				type: "cash",
				openingBalanceMinor: 0,
			}),
		);
		// The dialog closes after success.
		await waitFor(() => expect(screen.queryByLabelText("Name")).toBeNull());
	});

	it("surfaces a duplicate-name conflict inline", async () => {
		stubAccountsApi({
			"/api/accounts?status=active": () => jsonResponse(200, listBody([], 0)),
			"/api/accounts": () =>
				jsonResponse(409, {
					error: {
						code: "ACCOUNT_NAME_TAKEN",
						message: "An account with this name already exists",
						details: [],
					},
				}),
		});
		await renderRoute(<AccountsPage />, "/accounts");
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "Add account" })).toBeTruthy(),
		);
		fireEvent.click(screen.getByRole("button", { name: "Add account" }));
		await waitFor(() => expect(screen.getByLabelText("Name")).toBeTruthy());
		fireEvent.change(screen.getByLabelText("Name"), {
			target: { value: "HDFC Bank" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Create account" }));
		await waitFor(() =>
			expect(
				screen
					.getAllByRole("alert")
					.some((alert) => /already exists/i.test(alert.textContent ?? "")),
			).toBe(true),
		);
	});
});

describe("/accounts edit dialog", () => {
	it("prefills the account and patches on save", async () => {
		const fetchMock = stubAccountsApi({
			"/api/accounts?status=active": () =>
				jsonResponse(200, listBody([activeAccount], 125050)),
			"/api/accounts/acc-1": () => jsonResponse(200, activeAccount),
		});
		await renderRoute(<AccountsPage />, "/accounts");
		await waitFor(() => expect(screen.getByText("HDFC Bank")).toBeTruthy());
		fireEvent.click(screen.getByRole("button", { name: "Edit" }));
		await waitFor(() => expect(screen.getByLabelText("Name")).toBeTruthy());
		const nameInput = screen.getByLabelText("Name") as HTMLInputElement;
		expect(nameInput.value).toBe("HDFC Bank");

		fireEvent.change(nameInput, { target: { value: "Renamed Bank" } });
		fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
		await waitFor(() => {
			const calls = callsTo(fetchMock, "/api/accounts/acc-1");
			expect(calls).toHaveLength(1);
		});
		const [, init] = callsTo(fetchMock, "/api/accounts/acc-1")[0] as [
			string,
			RequestInit,
		];
		expect(init.method).toBe("PATCH");
		expect(init.body).toContain('"name":"Renamed Bank"');
	});

	it("surfaces the field-lock 409 inline", async () => {
		stubAccountsApi({
			"/api/accounts?status=active": () =>
				jsonResponse(200, listBody([activeAccount], 125050)),
			"/api/accounts/acc-1": () =>
				jsonResponse(409, {
					error: {
						code: "ACCOUNT_FIELD_LOCKED",
						message:
							"Opening balance and account type can no longer be changed",
						details: [],
					},
				}),
		});
		await renderRoute(<AccountsPage />, "/accounts");
		await waitFor(() => expect(screen.getByText("HDFC Bank")).toBeTruthy());
		fireEvent.click(screen.getByRole("button", { name: "Edit" }));
		await waitFor(() => expect(screen.getByLabelText("Name")).toBeTruthy());
		fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
		await waitFor(() =>
			expect(
				screen
					.getAllByRole("alert")
					.some((alert) =>
						/no longer be changed/i.test(alert.textContent ?? ""),
					),
			).toBe(true),
		);
	});
});

describe("/accounts lifecycle actions", () => {
	async function openWithSingleAccount(
		overrides: Record<string, () => Response> = {},
	) {
		const fetchMock = stubAccountsApi({
			"/api/accounts?status=active": () =>
				jsonResponse(200, listBody([activeAccount], 125050)),
			...overrides,
		});
		await renderRoute(<AccountsPage />, "/accounts");
		await waitFor(() => expect(screen.getByText("HDFC Bank")).toBeTruthy());
		return fetchMock;
	}

	it("archives after confirmation and supports cancel", async () => {
		const fetchMock = await openWithSingleAccount({
			"/api/accounts/acc-1/archive": () =>
				jsonResponse(200, {
					...activeAccount,
					status: "archived",
				}),
		});

		fireEvent.click(screen.getByRole("button", { name: "Archive" }));
		const dialog = await waitFor(() =>
			screen.getByText(/archive "hdfc bank"\?/i),
		);
		expect(dialog).toBeTruthy();

		// Cancel keeps the account untouched.
		fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
		await waitFor(() =>
			expect(screen.queryByText(/archive "hdfc bank"\?/i)).toBeNull(),
		);
		expect(callsTo(fetchMock, "/api/accounts/acc-1/archive")).toHaveLength(0);

		// Confirming calls the archive endpoint.
		fireEvent.click(screen.getByRole("button", { name: "Archive" }));
		await waitFor(() =>
			expect(screen.getByText(/archive "hdfc bank"\?/i)).toBeTruthy(),
		);
		fireEvent.click(screen.getByRole("button", { name: "Archive account" }));
		await waitFor(() =>
			expect(callsTo(fetchMock, "/api/accounts/acc-1/archive")).toHaveLength(1),
		);
	});

	it("deletes after confirmation", async () => {
		const fetchMock = await openWithSingleAccount({
			"/api/accounts/acc-1/delete": () =>
				jsonResponse(200, {
					...activeAccount,
					status: "deleted",
				}),
		});
		fireEvent.click(screen.getByRole("button", { name: "Delete" }));
		await waitFor(() =>
			expect(screen.getByText(/delete "hdfc bank"\?/i)).toBeTruthy(),
		);
		fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
		await waitFor(() =>
			expect(callsTo(fetchMock, "/api/accounts/acc-1/delete")).toHaveLength(1),
		);
	});

	it("restores, prompting for a new name when the name was taken", async () => {
		let restoreCalls = 0;
		const fetchMock = stubAccountsApi({
			"/api/accounts?status=active": () => jsonResponse(200, listBody([], 0)),
			"/api/accounts?status=deleted": () =>
				jsonResponse(200, listBody([deletedAccount], 0)),
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
		await renderRoute(<AccountsPage />, "/accounts");
		// Wait for the page to render (session loaded) before switching tabs.
		await waitFor(() =>
			expect(screen.getByRole("tab", { name: "Trash" })).toBeTruthy(),
		);
		fireEvent.click(screen.getByRole("tab", { name: "Trash" }));
		await waitFor(() => expect(screen.getByText("Trashed Bank")).toBeTruthy());

		fireEvent.click(screen.getByRole("button", { name: "Restore" }));
		await waitFor(() => {
			const calls = callsTo(fetchMock, "/api/accounts/acc-4/restore");
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
			const calls = callsTo(fetchMock, "/api/accounts/acc-4/restore");
			expect(calls).toHaveLength(2);
		});
		const [, secondInit] = callsTo(
			fetchMock,
			"/api/accounts/acc-4/restore",
		)[1] as [string, RequestInit];
		expect(secondInit.body).toBe(JSON.stringify({ newName: "Recovered Bank" }));
	});
});
