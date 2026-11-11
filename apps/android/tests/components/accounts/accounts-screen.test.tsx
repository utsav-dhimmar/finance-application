import { fireEvent, waitFor } from "@testing-library/react-native";
import {
	accountFormSchema,
	type AccountResponse,
} from "@finance-application/schemas";

import { toast } from "sonner-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AccountsScreen from "@/app/(app)/accounts";
import { AccountFormDialog } from "@/components/accounts/account-form-dialog";
import { INR_DISPLAY } from "@/lib/format";
import { jsonResponse, type FetchHandler } from "@/session/fetch-mock";
import { renderWithProviders } from "../../helpers";
import { makeRegisteredMachine } from "../../services/helpers";

vi.mock("sonner-native", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

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

const deletedAccount: AccountResponse = {
	...account,
	name: "Old Wallet",
	id: "acc-2",
	openingBalanceMinor: 0,
	currentBalanceMinor: 0,
	status: "deleted",
};

function preferences(): FetchHandler {
	return () =>
		jsonResponse(200, {
			currencyCode: "INR",
			currencySymbol: "₹",
			minorUnitExponent: 2,
		});
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

function nameSchemaMessage(values: Record<string, string>): string {
	const result = accountFormSchema.safeParse(values);
	expect(result.success).toBe(false);
	return (
		result.error?.issues.find((issue) => issue.path.includes("name"))
			?.message ?? ""
	);
}

describe("AccountsScreen", () => {
	beforeEach(() => {
		vi.mocked(toast.success).mockClear();
		vi.mocked(toast.error).mockClear();
	});

	it("lists active accounts with balances and the combined balance", async () => {
		makeRegisteredMachine({
			"GET /api/preferences": preferences(),
			"GET /api/accounts": () =>
				jsonResponse(200, {
					accounts: [account],
					combinedBalanceMinor: 125050,
				}),
		});
		const { view } = await renderWithProviders(<AccountsScreen />);
		await waitFor(() => expect(view.getByText("HDFC Bank")).toBeOnTheScreen(), {
			timeout: 10_000,
		});
		expect(view.getByText("Bank")).toBeOnTheScreen();
		// The figure appears on the card and in the combined-balance line.
		expect(view.getAllByText("₹1,250.50").length).toBeGreaterThan(0);
		expect(
			view.getByText(/Combined balance across active accounts:/),
		).toBeOnTheScreen();
	});

	it("shows the empty-state message for the selected tab", async () => {
		makeRegisteredMachine({
			"GET /api/preferences": preferences(),
			"GET /api/accounts": () =>
				jsonResponse(200, { accounts: [], combinedBalanceMinor: 0 }),
		});
		const { view } = await renderWithProviders(<AccountsScreen />);
		await waitFor(
			() =>
				expect(
					view.getByText(
						"No accounts yet. Add your first account to start tracking money.",
					),
				).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		expect(
			view.getByRole("button", { name: "Add your first account" }),
		).toBeOnTheScreen();
		await fireEvent.press(view.getByRole("tab", { name: "Trash" }));
		await waitFor(
			() => expect(view.getByText("Trash is empty.")).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
	});

	it("requests the selected status from the API", async () => {
		const { fetchMock } = makeRegisteredMachine({
			"GET /api/preferences": preferences(),
			"GET /api/accounts": () =>
				jsonResponse(200, { accounts: [], combinedBalanceMinor: 0 }),
		});
		const { view } = await renderWithProviders(<AccountsScreen />);
		await waitFor(
			() =>
				expect(
					view.getByText(
						"No accounts yet. Add your first account to start tracking money.",
					),
				).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		await fireEvent.press(view.getByRole("tab", { name: "Archived" }));
		await waitFor(
			() =>
				expect(
					fetchMock.mock.calls.some(([input]) =>
						String(input).includes("status=archived"),
					),
				).toBe(true),
			{ timeout: 10_000 },
		);
	});

	it("creates an account with the schema's parsed values", async () => {
		const { fetchMock } = makeRegisteredMachine({
			"GET /api/preferences": preferences(),
			"GET /api/accounts": () =>
				jsonResponse(200, { accounts: [], combinedBalanceMinor: 0 }),
			"POST /api/accounts": () => jsonResponse(201, account),
		});
		const { view } = await renderWithProviders(<AccountsScreen />);
		await waitFor(
			() =>
				expect(
					view.getByRole("button", { name: "Add account" }),
				).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		await fireEvent.press(view.getByRole("button", { name: "Add account" }));
		await waitFor(() =>
			expect(
				view.getByText("Track money held in one place. Amounts are in ₹."),
			).toBeOnTheScreen(),
		);
		await fireEvent.changeText(
			view.getByLabelText("Account name"),
			"HDFC Bank",
		);
		await fireEvent.changeText(
			view.getByLabelText("Opening balance (₹)"),
			"1250.50",
		);
		await fireEvent.press(view.getByRole("button", { name: "Create account" }));
		await waitFor(() => {
			expect(findCall(fetchMock, "POST", "/api/accounts")).toBeDefined();
		});
		const call = findCall(fetchMock, "POST", "/api/accounts");
		expect(JSON.parse(String((call?.[1] as RequestInit)?.body))).toEqual({
			name: "HDFC Bank",
			type: "cash",
			openingBalanceMinor: 125050,
		});
		// The dialog closes after the create succeeds.
		await waitFor(() =>
			expect(
				view.queryByText("Track money held in one place. Amounts are in ₹."),
			).toBeNull(),
		);
		expect(toast.success).toHaveBeenCalledWith("Account created.");
	});

	it("blocks submission and shows the schema message for an invalid form", async () => {
		const { fetchMock } = makeRegisteredMachine({
			"GET /api/preferences": preferences(),
			"GET /api/accounts": () =>
				jsonResponse(200, { accounts: [], combinedBalanceMinor: 0 }),
		});
		const { view } = await renderWithProviders(<AccountsScreen />);
		await waitFor(
			() =>
				expect(
					view.getByRole("button", { name: "Add account" }),
				).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		await fireEvent.press(view.getByRole("button", { name: "Add account" }));
		await waitFor(() =>
			expect(
				view.getByText("Track money held in one place. Amounts are in ₹."),
			).toBeOnTheScreen(),
		);
		await fireEvent.press(view.getByRole("button", { name: "Create account" }));
		await waitFor(
			() =>
				expect(
					view.getByText(
						nameSchemaMessage({ name: "", type: "cash", openingBalance: "" }),
					),
				).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		expect(
			fetchMock.mock.calls.some(
				([, init]) => (init as RequestInit | undefined)?.method === "POST",
			),
		).toBe(false);
	});

	it("archives through the confirmation dialog", async () => {
		const { fetchMock } = makeRegisteredMachine({
			"GET /api/preferences": preferences(),
			"GET /api/accounts": () =>
				jsonResponse(200, {
					accounts: [account],
					combinedBalanceMinor: 125050,
				}),
			"POST /api/accounts/acc-1/archive": () => jsonResponse(200, account),
		});
		const { view } = await renderWithProviders(<AccountsScreen />);
		await waitFor(
			() =>
				expect(view.getByRole("button", { name: "Archive" })).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		await fireEvent.press(view.getByRole("button", { name: "Archive" }));
		await waitFor(() =>
			expect(view.getByText('Archive "HDFC Bank"?')).toBeOnTheScreen(),
		);
		expect(
			view.getByText(
				"Archived accounts leave lists and balance summaries but keep their history. You can restore this account from the Archived tab.",
			),
		).toBeOnTheScreen();
		await fireEvent.press(
			view.getByRole("button", { name: "Archive account" }),
		);
		await waitFor(() => {
			expect(
				findCall(fetchMock, "POST", "/api/accounts/acc-1/archive"),
			).toBeDefined();
		});
		await waitFor(() =>
			expect(view.queryByText('Archive "HDFC Bank"?')).toBeNull(),
		);
		expect(toast.success).toHaveBeenCalledWith("Account archived.");
	});

	it("deletes through the confirmation dialog", async () => {
		const { fetchMock } = makeRegisteredMachine({
			"GET /api/preferences": preferences(),
			"GET /api/accounts": () =>
				jsonResponse(200, {
					accounts: [account],
					combinedBalanceMinor: 125050,
				}),
			"POST /api/accounts/acc-1/delete": () => jsonResponse(200, account),
		});
		const { view } = await renderWithProviders(<AccountsScreen />);
		await waitFor(
			() =>
				expect(view.getByRole("button", { name: "Delete" })).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		await fireEvent.press(view.getByRole("button", { name: "Delete" }));
		await waitFor(() =>
			expect(view.getByText('Delete "HDFC Bank"?')).toBeOnTheScreen(),
		);
		await fireEvent.press(view.getByRole("button", { name: "Delete account" }));
		await waitFor(() => {
			expect(
				findCall(fetchMock, "POST", "/api/accounts/acc-1/delete"),
			).toBeDefined();
		});
		await waitFor(() =>
			expect(view.queryByText('Delete "HDFC Bank"?')).toBeNull(),
		);
		expect(toast.success).toHaveBeenCalledWith("Account moved to trash.");
	});

	it("restores a trashed account without a name conflict", async () => {
		const { fetchMock } = makeRegisteredMachine({
			"GET /api/preferences": preferences(),
			"GET /api/accounts": () =>
				jsonResponse(200, {
					accounts: [deletedAccount],
					combinedBalanceMinor: 0,
				}),
			"POST /api/accounts/acc-2/restore": () =>
				jsonResponse(200, { ...deletedAccount, status: "active" }),
		});
		const { view } = await renderWithProviders(<AccountsScreen />);
		await waitFor(
			() =>
				expect(view.getByRole("button", { name: "Restore" })).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		await fireEvent.press(view.getByRole("button", { name: "Restore" }));
		await waitFor(() => {
			expect(
				findCall(fetchMock, "POST", "/api/accounts/acc-2/restore"),
			).toBeDefined();
		});
		const call = findCall(fetchMock, "POST", "/api/accounts/acc-2/restore");
		expect(JSON.parse(String((call?.[1] as RequestInit)?.body))).toEqual({});
		expect(toast.success).toHaveBeenCalledWith("Account restored.");
	});

	it("restores under a new name when the name conflicts", async () => {
		let restoreCalls = 0;
		const { fetchMock } = makeRegisteredMachine({
			"GET /api/preferences": preferences(),
			"GET /api/accounts": () =>
				jsonResponse(200, {
					accounts: [deletedAccount],
					combinedBalanceMinor: 0,
				}),
			"POST /api/accounts/acc-2/restore": (init?: RequestInit) => {
				restoreCalls += 1;
				const body = JSON.parse(String(init?.body ?? "{}")) as {
					newName?: string;
				};
				if (body.newName === undefined) {
					return jsonResponse(409, {
						error: {
							code: "ACCOUNT_NAME_TAKEN",
							message: "account name taken",
							details: [],
						},
					});
				}
				return jsonResponse(200, {
					...deletedAccount,
					name: body.newName,
					status: "active",
				});
			},
		});
		const { view } = await renderWithProviders(<AccountsScreen />);
		await waitFor(
			() =>
				expect(view.getByRole("button", { name: "Restore" })).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		await fireEvent.press(view.getByRole("button", { name: "Restore" }));
		// The conflict opens the rename prompt prefilled with the old name.
		await waitFor(
			() => expect(view.getByText("Choose a new name")).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		expect(view.getByLabelText("New name").props.value).toBe("Old Wallet");
		await fireEvent.changeText(view.getByLabelText("New name"), "New Wallet");
		await fireEvent.press(
			view.getByRole("button", { name: "Restore with new name" }),
		);
		await waitFor(() => expect(restoreCalls).toBe(2), { timeout: 10_000 });
		const retry = fetchMock.mock.calls.find(([, init]) =>
			String((init as RequestInit | undefined)?.body ?? "").includes("newName"),
		);
		expect(retry).toBeDefined();
		expect(JSON.parse(String((retry?.[1] as RequestInit)?.body))).toEqual({
			newName: "New Wallet",
		});
		// Success closes the rename prompt.
		await waitFor(() =>
			expect(view.queryByText("Choose a new name")).toBeNull(),
		);
		expect(toast.success).toHaveBeenCalledWith("Account restored.");
	});
});

describe("AccountFormDialog (edit mode)", () => {
	beforeEach(() => {
		vi.mocked(toast.success).mockClear();
		vi.mocked(toast.error).mockClear();
	});

	it("prefills parsed values and submits the update", async () => {
		const { fetchMock } = makeRegisteredMachine({
			"GET /api/preferences": preferences(),
			"PATCH /api/accounts/acc-1": () => jsonResponse(200, account),
		});
		const onOpenChange = vi.fn();
		const { view } = await renderWithProviders(
			<AccountFormDialog
				open
				account={account}
				display={INR_DISPLAY}
				onOpenChange={onOpenChange}
			/>,
		);
		await waitFor(
			() =>
				expect(view.getByLabelText("Account name").props.value).toBe(
					"HDFC Bank",
				),
			{ timeout: 10_000 },
		);
		// 100000 paise renders as the major-unit edit string.
		expect(view.getByLabelText("Opening balance (₹)").props.value).toBe(
			"1000.00",
		);
		expect(view.getByText('Edit "HDFC Bank"')).toBeOnTheScreen();
		await fireEvent.changeText(
			view.getByLabelText("Account name"),
			"HDFC Bank Prime",
		);
		await fireEvent.press(view.getByRole("button", { name: "Save changes" }));
		await waitFor(() => {
			expect(findCall(fetchMock, "PATCH", "/api/accounts/acc-1")).toBeDefined();
		});
		const call = findCall(fetchMock, "PATCH", "/api/accounts/acc-1");
		expect(JSON.parse(String((call?.[1] as RequestInit)?.body))).toEqual({
			name: "HDFC Bank Prime",
			type: "bank",
			openingBalanceMinor: 100000,
		});
		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
	});
});
