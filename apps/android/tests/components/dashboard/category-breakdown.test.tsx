import { render } from "@testing-library/react-native";
import type { CategoryBreakdownItem } from "@finance-application/schemas";
import { describe, expect, it } from "vitest";

import { CategoryBreakdown } from "@/components/dashboard/category-breakdown";
import { INR_DISPLAY } from "@/lib/format";

const breakdown: CategoryBreakdownItem[] = [
	{
		categoryId: "cat-1",
		categoryName: "Groceries",
		amountMinor: 200000,
		sharePercent: 61.54,
	},
	{
		categoryId: "cat-2",
		categoryName: null, // permanently deleted from trash
		amountMinor: 100000,
		sharePercent: 30.77,
	},
	{
		categoryId: "cat-3",
		categoryName: "Transport",
		amountMinor: 25000,
		sharePercent: 7.69,
	},
];

function renderBreakdown(items: CategoryBreakdownItem[] = breakdown) {
	return render(
		<CategoryBreakdown
			breakdown={items}
			display={INR_DISPLAY}
			periodLabelText="January 2026"
		/>,
	);
}

describe("CategoryBreakdown", () => {
	it("renders rows largest first with amounts and section copy", async () => {
		const view = await renderBreakdown();
		expect(view.getByText("Expenses by category")).toBeOnTheScreen();
		expect(
			view.getByText("Category shares of expenses in January 2026"),
		).toBeOnTheScreen();
		// The fixture is largest-first; the render order matches it.
		const names = view.getAllByText(/Groceries|Unavailable|Transport/, {
			exact: false,
		});
		expect(names.map((node) => node.props.children)).toEqual([
			"Groceries",
			"Unavailable",
			"Transport",
		]);
		expect(view.getByText("₹2,000.00")).toBeOnTheScreen();
		expect(view.getByText("₹1,000.00")).toBeOnTheScreen();
		expect(view.getByText("₹250.00")).toBeOnTheScreen();
	});

	it("falls back to a generic name for a deleted category", async () => {
		const view = await renderBreakdown();
		expect(view.getByText("Unavailable")).toBeOnTheScreen();
	});

	it("sizes bars by share percent, clamped to 0–100", async () => {
		const view = await renderBreakdown([
			{
				categoryId: "cat-full",
				categoryName: "Everything",
				amountMinor: 100000,
				sharePercent: 100,
			},
			{
				categoryId: "cat-zero",
				categoryName: "Nothing",
				amountMinor: 0,
				sharePercent: 0,
			},
			{
				categoryId: "cat-over",
				categoryName: "Over",
				amountMinor: 100000,
				// A pathological share cannot push the bar past its track.
				sharePercent: 150,
			},
		]);
		const widthOf = (id: string): string => {
			const fill = view.getByTestId(`breakdown-fill-${id}`);
			const style = Array.isArray(fill.props.style)
				? fill.props.style.find(
						(s: { width?: string } | undefined) =>
							s !== undefined && s.width !== undefined,
					)
				: fill.props.style;
			return String((style as { width?: string } | undefined)?.width);
		};
		expect(widthOf("cat-full")).toBe("100%");
		expect(widthOf("cat-zero")).toBe("0%");
		expect(widthOf("cat-over")).toBe("100%");
	});
});
