/// <reference types="@cloudflare/vitest-plugin/types" />
import { env } from "cloudflare:workers";
import { sign } from "hono/jwt";
import { beforeEach, describe, expect, it } from "vitest";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/session";
import {
	cookieHeader,
	cookieValue,
	fetchApp,
	seedUserAndLogin,
} from "../helpers";

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

async function userCount(): Promise<number> {
	const row = await env.finance_application
		.prepare("SELECT COUNT(*) AS n FROM users")
		.first<{ n: number }>();
	return row?.n ?? 0;
}

beforeEach(async () => {
	await env.finance_application.exec(
		"DELETE FROM refresh_tokens; DELETE FROM users;",
	);
});

describe("POST /api/auth/register (disabled)", () => {
	it("answers 403 REGISTRATION_DISABLED for a well-formed body and sets no cookies", async () => {
		const res = await postJson(REGISTER_URL, {
			email: "User@Example.com",
			password: "s3cret-pw",
		});
		expect(res.status).toBe(403);
		await expect(res.json()).resolves.toMatchObject({
			error: { code: "REGISTRATION_DISABLED" },
		});
		expect(res.headers.getSetCookie()).toEqual([]);
	});

	it("answers with the byte-identical 403 for a malformed body", async () => {
		const wellFormed = await postJson(REGISTER_URL, {
			email: "User@Example.com",
			password: "s3cret-pw",
		});
		const malformed = await postJson(REGISTER_URL, { email: "not-an-email" });
		expect(malformed.status).toBe(wellFormed.status);
		const wellFormedBody: unknown = await wellFormed.json();
		const malformedBody: unknown = await malformed.json();
		expect(malformedBody).toEqual(wellFormedBody);
	});

	it("leaks nothing about existing accounts: known and unknown emails answer identically", async () => {
		const { email: existingEmail } = await seedUserAndLogin();

		const known = await postJson(REGISTER_URL, {
			email: existingEmail,
			password: "s3cret-pw",
		});
		const unknown = await postJson(REGISTER_URL, {
			email: "ghost@example.com",
			password: "s3cret-pw",
		});
		expect(known.status).toBe(unknown.status);
		const knownBody: unknown = await known.json();
		const unknownBody: unknown = await unknown.json();
		expect(knownBody).toEqual(unknownBody);
	});

	it("creates no users row: the count is unchanged across every register shape", async () => {
		const { email: existingEmail } = await seedUserAndLogin();
		const before = await userCount();
		expect(before).toBe(1);

		await postJson(REGISTER_URL, {
			email: existingEmail,
			password: "s3cret-pw",
		});
		await postJson(REGISTER_URL, {
			email: "brand-new@example.com",
			password: "s3cret-pw",
		});
		await postJson(REGISTER_URL, { email: "malformed" });

		expect(await userCount()).toBe(before);
	});
});

describe("POST /api/auth/login", () => {
	it("returns the user and sets cookies for correct credentials", async () => {
		const { email } = await seedUserAndLogin();
		// A second login for the same seeded user.
		const res = await postJson(LOGIN_URL, { email, password: "s3cret-pw" });
		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toMatchObject({ email });
		expect(cookieValue(res, ACCESS_COOKIE)).toBeDefined();
		expect(cookieValue(res, REFRESH_COOKIE)).toBeDefined();
	});

	it("responds with the identical generic 401 for wrong password and unknown email", async () => {
		const { email } = await seedUserAndLogin();

		const wrongPassword = await postJson(LOGIN_URL, {
			email,
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
	it("returns the authenticated user for a seeded session", async () => {
		const { access, email } = await seedUserAndLogin();

		const res = await fetchApp(ME_URL, {
			headers: { cookie: cookieHeader({ [ACCESS_COOKIE]: access }) },
		});
		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toMatchObject({ email });
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
		const { userId } = await seedUserAndLogin();
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
