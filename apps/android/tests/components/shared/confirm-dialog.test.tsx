import { fireEvent, render } from "@testing-library/react-native";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";

describe("ConfirmDialog", () => {
	it("renders the title, description, and action buttons", async () => {
		const view = await render(
			<ConfirmDialog
				visible
				title={'Delete "HDFC Bank"?'}
				description="Deleted accounts move to Trash and keep their history."
				confirmLabel="Delete account"
				onConfirm={vi.fn()}
				onCancel={vi.fn()}
			/>,
		);
		expect(view.getByText('Delete "HDFC Bank"?')).toBeOnTheScreen();
		expect(
			view.getByText("Deleted accounts move to Trash and keep their history."),
		).toBeOnTheScreen();
		expect(view.getByRole("button", { name: "Delete account" }));
		expect(view.getByRole("button", { name: "Cancel" }));
	});

	it("confirms when the confirm button is pressed", async () => {
		const onConfirm = vi.fn();
		const onCancel = vi.fn();
		const view = await render(
			<ConfirmDialog
				visible
				title='Archive "HDFC Bank"?'
				description="Archived accounts keep their history."
				confirmLabel="Archive account"
				onConfirm={onConfirm}
				onCancel={onCancel}
			/>,
		);
		await fireEvent.press(
			view.getByRole("button", { name: "Archive account" }),
		);
		expect(onConfirm).toHaveBeenCalledTimes(1);
		expect(onCancel).not.toHaveBeenCalled();
	});

	it("cancels without confirming", async () => {
		const onConfirm = vi.fn();
		const onCancel = vi.fn();
		const view = await render(
			<ConfirmDialog
				visible
				title='Archive "HDFC Bank"?'
				description="Archived accounts keep their history."
				confirmLabel="Archive account"
				onConfirm={onConfirm}
				onCancel={onCancel}
			/>,
		);
		await fireEvent.press(view.getByRole("button", { name: "Cancel" }));
		expect(onCancel).toHaveBeenCalledTimes(1);
		expect(onConfirm).not.toHaveBeenCalled();
	});

	it("disables the confirm button while pending", async () => {
		const onConfirm = vi.fn();
		const view = await render(
			<ConfirmDialog
				visible
				title='Archive "HDFC Bank"?'
				description="Archived accounts keep their history."
				confirmLabel="Archive account"
				pending
				onConfirm={onConfirm}
				onCancel={vi.fn()}
			/>,
		);
		const confirm = view.getByRole("button", { name: "Archive account" });
		expect(confirm.props.accessibilityState?.disabled).toBe(true);
		await fireEvent.press(confirm);
		expect(onConfirm).not.toHaveBeenCalled();
	});
});
