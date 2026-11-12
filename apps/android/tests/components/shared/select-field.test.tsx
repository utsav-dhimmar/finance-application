import { fireEvent, render } from "@testing-library/react-native";
import { describe, expect, it, vi } from "vitest";

// SelectField is now the native Compose dropdown (BoxyDropdownField); tests
// run against the typed @expo/ui doubles per design.md D9 (see
// src/components/ui/SPIKE-NOTES.md — the real components serialize content
// into native-view props RNTL cannot reach).
vi.mock(
	"@expo/ui/jetpack-compose",
	async () => await import("@tests/helpers/ui-doubles"),
);

import { SelectField } from "@/components/shared/select-field";

const TYPES = [
	{ value: "cash", label: "Cash" },
	{ value: "bank", label: "Bank" },
	{ value: "wallet", label: "Wallet" },
];

describe("SelectField (native dropdown)", () => {
	it("renders the label and the selected option", async () => {
		const view = await render(
			<SelectField
				label="Account type"
				options={TYPES}
				value="bank"
				onValueChange={() => undefined}
			/>,
		);
		expect(view.getByText("Account type")).toBeOnTheScreen();
		// The double mounts menu items inline, so the selected label appears
		// both as the trigger content and as its option.
		expect(view.getAllByText("Bank").length).toBeGreaterThan(0);
	});

	it("shows the placeholder when nothing is selected", async () => {
		const view = await render(
			<SelectField
				label="Account type"
				options={TYPES}
				value=""
				onValueChange={() => undefined}
			/>,
		);
		expect(view.getByText("Select")).toBeOnTheScreen();
	});

	it("reports the picked option's value", async () => {
		const onValueChange = vi.fn();
		const view = await render(
			<SelectField
				label="Account type"
				options={TYPES}
				value="cash"
				onValueChange={onValueChange}
			/>,
		);
		await fireEvent.press(view.getByText("Wallet"));
		expect(onValueChange).toHaveBeenCalledWith("wallet");
	});

	it("renders the long year option list (101 options)", async () => {
		const yearOptions = Array.from({ length: 101 }, (_, index) => ({
			value: String(2000 + index),
			label: String(2000 + index),
		}));
		const onValueChange = vi.fn();
		const view = await render(
			<SelectField
				label="Year"
				options={yearOptions}
				value="2026"
				onValueChange={onValueChange}
			/>,
		);
		expect(view.getAllByText("2026").length).toBeGreaterThan(0);
		// Both ends of the range exist in the option list.
		expect(view.getByText("2000")).toBeOnTheScreen();
		expect(view.getByText("2100")).toBeOnTheScreen();
		await fireEvent.press(view.getByText("2050"));
		expect(onValueChange).toHaveBeenCalledWith("2050");
	});
});
