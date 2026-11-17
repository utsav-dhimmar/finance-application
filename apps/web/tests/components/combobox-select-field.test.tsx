import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	ComboboxSelectField,
	type ComboboxOption,
} from "@/components/shared/combobox-select-field";

const options: ComboboxOption[] = [
	{ value: "a1", label: "HDFC Savings" },
	{ value: "a2", label: "ICICI Current" },
	{ value: "a3", label: "Cash Wallet" },
];

function renderCombobox(
	props: Partial<Parameters<typeof ComboboxSelectField>[0]> = {},
) {
	const handleValueChange = vi.fn();
	const view = render(
		<ComboboxSelectField
			items={options}
			value=""
			onValueChange={handleValueChange}
			placeholder="Select account"
			ariaLabel="Test field"
			{...props}
		/>,
	);
	return { handleValueChange, ...view };
}

function openPopup() {
	fireEvent.click(screen.getByRole("combobox", { name: "Test field" }));
	return screen.getByPlaceholderText("Search...");
}

describe("ComboboxSelectField", () => {
	afterEach(cleanup);

	it("opens a popup with a search input and lists all options", () => {
		renderCombobox();
		const search = openPopup();
		expect(search).toBeDefined();
		expect(screen.getAllByRole("option")).toHaveLength(options.length);
	});

	it("narrows options with a case-insensitive substring match", () => {
		renderCombobox();
		const search = openPopup();

		fireEvent.change(search, { target: { value: "wal" } });
		let visible = screen.getAllByRole("option");
		expect(visible).toHaveLength(1);
		expect(visible[0]?.textContent).toContain("Cash Wallet");

		fireEvent.change(search, { target: { value: "hdfc" } });
		visible = screen.getAllByRole("option");
		expect(visible).toHaveLength(1);
		expect(visible[0]?.textContent).toContain("HDFC Savings");
	});

	it("shows the empty message when nothing matches", () => {
		renderCombobox();
		const search = openPopup();
		fireEvent.change(search, { target: { value: "nope" } });
		expect(screen.queryAllByRole("option")).toHaveLength(0);
		expect(screen.getByText("No options found.")).toBeDefined();
	});

	it("selects an option and reports its id", () => {
		const { handleValueChange } = renderCombobox();
		const search = openPopup();

		fireEvent.change(search, { target: { value: "icici" } });
		fireEvent.click(screen.getByRole("option", { name: "ICICI Current" }));

		expect(handleValueChange).toHaveBeenCalledWith("a2");
	});

	it("displays the selected label on the trigger", () => {
		renderCombobox({ value: "a2" });
		const trigger = screen.getByRole("combobox", { name: "Test field" });
		expect(trigger.textContent).toContain("ICICI Current");
	});

	it("keeps the value on Escape and closes the popup", () => {
		const { handleValueChange } = renderCombobox({ value: "a1" });
		const search = openPopup();

		fireEvent.keyDown(search, { key: "Escape" });

		expect(handleValueChange).not.toHaveBeenCalled();
		expect(screen.queryAllByRole("option")).toHaveLength(0);
	});
});
