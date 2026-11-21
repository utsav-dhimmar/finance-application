import { describe, expect, it, vi } from "vitest";
import type { Account } from "@/db/schema";
import type { AccountList } from "@/services/account-service";
import {
	createReportService,
	type ReportTransactionQueries,
} from "@/services/report-service";

// In-memory model of the reporting query seam. The seam's contract — active
// and archived rows count, deleted rows never do, dates filter inclusively —
// is what the service is written against; the transaction repository's
// integration tests verify its SQL honors the same contract.
function createFakes(
	seed: Array<{
		id: string;
		userId: string;
		type: string;
		amountMinor: number;
		date: string;
		status: string;
		categoryId: string;
	}>,
) {
	const categoryNames = new Map<string, string | null>([
		["cat-food", "Groceries"],
		["cat-archived", "Archived Category"],
		["cat-deleted", "Deleted Category"],
	]);

	function inRange(
		row: (typeof seed)[number],
		userId: string,
		from: string,
		to: string,
	): boolean {
		return (
			row.userId === userId &&
			(row.status === "active" || row.status === "archived") &&
			row.date >= from &&
			row.date <= to
		);
	}

	const transactions: ReportTransactionQueries = {
		sumTypeEffectsInRange: vi.fn(async (userId, from, to) => {
			let incomeMinor = 0;
			let expenseMinor = 0;
			for (const row of seed) {
				if (!inRange(row, userId, from, to)) {
					continue;
				}
				if (row.type === "income") {
					incomeMinor += row.amountMinor;
				} else {
					expenseMinor += row.amountMinor;
				}
			}
			return { incomeMinor, expenseMinor };
		}),
		expenseByCategoryInRange: vi.fn(async (userId, from, to) => {
			const totals = new Map<string, number>();
			for (const row of seed) {
				if (!inRange(row, userId, from, to) || row.type !== "expense") {
					continue;
				}
				totals.set(
					row.categoryId,
					(totals.get(row.categoryId) ?? 0) + row.amountMinor,
				);
			}
			return [...totals.entries()]
				.map(([categoryId, amountMinor]) => ({
					categoryId,
					categoryName: categoryNames.get(categoryId) ?? null,
					amountMinor,
				}))
				.sort(
					(a, b) =>
						b.amountMinor - a.amountMinor ||
						(a.categoryId < b.categoryId ? -1 : 1),
				);
		}),
		typeSumsPerDayInRange: vi.fn(async (userId, from, to) => {
			const sums = new Map<
				string,
				{ incomeMinor: number; expenseMinor: number }
			>();
			for (const row of seed) {
				if (!inRange(row, userId, from, to)) {
					continue;
				}
				const bucket = sums.get(row.date) ?? {
					incomeMinor: 0,
					expenseMinor: 0,
				};
				if (row.type === "income") {
					bucket.incomeMinor += row.amountMinor;
				} else {
					bucket.expenseMinor += row.amountMinor;
				}
				sums.set(row.date, bucket);
			}
			return sums;
		}),
	};

	function accountRow(overrides: Partial<Account> & { id: string }): Account {
		return {
			userId: "user-1",
			name: overrides.id,
			nameNormalized: (overrides.name ?? overrides.id).toLowerCase(),
			type: "bank",
			openingBalanceMinor: 0,
			status: "active",
			archivedAt: null,
			deletedAt: null,
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-01T00:00:00.000Z",
			...overrides,
		};
	}

	const accounts = {
		list: vi.fn(
			async (_userId: string, _status: string): Promise<AccountList> => {
				const rows = [
					accountRow({ id: "acc-1", openingBalanceMinor: 100_000 }),
					accountRow({
						id: "acc-2",
						type: "wallet",
						openingBalanceMinor: 5_000,
					}),
				].map((account) => ({
					...account,
					type: account.type as "bank" | "wallet",
					status: "active" as const,
					currentBalanceMinor: account.openingBalanceMinor,
				}));
				return {
					accounts: rows,
					combinedBalanceMinor: rows.reduce(
						(sum, account) => sum + account.currentBalanceMinor,
						0,
					),
				};
			},
		),
	};

	return { transactions, accounts };
}

function createService(fakes: ReturnType<typeof createFakes>) {
	return createReportService({
		transactions: fakes.transactions,
		accounts: fakes.accounts,
	});
}

describe("report service — period validation", () => {
	it("rejects a period with both a month and a year", async () => {
		const service = createService(createFakes([]));
		const outcome = await service.summary("user-1", {
			month: "2026-01",
			year: "2026",
		});
		expect(outcome).toEqual({ ok: false, code: "INVALID_PERIOD" });
	});

	it("rejects a reversed from/to range", async () => {
		const service = createService(createFakes([]));
		const outcome = await service.summary("user-1", {
			from: "2026-02-01",
			to: "2026-01-31",
		});
		expect(outcome).toEqual({ ok: false, code: "INVALID_PERIOD" });
	});

	it("rejects an empty period", async () => {
		const service = createService(createFakes([]));
		const outcome = await service.summary("user-1", {});
		expect(outcome).toEqual({ ok: false, code: "INVALID_PERIOD" });
	});
});

describe("report service — totals and breakdown", () => {
	it("sums income, expense, and net for a month", async () => {
		const fakes = createFakes([
			{
				id: "t1",
				userId: "user-1",
				type: "income",
				amountMinor: 50_000,
				date: "2026-01-10",
				status: "active",
				categoryId: "cat-food",
			},
			{
				id: "t2",
				userId: "user-1",
				type: "expense",
				amountMinor: 20_000,
				date: "2026-01-15",
				status: "active",
				categoryId: "cat-food",
			},
			{
				id: "t3",
				userId: "user-1",
				type: "expense",
				amountMinor: 5_000,
				date: "2026-02-01",
				status: "active",
				categoryId: "cat-food",
			},
		]);
		const outcome = await createService(fakes).summary("user-1", {
			month: "2026-01",
		});
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) {
			return;
		}
		expect(outcome.value.periodFrom).toBe("2026-01-01");
		expect(outcome.value.periodTo).toBe("2026-01-31");
		expect(outcome.value.incomeMinor).toBe(50_000);
		expect(outcome.value.expenseMinor).toBe(20_000);
		expect(outcome.value.netCashFlowMinor).toBe(30_000);
	});

	it("shows a negative net cash flow when expenses exceed income", async () => {
		const fakes = createFakes([
			{
				id: "t1",
				userId: "user-1",
				type: "income",
				amountMinor: 1_000,
				date: "2026-01-10",
				status: "active",
				categoryId: "cat-food",
			},
			{
				id: "t2",
				userId: "user-1",
				type: "expense",
				amountMinor: 9_000,
				date: "2026-01-11",
				status: "active",
				categoryId: "cat-food",
			},
		]);
		const outcome = await createService(fakes).summary("user-1", {
			month: "2026-01",
		});
		if (!outcome.ok) {
			throw new Error("expected a summary");
		}
		expect(outcome.value.netCashFlowMinor).toBe(-8_000);
	});

	it("includes transactions on the first and last day exactly once", async () => {
		const fakes = createFakes([
			{
				id: "first",
				userId: "user-1",
				type: "expense",
				amountMinor: 100,
				date: "2026-01-01",
				status: "active",
				categoryId: "cat-food",
			},
			{
				id: "middle",
				userId: "user-1",
				type: "expense",
				amountMinor: 100,
				date: "2026-01-16",
				status: "active",
				categoryId: "cat-food",
			},
			{
				id: "last",
				userId: "user-1",
				type: "expense",
				amountMinor: 100,
				date: "2026-01-31",
				status: "active",
				categoryId: "cat-food",
			},
			{
				id: "before",
				userId: "user-1",
				type: "expense",
				amountMinor: 100,
				date: "2025-12-31",
				status: "active",
				categoryId: "cat-food",
			},
			{
				id: "after",
				userId: "user-1",
				type: "expense",
				amountMinor: 100,
				date: "2026-02-01",
				status: "active",
				categoryId: "cat-food",
			},
		]);
		const outcome = await createService(fakes).summary("user-1", {
			month: "2026-01",
		});
		if (!outcome.ok) {
			throw new Error("expected a summary");
		}
		expect(outcome.value.expenseMinor).toBe(300);
		// The bounds passed to the queries are the inclusive calendar extremes.
		expect(fakes.transactions.sumTypeEffectsInRange).toHaveBeenCalledWith(
			"user-1",
			"2026-01-01",
			"2026-01-31",
		);
	});

	it("counts archived transactions and excludes soft-deleted ones", async () => {
		const fakes = createFakes([
			{
				id: "a",
				userId: "user-1",
				type: "expense",
				amountMinor: 100,
				date: "2026-01-05",
				status: "active",
				categoryId: "cat-food",
			},
			{
				id: "b",
				userId: "user-1",
				type: "expense",
				amountMinor: 200,
				date: "2026-01-06",
				status: "archived",
				categoryId: "cat-food",
			},
			{
				id: "c",
				userId: "user-1",
				type: "expense",
				amountMinor: 400,
				date: "2026-01-07",
				status: "deleted",
				categoryId: "cat-food",
			},
		]);
		const outcome = await createService(fakes).summary("user-1", {
			month: "2026-01",
		});
		if (!outcome.ok) {
			throw new Error("expected a summary");
		}
		expect(outcome.value.expenseMinor).toBe(300);
	});

	it("resolves breakdown names regardless of category lifecycle and shares the expense total", async () => {
		const fakes = createFakes([
			{
				id: "t1",
				userId: "user-1",
				type: "expense",
				amountMinor: 60_000,
				date: "2026-01-05",
				status: "active",
				categoryId: "cat-archived",
			},
			{
				id: "t2",
				userId: "user-1",
				type: "expense",
				amountMinor: 30_000,
				date: "2026-01-06",
				status: "archived",
				categoryId: "cat-deleted",
			},
			{
				id: "t3",
				userId: "user-1",
				type: "expense",
				amountMinor: 10_000,
				date: "2026-01-07",
				status: "active",
				categoryId: "cat-unknown",
			},
		]);
		const outcome = await createService(fakes).summary("user-1", {
			month: "2026-01",
		});
		if (!outcome.ok) {
			throw new Error("expected a summary");
		}
		expect(outcome.value.categoryBreakdown).toEqual([
			{
				categoryId: "cat-archived",
				categoryName: "Archived Category",
				amountMinor: 60_000,
				sharePercent: 60,
			},
			{
				categoryId: "cat-deleted",
				categoryName: "Deleted Category",
				amountMinor: 30_000,
				sharePercent: 30,
			},
			{
				categoryId: "cat-unknown",
				categoryName: null,
				amountMinor: 10_000,
				sharePercent: 10,
			},
		]);
	});

	it("omits income rows from the expense breakdown", async () => {
		const fakes = createFakes([
			{
				id: "t1",
				userId: "user-1",
				type: "income",
				amountMinor: 90_000,
				date: "2026-01-05",
				status: "active",
				categoryId: "cat-food",
			},
			{
				id: "t2",
				userId: "user-1",
				type: "expense",
				amountMinor: 10_000,
				date: "2026-01-06",
				status: "active",
				categoryId: "cat-food",
			},
		]);
		const outcome = await createService(fakes).summary("user-1", {
			month: "2026-01",
		});
		if (!outcome.ok) {
			throw new Error("expected a summary");
		}
		expect(outcome.value.categoryBreakdown).toEqual([
			{
				categoryId: "cat-food",
				categoryName: "Groceries",
				amountMinor: 10_000,
				sharePercent: 100,
			},
		]);
	});
});

describe("report service — comparison series", () => {
	it("fills every day of a month view with zeros when the period is empty", async () => {
		const outcome = await createService(createFakes([])).summary("user-1", {
			month: "2026-01",
		});
		if (!outcome.ok) {
			throw new Error("expected a summary");
		}
		expect(outcome.value.comparison).toHaveLength(31);
		expect(outcome.value.comparison[0]).toEqual({
			label: "2026-01-01",
			incomeMinor: 0,
			expenseMinor: 0,
		});
		expect(outcome.value.comparison[30]).toEqual({
			label: "2026-01-31",
			incomeMinor: 0,
			expenseMinor: 0,
		});
	});

	it("fills every month of a year view with zeros when the period is empty", async () => {
		const outcome = await createService(createFakes([])).summary("user-1", {
			year: "2026",
		});
		if (!outcome.ok) {
			throw new Error("expected a summary");
		}
		expect(outcome.value.comparison).toHaveLength(12);
		expect(outcome.value.comparison.map((bucket) => bucket.label)).toEqual([
			"2026-01",
			"2026-02",
			"2026-03",
			"2026-04",
			"2026-05",
			"2026-06",
			"2026-07",
			"2026-08",
			"2026-09",
			"2026-10",
			"2026-11",
			"2026-12",
		]);
	});

	it("covers leap-year February with 29 daily buckets", async () => {
		const fakes = createFakes([
			{
				id: "t",
				userId: "user-1",
				type: "expense",
				amountMinor: 500,
				date: "2024-02-29",
				status: "active",
				categoryId: "cat-food",
			},
		]);
		const outcome = await createService(fakes).summary("user-1", {
			month: "2024-02",
		});
		if (!outcome.ok) {
			throw new Error("expected a summary");
		}
		expect(outcome.value.periodTo).toBe("2024-02-29");
		expect(outcome.value.comparison).toHaveLength(29);
		expect(outcome.value.comparison[28]).toEqual({
			label: "2024-02-29",
			incomeMinor: 0,
			expenseMinor: 500,
		});
		expect(outcome.value.expenseMinor).toBe(500);
	});

	it("aggregates a year view into monthly buckets", async () => {
		const fakes = createFakes([
			{
				id: "t1",
				userId: "user-1",
				type: "income",
				amountMinor: 1_000,
				date: "2026-03-02",
				status: "active",
				categoryId: "cat-food",
			},
			{
				id: "t2",
				userId: "user-1",
				type: "expense",
				amountMinor: 400,
				date: "2026-03-20",
				status: "active",
				categoryId: "cat-food",
			},
			{
				id: "t3",
				userId: "user-1",
				type: "expense",
				amountMinor: 100,
				date: "2026-03-25",
				status: "active",
				categoryId: "cat-food",
			},
			{
				id: "t4",
				userId: "user-1",
				type: "expense",
				amountMinor: 900,
				date: "2026-04-01",
				status: "active",
				categoryId: "cat-food",
			},
		]);
		const outcome = await createService(fakes).summary("user-1", {
			year: "2026",
		});
		if (!outcome.ok) {
			throw new Error("expected a summary");
		}
		expect(outcome.value.comparison[2]).toEqual({
			label: "2026-03",
			incomeMinor: 1_000,
			expenseMinor: 500,
		});
		expect(outcome.value.comparison[3]).toEqual({
			label: "2026-04",
			incomeMinor: 0,
			expenseMinor: 900,
		});
		expect(outcome.value.comparison[0]).toEqual({
			label: "2026-01",
			incomeMinor: 0,
			expenseMinor: 0,
		});
	});

	it("uses daily buckets for a short explicit range and monthly ones for a long range", async () => {
		const short = await createService(createFakes([])).summary("user-1", {
			from: "2026-01-01",
			to: "2026-03-31",
		});
		if (!short.ok) {
			throw new Error("expected a summary");
		}
		// Three overlapping month keys stay daily: 31 + 28 + 31 days.
		expect(short.value.comparison).toHaveLength(90);
		expect(short.value.comparison[0]?.label).toBe("2026-01-01");

		const long = await createService(createFakes([])).summary("user-1", {
			from: "2025-01-01",
			to: "2026-12-31",
		});
		if (!long.ok) {
			throw new Error("expected a summary");
		}
		expect(long.value.comparison).toHaveLength(24);
		expect(long.value.comparison[0]?.label).toBe("2025-01");
		expect(long.value.comparison[23]?.label).toBe("2026-12");
	});
});

describe("report service — balance section", () => {
	it("reuses the account service's active-accounts list verbatim", async () => {
		const fakes = createFakes([]);
		const outcome = await createService(fakes).summary("user-1", {
			month: "2026-01",
		});
		if (!outcome.ok) {
			throw new Error("expected a summary");
		}
		expect(fakes.accounts.list).toHaveBeenCalledWith("user-1", "active");
		expect(outcome.value.accounts).toHaveLength(2);
		expect(outcome.value.combinedBalanceMinor).toBe(105_000);
	});
});

describe("report service — empty data", () => {
	it("returns zero totals, an empty breakdown, and a zero chart for an empty period", async () => {
		const outcome = await createService(createFakes([])).summary("user-1", {
			month: "2030-06",
		});
		if (!outcome.ok) {
			throw new Error("expected a summary");
		}
		expect(outcome.value.incomeMinor).toBe(0);
		expect(outcome.value.expenseMinor).toBe(0);
		expect(outcome.value.netCashFlowMinor).toBe(0);
		expect(outcome.value.categoryBreakdown).toEqual([]);
		expect(
			outcome.value.comparison.every(
				(b) => b.incomeMinor === 0 && b.expenseMinor === 0,
			),
		).toBe(true);
	});
});
