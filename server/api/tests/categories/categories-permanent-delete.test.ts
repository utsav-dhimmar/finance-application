/// <reference types="@cloudflare/vitest-plugin/types" />
import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { ACCESS_COOKIE } from "@/lib/session";
import { uuidV7 } from "@/lib/uuid";

// The main worker's default export, invoked with real bindings so requests
// carry env (D1 + JWT_SECRET) like production traffic does.
const worker = (
	exports as {
		default: { fetch: (req: Request, envVal: unknown) => Promise<Response> };
	}
).default;

function fetchApp(url: string, init?: RequestInit): Promise<Response> {
	return worker.fetch(new Request(url, init), env);
}

const BASE = "https://test.local/api/categories";
const ACCOUNTS_URL = "https://test.local/api/accounts";
const TRANSACTIONS_URL = "https://test.local/api/transactions";
const SUMMARY_URL = "https://test.local/api/reports/summary";
const REGISTER_URL = "https://test.local/api/auth/register";

function jsonResponseInit(
	method: string,
	body?: unknown,
	cookie?: string,
): RequestInit {
	return {
		method,
		headers: {
			...(body !== undefined ? { "content-type": "application/json" } : {}),
			...(cookie ? { cookie } : {}),
		},
		...(body !== undefined ? { body: JSON.stringify(body) } : {}),
	};
}

// Sessions must be established inside the test body: the workers test pool's
// isolated storage does not carry rows written in beforeEach into the test.
async function registerAndGetCookie(email: string): Promise<string> {
	const res = await worker.fetch(
		new Request(REGISTER_URL, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email, password: "s3cret-pw" }),
		}),
		env,
	);
	const access = res.headers
		.getSetCookie()
		.find((entry) => entry.startsWith(`${ACCESS_COOKIE}=`))
		?.split(";")[0];
	if (!access) {
		throw new Error("registration did not yield an access cookie");
	}
	return access;
}

let userCounter = 0;

async function freshCookie(): Promise<string> {
	userCounter += 1;
	return registerAndGetCookie(`cat-perm-${userCounter}@example.com`);
}

async function createCategory(
	cookie: string,
	name: string,
	type: string,
): Promise<string> {
	const res = await fetchApp(
		BASE,
		jsonResponseInit("POST", { name, type }, cookie),
	);
	expect(res.status).toBe(201);
	return ((await res.json()) as { id: string }).id;
}

async function createAccount(
	cookie: string,
	name: string,
): Promise<string> {
	const res = await fetchApp(
		ACCOUNTS_URL,
		jsonResponseInit("POST", { name, type: "bank", openingBalanceMinor: 50_000 }, cookie),
	);
	expect(res.status).toBe(201);
	return ((await res.json()) as { id: string }).id;
}

async function createTransaction(
	cookie: string,
	body: Record<string, unknown>,
): Promise<string> {
	const res = await fetchApp(
		TRANSACTIONS_URL,
		jsonResponseInit("POST", { id: uuidV7(), ...body }, cookie),
	);
	expect(res.status).toBe(201);
	return ((await res.json()) as { id: string }).id;
}

async function lifecycle(
	cookie: string,
	id: string,
	action: "archive" | "delete",
): Promise<Response> {
	return fetchApp(
		`${BASE}/${id}/${action}`,
		jsonResponseInit("POST", undefined, cookie),
	);
}

function permanentDelete(cookie: string, id: string): Promise<Response> {
	return fetchApp(`${BASE}/${id}`, {
		method: "DELETE",
		headers: { cookie },
	});
}

// Physical-row check straight against D1 — the API cannot observe the
// difference between a hidden row and a removed one.
async function categoryRowCount(id: string): Promise<number> {
	const row = await env.finance_application
		.prepare("SELECT COUNT(*) AS n FROM categories WHERE id = ?1")
		.bind(id)
		.first<{ n: number }>();
	return row?.n ?? 0;
}

interface SummaryResponse {
	incomeMinor: number;
	expenseMinor: number;
	netCashFlowMinor: number;
}

async function getSummary(cookie: string): Promise<SummaryResponse> {
	const res = await fetchApp(`${SUMMARY_URL}?month=2026-01`, {
		headers: { cookie },
	});
	expect(res.status).toBe(200);
	return (await res.json()) as SummaryResponse;
}

beforeEach(async () => {
	await env.finance_application.exec(
		"DELETE FROM transactions; DELETE FROM transfers; DELETE FROM categories; DELETE FROM accounts; DELETE FROM refresh_tokens; DELETE FROM users;",
	);
});

describe("DELETE /api/categories/:id", () => {
	it("rejects unauthenticated requests", async () => {
		const res = await fetchApp(`${BASE}/some-id`, { method: "DELETE" });
		expect(res.status).toBe(401);
	});

	it("returns 404 for an unknown id", async () => {
		const cookie = await freshCookie();
		const res = await permanentDelete(cookie, uuidV7());
		expect(res.status).toBe(404);
		const body = (await res.json()) as { error: { code: string } };
		expect(body.error.code).toBe("NOT_FOUND");
	});

	it("rejects an active category with 409", async () => {
		const cookie = await freshCookie();
		const categoryId = await createCategory(cookie, "Groceries", "expense");
		const res = await permanentDelete(cookie, categoryId);
		expect(res.status).toBe(409);
		const body = (await res.json()) as { error: { code: string } };
		expect(body.error.code).toBe("CATEGORY_TRANSITION_INVALID");
		expect(await categoryRowCount(categoryId)).toBe(1);
	});

	it("rejects an archived category with 409", async () => {
		const cookie = await freshCookie();
		const categoryId = await createCategory(cookie, "Groceries", "expense");
		expect((await lifecycle(cookie, categoryId, "archive")).status).toBe(200);
		const res = await permanentDelete(cookie, categoryId);
		expect(res.status).toBe(409);
		const body = (await res.json()) as { error: { code: string } };
		expect(body.error.code).toBe("CATEGORY_TRANSITION_INVALID");
	});

	it("blocks with PERMANENT_DELETE_BLOCKED while an active transaction references the category", async () => {
		const cookie = await freshCookie();
		const categoryId = await createCategory(cookie, "Groceries", "expense");
		const accountId = await createAccount(cookie, "HDFC Bank");
		await createTransaction(cookie, {
			type: "expense",
			amountMinor: 2_500,
			date: "2026-01-10",
			accountId,
			categoryId,
		});
		expect((await lifecycle(cookie, categoryId, "delete")).status).toBe(200);

		const res = await permanentDelete(cookie, categoryId);
		expect(res.status).toBe(409);
		const body = (await res.json()) as { error: { code: string } };
		expect(body.error.code).toBe("PERMANENT_DELETE_BLOCKED");
		expect(await categoryRowCount(categoryId)).toBe(1);
	});

	it("blocks with PERMANENT_DELETE_BLOCKED while an archived transaction references the category", async () => {
		const cookie = await freshCookie();
		const categoryId = await createCategory(cookie, "Groceries", "expense");
		const accountId = await createAccount(cookie, "HDFC Bank");
		const transactionId = await createTransaction(cookie, {
			type: "expense",
			amountMinor: 2_500,
			date: "2026-01-10",
			accountId,
			categoryId,
		});
		const archiveRes = await fetchApp(
			`${TRANSACTIONS_URL}/${transactionId}/archive`,
			jsonResponseInit("POST", undefined, cookie),
		);
		expect(archiveRes.status).toBe(200);
		expect((await lifecycle(cookie, categoryId, "delete")).status).toBe(200);

		const res = await permanentDelete(cookie, categoryId);
		expect(res.status).toBe(409);
		const body = (await res.json()) as { error: { code: string } };
		expect(body.error.code).toBe("PERMANENT_DELETE_BLOCKED");
		expect(await categoryRowCount(categoryId)).toBe(1);
	});

	it("blocks with PERMANENT_DELETE_BLOCKED even when only a soft-deleted transaction references the category", async () => {
		const cookie = await freshCookie();
		const categoryId = await createCategory(cookie, "Groceries", "expense");
		const accountId = await createAccount(cookie, "HDFC Bank");
		const transactionId = await createTransaction(cookie, {
			type: "expense",
			amountMinor: 2_500,
			date: "2026-01-10",
			accountId,
			categoryId,
		});
		// Both go to trash; the tombstoned transaction still references the
		// category and the enforced FKs forbid removing the category row.
		const trashTxRes = await fetchApp(
			`${TRANSACTIONS_URL}/${transactionId}/delete`,
			jsonResponseInit("POST", undefined, cookie),
		);
		expect(trashTxRes.status).toBe(200);
		expect((await lifecycle(cookie, categoryId, "delete")).status).toBe(200);

		const res = await permanentDelete(cookie, categoryId);
		expect(res.status).toBe(409);
		const body = (await res.json()) as { error: { code: string } };
		expect(body.error.code).toBe("PERMANENT_DELETE_BLOCKED");
		expect(await categoryRowCount(categoryId)).toBe(1);
	});

	it("becomes deletable once the referencing trash transaction is itself permanently deleted", async () => {
		const cookie = await freshCookie();
		const categoryId = await createCategory(cookie, "Groceries", "expense");
		const accountId = await createAccount(cookie, "HDFC Bank");
		const transactionId = await createTransaction(cookie, {
			type: "expense",
			amountMinor: 2_500,
			date: "2026-01-10",
			accountId,
			categoryId,
		});
		expect(
			(
				await fetchApp(
					`${TRANSACTIONS_URL}/${transactionId}/delete`,
					jsonResponseInit("POST", undefined, cookie),
				)
			).status,
		).toBe(200);
		expect((await lifecycle(cookie, categoryId, "delete")).status).toBe(200);
		expect((await permanentDelete(cookie, categoryId)).status).toBe(409);

		// Clear the chain: permanently remove the trashed transaction first.
		const txDeleteRes = await fetchApp(`${TRANSACTIONS_URL}/${transactionId}`, {
			method: "DELETE",
			headers: { cookie },
		});
		expect(txDeleteRes.status).toBe(200);

		const res = await permanentDelete(cookie, categoryId);
		expect(res.status).toBe(204);
		expect(await res.text()).toBe("");
		expect(await categoryRowCount(categoryId)).toBe(0);
		expect((await permanentDelete(cookie, categoryId)).status).toBe(404);
	});

	it("physically removes an unreferenced trashed category with 204", async () => {
		const cookie = await freshCookie();
		const categoryId = await createCategory(cookie, "Old Utility", "expense");
		expect((await lifecycle(cookie, categoryId, "delete")).status).toBe(200);

		const res = await permanentDelete(cookie, categoryId);
		expect(res.status).toBe(204);
		expect(await res.text()).toBe("");
		expect(await categoryRowCount(categoryId)).toBe(0);
	});

	it("leaves report totals unchanged after permanent deletion", async () => {
		const cookie = await freshCookie();
		const accountId = await createAccount(cookie, "HDFC Bank");
		const salaryId = await createCategory(cookie, "Salary", "income");
		const groceriesId = await createCategory(cookie, "Groceries", "expense");
		await createTransaction(cookie, {
			type: "income",
			amountMinor: 25_000,
			date: "2026-01-10",
			accountId,
			categoryId: salaryId,
		});
		await createTransaction(cookie, {
			type: "expense",
			amountMinor: 5_000,
			date: "2026-01-15",
			accountId,
			categoryId: groceriesId,
		});
		const unusedId = await createCategory(cookie, "Old Utility", "expense");
		expect((await lifecycle(cookie, unusedId, "delete")).status).toBe(200);
		const before = await getSummary(cookie);
		expect(before.incomeMinor).toBe(25_000);
		expect(before.expenseMinor).toBe(5_000);

		const res = await permanentDelete(cookie, unusedId);
		expect(res.status).toBe(204);

		const after = await getSummary(cookie);
		expect(after.incomeMinor).toBe(before.incomeMinor);
		expect(after.expenseMinor).toBe(before.expenseMinor);
		expect(after.netCashFlowMinor).toBe(before.netCashFlowMinor);
	});
});
