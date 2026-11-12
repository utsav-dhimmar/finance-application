import { render } from "@testing-library/react-native";
import type { AccountResponse } from "@finance-application/schemas";
import { describe, expect, it, vi } from "vitest";

// The card action rows are native @expo/ui buttons now; run them against
// the typed test doubles (design.md D9 — see src/components/ui/SPIKE-NOTES.md).
vi.mock(
	"@expo/ui/jetpack-compose",
	async () => await import("@tests/helpers/ui-doubles"),
);

import { AccountCard } from "@/components/accounts/account-card";
import { INR_DISPLAY } from "@/lib/format";

const account: AccountResponse = {
	id: "acc-1",
	name: "HDFC Bank",
	type: "bank",
	openingBalanceMinor: 100000,
	currentBalanceMinor: 125050,
	status: "active",
	archivedAt: null,
	deletedAt: null,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

function renderCard(overrides: Partial<AccountResponse> = {}) {
	return render(
		<AccountCard
			account={{ ...account, ...overrides }}
			display={INR_DISPLAY}
			onEdit={vi.fn()}
			onArchive={vi.fn()}
			onDelete={vi.fn()}
			onRestore={vi.fn()}
		/>,
	);
}

describe("AccountCard", () => {
	it("renders an active account with its name, type, and formatted balances", async () => {
		const view = await renderCard();
		expect(view.getByText("HDFC Bank")).toBeOnTheScreen();
		expect(view.getByText("Bank")).toBeOnTheScreen();
		expect(view.getByText("₹1,250.50")).toBeOnTheScreen();
		// Opening balance differs from current, so the opening line shows.
		expect(view.getByText("opening ₹1,000.00")).toBeOnTheScreen();
		expect(view.getByRole("button", { name: "Edit" })).toBeOnTheScreen();
		expect(view.getByRole("button", { name: "Archive" })).toBeOnTheScreen();
		expect(view.getByRole("button", { name: "Delete" })).toBeOnTheScreen();
		expect(view.queryByRole("button", { name: "Restore" })).toBeNull();
	});

	it("omits the opening line when it equals the current balance", async () => {
		const view = await renderCard({
			openingBalanceMinor: 125050,
			currentBalanceMinor: 125050,
		});
		expect(view.getByText("₹1,250.50")).toBeOnTheScreen();
		expect(view.queryByText(/opening /)).toBeNull();
	});

	it("marks archived accounts and offers restore instead of edits", async () => {
		const view = await renderCard({ status: "archived" });
		expect(view.getByText("Archived")).toBeOnTheScreen();
		expect(view.queryByRole("button", { name: "Edit" })).toBeNull();
		expect(view.queryByRole("button", { name: "Archive" })).toBeNull();
		expect(view.queryByRole("button", { name: "Delete" })).toBeNull();
		expect(view.getByRole("button", { name: "Restore" })).toBeOnTheScreen();
	});

	it("marks deleted accounts and offers restore", async () => {
		const view = await renderCard({ status: "deleted" });
		expect(view.getByText("Deleted")).toBeOnTheScreen();
		expect(view.getByRole("button", { name: "Restore" })).toBeOnTheScreen();
		expect(view.queryByRole("button", { name: "Edit" })).toBeNull();
	});
});
