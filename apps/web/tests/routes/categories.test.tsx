import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CategoryResponse } from "@finance-application/schemas";
import { CategoriesPage } from "@/routes/categories";
import { renderRoute } from "./helpers";

const sessionUser = { id: "u1", email: "user@example.com" };

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

const expenseCategory = makeCategory({ id: "cat-1", name: "Groceries" });
const incomeCategory = makeCategory({
	id: "cat-2",
	name: "Salary",
	type: "income",
	color: "#22C55E",
	icon: "briefcase",
});
const archivedCategory = makeCategory({
	id: "cat-3",
	name: "Old Category",
	status: "archived",
	archivedAt: "2026-01-02T00:00:00.000Z",
});
const deletedCategory = makeCategory({
	id: "cat-4",
	name: "Trashed Category",
	status: "deleted",
	deletedAt: "2026-01-02T00:00:00.000Z",
});

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function listBody(categories: CategoryResponse[]): unknown {
	return { categories };
}

// Signed-in session by default; tests override the endpoints they exercise.
// Any URL without an override returns 404 so accidental requests are visible.
function stubCategoriesApi(
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

describe("/categories rendering states", () => {
	it("renders the active list with type badges and presentation values", async () => {
		stubCategoriesApi({
			"/api/categories?status=active": () =>
				jsonResponse(200, listBody([expenseCategory, incomeCategory])),
		});
		await renderRoute(<CategoriesPage />, "/categories");

		await waitFor(() => expect(screen.getByText("Groceries")).toBeTruthy());
		expect(screen.getByText("Salary")).toBeTruthy();
		expect(screen.getAllByText("Expense").length).toBeGreaterThan(0);
		expect(screen.getByText("Income")).toBeTruthy();
		expect(screen.getByText(/icon: briefcase/i)).toBeTruthy();
	});

	it("shows the active empty state when there are no categories", async () => {
		stubCategoriesApi({
			"/api/categories?status=active": () => jsonResponse(200, listBody([])),
		});
		await renderRoute(<CategoriesPage />, "/categories");

		await waitFor(() =>
			expect(screen.getByText(/no categories yet/i)).toBeTruthy(),
		);
	});

	it("shows an error state with a working retry", async () => {
		const fetchMock = stubCategoriesApi({
			"/api/categories?status=active": () =>
				jsonResponse(500, {
					error: {
						code: "INTERNAL_ERROR",
						message: "Internal server error",
						details: [],
					},
				}),
		});
		await renderRoute(<CategoriesPage />, "/categories");
		await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());

		// Recovery on retry: point the stub at a good response.
		vi.mocked(fetchMock).mockImplementation(async (input) => {
			const url = typeof input === "string" ? input : input.url;
			if (url === "/api/auth/me") {
				return jsonResponse(200, sessionUser);
			}
			if (url === "/api/categories?status=active") {
				return jsonResponse(200, listBody([expenseCategory]));
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
		await waitFor(() => expect(screen.getByText("Groceries")).toBeTruthy());
	});

	it("switches tabs and fetches the matching lifecycle slice", async () => {
		stubCategoriesApi({
			"/api/categories?status=active": () =>
				jsonResponse(200, listBody([expenseCategory])),
			"/api/categories?status=archived": () =>
				jsonResponse(200, listBody([archivedCategory])),
		});
		await renderRoute(<CategoriesPage />, "/categories");
		await waitFor(() => expect(screen.getByText("Groceries")).toBeTruthy());

		fireEvent.click(screen.getByRole("tab", { name: "Archived" }));
		await waitFor(() => expect(screen.getByText("Old Category")).toBeTruthy());
		expect(screen.queryByText("Groceries")).toBeNull();
		// Archived cards offer Restore, not Edit.
		expect(screen.getByRole("button", { name: "Restore" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
	});
});

describe("/categories create dialog", () => {
	it("validates the name before submitting", async () => {
		stubCategoriesApi({
			"/api/categories?status=active": () => jsonResponse(200, listBody([])),
		});
		await renderRoute(<CategoriesPage />, "/categories");
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "Add category" })).toBeTruthy(),
		);
		fireEvent.click(screen.getByRole("button", { name: "Add category" }));
		await waitFor(() =>
			expect(
				screen.getByText("Add category", { selector: "[role=dialog] h2, h2" }),
			).toBeTruthy(),
		);

		fireEvent.click(screen.getByRole("button", { name: "Create category" }));
		await waitFor(() =>
			expect(screen.getAllByRole("alert").length).toBeGreaterThan(0),
		);
	});

	it("submits a valid create without presentation values and closes the dialog", async () => {
		const fetchMock = stubCategoriesApi({
			"/api/categories?status=active": () => jsonResponse(200, listBody([])),
			"/api/categories": () => jsonResponse(201, expenseCategory),
		});
		await renderRoute(<CategoriesPage />, "/categories");
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "Add category" })).toBeTruthy(),
		);
		fireEvent.click(screen.getByRole("button", { name: "Add category" }));
		await waitFor(() => expect(screen.getByLabelText("Name")).toBeTruthy());

		fireEvent.change(screen.getByLabelText("Name"), {
			target: { value: "Groceries" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Create category" }));

		await waitFor(() => {
			const calls = callsTo(fetchMock, "/api/categories").filter(
				([, init]) => init?.method === "POST",
			);
			expect(calls).toHaveLength(1);
		});
		const postCalls = callsTo(fetchMock, "/api/categories").filter(
			([, init]) => init?.method === "POST",
		);
		const [, init] = postCalls[0] as [string, RequestInit];
		expect(init.body).toBe(
			JSON.stringify({ name: "Groceries", type: "expense" }),
		);
		// The dialog closes after success.
		await waitFor(() => expect(screen.queryByLabelText("Name")).toBeNull());
	});

	it("submits presentation values when provided", async () => {
		const fetchMock = stubCategoriesApi({
			"/api/categories?status=active": () => jsonResponse(200, listBody([])),
			"/api/categories": () => jsonResponse(201, incomeCategory),
		});
		await renderRoute(<CategoriesPage />, "/categories");
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "Add category" })).toBeTruthy(),
		);
		fireEvent.click(screen.getByRole("button", { name: "Add category" }));
		await waitFor(() => expect(screen.getByLabelText("Name")).toBeTruthy());
		fireEvent.change(screen.getByLabelText("Name"), {
			target: { value: "Salary" },
		});
		fireEvent.change(screen.getByLabelText(/color \(optional\)/i), {
			target: { value: "#22C55E" },
		});
		fireEvent.change(screen.getByLabelText(/icon \(optional\)/i), {
			target: { value: "briefcase" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Create category" }));

		await waitFor(() => {
			const postCalls = callsTo(fetchMock, "/api/categories").filter(
				([, init]) => init?.method === "POST",
			);
			expect(postCalls).toHaveLength(1);
		});
		const postCalls = callsTo(fetchMock, "/api/categories").filter(
			([, init]) => init?.method === "POST",
		);
		const [, init] = postCalls[0] as [string, RequestInit];
		expect(init.body).toBe(
			JSON.stringify({
				name: "Salary",
				type: "expense",
				color: "#22C55E",
				icon: "briefcase",
			}),
		);
	});

	it("surfaces a duplicate-name conflict inline", async () => {
		stubCategoriesApi({
			"/api/categories?status=active": () => jsonResponse(200, listBody([])),
			"/api/categories": () =>
				jsonResponse(409, {
					error: {
						code: "CATEGORY_NAME_TAKEN",
						message: "A category with this name already exists",
						details: [],
					},
				}),
		});
		await renderRoute(<CategoriesPage />, "/categories");
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "Add category" })).toBeTruthy(),
		);
		fireEvent.click(screen.getByRole("button", { name: "Add category" }));
		await waitFor(() => expect(screen.getByLabelText("Name")).toBeTruthy());
		fireEvent.change(screen.getByLabelText("Name"), {
			target: { value: "Groceries" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Create category" }));
		await waitFor(() =>
			expect(
				screen
					.getAllByRole("alert")
					.some((alert) => /already exists/i.test(alert.textContent ?? "")),
			).toBe(true),
		);
	});
});

describe("/categories edit dialog", () => {
	it("prefills the category and patches on save", async () => {
		const fetchMock = stubCategoriesApi({
			"/api/categories?status=active": () =>
				jsonResponse(200, listBody([expenseCategory])),
			"/api/categories/cat-1": () => jsonResponse(200, expenseCategory),
		});
		await renderRoute(<CategoriesPage />, "/categories");
		await waitFor(() => expect(screen.getByText("Groceries")).toBeTruthy());
		fireEvent.click(screen.getByRole("button", { name: "Edit" }));
		await waitFor(() => expect(screen.getByLabelText("Name")).toBeTruthy());
		const nameInput = screen.getByLabelText("Name") as HTMLInputElement;
		expect(nameInput.value).toBe("Groceries");

		fireEvent.change(nameInput, { target: { value: "Food" } });
		fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
		await waitFor(() => {
			const calls = callsTo(fetchMock, "/api/categories/cat-1");
			expect(calls).toHaveLength(1);
		});
		const [, init] = callsTo(fetchMock, "/api/categories/cat-1")[0] as [
			string,
			RequestInit,
		];
		expect(init.method).toBe("PATCH");
		expect(init.body).toContain('"name":"Food"');
	});

	it("clears presentation values by submitting null on empty fields", async () => {
		const fetchMock = stubCategoriesApi({
			"/api/categories?status=active": () =>
				jsonResponse(200, listBody([incomeCategory])),
			"/api/categories/cat-2": () => jsonResponse(200, incomeCategory),
		});
		await renderRoute(<CategoriesPage />, "/categories");
		await waitFor(() => expect(screen.getByText("Salary")).toBeTruthy());
		fireEvent.click(screen.getByRole("button", { name: "Edit" }));
		await waitFor(() => expect(screen.getByLabelText("Name")).toBeTruthy());
		// The form prefills the stored values; emptying them clears on save.
		fireEvent.change(screen.getByLabelText(/color \(#rrggbb\)/i), {
			target: { value: "" },
		});
		fireEvent.change(screen.getByLabelText(/^icon$/i), {
			target: { value: "" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
		await waitFor(() => {
			const calls = callsTo(fetchMock, "/api/categories/cat-2");
			expect(calls).toHaveLength(1);
		});
		const [, init] = callsTo(fetchMock, "/api/categories/cat-2")[0] as [
			string,
			RequestInit,
		];
		expect(init.body).toBe(
			JSON.stringify({ name: "Salary", type: "income", color: null, icon: null }),
		);
	});

	it("surfaces the type-lock 409 inline", async () => {
		stubCategoriesApi({
			"/api/categories?status=active": () =>
				jsonResponse(200, listBody([expenseCategory])),
			"/api/categories/cat-1": () =>
				jsonResponse(409, {
					error: {
						code: "CATEGORY_TYPE_LOCKED",
						message: "The category type can no longer be changed",
						details: [],
					},
				}),
		});
		await renderRoute(<CategoriesPage />, "/categories");
		await waitFor(() => expect(screen.getByText("Groceries")).toBeTruthy());
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

describe("/categories lifecycle actions", () => {
	async function openWithSingleCategory(
		overrides: Record<string, () => Response> = {},
	) {
		const fetchMock = stubCategoriesApi({
			"/api/categories?status=active": () =>
				jsonResponse(200, listBody([expenseCategory])),
			...overrides,
		});
		await renderRoute(<CategoriesPage />, "/categories");
		await waitFor(() => expect(screen.getByText("Groceries")).toBeTruthy());
		return fetchMock;
	}

	it("archives after confirmation and supports cancel", async () => {
		const fetchMock = await openWithSingleCategory({
			"/api/categories/cat-1/archive": () =>
				jsonResponse(200, {
					...expenseCategory,
					status: "archived",
				}),
		});

		fireEvent.click(screen.getByRole("button", { name: "Archive" }));
		const dialog = await waitFor(() =>
			screen.getByText(/archive "groceries"\?/i),
		);
		expect(dialog).toBeTruthy();

		// Cancel keeps the category untouched.
		fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
		await waitFor(() =>
			expect(screen.queryByText(/archive "groceries"\?/i)).toBeNull(),
		);
		expect(callsTo(fetchMock, "/api/categories/cat-1/archive")).toHaveLength(0);

		// Confirming calls the archive endpoint.
		fireEvent.click(screen.getByRole("button", { name: "Archive" }));
		await waitFor(() =>
			expect(screen.getByText(/archive "groceries"\?/i)).toBeTruthy(),
		);
		fireEvent.click(screen.getByRole("button", { name: "Archive category" }));
		await waitFor(() =>
			expect(
				callsTo(fetchMock, "/api/categories/cat-1/archive"),
			).toHaveLength(1),
		);
	});

	it("deletes after confirmation", async () => {
		const fetchMock = await openWithSingleCategory({
			"/api/categories/cat-1/delete": () =>
				jsonResponse(200, {
					...expenseCategory,
					status: "deleted",
				}),
		});
		fireEvent.click(screen.getByRole("button", { name: "Delete" }));
		await waitFor(() =>
			expect(screen.getByText(/delete "groceries"\?/i)).toBeTruthy(),
		);
		fireEvent.click(screen.getByRole("button", { name: "Delete category" }));
		await waitFor(() =>
			expect(callsTo(fetchMock, "/api/categories/cat-1/delete")).toHaveLength(1),
		);
	});

	it("restores, prompting for a new name when the name was taken", async () => {
		let restoreCalls = 0;
		const fetchMock = stubCategoriesApi({
			"/api/categories?status=active": () => jsonResponse(200, listBody([])),
			"/api/categories?status=deleted": () =>
				jsonResponse(200, listBody([deletedCategory])),
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
		await renderRoute(<CategoriesPage />, "/categories");
		// Wait for the page to render (session loaded) before switching tabs.
		await waitFor(() =>
			expect(screen.getByRole("tab", { name: "Trash" })).toBeTruthy(),
		);
		fireEvent.click(screen.getByRole("tab", { name: "Trash" }));
		await waitFor(() => expect(screen.getByText("Trashed Category")).toBeTruthy());

		fireEvent.click(screen.getByRole("button", { name: "Restore" }));
		await waitFor(() => {
			const calls = callsTo(fetchMock, "/api/categories/cat-4/restore");
			expect(calls).toHaveLength(1);
		});

		// The conflict opens the rename prompt.
		await waitFor(() =>
			expect(screen.getByText("Choose a new name")).toBeTruthy(),
		);
		fireEvent.change(screen.getByLabelText("New name"), {
			target: { value: "Recovered Category" },
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
			JSON.stringify({ newName: "Recovered Category" }),
		);
	});
});
