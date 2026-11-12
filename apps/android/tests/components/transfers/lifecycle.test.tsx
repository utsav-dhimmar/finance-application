import { fireEvent, waitFor } from "@testing-library/react-native";
import type { AccountResponse } from "@finance-application/schemas";

import { toast } from "sonner-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The shared select fields are native @expo/ui components now; run their
// content through the typed test doubles (design.md D9 — see
// src/components/ui/SPIKE-NOTES.md).
vi.mock(
	"@expo/ui/jetpack-compose",
	async () => await import("@tests/helpers/ui-doubles"),
);

import TransactionsScreen from "@/app/(app)/transactions";
import { jsonResponse } from "@/session/fetch-mock";
import { pickOption, renderWithProviders } from "../../helpers";
import { makeRegisteredMachine } from "../../services/helpers";

vi.mock("expo-crypto", () => ({
	getRandomValues: (bytes: Uint8Array) => bytes.fill(7),
}));
vi.mock("sonner-native", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@react-native-community/datetimepicker", () => ({
	default: () => null,
}));

const source: AccountResponse = {
	id: "acc-1",
	name: "HDFC Bank",
	type: "bank",
	openingBalanceMinor: 100000,
	currentBalanceMinor: 500000,
	status: "active",
	archivedAt: null,
	deletedAt: null,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

const destination: AccountResponse = {
	...source,
	id: "acc-2",
	name: "Cash Wallet",
	type: "cash",
	currentBalanceMinor: 25000,
};

// A transfer contributes one row per involved account side; an unscoped feed
// legitimately contains the same transfer id twice.
function transferSide(
	side: "out" | "in",
	status = "active",
): Record<string, unknown> {
	const outgoing = side === "out";
	return {
		id: "tr-1",
		kind: "transfer",
		date: "2026-01-15",
		amountMinor: outgoing ? -500000 : 500000,
		direction: side,
		accountId: outgoing ? "acc-1" : "acc-2",
		accountName: outgoing ? "HDFC Bank" : "Cash Wallet",
		status,
		notes: null,
		type: null,
		categoryId: null,
		categoryName: null,
		counterpartyAccountId: outgoing ? "acc-2" : "acc-1",
		counterpartyAccountName: outgoing ? "Cash Wallet" : "HDFC Bank",
		createdAt: "2026-01-15T00:00:00.000Z",
		updatedAt: "2026-01-15T00:00:00.000Z",
		archivedAt: null,
		deletedAt: null,
	};
}

function baseHandlers(
	overrides: Record<string, unknown> = {},
): Parameters<typeof makeRegisteredMachine>[0] {
	return {
		"GET /api/accounts": () =>
			jsonResponse(200, {
				accounts: [source, destination],
				combinedBalanceMinor: 525000,
			}),
		"GET /api/categories": () => jsonResponse(200, { categories: [] }),
		"GET /api/preferences": () =>
			jsonResponse(200, {
				currencyCode: "INR",
				currencySymbol: "₹",
				minorUnitExponent: 2,
			}),
		"GET /api/activity": () =>
			jsonResponse(200, {
				activity: [transferSide("out"), transferSide("in")],
				page: 1,
				pageSize: 20,
				total: 2,
			}),
		...overrides,
	} as Parameters<typeof makeRegisteredMachine>[0];
}

function findCall(
	fetchMock: { mock: { calls: unknown[][] } },
	method: string,
	suffix: string,
): unknown[] | undefined {
	return fetchMock.mock.calls.find(
		([input, init]) =>
			(init as RequestInit | undefined)?.method === method &&
			String(input).endsWith(suffix),
	);
}

beforeEach(() => {
	vi.mocked(toast.success).mockClear();
	vi.mocked(toast.error).mockClear();
});

describe("TransfersScreen lifecycle", () => {
	it("renders both sides of a transfer with signed amounts", async () => {
		makeRegisteredMachine(baseHandlers());
		const { view } = await renderWithProviders(<TransactionsScreen />);
		await waitFor(() => expect(view.getAllByText("Transfer")).toHaveLength(2), {
			timeout: 10_000,
		});
		expect(view.getByText("−₹5,000.00")).toBeOnTheScreen();
		expect(view.getByText("+₹5,000.00")).toBeOnTheScreen();
		// Each side shows its counterparty: source side → destination, and
		// the other way around.
		// The names appear in both rows and, under the test doubles, in the
		// filter dropdown's mounted options.
		expect(view.getAllByText("Cash Wallet").length).toBeGreaterThanOrEqual(2);
		expect(view.getAllByText("HDFC Bank").length).toBeGreaterThanOrEqual(2);
	});

	it("archives a transfer through the confirmation dialog", async () => {
		const { fetchMock } = makeRegisteredMachine(
			baseHandlers({
				"POST /api/transfers/tr-1/archive": () =>
					jsonResponse(200, { id: "tr-1", status: "archived" }),
			}),
		);
		const { view } = await renderWithProviders(<TransactionsScreen />);
		await waitFor(
			() =>
				expect(
					view.getAllByRole("button", { name: "Archive" }).length,
				).toBeGreaterThan(0),
			{ timeout: 10_000 },
		);
		// Both sides of the transfer render the action; either targets the
		// same transfer id.
		await fireEvent.press(firstButton(view, "Archive"));
		await waitFor(
			() => expect(view.getByText("Archive this transfer?")).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		await fireEvent.press(
			view.getByRole("button", { name: "Archive transfer" }),
		);
		await waitFor(() => {
			expect(
				findCall(fetchMock, "POST", "/api/transfers/tr-1/archive"),
			).toBeDefined();
		});
		await waitFor(
			() => expect(view.queryByText("Archive this transfer?")).toBeNull(),
			{ timeout: 10_000 },
		);
		expect(toast.success).toHaveBeenCalledWith("Transfer archived.");
	});

	it("deletes a transfer through the confirmation dialog", async () => {
		const { fetchMock } = makeRegisteredMachine(
			baseHandlers({
				"POST /api/transfers/tr-1/delete": () =>
					jsonResponse(200, { id: "tr-1", status: "deleted" }),
			}),
		);
		const { view } = await renderWithProviders(<TransactionsScreen />);
		await waitFor(
			() =>
				expect(
					view.getAllByRole("button", { name: "Delete" }).length,
				).toBeGreaterThan(0),
			{ timeout: 10_000 },
		);
		await fireEvent.press(firstButton(view, "Delete"));
		await waitFor(
			() => expect(view.getByText("Delete this transfer?")).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		await fireEvent.press(
			view.getByRole("button", { name: "Delete transfer" }),
		);
		await waitFor(() => {
			expect(
				findCall(fetchMock, "POST", "/api/transfers/tr-1/delete"),
			).toBeDefined();
		});
		expect(toast.success).toHaveBeenCalledWith("Transfer moved to trash.");
	});

	it("restores a trashed transfer from the Trash tab", async () => {
		const { fetchMock } = makeRegisteredMachine({
			...baseHandlers(),
			"GET /api/activity": () =>
				jsonResponse(200, {
					activity: [
						transferSide("out", "deleted"),
						transferSide("in", "deleted"),
					],
					page: 1,
					pageSize: 20,
					total: 2,
				}),
			"POST /api/transfers/tr-1/restore": () =>
				jsonResponse(200, { id: "tr-1", status: "active" }),
		} as Parameters<typeof makeRegisteredMachine>[0]);
		const { view } = await renderWithProviders(<TransactionsScreen />);
		await waitFor(
			() =>
				expect(view.getByRole("button", { name: "Trash" })).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		await fireEvent.press(view.getByRole("button", { name: "Trash" }));
		await waitFor(
			() =>
				expect(
					view.getAllByRole("button", { name: "Restore" }).length,
				).toBeGreaterThan(0),
			{ timeout: 10_000 },
		);
		await fireEvent.press(firstButton(view, "Restore"));
		await waitFor(() => {
			expect(
				findCall(fetchMock, "POST", "/api/transfers/tr-1/restore"),
			).toBeDefined();
		});
		expect(toast.success).toHaveBeenCalledWith("Transfer restored.");
	});

	it("creates a transfer after blocking the same-account selection", async () => {
		let created = false;
		makeRegisteredMachine({
			...baseHandlers(),
			"GET /api/activity": () =>
				jsonResponse(200, {
					activity: created
						? [transferSide("out"), transferSide("in"), transferSide("out")]
						: [transferSide("out"), transferSide("in")],
					page: 1,
					pageSize: 20,
					total: created ? 3 : 2,
				}),
			"POST /api/transfers": () => {
				created = true;
				return jsonResponse(201, { id: "tr-2", status: "active" });
			},
		} as Parameters<typeof makeRegisteredMachine>[0]);
		const { view } = await renderWithProviders(<TransactionsScreen />);
		await waitFor(
			() =>
				expect(
					view.getByRole("button", { name: "New transfer" }),
				).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		await fireEvent.press(view.getByRole("button", { name: "New transfer" }));
		await waitFor(
			() => expect(view.getByPlaceholderText("0.00")).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		await pickOption(view, "HDFC Bank", "Source account");
		await pickOption(view, "HDFC Bank", "Destination account");
		await fireEvent.changeText(view.getByPlaceholderText("0.00"), "500");
		await fireEvent.press(
			view.getByRole("button", { name: "Record transfer" }),
		);
		// The shared schema's refinement blocks the same-account pair on the
		// destination field.
		await waitFor(
			() =>
				expect(
					view.getByText("Source and destination must be different accounts"),
				).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		await pickOption(view, "Cash Wallet", "Destination account");
		await fireEvent.press(
			view.getByRole("button", { name: "Record transfer" }),
		);
		await waitFor(() =>
			expect(view.getAllByText("−₹5,000.00")).toHaveLength(2),
		);
		expect(toast.success).toHaveBeenCalledWith("Transfer recorded.");
	});
});

function firstButton(
	view: Awaited<ReturnType<typeof renderWithProviders>>["view"],
	name: string,
): NonNullable<
	ReturnType<
		Awaited<ReturnType<typeof renderWithProviders>>["view"]["getAllByRole"]
	>[number]
> {
	const match = view.getAllByRole("button", { name })[0];
	if (!match) {
		throw new Error(`Button not found: ${name}`);
	}
	return match;
}
