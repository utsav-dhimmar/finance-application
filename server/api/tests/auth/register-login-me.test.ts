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

import { sign } from "hono/jwt";
import { beforeEach, describe, expect, it } from "vitest";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/session";

const REGISTER_URL = "https://test.local/api/auth/register";
const LOGIN_URL = "https://test.local/api/auth/login";
const ME_URL = "https://test.local/api/auth/me";

function postJson(
	url: string,
	body: unknown,
	cookie?: string,
): Promise<Response> {
	return fetchApp(url, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			...(cookie ? { cookie } : {}),
		},
		body: JSON.stringify(body),
	});
}

function cookieValue(res: Response, name: string): string | undefined {
	const header = res.headers
		.getSetCookie()
		.find((entry) => entry.startsWith(`${name}=`));
	return header?.split(";")[0]?.slice(name.length + 1);
}

function cookieHeader(pairs: Record<string, string>): string {
	return Object.entries(pairs)
		.map(([key, value]) => `${key}=${value}`)
		.join("; ");
}

beforeEach(async () => {
	await env.finance_application.exec(
		"DELETE FROM refresh_tokens; DELETE FROM users;",
	);
});

describe("POST /api/auth/register", () => {
	it("creates an account, returns 201, and sets HttpOnly session cookies", async () => {
		const res = await postJson(REGISTER_URL, {
			email: "User@Example.com",
			password: "s3cret-pw",
		});
		expect(res.status).toBe(201);
		await expect(res.json()).resolves.toMatchObject({
			email: "user@example.com",
		});

		const cookies = res.headers.getSetCookie();
		const access = cookies.find((entry) =>
			entry.startsWith(`${ACCESS_COOKIE}=`),
		);
		const refresh = cookies.find((entry) =>
			entry.startsWith(`${REFRESH_COOKIE}=`),
		);
		expect(access).toContain("HttpOnly");
		expect(access).toContain("Secure");
		expect(access).toContain("SameSite=Lax");
		expect(access).toContain("Path=/");
		expect(refresh).toContain("HttpOnly");
		expect(refresh).toContain("Path=/api/auth");
	});

	it("stores the password as a PHC Argon2id hash", async () => {
		await postJson(REGISTER_URL, {
			email: "hash@example.com",
			password: "s3cret-pw",
		});
		const result = await env.finance_application
			.prepare(
				"SELECT password_hash FROM users WHERE email = 'hash@example.com'",
			)
			.first<{ password_hash: string }>();
		expect(result?.password_hash).toMatch(/^\$argon2id\$/);
	});

	it("rejects duplicate emails case-insensitively with 409 EMAIL_TAKEN", async () => {
		await postJson(REGISTER_URL, {
			email: "taken@example.com",
			password: "s3cret-pw",
		});
		const same = await postJson(REGISTER_URL, {
			email: "taken@example.com",
			password: "other-pw-1",
		});
		expect(same.status).toBe(409);
		expect(await same.json()).toMatchObject({ error: { code: "EMAIL_TAKEN" } });

		const differentCase = await postJson(REGISTER_URL, {
			email: "TAKEN@example.com",
			password: "other-pw-1",
		});
		expect(differentCase.status).toBe(409);
	});

	it("rejects invalid input with 400 VALIDATION_ERROR", async () => {
		const shortPassword = await postJson(REGISTER_URL, {
			email: "a@example.com",
			password: "short",
		});
		expect(shortPassword.status).toBe(400);
		const body: unknown = await shortPassword.json();
		expect(body).toMatchObject({ error: { code: "VALIDATION_ERROR" } });

		const badEmail = await postJson(REGISTER_URL, {
			email: "not-an-email",
			password: "s3cret-pw",
		});
		expect(badEmail.status).toBe(400);
	});
});

describe("POST /api/auth/login", () => {
	it("returns the user and sets cookies for correct credentials", async () => {
		await postJson(REGISTER_URL, {
			email: "login@example.com",
			password: "s3cret-pw",
		});
		const res = await postJson(LOGIN_URL, {
			email: "login@example.com",
			password: "s3cret-pw",
		});
		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toMatchObject({
			email: "login@example.com",
		});
		expect(cookieValue(res, ACCESS_COOKIE)).toBeDefined();
		expect(cookieValue(res, REFRESH_COOKIE)).toBeDefined();
	});

	it("responds with the identical generic 401 for wrong password and unknown email", async () => {
		await postJson(REGISTER_URL, {
			email: "known@example.com",
			password: "s3cret-pw",
		});

		const wrongPassword = await postJson(LOGIN_URL, {
			email: "known@example.com",
			password: "wrong-pw-1",
		});
		const unknownEmail = await postJson(LOGIN_URL, {
			email: "ghost@example.com",
			password: "s3cret-pw",
		});
		expect(wrongPassword.status).toBe(401);
		expect(unknownEmail.status).toBe(401);

		const wrongPasswordBody: unknown = await wrongPassword.json();
		const unknownEmailBody: unknown = await unknownEmail.json();
		expect(wrongPasswordBody).toEqual(unknownEmailBody);
		expect(wrongPasswordBody).toMatchObject({
			error: { code: "AUTH_INVALID_CREDENTIALS" },
		});
	});
});

describe("GET /api/auth/me", () => {
	it("returns the authenticated user for a valid access token", async () => {
		const registered = await postJson(REGISTER_URL, {
			email: "me@example.com",
			password: "s3cret-pw",
		});
		const access = cookieValue(registered, ACCESS_COOKIE);
		if (!access) {
			throw new Error("register did not set an access cookie");
		}

		const res = await fetchApp(ME_URL, {
			headers: { cookie: cookieHeader({ [ACCESS_COOKIE]: access }) },
		});
		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toMatchObject({
			email: "me@example.com",
		});
	});

	it("responds 401 UNAUTHENTICATED without or with a malformed access token", async () => {
		const noToken = await fetchApp(ME_URL);
		expect(noToken.status).toBe(401);
		expect(await noToken.json()).toMatchObject({
			error: { code: "UNAUTHENTICATED" },
		});

		const malformed = await fetchApp(ME_URL, {
			headers: { cookie: cookieHeader({ [ACCESS_COOKIE]: "garbage" }) },
		});
		expect(malformed.status).toBe(401);
	});

	it("responds 401 for an expired access token", async () => {
		await postJson(REGISTER_URL, {
			email: "expired@example.com",
			password: "s3cret-pw",
		});
		const row = await env.finance_application
			.prepare("SELECT id FROM users WHERE email = 'expired@example.com'")
			.first<{ id: string }>();
		const userId = row?.id;
		if (!userId) {
			throw new Error("registered user not found");
		}
		const now = Math.floor(Date.now() / 1000);
		const expired = await sign(
			{ sub: userId, iat: now - 3600, exp: now - 1800 },
			"test-secret-for-workers-pool",
			"HS256",
		);

		const res = await fetchApp(ME_URL, {
			headers: { cookie: cookieHeader({ [ACCESS_COOKIE]: expired }) },
		});
		expect(res.status).toBe(401);
	});
});
