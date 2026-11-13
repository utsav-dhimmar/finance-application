import { fireEvent, waitFor } from "@testing-library/react-native";
import type {
	AccountResponse,
	TransferResponse,
} from "@finance-application/schemas";
import { transferFormSchema } from "@finance-application/schemas";

import { toast } from "sonner-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TransferFormDialog } from "@/components/transfers/transfer-form-dialog";
import { INR_DISPLAY } from "@/lib/format";
import { jsonResponse } from "@/session/fetch-mock";
import { renderWithProviders } from "../../helpers";
import { makeRegisteredMachine } from "../../services/helpers";

vi.mock("expo-crypto", () => ({
	getRandomValues: (bytes: Uint8Array) => bytes.fill(7),
}));
vi.mock("sonner-native", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
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

const transfer: TransferResponse = {
	id: "018f6a2c-9b7d-7ce2-8f3a-1d4e5f6a7b8c",
	amountMinor: 100000,
	date: "2026-01-15",
	sourceAccountId: "acc-1",
	sourceAccountName: "HDFC Bank",
	destinationAccountId: "acc-2",
	destinationAccountName: "Cash Wallet",
	notes: "Restock wallet",
	status: "active",
	archivedAt: null,
	deletedAt: null,
	createdAt: "2026-01-15T00:00:00.000Z",
	updatedAt: "2026-01-15T00:00:00.000Z",
};

function baseHandlers(
	overrides: Record<string, unknown> = {},
): Parameters<typeof makeRegisteredMachine>[0] {
	return {
		"GET /api/accounts": () =>
			jsonResponse(200, {
				accounts: [source, destination],
				combinedBalanceMinor: 525000,
			}),
		...overrides,
	} as Parameters<typeof makeRegisteredMachine>[0];
}

function schemaMessage(values: Record<string, unknown>): string | undefined {
	const result = transferFormSchema.safeParse(values);
	expect(result.success).toBe(false);
	return result.error?.issues[0]?.message;
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

async function pickAccount(
	view: Awaited<ReturnType<typeof renderWithProviders>>["view"],
	fieldLabel: string,
	optionLabel: string,
): Promise<void> {
	await fireEvent.press(view.getByLabelText(fieldLabel));
	await waitFor(
		() => expect(view.getAllByLabelText(optionLabel).length).toBeGreaterThan(0),
		{ timeout: 10_000 },
	);
	// Both sheets list the same accounts and a closed sheet keeps its
	// options findable, so press the open sheet's option (the last match).
	const options = view.getAllByLabelText(optionLabel);
	const option = options[options.length - 1];
	if (!option) {
		throw new Error(`Option not found: ${optionLabel}`);
	}
	await fireEvent.press(option);
}

beforeEach(() => {
	vi.mocked(toast.success).mockClear();
	vi.mocked(toast.error).mockClear();
});

describe("TransferFormDialog (create)", () => {
	it("submits the parsed minor-unit payload with a client UUIDv7 id", async () => {
		const { fetchMock } = makeRegisteredMachine(
			baseHandlers({
				"POST /api/transfers": () => jsonResponse(201, transfer),
			}),
		);
		const onOpenChange = vi.fn();
		const { view } = await renderWithProviders(
			<TransferFormDialog
				display={INR_DISPLAY}
				onOpenChange={onOpenChange}
				open
			/>,
		);
		await waitFor(
			() => expect(view.getByLabelText("Amount (₹)")).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		await pickAccount(view, "Source account", "HDFC Bank");
		await pickAccount(view, "Destination account", "Cash Wallet");
		await fireEvent.changeText(view.getByLabelText("Amount (₹)"), "2500.75");
		await fireEvent.press(
			view.getByRole("button", { name: "Record transfer" }),
		);
		await waitFor(() => {
			expect(findCall(fetchMock, "POST", "/api/transfers")).toBeDefined();
		});
		const call = findCall(fetchMock, "POST", "/api/transfers");
		const body = JSON.parse(String((call?.[1] as RequestInit)?.body));
		expect(body).toEqual({
			id: expect.any(String),
			amountMinor: 250075,
			date: expect.any(String),
			sourceAccountId: "acc-1",
			destinationAccountId: "acc-2",
		});
		expect(body.id).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
		);
		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		expect(toast.success).toHaveBeenCalledWith("Transfer recorded.");
	});

	it("blocks the same account as source and destination with the schema's message", async () => {
		const { fetchMock } = makeRegisteredMachine(baseHandlers());
		const { view } = await renderWithProviders(
			<TransferFormDialog display={INR_DISPLAY} onOpenChange={vi.fn()} open />,
		);
		await waitFor(
			() => expect(view.getByLabelText("Amount (₹)")).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		await pickAccount(view, "Source account", "HDFC Bank");
		await pickAccount(view, "Destination account", "HDFC Bank");
		await fireEvent.changeText(view.getByLabelText("Amount (₹)"), "100");
		await fireEvent.press(
			view.getByRole("button", { name: "Record transfer" }),
		);
		await waitFor(
			() =>
				expect(
					view.getByText(
						schemaMessage({
							amount: "100",
							date: "2026-01-15",
							sourceAccountId: "acc-1",
							destinationAccountId: "acc-1",
						}) ?? "",
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

	it("blocks submission and shows the schema messages for invalid fields", async () => {
		const { fetchMock } = makeRegisteredMachine(baseHandlers());
		const { view } = await renderWithProviders(
			<TransferFormDialog display={INR_DISPLAY} onOpenChange={vi.fn()} open />,
		);
		await waitFor(
			() => expect(view.getByLabelText("Amount (₹)")).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		await fireEvent.press(
			view.getByRole("button", { name: "Record transfer" }),
		);
		await waitFor(
			() =>
				expect(
					view.getByText(
						schemaMessage({
							amount: "",
							date: "2026-01-15",
							sourceAccountId: "",
							destinationAccountId: "",
						}) ?? "",
					),
				).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		// The missing-source message and the amount message both render.
		expect(
			view.getByText(
				schemaMessage({
					amount: "1",
					date: "2026-01-15",
					sourceAccountId: "",
					destinationAccountId: "",
				}) ?? "",
			),
		).toBeOnTheScreen();
		expect(
			fetchMock.mock.calls.some(
				([, init]) => (init as RequestInit | undefined)?.method === "POST",
			),
		).toBe(false);
	});
});

describe("TransferFormDialog (edit)", () => {
	it("prefills the parsed values and submits the update", async () => {
		const { fetchMock } = makeRegisteredMachine(
			baseHandlers({
				"PATCH /api/transfers/018f6a2c-9b7d-7ce2-8f3a-1d4e5f6a7b8c": () =>
					jsonResponse(200, transfer),
			}),
		);
		const onOpenChange = vi.fn();
		const { view } = await renderWithProviders(
			<TransferFormDialog
				display={INR_DISPLAY}
				onOpenChange={onOpenChange}
				open
				transfer={transfer}
			/>,
		);
		await waitFor(
			() =>
				expect(view.getByLabelText("Amount (₹)").props.value).toBe("1000.00"),
			{ timeout: 10_000 },
		);
		expect(view.getByText("Edit transfer")).toBeOnTheScreen();
		await fireEvent.changeText(view.getByLabelText("Amount (₹)"), "1200");
		await fireEvent.press(view.getByRole("button", { name: "Save changes" }));
		await waitFor(() => {
			expect(
				findCall(
					fetchMock,
					"PATCH",
					"/api/transfers/018f6a2c-9b7d-7ce2-8f3a-1d4e5f6a7b8c",
				),
			).toBeDefined();
		});
		const call = findCall(
			fetchMock,
			"PATCH",
			"/api/transfers/018f6a2c-9b7d-7ce2-8f3a-1d4e5f6a7b8c",
		);
		expect(JSON.parse(String((call?.[1] as RequestInit)?.body))).toEqual({
			amountMinor: 120000,
			date: "2026-01-15",
			sourceAccountId: "acc-1",
			destinationAccountId: "acc-2",
			notes: "Restock wallet",
		});
		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
	});
});
