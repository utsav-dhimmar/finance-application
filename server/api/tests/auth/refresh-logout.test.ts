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
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/session";
import { generateRefreshToken, hashToken } from "@/lib/tokens";
import { uuidV7 } from "@/lib/uuid";

const REGISTER_URL = "https://test.local/api/auth/register";
const REFRESH_URL = "https://test.local/api/auth/refresh";
const LOGOUT_URL = "https://test.local/api/auth/logout";

function post(url: string, cookie?: string): Promise<Response> {
	return fetchApp(url, { method: "POST", headers: cookie ? { cookie } : {} });
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

interface SessionCookies {
	access: string;
	refresh: string;
}

async function registerAndGrabCookies(): Promise<SessionCookies> {
	const res = await fetchApp(REGISTER_URL, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			email: "session@example.com",
			password: "s3cret-pw",
		}),
	});
	expect(res.status).toBe(201);
	const access = cookieValue(res, ACCESS_COOKIE);
	const refresh = cookieValue(res, REFRESH_COOKIE);
	if (!access || !refresh) {
		throw new Error("register did not set session cookies");
	}
	return { access, refresh };
}

function sessionCookieHeader(session: SessionCookies): string {
	return cookieHeader({
		[ACCESS_COOKIE]: session.access,
		[REFRESH_COOKIE]: session.refresh,
	});
}

beforeEach(async () => {
	await env.finance_application.exec(
		"DELETE FROM refresh_tokens; DELETE FROM users;",
	);
});

describe("POST /api/auth/refresh", () => {
	it("rotates the session: new cookies, presented token revoked", async () => {
		const session = await registerAndGrabCookies();

		const res = await post(REFRESH_URL, sessionCookieHeader(session));
		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toMatchObject({
			email: "session@example.com",
		});
		const newRefresh = cookieValue(res, REFRESH_COOKIE);
		expect(newRefresh).toBeDefined();
		expect(newRefresh).not.toBe(session.refresh);

		const revoked = await env.finance_application
			.prepare("SELECT revoked_at FROM refresh_tokens WHERE token_hash = ?")
			.bind(await hashToken(session.refresh))
			.first<{ revoked_at: string | null }>();
		expect(revoked?.revoked_at).not.toBeNull();
	});

	it("rejects reuse of a revoked refresh token with 401 INVALID_REFRESH_TOKEN", async () => {
		const session = await registerAndGrabCookies();
		await post(REFRESH_URL, sessionCookieHeader(session));

		const reuse = await post(REFRESH_URL, sessionCookieHeader(session));
		expect(reuse.status).toBe(401);
		expect(await reuse.json()).toMatchObject({
			error: { code: "INVALID_REFRESH_TOKEN" },
		});
	});

	it("responds 401 for a missing or unknown refresh token", async () => {
		const missing = await post(REFRESH_URL);
		expect(missing.status).toBe(401);

		const unknown = await post(
			REFRESH_URL,
			cookieHeader({ [REFRESH_COOKIE]: generateRefreshToken() }),
		);
		expect(unknown.status).toBe(401);
	});

	it("responds 401 for an expired refresh token", async () => {
		await registerAndGrabCookies();
		const userRow = await env.finance_application
			.prepare("SELECT id FROM users WHERE email = 'session@example.com'")
			.first<{ id: string }>();
		const userId = userRow?.id;
		if (!userId) {
			throw new Error("registered user not found");
		}

		const token = generateRefreshToken();
		const past = new Date(Date.now() - 60_000).toISOString();
		await env.finance_application
			.prepare(
				"INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)",
			)
			.bind(uuidV7(), userId, await hashToken(token), past, past)
			.run();

		const res = await post(
			REFRESH_URL,
			cookieHeader({ [REFRESH_COOKIE]: token }),
		);
		expect(res.status).toBe(401);
		expect(await res.json()).toMatchObject({
			error: { code: "INVALID_REFRESH_TOKEN" },
		});
	});
});

describe("POST /api/auth/logout", () => {
	it("revokes the refresh token, clears cookies, and always responds 204", async () => {
		const session = await registerAndGrabCookies();

		const res = await post(LOGOUT_URL, sessionCookieHeader(session));
		expect(res.status).toBe(204);

		const cleared = res.headers.getSetCookie().join(" ");
		expect(cleared).toContain(`${ACCESS_COOKIE}=;`);
		expect(cleared).toContain(`${REFRESH_COOKIE}=;`);

		const revoked = await env.finance_application
			.prepare("SELECT revoked_at FROM refresh_tokens WHERE token_hash = ?")
			.bind(await hashToken(session.refresh))
			.first<{ revoked_at: string | null }>();
		expect(revoked?.revoked_at).not.toBeNull();

		const afterLogout = await post(REFRESH_URL, sessionCookieHeader(session));
		expect(afterLogout.status).toBe(401);
	});

	it("responds 204 even without a session", async () => {
		const res = await post(LOGOUT_URL);
		expect(res.status).toBe(204);
	});
});
