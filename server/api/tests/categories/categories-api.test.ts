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

import { beforeEach, describe, expect, it } from "vitest";
import { ACCESS_COOKIE } from "@/lib/session";

const BASE = "https://test.local/api/categories";
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
	return registerAndGetCookie(`categories-${userCounter}@example.com`);
}

async function createCategory(
	cookie: string,
	body: Record<string, unknown>,
): Promise<Response> {
	return postJson(BASE, body, cookie);
}

function categoryBody(
	name: string,
	overrides: Record<string, unknown> = {},
): Record<string, unknown> {
	return { name, type: "expense", ...overrides };
}

async function categoryIdOf(res: Response): Promise<string> {
	return ((await res.json()) as { id: string }).id;
}

beforeEach(async () => {
	await env.finance_application.exec(
		"DELETE FROM categories; DELETE FROM accounts; DELETE FROM refresh_tokens; DELETE FROM users;",
	);
});

describe("authentication", () => {
	it("rejects unauthenticated requests on every endpoint", async () => {
		expect((await fetchApp(BASE)).status).toBe(401);
		expect((await fetchApp(`${BASE}/some-id`)).status).toBe(401);
		expect(
			(await postJson(BASE, categoryBody("X"), "access_token=invalid")).status,
		).toBe(401);
		expect(
			(
				await fetchApp(
					`${BASE}/some-id/archive`,
					jsonResponseInit("POST", undefined, "access_token=invalid"),
				)
			).status,
		).toBe(401);
	});
});

describe("POST /api/categories", () => {
	it("creates a category and returns 201 with its fields", async () => {
		const cookie = await freshCookie();
		const res = await createCategory(
			cookie,
			categoryBody("Groceries", { color: "#22C55E", icon: "shopping-cart" }),
		);
		expect(res.status).toBe(201);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body).toMatchObject({
			name: "Groceries",
			type: "expense",
			color: "#22C55E",
			icon: "shopping-cart",
			status: "active",
			archivedAt: null,
			deletedAt: null,
		});
		expect(typeof body.id).toBe("string");
		expect(typeof body.createdAt).toBe("string");
	});

	it("defaults presentation values to null when omitted", async () => {
		const cookie = await freshCookie();
		const res = await createCategory(
			cookie,
			categoryBody("Salary", { type: "income" }),
		);
		expect(res.status).toBe(201);
		await expect(res.json()).resolves.toMatchObject({
			color: null,
			icon: null,
		});
	});

	it.each([
		["blank name", { name: "   ", type: "expense" }],
		["unknown type", { name: "X", type: "transfer" }],
		["bad hex color", { name: "X", type: "expense", color: "green" }],
		["bad icon name", { name: "X", type: "expense", icon: "Big Icon" }],
	])("returns 400 for %s", async (_label, body) => {
		const cookie = await freshCookie();
		const res = await createCategory(cookie, body);
		expect(res.status).toBe(400);
		await expect(res.json()).resolves.toMatchObject({
			error: { code: "VALIDATION_ERROR" },
		});
	});

	it("returns 409 for a duplicate name ignoring case", async () => {
		const cookie = await freshCookie();
		await createCategory(cookie, categoryBody("Groceries"));
		const res = await createCategory(cookie, categoryBody("groceries"));
		expect(res.status).toBe(409);
		await expect(res.json()).resolves.toMatchObject({
			error: { code: "CATEGORY_NAME_TAKEN" },
		});
	});

	it("returns 409 for a cross-type duplicate name", async () => {
		const cookie = await freshCookie();
		await createCategory(cookie, categoryBody("Salary", { type: "income" }));
		const res = await createCategory(
			cookie,
			categoryBody("SALARY", { type: "expense" }),
		);
		expect(res.status).toBe(409);
		await expect(res.json()).resolves.toMatchObject({
			error: { code: "CATEGORY_NAME_TAKEN" },
		});
	});

	it("allows reusing a name once the previous category is soft-deleted", async () => {
		const cookie = await freshCookie();
		const id = await categoryIdOf(
			await createCategory(cookie, categoryBody("Groceries")),
		);
		await fetchApp(
			`${BASE}/${id}/delete`,
			jsonResponseInit("POST", undefined, cookie),
		);
		const res = await createCategory(cookie, categoryBody("groceries"));
		expect(res.status).toBe(201);
	});
});

describe("GET /api/categories", () => {
	it("returns the requested status slice", async () => {
		const cookie = await freshCookie();
		await createCategory(cookie, categoryBody("Active"));
		const archivedId = await categoryIdOf(
			await createCategory(cookie, categoryBody("Old")),
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
			categories: { id: string; name: string }[];
		};
		expect(activeBody.categories).toHaveLength(1);
		expect(activeBody.categories[0]?.name).toBe("Active");

		const archivedList = await fetchApp(`${BASE}?status=archived`, {
			headers: { cookie },
		});
		const archivedBody = (await archivedList.json()) as {
			categories: { id: string }[];
		};
		expect(archivedBody.categories.map((c) => c.id)).toEqual([archivedId]);
	});

	it("returns 400 for an unknown status filter", async () => {
		const cookie = await freshCookie();
		const res = await fetchApp(`${BASE}?status=nonsense`, {
			headers: { cookie },
		});
		expect(res.status).toBe(400);
	});
});

describe("GET /api/categories/:id", () => {
	it("returns the category for its owner and 404 for unknown ids", async () => {
		const cookie = await freshCookie();
		const id = await categoryIdOf(
			await createCategory(cookie, categoryBody("Groceries")),
		);

		const found = await fetchApp(`${BASE}/${id}`, { headers: { cookie } });
		expect(found.status).toBe(200);
		await expect(found.json()).resolves.toMatchObject({
			id,
			name: "Groceries",
		});

		expect(
			(await fetchApp(`${BASE}/no-such-id`, { headers: { cookie } })).status,
		).toBe(404);
	});

	it("hides other users' categories behind 404", async () => {
		const ownerCookie = await freshCookie();
		const id = await categoryIdOf(
			await createCategory(ownerCookie, categoryBody("Groceries")),
		);
		const otherCookie = await freshCookie();
		expect(
			(await fetchApp(`${BASE}/${id}`, { headers: { cookie: otherCookie } }))
				.status,
		).toBe(404);
	});
});

describe("PATCH /api/categories/:id", () => {
	async function seed(cookie: string): Promise<string> {
		return categoryIdOf(
			await createCategory(cookie, categoryBody("Groceries")),
		);
	}

	it("renames an active category", async () => {
		const cookie = await freshCookie();
		const id = await seed(cookie);
		const res = await patchJson(`${BASE}/${id}`, { name: "Food" }, cookie);
		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toMatchObject({ name: "Food" });
	});

	it("returns 409 when renaming to a taken name", async () => {
		const cookie = await freshCookie();
		await createCategory(cookie, categoryBody("Other"));
		const id = await seed(cookie);
		const res = await patchJson(`${BASE}/${id}`, { name: "OTHER" }, cookie);
		expect(res.status).toBe(409);
		await expect(res.json()).resolves.toMatchObject({
			error: { code: "CATEGORY_NAME_TAKEN" },
		});
	});

	it("changes the type of an unused category", async () => {
		const cookie = await freshCookie();
		const id = await seed(cookie);
		const res = await patchJson(`${BASE}/${id}`, { type: "income" }, cookie);
		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toMatchObject({ type: "income" });
	});

	it("updates and clears presentation values", async () => {
		const cookie = await freshCookie();
		const id = await seed(cookie);
		const updated = await patchJson(
			`${BASE}/${id}`,
			{ color: "#FF0000", icon: "utensils" },
			cookie,
		);
		expect(updated.status).toBe(200);
		await expect(updated.json()).resolves.toMatchObject({
			color: "#FF0000",
			icon: "utensils",
		});
		const cleared = await patchJson(
			`${BASE}/${id}`,
			{ color: null, icon: null },
			cookie,
		);
		expect(cleared.status).toBe(200);
		await expect(cleared.json()).resolves.toMatchObject({
			color: null,
			icon: null,
		});
	});

	it("returns 409 when editing a non-active category", async () => {
		const cookie = await freshCookie();
		const id = await seed(cookie);
		await fetchApp(
			`${BASE}/${id}/archive`,
			jsonResponseInit("POST", undefined, cookie),
		);
		const res = await patchJson(`${BASE}/${id}`, { name: "New Name" }, cookie);
		expect(res.status).toBe(409);
		await expect(res.json()).resolves.toMatchObject({
			error: { code: "CATEGORY_TRANSITION_INVALID" },
		});
	});

	it("returns 400 for an invalid patch body", async () => {
		const cookie = await freshCookie();
		const id = await seed(cookie);
		const res = await patchJson(`${BASE}/${id}`, { type: "both" }, cookie);
		expect(res.status).toBe(400);
	});
});

describe("lifecycle transitions", () => {
	async function seed(cookie: string): Promise<string> {
		return categoryIdOf(
			await createCategory(cookie, categoryBody("Groceries")),
		);
	}

	it("archives an active category and excludes it from active lists", async () => {
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
		).json()) as { categories: unknown[] };
		expect(list.categories).toHaveLength(0);
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
			error: { code: "CATEGORY_TRANSITION_INVALID" },
		});
	});

	it("rejects archiving an already-deleted category with 409", async () => {
		const cookie = await freshCookie();
		const id = await seed(cookie);
		await fetchApp(
			`${BASE}/${id}/delete`,
			jsonResponseInit("POST", undefined, cookie),
		);
		const res = await fetchApp(
			`${BASE}/${id}/archive`,
			jsonResponseInit("POST", undefined, cookie),
		);
		expect(res.status).toBe(409);
		await expect(res.json()).resolves.toMatchObject({
			error: { code: "CATEGORY_TRANSITION_INVALID" },
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
		).json()) as { categories: { id: string }[] };
		expect(trashList.categories.map((c) => c.id)).toEqual([id]);

		const restored = await fetchApp(
			`${BASE}/${id}/restore`,
			jsonResponseInit("POST", undefined, cookie),
		);
		expect(restored.status).toBe(200);
		await expect(restored.json()).resolves.toMatchObject({
			status: "active",
			deletedAt: null,
			name: "Groceries",
		});
	});

	it("restores an archived category with data intact", async () => {
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
		await createCategory(cookie, categoryBody("GROCERIES", { type: "income" }));

		const conflict = await fetchApp(
			`${BASE}/${id}/restore`,
			jsonResponseInit("POST", undefined, cookie),
		);
		expect(conflict.status).toBe(409);
		await expect(conflict.json()).resolves.toMatchObject({
			error: { code: "CATEGORY_NAME_TAKEN" },
		});

		const renamed = await fetchApp(
			`${BASE}/${id}/restore`,
			jsonResponseInit("POST", { newName: "Groceries Restored" }, cookie),
		);
		expect(renamed.status).toBe(200);
		await expect(renamed.json()).resolves.toMatchObject({
			status: "active",
			name: "Groceries Restored",
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
