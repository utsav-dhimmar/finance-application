import { fireEvent, render, within } from "@testing-library/react-native";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { SelectField, type SelectOption } from "@/components/shared/select-field";

const COLORS: SelectOption[] = [
	{ value: "red", label: "Red" },
	{ value: "blue", label: "Blue" },
	{ value: "green", label: "Green" },
];

// A stateful harness so the trigger's display follows selections the way
// every screen uses the field (value state owned by the caller).
function Harness({
	onValueChange,
	initialValue = "red",
}: {
	onValueChange?: (value: string) => void;
	initialValue?: string;
}) {
	const [value, setValue] = useState(initialValue);
	return (
		<SelectField
			label="Color"
			options={COLORS}
			value={value}
			onValueChange={(next) => {
				onValueChange?.(next);
				setValue(next);
			}}
		/>
	);
}

// The four scenarios of the android-ui "Native select menus" requirement.
// The native menu layer itself is mocked in tests/setup.ts, where the fake
// menu hides options until the trigger is pressed and closes after a
// selection, mirroring the real component's observable behavior. The
// physical open/dismiss gestures are device-verified in the QA checklist.
describe("SelectField native select menus", () => {
	it("opens a menu listing the options with the current selection marked", async () => {
		const view = await render(<Harness />);
		expect(view.getByRole("button", { name: "Color" })).toBeOnTheScreen();
		// Options stay hidden behind the trigger until it is pressed.
		expect(view.queryByLabelText("Red")).toBeNull();
		await fireEvent.press(view.getByRole("button", { name: "Color" }));
		// Every option is present and labeled.
		for (const label of ["Red", "Blue", "Green"]) {
			expect(view.getByLabelText(label)).toBeOnTheScreen();
		}
		// The current selection is the marked one.
		expect(view.getByLabelText("Red")).toBeChecked();
		expect(view.getByLabelText("Blue")).not.toBeChecked();
		expect(view.getByLabelText("Green")).not.toBeChecked();
	});

	it("updates the field and closes the menu when an option is chosen", async () => {
		const onValueChange = vi.fn();
		const view = await render(<Harness onValueChange={onValueChange} />);
		await fireEvent.press(view.getByRole("button", { name: "Color" }));
		await fireEvent.press(view.getByLabelText("Blue"));
		expect(onValueChange).toHaveBeenCalledWith("blue");
		// The trigger now displays the chosen option's label.
		const trigger = view.getByRole("button", { name: "Color" });
		expect(within(trigger).getByText("Blue")).toBeOnTheScreen();
		// The menu closed after the selection.
		expect(view.queryByLabelText("Blue")).toBeNull();
	});

	it("keeps the value when nothing is chosen", async () => {
		const onValueChange = vi.fn();
		const view = await render(<Harness onValueChange={onValueChange} />);
		await fireEvent.press(view.getByRole("button", { name: "Color" }));
		// Opening the menu chooses nothing: only an option press reports a
		// value, so dismissing it keeps the current one.
		expect(onValueChange).not.toHaveBeenCalled();
		const trigger = view.getByRole("button", { name: "Color" });
		expect(within(trigger).getByText("Red")).toBeOnTheScreen();
	});

	it("renders the trigger with the boxy StyleSheet theme", async () => {
		const view = await render(<Harness />);
		const trigger = view.getByRole("button", { name: "Color" });
		expect(trigger).toHaveStyle({ borderRadius: 0, borderWidth: 1 });
		expect(within(trigger).getByText("Red")).toBeOnTheScreen();
	});
});
