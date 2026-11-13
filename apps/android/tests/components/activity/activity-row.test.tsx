import { render } from "@testing-library/react-native";
import type { ActivityItem } from "@finance-application/schemas";
import { describe, expect, it, vi } from "vitest";

import {
	ActivityRow,
	formatSignedAmount,
} from "@/components/activity/activity-row";
import { INR_DISPLAY } from "@/lib/format";

const transactionRow: ActivityItem = {
	id: "tx-1",
	kind: "transaction",
	date: "2026-01-15",
	amountMinor: -125050,
	direction: null,
	accountId: "acc-1",
	accountName: "HDFC Bank",
	status: "active",
	notes: "Weekly shop",
	type: "expense",
	categoryId: "cat-1",
	categoryName: "Groceries",
	counterpartyAccountId: null,
	counterpartyAccountName: null,
	createdAt: "2026-01-15T00:00:00.000Z",
	updatedAt: "2026-01-15T00:00:00.000Z",
	archivedAt: null,
	deletedAt: null,
};

const transferOutRow: ActivityItem = {
	...transactionRow,
	id: "tr-1",
	kind: "transfer",
	type: null,
	categoryId: null,
	categoryName: null,
	amountMinor: -500000,
	direction: "out",
	accountId: "acc-1",
	accountName: "HDFC Bank",
	counterpartyAccountId: "acc-2",
	counterpartyAccountName: "Cash Wallet",
	notes: null,
};

const transferInRow: ActivityItem = {
	...transferOutRow,
	amountMinor: 500000,
	direction: "in",
	accountId: "acc-2",
	accountName: "Cash Wallet",
	counterpartyAccountId: "acc-1",
	counterpartyAccountName: "HDFC Bank",
};

function renderRow(item: ActivityItem) {
	return render(
		<ActivityRow
			display={INR_DISPLAY}
			item={item}
			onEdit={vi.fn()}
			onArchive={vi.fn()}
			onDelete={vi.fn()}
			onRestore={vi.fn()}
		/>,
	);
}

describe("formatSignedAmount", () => {
	it("signs income with + and expenses with −, magnitude via the formatter", () => {
		expect(
			formatSignedAmount(
				{ ...transactionRow, amountMinor: 50000 },
				INR_DISPLAY,
			),
		).toBe("+₹500.00");
		expect(formatSignedAmount(transactionRow, INR_DISPLAY)).toBe("−₹1,250.50");
		expect(formatSignedAmount(transferInRow, INR_DISPLAY)).toBe("+₹5,000.00");
		expect(formatSignedAmount(transferOutRow, INR_DISPLAY)).toBe("−₹5,000.00");
	});
});

describe("ActivityRow", () => {
	it("renders a transaction row with date, kind, category, and amount", async () => {
		const view = await renderRow(transactionRow);
		expect(view.getByText("2026-01-15")).toBeOnTheScreen();
		expect(view.getByText("Expense")).toBeOnTheScreen();
		expect(view.getByText("−₹1,250.50")).toBeOnTheScreen();
		expect(view.getByText("Groceries")).toBeOnTheScreen();
		expect(view.getByText("HDFC Bank")).toBeOnTheScreen();
		expect(view.getByText("Weekly shop")).toBeOnTheScreen();
		expect(view.getByRole("button", { name: "Edit" })).toBeOnTheScreen();
		expect(view.getByRole("button", { name: "Archive" })).toBeOnTheScreen();
		expect(view.getByRole("button", { name: "Delete" })).toBeOnTheScreen();
		expect(view.queryByRole("button", { name: "Restore" })).toBeNull();
	});

	it("renders the source side of a transfer with its direction", async () => {
		const view = await renderRow(transferOutRow);
		expect(view.getByText("Transfer")).toBeOnTheScreen();
		expect(view.getByText("Out")).toBeOnTheScreen();
		expect(view.getByText("−₹5,000.00")).toBeOnTheScreen();
		// The counterparty (destination) is shown instead of a category.
		expect(view.getByText("Cash Wallet")).toBeOnTheScreen();
		expect(view.queryByText("Groceries")).toBeNull();
	});

	it("renders the destination side of the same transfer id", async () => {
		const view = await renderRow(transferInRow);
		expect(view.getByText("In")).toBeOnTheScreen();
		expect(view.getByText("+₹5,000.00")).toBeOnTheScreen();
		// From the destination side, the counterparty is the source account.
		expect(view.getByText("HDFC Bank")).toBeOnTheScreen();
	});

	it("marks non-active rows and offers restore instead of edits", async () => {
		const view = await renderRow({
			...transactionRow,
			status: "archived",
		});
		expect(view.getByText("Archived")).toBeOnTheScreen();
		expect(view.queryByRole("button", { name: "Edit" })).toBeNull();
		expect(view.getByRole("button", { name: "Restore" })).toBeOnTheScreen();
	});
});
