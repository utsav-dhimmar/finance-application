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

const BASE = "https://test.local/api/preferences";
const ACCOUNTS_URL = "https://test.local/api/accounts";
const CATEGORIES_URL = "https://test.local/api/categories";
const TRANSACTIONS_URL = "https://test.local/api/transactions";
const TRANSFERS_URL = "https://test.local/api/transfers";
const ME_URL = "https://test.local/api/auth/me";
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
	return registerAndGetCookie(`prefs-api-${userCounter}@example.com`);
}

async function userIdOf(cookie: string): Promise<string> {
	const res = await fetchApp(ME_URL, { headers: { cookie } });
	expect(res.status).toBe(200);
	return ((await res.json()) as { id: string }).id;
}

async function preferenceRowCount(userId: string): Promise<number> {
	const row = await env.finance_application
		.prepare("SELECT COUNT(*) AS n FROM user_preferences WHERE user_id = ?1")
		.bind(userId)
		.first<{ n: number }>();
	return row?.n ?? 0;
}

// Direct-database snapshot of every financial table: preference reads and
// updates must never touch any of them (display-only contract).
async function financialSnapshot(): Promise<string> {
	const parts: string[] = [];
	for (const table of ["accounts", "categories", "transactions", "transfers"]) {
		const result = await env.finance_application
			.prepare(`SELECT * FROM ${table} ORDER BY id`)
			.all();
		parts.push(`${table}:${JSON.stringify(result.results)}`);
	}
	return parts.join("\n");
}

async function createAccount(cookie: string, name: string): Promise<string> {
	const res = await fetchApp(
		ACCOUNTS_URL,
		jsonResponseInit(
			"POST",
			{ name, type: "bank", openingBalanceMinor: 50_000 },
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

beforeEach(async () => {
	await env.finance_application.exec(
		"DELETE FROM user_preferences; DELETE FROM transactions; DELETE FROM transfers; DELETE FROM categories; DELETE FROM accounts; DELETE FROM refresh_tokens; DELETE FROM users;",
	);
});

describe("authentication", () => {
	it("rejects unauthenticated requests on both endpoints", async () => {
		expect((await fetchApp(BASE)).status).toBe(401);
		expect(
			(
				await fetchApp(BASE, {
					method: "PATCH",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ currencyCode: "INR" }),
				})
			).status,
		).toBe(401);
		expect(
			(
				await fetchApp(
					BASE,
					jsonResponseInit("GET", undefined, "access_token=invalid"),
				)
			).status,
		).toBe(401);
	});
});

describe("GET /api/preferences", () => {
	it("returns defaults for a fresh user and creates exactly one row", async () => {
		const cookie = await freshCookie();
		const userId = await userIdOf(cookie);

		const res = await fetchApp(BASE, { headers: { cookie } });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			currencyCode: "INR",
			currencySymbol: "₹",
			minorUnitExponent: 2,
		});
		expect(await preferenceRowCount(userId)).toBe(1);

		// Repeating the read stays idempotent: still exactly one row.
		await fetchApp(BASE, { headers: { cookie } });
		expect(await preferenceRowCount(userId)).toBe(1);
	});
});

describe("PATCH /api/preferences", () => {
	it("persists the update and returns the resolved definition", async () => {
		const cookie = await freshCookie();
		const userId = await userIdOf(cookie);

		const res = await fetchApp(
			BASE,
			jsonResponseInit("PATCH", { currencyCode: "INR" }, cookie),
		);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			currencyCode: "INR",
			currencySymbol: "₹",
			minorUnitExponent: 2,
		});

		// The value persists server-side (read back through a second session's
		// view of the same row).
		const reread = await fetchApp(BASE, { headers: { cookie } });
		expect(await reread.json()).toEqual({
			currencyCode: "INR",
			currencySymbol: "₹",
			minorUnitExponent: 2,
		});
		expect(await preferenceRowCount(userId)).toBe(1);
		const row = await env.finance_application
			.prepare("SELECT currency_code FROM user_preferences WHERE user_id = ?1")
			.bind(userId)
			.first<{ currency_code: string }>();
		expect(row?.currency_code).toBe("INR");
	});

	it("rejects an unsupported currency with 400 and leaves the preference unchanged", async () => {
		const cookie = await freshCookie();
		const userId = await userIdOf(cookie);

		const res = await fetchApp(
			BASE,
			jsonResponseInit("PATCH", { currencyCode: "USD" }, cookie),
		);
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: { code: string } };
		expect(body.error.code).toBe("VALIDATION_ERROR");

		// The preference is unchanged: still the INR default (or absent before
		// any successful write).
		const reread = await fetchApp(BASE, { headers: { cookie } });
		expect((await reread.json()) as { currencyCode: string }).toMatchObject({
			currencyCode: "INR",
		});
		const row = await env.finance_application
			.prepare("SELECT currency_code FROM user_preferences WHERE user_id = ?1")
			.bind(userId)
			.first<{ currency_code: string }>();
		expect(row?.currency_code).toBe("INR");
	});

	it.each([
		["blank currency", { currencyCode: "" }],
		["unknown field", { currencyCode: "INR", theme: "dark" }],
		["missing currency", {}],
	])("rejects %s with 400", async (_label, body) => {
		const cookie = await freshCookie();
		const res = await fetchApp(BASE, jsonResponseInit("PATCH", body, cookie));
		expect(res.status).toBe(400);
		const errorBody = (await res.json()) as { error: { code: string } };
		expect(errorBody.error.code).toBe("VALIDATION_ERROR");
	});

	it("never modifies any financial record", async () => {
		const cookie = await freshCookie();
		const accountId = await createAccount(cookie, "HDFC Bank");
		const destinationId = await createAccount(cookie, "Cash Wallet");
		const categoryId = await createCategory(cookie, "Groceries", "expense");
		const transactionResponse = await fetchApp(
			TRANSACTIONS_URL,
			jsonResponseInit(
				"POST",
				{
					id: uuidV7(),
					type: "expense",
					amountMinor: 2_500,
					date: "2026-01-10",
					accountId,
					categoryId,
				},
				cookie,
			),
		);
		expect(transactionResponse.status).toBe(201);
		const transferResponse = await fetchApp(
			TRANSFERS_URL,
			jsonResponseInit(
				"POST",
				{
					id: uuidV7(),
					sourceAccountId: accountId,
					destinationAccountId: destinationId,
					amountMinor: 1_000,
					date: "2026-01-11",
				},
				cookie,
			),
		);
		expect(transferResponse.status).toBe(201);

		const before = await financialSnapshot();

		// Both a defaulting read and a successful update.
		expect((await fetchApp(BASE, { headers: { cookie } })).status).toBe(200);
		expect(
			(
				await fetchApp(
					BASE,
					jsonResponseInit("PATCH", { currencyCode: "INR" }, cookie),
				)
			).status,
		).toBe(200);

		expect(await financialSnapshot()).toBe(before);
	});
});
