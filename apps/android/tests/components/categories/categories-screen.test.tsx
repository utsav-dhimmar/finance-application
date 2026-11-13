import { fireEvent, waitFor } from "@testing-library/react-native";
import {
	categoryFormSchema,
	type CategoryResponse,
} from "@finance-application/schemas";

import { toast } from "sonner-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CategoriesScreen from "@/app/(app)/categories";
import { CategoryFormDialog } from "@/components/categories/category-form-dialog";
import { jsonResponse } from "@/session/fetch-mock";
import { renderWithProviders } from "../../helpers";
import { makeRegisteredMachine } from "../../services/helpers";

vi.mock("sonner-native", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

const category: CategoryResponse = {
	id: "cat-1",
	name: "Groceries",
	type: "expense",
	color: "#22C55E",
	icon: "shopping-cart",
	status: "active",
	archivedAt: null,
	deletedAt: null,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

const deletedCategory: CategoryResponse = {
	...category,
	name: "Old Salary",
	id: "cat-2",
	type: "income",
	color: null,
	icon: null,
	status: "deleted",
};

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

function nameSchemaMessage(values: Record<string, string>): string {
	const result = categoryFormSchema.safeParse(values);
	expect(result.success).toBe(false);
	return (
		result.error?.issues.find((issue) => issue.path.includes("name"))
			?.message ?? ""
	);
}

describe("CategoriesScreen", () => {
	beforeEach(() => {
		vi.mocked(toast.success).mockClear();
		vi.mocked(toast.error).mockClear();
	});

	it("lists active categories with their fields", async () => {
		makeRegisteredMachine({
			"GET /api/categories": () =>
				jsonResponse(200, { categories: [category] }),
		});
		const { view } = await renderWithProviders(<CategoriesScreen />);
		await waitFor(() => expect(view.getByText("Groceries")).toBeOnTheScreen(), {
			timeout: 10_000,
		});
		expect(view.getByText("Expense")).toBeOnTheScreen();
		expect(view.getByTestId("category-color-swatch")).toBeOnTheScreen();
		expect(view.getByText("icon: shopping-cart")).toBeOnTheScreen();
		expect(
			view.getByText("Organize income and expenses across all your accounts."),
		).toBeOnTheScreen();
	});

	it("shows the empty-state message for the selected tab", async () => {
		makeRegisteredMachine({
			"GET /api/categories": () => jsonResponse(200, { categories: [] }),
		});
		const { view } = await renderWithProviders(<CategoriesScreen />);
		await waitFor(
			() =>
				expect(
					view.getByText(
						"No categories yet. Add your first category to organize transactions.",
					),
				).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		expect(
			view.getByRole("button", { name: "Add your first category" }),
		).toBeOnTheScreen();
		await fireEvent.press(view.getByRole("tab", { name: "Trash" }));
		await waitFor(
			() => expect(view.getByText("Trash is empty.")).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
	});

	it("creates a category with the schema's parsed values", async () => {
		const { fetchMock } = makeRegisteredMachine({
			"GET /api/categories": () => jsonResponse(200, { categories: [] }),
			"POST /api/categories": () => jsonResponse(201, category),
		});
		const { view } = await renderWithProviders(<CategoriesScreen />);
		await waitFor(
			() =>
				expect(
					view.getByRole("button", { name: "Add category" }),
				).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		await fireEvent.press(view.getByRole("button", { name: "Add category" }));
		await waitFor(() =>
			expect(
				view.getByText("Organize income and expenses. Names must be unique."),
			).toBeOnTheScreen(),
		);
		await fireEvent.changeText(
			view.getByLabelText("Category name"),
			"Groceries",
		);
		await fireEvent.changeText(
			view.getByLabelText("Category color"),
			"#22C55E",
		);
		await fireEvent.changeText(
			view.getByLabelText("Category icon"),
			"shopping-cart",
		);
		await fireEvent.press(
			view.getByRole("button", { name: "Create category" }),
		);
		await waitFor(() => {
			expect(findCall(fetchMock, "POST", "/api/categories")).toBeDefined();
		});
		const call = findCall(fetchMock, "POST", "/api/categories");
		expect(JSON.parse(String((call?.[1] as RequestInit)?.body))).toEqual({
			name: "Groceries",
			type: "expense",
			color: "#22C55E",
			icon: "shopping-cart",
		});
		// The dialog closes after the create succeeds.
		await waitFor(() =>
			expect(
				view.queryByText("Organize income and expenses. Names must be unique."),
			).toBeNull(),
		);
		expect(toast.success).toHaveBeenCalledWith("Category created.");
	});

	it("blocks submission and shows the schema message for an invalid form", async () => {
		const { fetchMock } = makeRegisteredMachine({
			"GET /api/categories": () => jsonResponse(200, { categories: [] }),
		});
		const { view } = await renderWithProviders(<CategoriesScreen />);
		await waitFor(
			() =>
				expect(
					view.getByRole("button", { name: "Add category" }),
				).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		await fireEvent.press(view.getByRole("button", { name: "Add category" }));
		await waitFor(() =>
			expect(
				view.getByText("Organize income and expenses. Names must be unique."),
			).toBeOnTheScreen(),
		);
		await fireEvent.press(
			view.getByRole("button", { name: "Create category" }),
		);
		await waitFor(
			() =>
				expect(
					view.getByText(
						nameSchemaMessage({
							name: "",
							type: "expense",
							color: "",
							icon: "",
						}),
					),
				).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		expect(
			fetchMock.mock.calls.some(
				([, init]) => (init as RequestInit | undefined)?.method === "POST",
			),
		).toBe(false);
	});

	it("archives through the confirmation dialog", async () => {
		const { fetchMock } = makeRegisteredMachine({
			"GET /api/categories": () =>
				jsonResponse(200, { categories: [category] }),
			"POST /api/categories/cat-1/archive": () => jsonResponse(200, category),
		});
		const { view } = await renderWithProviders(<CategoriesScreen />);
		await waitFor(
			() =>
				expect(view.getByRole("button", { name: "Archive" })).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		await fireEvent.press(view.getByRole("button", { name: "Archive" }));
		await waitFor(() =>
			expect(view.getByText('Archive "Groceries"?')).toBeOnTheScreen(),
		);
		expect(
			view.getByText(
				"Archived categories leave lists and transaction selection but keep their history. You can restore this category from the Archived tab.",
			),
		).toBeOnTheScreen();
		await fireEvent.press(
			view.getByRole("button", { name: "Archive category" }),
		);
		await waitFor(() => {
			expect(
				findCall(fetchMock, "POST", "/api/categories/cat-1/archive"),
			).toBeDefined();
		});
		await waitFor(() =>
			expect(view.queryByText('Archive "Groceries"?')).toBeNull(),
		);
		expect(toast.success).toHaveBeenCalledWith("Category archived.");
	});

	it("deletes through the confirmation dialog", async () => {
		const { fetchMock } = makeRegisteredMachine({
			"GET /api/categories": () =>
				jsonResponse(200, { categories: [category] }),
			"POST /api/categories/cat-1/delete": () => jsonResponse(200, category),
		});
		const { view } = await renderWithProviders(<CategoriesScreen />);
		await waitFor(
			() =>
				expect(view.getByRole("button", { name: "Delete" })).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		await fireEvent.press(view.getByRole("button", { name: "Delete" }));
		await waitFor(() =>
			expect(view.getByText('Delete "Groceries"?')).toBeOnTheScreen(),
		);
		await fireEvent.press(
			view.getByRole("button", { name: "Delete category" }),
		);
		await waitFor(() => {
			expect(
				findCall(fetchMock, "POST", "/api/categories/cat-1/delete"),
			).toBeDefined();
		});
		await waitFor(() =>
			expect(view.queryByText('Delete "Groceries"?')).toBeNull(),
		);
		expect(toast.success).toHaveBeenCalledWith("Category moved to trash.");
	});

	it("restores under a new name when the name conflicts", async () => {
		let restoreCalls = 0;
		const { fetchMock } = makeRegisteredMachine({
			"GET /api/categories": () =>
				jsonResponse(200, { categories: [deletedCategory] }),
			"POST /api/categories/cat-2/restore": (init?: RequestInit) => {
				restoreCalls += 1;
				const body = JSON.parse(String(init?.body ?? "{}")) as {
					newName?: string;
				};
				if (body.newName === undefined) {
					return jsonResponse(409, {
						error: {
							code: "CATEGORY_NAME_TAKEN",
							message: "category name taken",
							details: [],
						},
					});
				}
				return jsonResponse(200, {
					...deletedCategory,
					name: body.newName,
					status: "active",
				});
			},
		});
		const { view } = await renderWithProviders(<CategoriesScreen />);
		await waitFor(
			() =>
				expect(view.getByRole("button", { name: "Restore" })).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		await fireEvent.press(view.getByRole("button", { name: "Restore" }));
		// The conflict opens the rename prompt prefilled with the old name.
		await waitFor(
			() => expect(view.getByText("Choose a new name")).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		expect(
			view.getByText(
				'Another category already uses "Old Salary". Restore with a new name.',
			),
		).toBeOnTheScreen();
		expect(view.getByLabelText("New name").props.value).toBe("Old Salary");
		await fireEvent.changeText(view.getByLabelText("New name"), "New Salary");
		await fireEvent.press(
			view.getByRole("button", { name: "Restore with new name" }),
		);
		await waitFor(() => expect(restoreCalls).toBe(2), { timeout: 10_000 });
		const retry = fetchMock.mock.calls.find(([, init]) =>
			String((init as RequestInit | undefined)?.body ?? "").includes("newName"),
		);
		expect(retry).toBeDefined();
		expect(JSON.parse(String((retry?.[1] as RequestInit)?.body))).toEqual({
			newName: "New Salary",
		});
		// Success closes the rename prompt.
		await waitFor(() =>
			expect(view.queryByText("Choose a new name")).toBeNull(),
		);
		expect(toast.success).toHaveBeenCalledWith("Category restored.");
	});
});

describe("CategoryFormDialog (edit mode)", () => {
	beforeEach(() => {
		vi.mocked(toast.success).mockClear();
		vi.mocked(toast.error).mockClear();
	});

	it("prefills values and clears empty color and icon on save", async () => {
		const { fetchMock } = makeRegisteredMachine({
			"PATCH /api/categories/cat-1": () => jsonResponse(200, category),
		});
		const onOpenChange = vi.fn();
		const { view } = await renderWithProviders(
			<CategoryFormDialog
				open
				category={category}
				onOpenChange={onOpenChange}
			/>,
		);
		await waitFor(
			() =>
				expect(view.getByLabelText("Category name").props.value).toBe(
					"Groceries",
				),
			{ timeout: 10_000 },
		);
		expect(view.getByLabelText("Category color").props.value).toBe("#22C55E");
		expect(view.getByText('Edit "Groceries"')).toBeOnTheScreen();
		await fireEvent.changeText(view.getByLabelText("Category color"), "");
		await fireEvent.changeText(view.getByLabelText("Category icon"), "");
		await fireEvent.press(view.getByRole("button", { name: "Save changes" }));
		await waitFor(() => {
			expect(
				findCall(fetchMock, "PATCH", "/api/categories/cat-1"),
			).toBeDefined();
		});
		const call = findCall(fetchMock, "PATCH", "/api/categories/cat-1");
		// Empty presentation fields are sent as null to clear them.
		expect(JSON.parse(String((call?.[1] as RequestInit)?.body))).toEqual({
			name: "Groceries",
			type: "expense",
			color: null,
			icon: null,
		});
		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
	});
});
