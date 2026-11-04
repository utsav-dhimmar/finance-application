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

const BASE = "https://test.local/api/accounts";
const CATEGORIES_URL = "https://test.local/api/categories";
const TRANSACTIONS_URL = "https://test.local/api/transactions";
const TRANSFERS_URL = "https://test.local/api/transfers";
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
	return registerAndGetCookie(`acct-perm-${userCounter}@example.com`);
}

async function createAccount(
	cookie: string,
	name: string,
	overrides: Record<string, unknown> = {},
): Promise<string> {
	const res = await fetchApp(
		BASE,
		jsonResponseInit(
			"POST",
			{ name, type: "bank", openingBalanceMinor: 50_000, ...overrides },
			cookie,
		),
	);
	expect(res.status).toBe(201);
	return ((await res.json()) as { id: string }).id;
}

async function createCategory(
	cookie: string,
	name: string,
	type: string,
): Promise<string> {
	const res = await fetchApp(
		CATEGORIES_URL,
		jsonResponseInit("POST", { name, type }, cookie),
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

async function createTransfer(
	cookie: string,
	sourceAccountId: string,
	destinationAccountId: string,
): Promise<string> {
	const res = await fetchApp(
		TRANSFERS_URL,
		jsonResponseInit(
			"POST",
			{
				id: uuidV7(),
				sourceAccountId,
				destinationAccountId,
				amountMinor: 5_000,
				date: "2026-01-12",
			},
			cookie,
		),
	);
	expect(res.status).toBe(201);
	return ((await res.json()) as { id: string }).id;
}

async function lifecycle(
	cookie: string,
	id: string,
	action: "archive" | "delete",
): Promise<Response> {
	return fetchApp(`${BASE}/${id}/${action}`, jsonResponseInit("POST", undefined, cookie));
}

function permanentDelete(cookie: string, id: string): Promise<Response> {
	return fetchApp(`${BASE}/${id}`, {
		method: "DELETE",
		headers: { cookie },
	});
}

// Physical-row check straight against D1 — the API cannot observe the
// difference between a hidden row and a removed one.
async function accountRowCount(id: string): Promise<number> {
	const row = await env.finance_application
		.prepare("SELECT COUNT(*) AS n FROM accounts WHERE id = ?1")
		.bind(id)
		.first<{ n: number }>();
	return row?.n ?? 0;
}

interface SummaryResponse {
	incomeMinor: number;
	expenseMinor: number;
	netCashFlowMinor: number;
	combinedBalanceMinor: number;
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

describe("DELETE /api/accounts/:id", () => {
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

	it("rejects an active account with 409", async () => {
		const cookie = await freshCookie();
		const accountId = await createAccount(cookie, "HDFC Bank");
		const res = await permanentDelete(cookie, accountId);
		expect(res.status).toBe(409);
		const body = (await res.json()) as { error: { code: string } };
		expect(body.error.code).toBe("ACCOUNT_TRANSITION_INVALID");
		expect(await accountRowCount(accountId)).toBe(1);
	});

	it("rejects an archived account with 409", async () => {
		const cookie = await freshCookie();
		const accountId = await createAccount(cookie, "HDFC Bank");
		expect((await lifecycle(cookie, accountId, "archive")).status).toBe(200);
		const res = await permanentDelete(cookie, accountId);
		expect(res.status).toBe(409);
		const body = (await res.json()) as { error: { code: string } };
		expect(body.error.code).toBe("ACCOUNT_TRANSITION_INVALID");
	});

	it("blocks with PERMANENT_DELETE_BLOCKED while an active transaction references the account", async () => {
		const cookie = await freshCookie();
		const accountId = await createAccount(cookie, "HDFC Bank");
		const categoryId = await createCategory(cookie, "Salary", "income");
		await createTransaction(cookie, {
			type: "income",
			amountMinor: 10_000,
			date: "2026-01-10",
			accountId,
			categoryId,
		});
		expect((await lifecycle(cookie, accountId, "delete")).status).toBe(200);

		const res = await permanentDelete(cookie, accountId);
		expect(res.status).toBe(409);
		const body = (await res.json()) as { error: { code: string } };
		expect(body.error.code).toBe("PERMANENT_DELETE_BLOCKED");
		// The record remains in trash, physically present.
		expect(await accountRowCount(accountId)).toBe(1);
	});

	it("blocks with PERMANENT_DELETE_BLOCKED even when only a soft-deleted transaction references the account", async () => {
		const cookie = await freshCookie();
		const accountId = await createAccount(cookie, "HDFC Bank");
		const categoryId = await createCategory(cookie, "Salary", "income");
		const transactionId = await createTransaction(cookie, {
			type: "income",
			amountMinor: 10_000,
			date: "2026-01-10",
			accountId,
			categoryId,
		});
		// Both go to trash; the tombstoned transaction still references the
		// account and the enforced FKs forbid removing the account row.
		expect((await lifecycle(cookie, accountId, "delete")).status).toBe(200);
		const trashRes = await fetchApp(
			`${TRANSACTIONS_URL}/${transactionId}/delete`,
			jsonResponseInit("POST", undefined, cookie),
		);
		expect(trashRes.status).toBe(200);

		const res = await permanentDelete(cookie, accountId);
		expect(res.status).toBe(409);
		const body = (await res.json()) as { error: { code: string } };
		expect(body.error.code).toBe("PERMANENT_DELETE_BLOCKED");
		expect(await accountRowCount(accountId)).toBe(1);
	});

	it("blocks with PERMANENT_DELETE_BLOCKED while an active transfer references the account", async () => {
		const cookie = await freshCookie();
		const sourceId = await createAccount(cookie, "HDFC Bank");
		const destinationId = await createAccount(cookie, "Cash Wallet");
		await createTransfer(cookie, sourceId, destinationId);
		expect((await lifecycle(cookie, sourceId, "delete")).status).toBe(200);

		const res = await permanentDelete(cookie, sourceId);
		expect(res.status).toBe(409);
		const body = (await res.json()) as { error: { code: string } };
		expect(body.error.code).toBe("PERMANENT_DELETE_BLOCKED");
		expect(await accountRowCount(sourceId)).toBe(1);
	});

	it("blocks with PERMANENT_DELETE_BLOCKED even when only a soft-deleted transfer references the account", async () => {
		const cookie = await freshCookie();
		const sourceId = await createAccount(cookie, "HDFC Bank");
		const destinationId = await createAccount(cookie, "Cash Wallet");
		const transferId = await createTransfer(cookie, sourceId, destinationId);
		expect((await lifecycle(cookie, sourceId, "delete")).status).toBe(200);
		const trashRes = await fetchApp(
			`${TRANSFERS_URL}/${transferId}/delete`,
			jsonResponseInit("POST", undefined, cookie),
		);
		expect(trashRes.status).toBe(200);

		const res = await permanentDelete(cookie, sourceId);
		expect(res.status).toBe(409);
		const body = (await res.json()) as { error: { code: string } };
		expect(body.error.code).toBe("PERMANENT_DELETE_BLOCKED");
		expect(await accountRowCount(sourceId)).toBe(1);
	});

	it("physically removes an unreferenced trashed account with 204", async () => {
		const cookie = await freshCookie();
		const accountId = await createAccount(cookie, "Old Account");
		expect((await lifecycle(cookie, accountId, "delete")).status).toBe(200);

		const res = await permanentDelete(cookie, accountId);
		expect(res.status).toBe(204);
		expect(await res.text()).toBe("");
		expect(await accountRowCount(accountId)).toBe(0);
		expect((await permanentDelete(cookie, accountId)).status).toBe(404);
		expect(
			(await fetchApp(`${BASE}/${accountId}`, { headers: { cookie } })).status,
		).toBe(404);
	});

	it("leaves balances and report totals unchanged after permanent deletion", async () => {
		const cookie = await freshCookie();
		const trashedId = await createAccount(cookie, "Old Account", {
			openingBalanceMinor: 40_000,
		});
		const keptId = await createAccount(cookie, "HDFC Bank", {
			openingBalanceMinor: 100_000,
		});
		const categoryId = await createCategory(cookie, "Salary", "income");
		await createTransaction(cookie, {
			type: "income",
			amountMinor: 10_000,
			date: "2026-01-10",
			accountId: keptId,
			categoryId,
		});

		expect((await lifecycle(cookie, trashedId, "delete")).status).toBe(200);
		// While trashed the account is already excluded from balances and
		// reports; permanent removal must not change them further.
		const before = await getSummary(cookie);
		expect(before.incomeMinor).toBe(10_000);
		expect(before.combinedBalanceMinor).toBe(110_000);

		const res = await permanentDelete(cookie, trashedId);
		expect(res.status).toBe(204);

		const after = await getSummary(cookie);
		expect(after.incomeMinor).toBe(before.incomeMinor);
		expect(after.expenseMinor).toBe(before.expenseMinor);
		expect(after.netCashFlowMinor).toBe(before.netCashFlowMinor);
		expect(after.combinedBalanceMinor).toBe(before.combinedBalanceMinor);
	});
});
