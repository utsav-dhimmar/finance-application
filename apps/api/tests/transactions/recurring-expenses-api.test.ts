/// <reference types="@cloudflare/vitest-plugin/types" />
import { describe, expect, it } from "vitest";
import type {
	PostDueResponse,
	RecurringExpenseListResponse,
	RecurringExpenseResponse,
	TransactionResponse,
} from "@finance-application/schemas";
import { ACCESS_COOKIE } from "@/lib/session";
import { uuidV7 } from "@/lib/uuid";
import { cookieHeader, fetchApp, seedUserAndLogin } from "../helpers";

const RECURRING_URL = "https://test.local/api/recurring-expenses";
const TRANSACTIONS_URL = "https://test.local/api/transactions";
const ACCOUNTS_URL = "https://test.local/api/accounts";
const CATEGORIES_URL = "https://test.local/api/categories";

function jsonInit(method: string, body?: unknown, cookie?: string): RequestInit {
	return {
		method,
		headers: {
			...(body !== undefined ? { "content-type": "application/json" } : {}),
			...(cookie ? { cookie } : {}),
		},
		...(body !== undefined ? { body: JSON.stringify(body) } : {}),
	};
}

async function freshCookie(): Promise<string> {
	const session = await seedUserAndLogin();
	return cookieHeader({ [ACCESS_COOKIE]: session.access });
}

async function createAccount(
	cookie: string,
	body: Record<string, unknown>,
): Promise<string> {
	const res = await fetchApp(
		ACCOUNTS_URL,
		jsonInit("POST", body, cookie),
	);
	expect(res.status).toBe(201);
	return ((await res.json()) as { id: string }).id;
}

async function createCategory(
	cookie: string,
	body: Record<string, unknown>,
): Promise<string> {
	const res = await fetchApp(
		CATEGORIES_URL,
		jsonInit("POST", body, cookie),
	);
	expect(res.status).toBe(201);
	return ((await res.json()) as { id: string }).id;
}

describe("recurring expenses API endpoints", () => {
	it("creates, queries, modifies cadence, posts due, and skips recurring expenses", async () => {
		const cookie = await freshCookie();
		const accountId = await createAccount(cookie, {
			name: "Salary Checking",
			type: "bank",
			openingBalanceMinor: 1000000,
		});
		const categoryId = await createCategory(cookie, {
			name: "Internet Services",
			type: "expense",
		});

		const ruleId = uuidV7();
		// 1. Create recurring expense rule
		const createRes = await fetchApp(
			RECURRING_URL,
			jsonInit(
				"POST",
				{
					id: ruleId,
					name: "Fibre Broadband",
					amountMinor: 120000,
					intervalMonths: 1,
					startDate: "2026-01-01",
					sourceAccountId: accountId,
					categoryId,
					notes: "High speed plan",
				},
				cookie,
			),
		);
		expect(createRes.status).toBe(201);
		const created = (await createRes.json()) as RecurringExpenseResponse;
		expect(created.name).toBe("Fibre Broadband");
		expect(created.nextDueDate).toBe("2026-01-01");
		expect(created.status).toBe("active");

		// 2. Query due recurring expenses
		const dueRes = await fetchApp(
			`${RECURRING_URL}/due?asOfDate=2026-01-05`,
			jsonInit("GET", undefined, cookie),
		);
		expect(dueRes.status).toBe(200);
		const dueData = (await dueRes.json()) as RecurringExpenseListResponse;
		expect(dueData.recurringExpenses).toHaveLength(1);
		expect(dueData.recurringExpenses[0]?.id).toBe(ruleId);
		expect(dueData.recurringExpenses[0]?.isOverdue).toBe(true);

		// 3. Post the due occurrence
		const postDueTxnId = uuidV7();
		const postDueRes = await fetchApp(
			`${RECURRING_URL}/${ruleId}/post-due`,
			jsonInit(
				"POST",
				{
					transactionId: postDueTxnId,
					amountMinor: 120000,
					date: "2026-01-02",
				},
				cookie,
			),
		);
		expect(postDueRes.status).toBe(201);
		const postDueData = (await postDueRes.json()) as PostDueResponse;
		expect(postDueData.transaction.id).toBe(postDueTxnId);
		expect(postDueData.transaction.recurringExpenseId).toBe(ruleId);
		expect(postDueData.recurringExpense.lastPostedDate).toBe("2026-01-02");
		// advanced by 1 month: 2026-01-01 + 1m = 2026-02-01
		expect(postDueData.recurringExpense.nextDueDate).toBe("2026-02-01");

		// 4. Change cadence duration from 1 month to 3 months
		const patchRes = await fetchApp(
			`${RECURRING_URL}/${ruleId}`,
			jsonInit("PATCH", { intervalMonths: 3 }, cookie),
		);
		expect(patchRes.status).toBe(200);
		const patched = (await patchRes.json()) as RecurringExpenseResponse;
		expect(patched.intervalMonths).toBe(3);
		// recalculated from lastPostedDate (2026-01-02) + 3 months = 2026-04-02
		expect(patched.nextDueDate).toBe("2026-04-02");

		// 5. Pause and resume
		const pauseRes = await fetchApp(
			`${RECURRING_URL}/${ruleId}/pause`,
			jsonInit("POST", undefined, cookie),
		);
		expect(pauseRes.status).toBe(200);
		expect(((await pauseRes.json()) as RecurringExpenseResponse).status).toBe(
			"paused",
		);

		const resumeRes = await fetchApp(
			`${RECURRING_URL}/${ruleId}/resume`,
			jsonInit("POST", undefined, cookie),
		);
		expect(resumeRes.status).toBe(200);
		expect(((await resumeRes.json()) as RecurringExpenseResponse).status).toBe(
			"active",
		);

		// 6. Skip occurrence
		const skipRes = await fetchApp(
			`${RECURRING_URL}/${ruleId}/skip`,
			jsonInit("POST", undefined, cookie),
		);
		expect(skipRes.status).toBe(200);
		const skipped = (await skipRes.json()) as RecurringExpenseResponse;
		// 2026-04-02 + 3 months = 2026-07-02
		expect(skipped.nextDueDate).toBe("2026-07-02");
	});

	it("POST /api/transactions with recurrence atomically records transaction and establishes recurring schedule", async () => {
		const cookie = await freshCookie();
		const accountId = await createAccount(cookie, {
			name: "Main Account",
			type: "bank",
			openingBalanceMinor: 500000,
		});
		const categoryId = await createCategory(cookie, {
			name: "Streaming Subscriptions",
			type: "expense",
		});

		const txnId = uuidV7();
		const res = await fetchApp(
			TRANSACTIONS_URL,
			jsonInit(
				"POST",
				{
					id: txnId,
					type: "expense",
					amountMinor: 49900,
					date: "2026-02-15",
					accountId,
					categoryId,
					notes: "Netflix Premium",
					recurrence: {
						intervalMonths: 1,
					},
				},
				cookie,
			),
		);

		expect(res.status).toBe(201);
		const txnData = (await res.json()) as TransactionResponse;
		expect(txnData.id).toBe(txnId);
		expect(txnData.recurringExpenseId).toBeTruthy();

		// Check the created recurring rule
		const recurringRuleId = txnData.recurringExpenseId;
		const ruleRes = await fetchApp(
			`${RECURRING_URL}/${recurringRuleId}`,
			jsonInit("GET", undefined, cookie),
		);
		expect(ruleRes.status).toBe(200);
		const ruleData = (await ruleRes.json()) as RecurringExpenseResponse;
		expect(ruleData.id).toBe(recurringRuleId);
		expect(ruleData.intervalMonths).toBe(1);
		expect(ruleData.startDate).toBe("2026-02-15");
		// next due date scheduled 1 month after payment: 2026-03-15
		expect(ruleData.nextDueDate).toBe("2026-03-15");
		expect(ruleData.lastPostedDate).toBe("2026-02-15");
	});
});
