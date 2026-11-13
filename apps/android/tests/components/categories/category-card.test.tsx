import { render } from "@testing-library/react-native";
import type { CategoryResponse } from "@finance-application/schemas";
import { describe, expect, it, vi } from "vitest";

import { CategoryCard } from "@/components/categories/category-card";

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

function renderCard(overrides: Partial<CategoryResponse> = {}) {
	return render(
		<CategoryCard
			category={{ ...category, ...overrides }}
			onEdit={vi.fn()}
			onArchive={vi.fn()}
			onDelete={vi.fn()}
			onRestore={vi.fn()}
		/>,
	);
}

describe("CategoryCard", () => {
	it("renders an active category with name, type, color swatch, and icon", async () => {
		const view = await renderCard();
		expect(view.getByText("Groceries")).toBeOnTheScreen();
		expect(view.getByText("Expense")).toBeOnTheScreen();
		expect(view.getByTestId("category-color-swatch")).toBeOnTheScreen();
		expect(view.getByText("icon: shopping-cart")).toBeOnTheScreen();
		expect(view.getByRole("button", { name: "Edit" })).toBeOnTheScreen();
		expect(view.getByRole("button", { name: "Archive" })).toBeOnTheScreen();
		expect(view.getByRole("button", { name: "Delete" })).toBeOnTheScreen();
		expect(view.queryByRole("button", { name: "Restore" })).toBeNull();
	});

	it("omits the swatch and icon line when unset", async () => {
		const view = await renderCard({ color: null, icon: null });
		expect(view.queryByTestId("category-color-swatch")).toBeNull();
		expect(view.queryByText(/icon: /)).toBeNull();
	});

	it("marks archived categories and offers restore instead of edits", async () => {
		const view = await renderCard({ status: "archived" });
		expect(view.getByText("Archived")).toBeOnTheScreen();
		expect(view.queryByRole("button", { name: "Edit" })).toBeNull();
		expect(view.getByRole("button", { name: "Restore" })).toBeOnTheScreen();
	});

	it("marks deleted categories and offers restore", async () => {
		const view = await renderCard({ status: "deleted" });
		expect(view.getByText("Deleted")).toBeOnTheScreen();
		expect(view.getByRole("button", { name: "Restore" })).toBeOnTheScreen();
	});
});
