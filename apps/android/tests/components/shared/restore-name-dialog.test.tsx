import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { accountNameSchema } from "@finance-application/schemas";
import { describe, expect, it, vi } from "vitest";

// The dialog is the native Compose alert dialog now; run it against the
// typed test doubles (design.md D9 — see src/components/ui/SPIKE-NOTES.md).
vi.mock(
	"@expo/ui/jetpack-compose",
	async () => await import("@tests/helpers/ui-doubles"),
);

import { RestoreNameDialog } from "@/components/shared/restore-name-dialog";

function schemaMessage(value: string): string {
	const result = accountNameSchema.safeParse(value);
	expect(result.success).toBe(false);
	return result.error?.issues[0]?.message ?? "";
}

describe("RestoreNameDialog", () => {
	it("prefills the conflicting name and describes the conflict", async () => {
		const view = await render(
			<RestoreNameDialog
				visible
				entityName="HDFC Bank"
				noun="account"
				nameSchema={accountNameSchema}
				onSubmit={vi.fn()}
				onCancel={vi.fn()}
			/>,
		);
		expect(view.getByDisplayValue("HDFC Bank")).toBeOnTheScreen();
		expect(
			view.getByText(
				'Another account already uses "HDFC Bank". Restore with a new name.',
			),
		).toBeOnTheScreen();
	});

	it("blocks an invalid name with the shared schema's message", async () => {
		const onSubmit = vi.fn();
		const view = await render(
			<RestoreNameDialog
				visible
				entityName="HDFC Bank"
				noun="account"
				nameSchema={accountNameSchema}
				onSubmit={onSubmit}
				onCancel={vi.fn()}
			/>,
		);
		await fireEvent.changeText(view.getByDisplayValue("HDFC Bank"), "");
		await fireEvent.press(view.getByRole("button", { name: "Restore" }));
		await waitFor(
			() => expect(view.getByText(schemaMessage(""))).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("submits the schema-parsed name on valid input", async () => {
		const onSubmit = vi.fn();
		const view = await render(
			<RestoreNameDialog
				visible
				entityName="HDFC Bank"
				noun="account"
				nameSchema={accountNameSchema}
				onSubmit={onSubmit}
				onCancel={vi.fn()}
			/>,
		);
		await fireEvent.changeText(
			view.getByDisplayValue("HDFC Bank"),
			"  HDFC Bank 2 ",
		);
		await fireEvent.press(view.getByRole("button", { name: "Restore" }));
		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
		// Parsed output: the schema trims the value.
		expect(onSubmit).toHaveBeenCalledWith("HDFC Bank 2");
	});

	it("cancels without submitting", async () => {
		const onSubmit = vi.fn();
		const onCancel = vi.fn();
		const view = await render(
			<RestoreNameDialog
				visible
				entityName="HDFC Bank"
				noun="account"
				nameSchema={accountNameSchema}
				onSubmit={onSubmit}
				onCancel={onCancel}
			/>,
		);
		await fireEvent.press(view.getByRole("button", { name: "Cancel" }));
		expect(onCancel).toHaveBeenCalledTimes(1);
		expect(onSubmit).not.toHaveBeenCalled();
	});
});
