import { fireEvent, waitFor } from "@testing-library/react-native";
import type {
	AccountResponse,
	ReportSummaryResponse,
} from "@finance-application/schemas";

import { describe, expect, it, vi } from "vitest";

// The shared select fields are native @expo/ui components now; run their
// content through the typed test doubles (design.md D9 — see
// src/components/ui/SPIKE-NOTES.md).
vi.mock(
	"@expo/ui/jetpack-compose",
	async () => await import("@tests/helpers/ui-doubles"),
);

// The preferences hook chain reaches sonner-native (reanimated easings);
// mock it so the screen test stays native-module free.
vi.mock("sonner-native", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

import DashboardScreen from "@/app/(app)/index";
import {
	currentMonthValue,
	currentYearValue,
	periodLabel,
} from "@/components/dashboard/period";
import { jsonResponse } from "@/session/fetch-mock";
import { pickOption, renderWithProviders } from "../../helpers";
import { makeRegisteredMachine } from "../../services/helpers";

// The whole screen renders over stubbed API fixtures, the same shape the
// web's dashboard tests use: one report-summary payload per scenario.
const account: AccountResponse = {
	id: "acc-1",
	name: "HDFC Bank",
	type: "bank",
	openingBalanceMinor: 100000,
	currentBalanceMinor: 525000,
	status: "active",
	archivedAt: null,
	deletedAt: null,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

function reportFixture(
	overrides: Partial<ReportSummaryResponse> = {},
): ReportSummaryResponse {
	return {
		periodFrom: "2026-01-01",
		periodTo: "2026-01-31",
		incomeMinor: 500000,
		expenseMinor: 325000,
		netCashFlowMinor: 175000,
		categoryBreakdown: [
			{
				categoryId: "cat-1",
				categoryName: "Groceries",
				amountMinor: 200000,
				sharePercent: 61.54,
			},
			{
				categoryId: "cat-2",
				categoryName: null,
				amountMinor: 100000,
				sharePercent: 30.77,
			},
		],
		comparison: [],
		accounts: [account],
		combinedBalanceMinor: 525000,
		...overrides,
	};
}

function baseHandlers(
	report: ReportSummaryResponse = reportFixture(),
): Parameters<typeof makeRegisteredMachine>[0] {
	return {
		"GET /api/preferences": () =>
			jsonResponse(200, {
				currencyCode: "INR",
				currencySymbol: "₹",
				minorUnitExponent: 2,
			}),
		"GET /api/reports/summary": () => jsonResponse(200, report),
	} as Parameters<typeof makeRegisteredMachine>[0];
}

function reportUrls(fetchMock: { mock: { calls: unknown[][] } }): string[] {
	return fetchMock.mock.calls
		.map(([input]) => String(input))
		.filter((url) => url.includes("/api/reports/summary"));
}

describe("DashboardScreen", () => {
	it("requests the current month by default and shows the period label", async () => {
		const { fetchMock } = makeRegisteredMachine(baseHandlers());
		const { view } = await renderWithProviders(<DashboardScreen />);
		await waitFor(() => expect(view.getByText("Income")).toBeOnTheScreen(), {
			timeout: 10_000,
		});
		const month = currentMonthValue();
		expect(reportUrls(fetchMock)[0]).toContain(`month=${month}`);
		expect(
			view.getByText(`Showing ${periodLabel({ month })}`),
		).toBeOnTheScreen();
	});

	it("renders the summary cards with the period totals", async () => {
		makeRegisteredMachine(baseHandlers());
		const { view } = await renderWithProviders(<DashboardScreen />);
		await waitFor(
			() => expect(view.getByText("Net cash flow")).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		expect(view.getByText("₹5,000.00")).toBeOnTheScreen();
		expect(view.getByText("₹3,250.00")).toBeOnTheScreen();
		expect(view.getByText("₹1,750.00")).toBeOnTheScreen();
		expect(
			view.getByText(
				`Received during ${periodLabel({ month: currentMonthValue() })}`,
			),
		).toBeOnTheScreen();
		expect(view.getByText("Income minus expenses")).toBeOnTheScreen();
	});

	it("renders a negative net cash flow as identifiable", async () => {
		makeRegisteredMachine(
			baseHandlers(
				reportFixture({
					incomeMinor: 100000,
					expenseMinor: 325000,
					netCashFlowMinor: -225000,
				}),
			),
		);
		const { view } = await renderWithProviders(<DashboardScreen />);
		await waitFor(
			() => expect(view.getByText("Net cash flow")).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		// The formatter's leading sign keeps the figure identifiable.
		expect(view.getByText("-₹2,250.00")).toBeOnTheScreen();
	});

	it("renders the category breakdown with the deleted-category fallback", async () => {
		makeRegisteredMachine(baseHandlers());
		const { view } = await renderWithProviders(<DashboardScreen />);
		await waitFor(
			() => expect(view.getByText("Expenses by category")).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		expect(view.getByText("Groceries")).toBeOnTheScreen();
		expect(view.getByText("Unavailable")).toBeOnTheScreen();
		expect(view.getByTestId("breakdown-fill-cat-1")).toBeOnTheScreen();
	});

	it("renders active account balances with the combined balance", async () => {
		makeRegisteredMachine(baseHandlers());
		const { view } = await renderWithProviders(<DashboardScreen />);
		await waitFor(() => expect(view.getByText("Accounts")).toBeOnTheScreen(), {
			timeout: 10_000,
		});
		expect(view.getByText("HDFC Bank")).toBeOnTheScreen();
		expect(view.getByText("Bank")).toBeOnTheScreen();
		// The row figure and the combined figure coincide in this fixture.
		expect(view.getAllByText("₹5,250.00").length).toBeGreaterThan(0);
		expect(view.getByText("Combined balance ₹5,250.00")).toBeOnTheScreen();
	});

	it("renders the no-accounts state with a zero combined balance", async () => {
		makeRegisteredMachine(
			baseHandlers(reportFixture({ accounts: [], combinedBalanceMinor: 0 })),
		);
		const { view } = await renderWithProviders(<DashboardScreen />);
		await waitFor(
			() => expect(view.getByText("No accounts added yet")).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		expect(view.getByText("Combined balance ₹0.00")).toBeOnTheScreen();
		expect(view.queryByText("HDFC Bank")).toBeNull();
	});

	it("refetches for the selected period without reloading the app", async () => {
		const { fetchMock } = makeRegisteredMachine(baseHandlers());
		const { view } = await renderWithProviders(<DashboardScreen />);
		await waitFor(() => expect(view.getByText("Income")).toBeOnTheScreen(), {
			timeout: 10_000,
		});
		const monthUrls = reportUrls(fetchMock).length;

		// Switch to year mode: the year select takes over and the summary is
		// requested for the year.
		await fireEvent.press(view.getByRole("button", { name: "Year" }));
		await waitFor(
			() => expect(reportUrls(fetchMock).length).toBeGreaterThan(monthUrls),
			{ timeout: 10_000 },
		);
		expect(
			reportUrls(fetchMock).some((url) =>
				url.includes(`year=${currentYearValue()}`),
			),
		).toBe(true);
		expect(view.getByText(`Showing ${currentYearValue()}`)).toBeOnTheScreen();

		// Back to month mode and pick a different month: a fresh request for
		// that month.
		await fireEvent.press(view.getByRole("button", { name: "Month" }));
		// "Month" is both the mode tab and the select's label; the select is
		// mounted once the label appears twice.
		await waitFor(
			() => expect(view.getAllByText("Month").length).toBeGreaterThan(1),
			{ timeout: 10_000 },
		);
		const before = reportUrls(fetchMock).length;
		// The native dropdown's options mount inline under the test doubles:
		// pick February directly.
		await pickOption(view, "February", "Month");
		await waitFor(
			() => {
				const urls = reportUrls(fetchMock);
				expect(urls.length).toBeGreaterThan(before);
				expect(
					urls.some((url) => url.includes(`month=${currentYearValue()}-02`)),
				).toBe(true);
			},
			{ timeout: 10_000 },
		);
		expect(
			view.getByText(`Showing February ${currentYearValue()}`),
		).toBeOnTheScreen();
	});
});
