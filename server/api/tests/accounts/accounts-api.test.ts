/// <reference types="@cloudflare/vitest-plugin/types" />
import { env, exports } from "cloudflare:workers";

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

import { ACCESS_COOKIE } from "@/lib/session";
import { beforeEach, describe, expect, it } from "vitest";

const BASE = "https://test.local/api/accounts";
const REGISTER_URL = "https://test.local/api/auth/register";

function jsonResponseInit(
	method: string,
	body?: unknown,
	cookie?: string,
): RequestInit {
	return {
		method,
		headers: {
			// Only send the JSON content-type when a body exists: a JSON content
			// type with an empty body makes the hono validator attempt to parse
			// the empty string and fail before schema validation.
			...(body !== undefined ? { "content-type": "application/json" } : {}),
			...(cookie ? { cookie } : {}),
		},
		...(body !== undefined ? { body: JSON.stringify(body) } : {}),
	};
}

// Sessions must be established inside the test body: the workers test pool's
// isolated storage does not carry rows written in beforeEach into the test.
// Returns the full `access_token=<jwt>` pair, ready for a Cookie header.
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

function postJson(
	url: string,
	body: unknown,
	cookie: string,
): Promise<Response> {
	return fetchApp(url, jsonResponseInit("POST", body, cookie));
}

function patchJson(
	url: string,
	body: unknown,
	cookie: string,
): Promise<Response> {
	return fetchApp(url, jsonResponseInit("PATCH", body, cookie));
}

let userCounter = 0;

async function freshCookie(): Promise<string> {
	userCounter += 1;
	return registerAndGetCookie(`accounts-${userCounter}@example.com`);
}

async function createAccount(
	cookie: string,
	body: Record<string, unknown>,
): Promise<Response> {
	return postJson(BASE, body, cookie);
}

function accountBody(
	name: string,
	overrides: Record<string, unknown> = {},
): Record<string, unknown> {
	return { name, type: "bank", openingBalanceMinor: 125050, ...overrides };
}

async function accountIdOf(res: Response): Promise<string> {
	return ((await res.json()) as { id: string }).id;
}

beforeEach(async () => {
	await env.finance_application.exec(
		"DELETE FROM accounts; DELETE FROM refresh_tokens; DELETE FROM users;",
	);
});

describe("authentication", () => {
	it("rejects unauthenticated requests on every endpoint", async () => {
		expect((await fetchApp(BASE)).status).toBe(401);
		expect((await fetchApp(`${BASE}/some-id`)).status).toBe(401);
		expect(
			(await postJson(BASE, accountBody("X"), "access_token=invalid")).status,
		).toBe(401);
	});
});

describe("POST /api/accounts", () => {
	it("creates an account and returns 201 with balance fields", async () => {
		const cookie = await freshCookie();
		const res = await createAccount(cookie, accountBody("HDFC Bank"));
		expect(res.status).toBe(201);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body).toMatchObject({
			name: "HDFC Bank",
			type: "bank",
			openingBalanceMinor: 125050,
			currentBalanceMinor: 125050,
			status: "active",
			archivedAt: null,
			deletedAt: null,
		});
		expect(typeof body.id).toBe("string");
		expect(typeof body.createdAt).toBe("string");
	});

	it("defaults the opening balance to zero when omitted", async () => {
		const cookie = await freshCookie();
		const res = await createAccount(cookie, { name: "Cash", type: "cash" });
		expect(res.status).toBe(201);
		await expect(res.json()).resolves.toMatchObject({
			openingBalanceMinor: 0,
			currentBalanceMinor: 0,
		});
	});

	it.each([
		["blank name", { name: "   ", type: "cash" }],
		["unknown type", { name: "X", type: "credit" }],
		[
			"fractional paise",
			{ name: "X", type: "cash", openingBalanceMinor: 12.5 },
		],
	])("returns 400 for %s", async (_label, body) => {
		const cookie = await freshCookie();
		const res = await createAccount(cookie, body);
		expect(res.status).toBe(400);
		await expect(res.json()).resolves.toMatchObject({
			error: { code: "VALIDATION_ERROR" },
		});
	});

	it("returns 409 for a duplicate name ignoring case", async () => {
		const cookie = await freshCookie();
		await createAccount(cookie, accountBody("HDFC Bank"));
		const res = await createAccount(cookie, accountBody("hdfc bank"));
		expect(res.status).toBe(409);
		await expect(res.json()).resolves.toMatchObject({
			error: { code: "ACCOUNT_NAME_TAKEN" },
		});
	});
});

describe("GET /api/accounts", () => {
	it("returns the requested status slice with a combined balance over active accounts", async () => {
		const cookie = await freshCookie();
		await createAccount(
			cookie,
			accountBody("Active", { openingBalanceMinor: 10000 }),
		);
		await createAccount(
			cookie,
			accountBody("Second", { type: "wallet", openingBalanceMinor: 20000 }),
		);
		const archivedId = await accountIdOf(
			await createAccount(
				cookie,
				accountBody("Old", { openingBalanceMinor: 50000 }),
			),
		);
		await fetchApp(
			`${BASE}/${archivedId}/archive`,
			jsonResponseInit("POST", undefined, cookie),
		);

		const activeList = await fetchApp(`${BASE}?status=active`, {
			headers: { cookie },
		});
		expect(activeList.status).toBe(200);
		const activeBody = (await activeList.json()) as {
			accounts: { id: string }[];
			combinedBalanceMinor: number;
		};
		expect(activeBody.accounts).toHaveLength(2);
		expect(activeBody.combinedBalanceMinor).toBe(30000);

		const archivedList = await fetchApp(`${BASE}?status=archived`, {
			headers: { cookie },
		});
		const archivedBody = (await archivedList.json()) as {
			accounts: { id: string }[];
			combinedBalanceMinor: number;
		};
		expect(archivedBody.accounts.map((a) => a.id)).toEqual([archivedId]);
		// The combined figure still covers active accounts regardless of filter.
		expect(archivedBody.combinedBalanceMinor).toBe(30000);
	});

	it("returns 400 for an unknown status filter", async () => {
		const cookie = await freshCookie();
		const res = await fetchApp(`${BASE}?status=nonsense`, {
			headers: { cookie },
		});
		expect(res.status).toBe(400);
	});
});

describe("GET /api/accounts/:id", () => {
	it("returns the account for its owner and 404 for unknown ids", async () => {
		const cookie = await freshCookie();
		const id = await accountIdOf(
			await createAccount(cookie, accountBody("HDFC Bank")),
		);

		const found = await fetchApp(`${BASE}/${id}`, { headers: { cookie } });
		expect(found.status).toBe(200);
		await expect(found.json()).resolves.toMatchObject({
			id,
			name: "HDFC Bank",
		});

		expect(
			(await fetchApp(`${BASE}/no-such-id`, { headers: { cookie } })).status,
		).toBe(404);
	});

	it("hides other users' accounts behind 404", async () => {
		const ownerCookie = await freshCookie();
		const id = await accountIdOf(
			await createAccount(ownerCookie, accountBody("HDFC Bank")),
		);
		const otherCookie = await freshCookie();
		expect(
			(await fetchApp(`${BASE}/${id}`, { headers: { cookie: otherCookie } }))
				.status,
		).toBe(404);
	});
});

describe("PATCH /api/accounts/:id", () => {
	async function seed(cookie: string): Promise<string> {
		return accountIdOf(await createAccount(cookie, accountBody("HDFC Bank")));
	}

	it("renames an active account", async () => {
		const cookie = await freshCookie();
		const id = await seed(cookie);
		const res = await patchJson(
			`${BASE}/${id}`,
			{ name: "Renamed Bank" },
			cookie,
		);
		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toMatchObject({ name: "Renamed Bank" });
	});

	it("returns 409 when renaming to a taken name", async () => {
		const cookie = await freshCookie();
		await createAccount(cookie, accountBody("Other Bank"));
		const id = await seed(cookie);
		const res = await patchJson(
			`${BASE}/${id}`,
			{ name: "OTHER BANK" },
			cookie,
		);
		expect(res.status).toBe(409);
		await expect(res.json()).resolves.toMatchObject({
			error: { code: "ACCOUNT_NAME_TAKEN" },
		});
	});

	it("returns 409 when editing a non-active account", async () => {
		const cookie = await freshCookie();
		const id = await seed(cookie);
		await fetchApp(
			`${BASE}/${id}/archive`,
			jsonResponseInit("POST", undefined, cookie),
		);
		const res = await patchJson(`${BASE}/${id}`, { name: "New Name" }, cookie);
		expect(res.status).toBe(409);
		await expect(res.json()).resolves.toMatchObject({
			error: { code: "ACCOUNT_TRANSITION_INVALID" },
		});
	});

	it("returns 400 for an invalid patch body", async () => {
		const cookie = await freshCookie();
		const id = await seed(cookie);
		const res = await patchJson(`${BASE}/${id}`, { type: "spaceship" }, cookie);
		expect(res.status).toBe(400);
	});
});

describe("lifecycle transitions", () => {
	async function seed(cookie: string): Promise<string> {
		return accountIdOf(await createAccount(cookie, accountBody("HDFC Bank")));
	}

	it("archives an active account and excludes it from active lists", async () => {
		const cookie = await freshCookie();
		const id = await seed(cookie);
		const res = await fetchApp(
			`${BASE}/${id}/archive`,
			jsonResponseInit("POST", undefined, cookie),
		);
		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toMatchObject({
			status: "archived",
			archivedAt: expect.any(String),
			deletedAt: null,
		});
		const list = (await (
			await fetchApp(BASE, { headers: { cookie } })
		).json()) as { accounts: unknown[] };
		expect(list.accounts).toHaveLength(0);
	});

	it("rejects archiving twice with 409", async () => {
		const cookie = await freshCookie();
		const id = await seed(cookie);
		await fetchApp(
			`${BASE}/${id}/archive`,
			jsonResponseInit("POST", undefined, cookie),
		);
		const res = await fetchApp(
			`${BASE}/${id}/archive`,
			jsonResponseInit("POST", undefined, cookie),
		);
		expect(res.status).toBe(409);
		await expect(res.json()).resolves.toMatchObject({
			error: { code: "ACCOUNT_TRANSITION_INVALID" },
		});
	});

	it("soft-deletes and restores through trash", async () => {
		const cookie = await freshCookie();
		const id = await seed(cookie);
		const deleted = await fetchApp(
			`${BASE}/${id}/delete`,
			jsonResponseInit("POST", undefined, cookie),
		);
		expect(deleted.status).toBe(200);
		await expect(deleted.json()).resolves.toMatchObject({
			status: "deleted",
			deletedAt: expect.any(String),
		});

		const trashList = (await (
			await fetchApp(`${BASE}?status=deleted`, { headers: { cookie } })
		).json()) as { accounts: { id: string }[] };
		expect(trashList.accounts.map((a) => a.id)).toEqual([id]);

		const restored = await fetchApp(
			`${BASE}/${id}/restore`,
			jsonResponseInit("POST", undefined, cookie),
		);
		expect(restored.status).toBe(200);
		await expect(restored.json()).resolves.toMatchObject({
			status: "active",
			deletedAt: null,
			name: "HDFC Bank",
		});
	});

	it("restores an archived account with data intact", async () => {
		const cookie = await freshCookie();
		const id = await seed(cookie);
		await fetchApp(
			`${BASE}/${id}/archive`,
			jsonResponseInit("POST", undefined, cookie),
		);
		const res = await fetchApp(
			`${BASE}/${id}/restore`,
			jsonResponseInit("POST", undefined, cookie),
		);
		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toMatchObject({
			status: "active",
			archivedAt: null,
		});
	});

	it("rejects restoring when the name was taken, then succeeds with newName", async () => {
		const cookie = await freshCookie();
		const id = await seed(cookie);
		await fetchApp(
			`${BASE}/${id}/delete`,
			jsonResponseInit("POST", undefined, cookie),
		);
		await createAccount(cookie, accountBody("HDFC BANK", { type: "wallet" }));

		const conflict = await fetchApp(
			`${BASE}/${id}/restore`,
			jsonResponseInit("POST", undefined, cookie),
		);
		expect(conflict.status).toBe(409);
		await expect(conflict.json()).resolves.toMatchObject({
			error: { code: "ACCOUNT_NAME_TAKEN" },
		});

		const renamed = await fetchApp(
			`${BASE}/${id}/restore`,
			jsonResponseInit("POST", { newName: "HDFC Bank Restored" }, cookie),
		);
		expect(renamed.status).toBe(200);
		await expect(renamed.json()).resolves.toMatchObject({
			status: "active",
			name: "HDFC Bank Restored",
		});
	});

	it("returns 404 for transitions on unknown ids", async () => {
		const cookie = await freshCookie();
		expect(
			(
				await fetchApp(
					`${BASE}/no-such-id/archive`,
					jsonResponseInit("POST", undefined, cookie),
				)
			).status,
		).toBe(404);
	});
});
