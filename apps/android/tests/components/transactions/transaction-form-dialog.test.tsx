import { fireEvent, waitFor } from "@testing-library/react-native";
import type {
	AccountResponse,
	CategoryResponse,
	TransactionResponse,
} from "@finance-application/schemas";
import { transactionFormSchema } from "@finance-application/schemas";

import { toast } from "sonner-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TransactionFormDialog } from "@/components/transactions/transaction-form-dialog";
import { INR_DISPLAY } from "@/lib/format";
import { jsonResponse } from "@/session/fetch-mock";
import { renderWithProviders } from "../../helpers";
import { makeRegisteredMachine } from "../../services/helpers";

// The form generates client UUIDv7 ids through expo-crypto; give the native
// module a deterministic stub for the native engine.
vi.mock("expo-crypto", () => ({
	getRandomValues: (bytes: Uint8Array) => bytes.fill(7),
}));
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

const expenseCategory: CategoryResponse = {
	id: "cat-1",
	name: "Groceries",
	type: "expense",
	color: null,
	icon: null,
	status: "active",
	archivedAt: null,
	deletedAt: null,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

const incomeCategory: CategoryResponse = {
	...expenseCategory,
	id: "cat-2",
	name: "Salary",
	type: "income",
};

const transaction: TransactionResponse = {
	id: "018f6a2c-9b7d-7ce2-8f3a-1d4e5f6a7b8c",
	type: "expense",
	amountMinor: 100000,
	date: "2026-01-15",
	accountId: "acc-1",
	accountName: "HDFC Bank",
	categoryId: "cat-1",
	categoryName: "Groceries",
	notes: "Weekly shop",
	status: "active",
	archivedAt: null,
	deletedAt: null,
	createdAt: "2026-01-15T00:00:00.000Z",
	updatedAt: "2026-01-15T00:00:00.000Z",
};

function baseHandlers(
	overrides: Record<string, unknown> = {},
): Record<string, unknown> {
	return {
		"GET /api/accounts": () =>
			jsonResponse(200, { accounts: [account], combinedBalanceMinor: 125050 }),
		"GET /api/categories": () =>
			jsonResponse(200, { categories: [expenseCategory, incomeCategory] }),
		...overrides,
	};
}

function schemaMessage(values: Record<string, unknown>, path: string): string {
	const result = transactionFormSchema.safeParse(values);
	expect(result.success).toBe(false);
	return (
		result.error?.issues.find((issue) => issue.path.includes(path))?.message ??
		""
	);
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

describe("TransactionFormDialog (create)", () => {
	it("submits the parsed minor-unit payload with a client UUIDv7 id", async () => {
		const { fetchMock } = makeRegisteredMachine(
			baseHandlers({
				"POST /api/transactions": () => jsonResponse(201, transaction),
			}) as Parameters<typeof makeRegisteredMachine>[0],
		);
		const onOpenChange = vi.fn();
		const { view } = await renderWithProviders(
			<TransactionFormDialog
				display={INR_DISPLAY}
				onOpenChange={onOpenChange}
				open
			/>,
		);
		await waitFor(
			() => expect(view.getByLabelText("Amount (₹)")).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		// The category options follow the selected type; pick account and
		// category through the shared select fields. (The native Modal mock
		// keeps closed sheets findable, so closed-state asserts are omitted.)
		await fireEvent.press(view.getByLabelText("Account"));
		await waitFor(() =>
			expect(view.getByLabelText("HDFC Bank")).toBeOnTheScreen(),
		);
		await fireEvent.press(view.getByLabelText("HDFC Bank"));
		await fireEvent.press(view.getByLabelText("Category"));
		await waitFor(() =>
			expect(view.getByLabelText("Groceries")).toBeOnTheScreen(),
		);
		await fireEvent.press(view.getByLabelText("Groceries"));
		await fireEvent.changeText(view.getByLabelText("Amount (₹)"), "1250.50");
		await fireEvent.press(
			view.getByRole("button", { name: "Record transaction" }),
		);
		await waitFor(() => {
			expect(findCall(fetchMock, "POST", "/api/transactions")).toBeDefined();
		});
		const call = findCall(fetchMock, "POST", "/api/transactions");
		const body = JSON.parse(String((call?.[1] as RequestInit)?.body));
		// The amount parses to integer paise; the id is a client UUIDv7.
		expect(body).toEqual({
			id: expect.any(String),
			type: "expense",
			amountMinor: 125050,
			date: expect.any(String),
			accountId: "acc-1",
			categoryId: "cat-1",
		});
		expect(body.id).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
		);
		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		expect(toast.success).toHaveBeenCalledWith("Transaction recorded.");
	});

	it("blocks submission and shows the schema messages for invalid fields", async () => {
		const { fetchMock } = makeRegisteredMachine(
			baseHandlers() as Parameters<typeof makeRegisteredMachine>[0],
		);
		const { view } = await renderWithProviders(
			<TransactionFormDialog
				display={INR_DISPLAY}
				onOpenChange={vi.fn()}
				open
			/>,
		);
		await waitFor(
			() => expect(view.getByLabelText("Amount (₹)")).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		await fireEvent.changeText(view.getByLabelText("Amount (₹)"), "0");
		await fireEvent.press(
			view.getByRole("button", { name: "Record transaction" }),
		);
		const blank = {
			type: "expense",
			amount: "0",
			date: "2026-01-15",
			accountId: "",
			categoryId: "",
		};
		await waitFor(
			() =>
				expect(
					view.getByText(schemaMessage(blank, "amount")),
				).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		expect(view.getByText(schemaMessage(blank, "accountId"))).toBeOnTheScreen();
		expect(
			view.getByText(schemaMessage(blank, "categoryId")),
		).toBeOnTheScreen();
		expect(
			fetchMock.mock.calls.some(
				([, init]) => (init as RequestInit | undefined)?.method === "POST",
			),
		).toBe(false);
	});
});

describe("TransactionFormDialog (edit)", () => {
	it("prefills the parsed values and submits the update", async () => {
		const { fetchMock } = makeRegisteredMachine(
			baseHandlers({
				"PATCH /api/transactions/018f6a2c-9b7d-7ce2-8f3a-1d4e5f6a7b8c": () =>
					jsonResponse(200, transaction),
			}) as Parameters<typeof makeRegisteredMachine>[0],
		);
		const onOpenChange = vi.fn();
		const { view } = await renderWithProviders(
			<TransactionFormDialog
				display={INR_DISPLAY}
				onOpenChange={onOpenChange}
				open
				transaction={transaction}
			/>,
		);
		await waitFor(
			() =>
				expect(view.getByLabelText("Amount (₹)").props.value).toBe("1000.00"),
			{ timeout: 10_000 },
		);
		expect(view.getByLabelText("Transaction date")).toBeOnTheScreen();
		expect(view.getByText("Edit transaction")).toBeOnTheScreen();
		await fireEvent.changeText(view.getByLabelText("Amount (₹)"), "1500.75");
		await fireEvent.press(view.getByRole("button", { name: "Save changes" }));
		await waitFor(() => {
			expect(
				findCall(
					fetchMock,
					"PATCH",
					"/api/transactions/018f6a2c-9b7d-7ce2-8f3a-1d4e5f6a7b8c",
				),
			).toBeDefined();
		});
		const call = findCall(
			fetchMock,
			"PATCH",
			"/api/transactions/018f6a2c-9b7d-7ce2-8f3a-1d4e5f6a7b8c",
		);
		expect(JSON.parse(String((call?.[1] as RequestInit)?.body))).toEqual({
			amountMinor: 150075,
			date: "2026-01-15",
			accountId: "acc-1",
			categoryId: "cat-1",
			notes: "Weekly shop",
		});
		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
	});
});
