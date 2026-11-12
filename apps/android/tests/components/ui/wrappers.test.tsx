import { fireEvent, render } from "@testing-library/react-native";
import { ActivityIndicator, Text } from "react-native";
import { describe, expect, it, vi } from "vitest";

// Wrapper tests run against the typed @expo/ui test doubles (design.md D9):
// they verify the boxy wrappers' contracts — copy, callbacks, disabled and
// pending states, conditional mount — which the real Compose components
// cannot expose to RNTL (see src/components/ui/SPIKE-NOTES.md). The real
// components stay smoke-tested in spike.test.tsx and device-verified in
// Expo Go (tasks.md 4.3).
vi.mock(
	"@expo/ui/jetpack-compose",
	async () => await import("@tests/helpers/ui-doubles"),
);

import {
	BoxyButton,
	BoxyConfirmDialog,
	BoxyDateField,
	BoxyDropdownField,
	BoxyLazyList,
	BoxySegmentedRow,
	BoxyTextField,
} from "@/components/ui";

type TestRenderResult = Awaited<ReturnType<typeof render>>;
type TestInstance = NonNullable<TestRenderResult["root"]>;

/** The rendered tree root; null only when nothing rendered. */
function rootOf(view: TestRenderResult): TestInstance {
	const root = view.root;
	if (!root) {
		throw new Error("nothing rendered");
	}
	return root;
}

/** Whether any node in the rendered tree is the given component (or its host view). */
function hasNodeType(root: TestInstance, type: unknown): boolean {
	const nodeHasType = (node: { type?: unknown }): boolean =>
		node.type === type ||
		(typeof node.type === "string" &&
			node.type.toLowerCase().includes("activityindicator"));
	if (nodeHasType(root)) {
		return true;
	}
	return root.children.some((child) => {
		if (child === null || typeof child !== "object") {
			return false;
		}
		const instance = child as TestInstance;
		return nodeHasType(instance) || hasNodeType(instance, type);
	});
}

describe("BoxyButton", () => {
	it("renders the label and fires onPress", async () => {
		const onPress = vi.fn();
		const view = await render(
			<BoxyButton label="Sign out" onPress={onPress} />,
		);
		expect(view.getByText("Sign out")).toBeOnTheScreen();
		await fireEvent.press(view.getByText("Sign out"));
		expect(onPress).toHaveBeenCalledTimes(1);
	});

	it("disables the control while pending and shows the spinner", async () => {
		const onPress = vi.fn();
		const view = await render(
			<BoxyButton label="Archiving…" onPress={onPress} pending />,
		);
		expect(view.getByText("Archiving…")).toBeOnTheScreen();
		expect(hasNodeType(rootOf(view), ActivityIndicator)).toBe(true);
		await fireEvent.press(view.getByText("Archiving…"));
		expect(onPress).not.toHaveBeenCalled();
	});
});

describe("BoxyTextField", () => {
	it("renders the label above the native field and reports edits", async () => {
		const onChangeText = vi.fn();
		const view = await render(
			<BoxyTextField
				label="Email"
				value="user@example.com"
				placeholder="Email address"
				onChangeText={onChangeText}
			/>,
		);
		expect(view.getByText("Email")).toBeOnTheScreen();
		const input = view.getByDisplayValue("user@example.com");
		await fireEvent.changeText(input, "typed@example.com");
		expect(onChangeText).toHaveBeenCalledWith("typed@example.com");
	});

	it("keeps the field disabled while disabled", async () => {
		const onChangeText = vi.fn();
		const view = await render(
			<BoxyTextField
				label="Email"
				value=""
				onChangeText={onChangeText}
				disabled
			/>,
		);
		expect(view.getByDisplayValue("").props.editable).toBe(false);
	});
});

describe("BoxyDropdownField", () => {
	const options = [
		{ value: "bank", label: "Bank" },
		{ value: "cash", label: "Cash" },
	];

	it("renders the label and the selected option", async () => {
		const view = await render(
			<BoxyDropdownField
				label="Account type"
				options={options}
				value="bank"
				onValueChange={() => undefined}
			/>,
		);
		expect(view.getByText("Account type")).toBeOnTheScreen();
		// The double mounts the menu items inline, so the selected label also
		// appears as its option; the trigger content must exist too.
		expect(view.getAllByText("Bank").length).toBeGreaterThan(0);
	});

	it("reports the picked option value", async () => {
		const onValueChange = vi.fn();
		const view = await render(
			<BoxyDropdownField
				label="Account type"
				options={options}
				value=""
				placeholder="Select"
				onValueChange={onValueChange}
			/>,
		);
		expect(view.getByText("Select")).toBeOnTheScreen();
		await fireEvent.press(view.getByText("Cash"));
		expect(onValueChange).toHaveBeenCalledWith("cash");
	});
});

describe("BoxySegmentedRow", () => {
	const options = [
		{ value: "active", label: "Active" },
		{ value: "archived", label: "Archived" },
	];

	it("marks the selected option and reports picks", async () => {
		const onValueChange = vi.fn();
		const view = await render(
			<BoxySegmentedRow
				options={options}
				value="active"
				onValueChange={onValueChange}
			/>,
		);
		expect(view.getByText("Active")).toBeOnTheScreen();
		expect(view.getByText("Archived")).toBeOnTheScreen();
		await fireEvent.press(view.getByText("Archived"));
		expect(onValueChange).toHaveBeenCalledWith("archived");
	});
});

describe("BoxyConfirmDialog", () => {
	it("conditionally mounts and fires confirm and cancel", async () => {
		const onConfirm = vi.fn();
		const onCancel = vi.fn();
		const view = await render(
			<BoxyConfirmDialog
				open
				title="Archive this account?"
				body="Archived accounts leave the active list."
				confirmLabel="Archive"
				cancelLabel="Cancel"
				onConfirm={onConfirm}
				onCancel={onCancel}
			/>,
		);
		expect(view.getByText("Archive this account?")).toBeOnTheScreen();
		expect(
			view.getByText("Archived accounts leave the active list."),
		).toBeOnTheScreen();
		await fireEvent.press(view.getByText("Archive"));
		expect(onConfirm).toHaveBeenCalledTimes(1);
		await fireEvent.press(view.getByText("Cancel"));
		expect(onCancel).toHaveBeenCalledTimes(1);
	});

	it("renders nothing when closed", async () => {
		const view = await render(
			<BoxyConfirmDialog
				open={false}
				title="Archive this account?"
				confirmLabel="Archive"
				cancelLabel="Cancel"
				onConfirm={() => undefined}
				onCancel={() => undefined}
			/>,
		);
		expect(view.toJSON()).toBeNull();
	});
});

describe("BoxyDateField", () => {
	it("shows the value and commits the picked date", async () => {
		const onChange = vi.fn();
		const view = await render(
			<BoxyDateField label="From" value="2026-01-15" onChange={onChange} />,
		);
		expect(view.getByText("From")).toBeOnTheScreen();
		expect(view.getByText("2026-01-15")).toBeOnTheScreen();
		// Open the native picker dialog and confirm: the dialog's own confirm
		// button reports the selection.
		await fireEvent.press(view.getByText("2026-01-15"));
		await fireEvent.press(view.getByText("Done"));
		expect(onChange).toHaveBeenCalledWith("2026-01-15");
	});

	it("closes with Cancel without committing", async () => {
		const onChange = vi.fn();
		const view = await render(
			<BoxyDateField label="From" value={null} onChange={onChange} />,
		);
		await fireEvent.press(view.getByText("Select date"));
		await fireEvent.press(view.getByText("Cancel"));
		expect(onChange).not.toHaveBeenCalled();
	});
});

describe("BoxyLazyList", () => {
	it("renders items through the renderer", async () => {
		const view = await render(
			<BoxyLazyList
				items={["Alpha", "Beta"]}
				keyExtractor={(item) => item}
				renderItem={(item) => <Text>Row: {item}</Text>}
			/>,
		);
		expect(view.getByText("Row: Alpha")).toBeOnTheScreen();
		expect(view.getByText("Row: Beta")).toBeOnTheScreen();
	});
});
