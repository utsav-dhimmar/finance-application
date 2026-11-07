import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/session";
import { generateRefreshToken, hashToken } from "@/lib/tokens";
import { uuidV7 } from "@/lib/uuid";
import {
	cookieHeader,
	cookieValue,
	fetchApp,
	type SessionCookies,
	seedUserAndLogin,
	workerWithEnv,
} from "../helpers";

const REFRESH_URL = "https://test.local/api/auth/refresh";
const LOGOUT_URL = "https://test.local/api/auth/logout";
const LOGIN_URL = "https://test.local/api/auth/login";

function post(url: string, cookie?: string): Promise<Response> {
	return fetchApp(url, { method: "POST", headers: cookie ? { cookie } : {} });
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
		const session = await seedUserAndLogin();

		const res = await post(REFRESH_URL, sessionCookieHeader(session));
		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toMatchObject({ email: session.email });
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
		const session = await seedUserAndLogin();
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
		const { userId } = await seedUserAndLogin();

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

	it("rotates single-use under concurrency: two racing refreshes never both succeed", {
		timeout: 120_000,
	}, async () => {
		// The rotation is single-use, so of two refreshes racing with the same
		// valid cookie exactly one wins (200) and the loser gets 401. If workerd
		// serializes the pair the outcome is identical; two 200s would be a
		// double rotation and two 401s a rejected valid session — both bugs.
		// Attempts are re-seeded: a first-attempt miss of the interleaving says
		// nothing, so the contract is asserted per attempt up to 20 tries.
		const MAX_ATTEMPTS = 20;

		for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
			const session = await seedUserAndLogin();
			const header = sessionCookieHeader(session);
			const [first, second] = await Promise.all([
				post(REFRESH_URL, header),
				post(REFRESH_URL, header),
			]);
			const statuses = [first.status, second.status];
			const successes = statuses.filter((status) => status === 200).length;

			expect(successes).toBeLessThanOrEqual(1);
			for (const res of [first, second]) {
				if (res.status === 401) {
					await expect(res.json()).resolves.toMatchObject({
						error: { code: "INVALID_REFRESH_TOKEN" },
					});
				}
			}

			// Exactly one live (non-revoked) token must remain for the user: the
			// rotated replacement after a success, or the untouched original.
			const live = await env.finance_application
				.prepare(
					"SELECT COUNT(*) AS n FROM refresh_tokens WHERE user_id = ?1 AND revoked_at IS NULL",
				)
				.bind(session.userId)
				.first<{ n: number }>();
			expect(live?.n).toBe(1);
		}
	});
});

describe("auth rate limiting", () => {
	const rejectingLimiter = workerWithEnv({
		RATE_LIMITER: { limit: async () => ({ success: false }) },
	});
	const allowingLimiter = workerWithEnv({
		RATE_LIMITER: { limit: async () => ({ success: true }) },
	});

	it("responds 429 RATE_LIMITED on refresh when the limiter rejects", async () => {
		const session = await seedUserAndLogin();

		const res = await rejectingLimiter.fetch(REFRESH_URL, {
			method: "POST",
			headers: { cookie: sessionCookieHeader(session) },
		});
		expect(res.status).toBe(429);
		await expect(res.json()).resolves.toMatchObject({
			error: { code: "RATE_LIMITED" },
		});
	});

	it("allows refresh when the limiter accepts", async () => {
		const session = await seedUserAndLogin();

		const res = await allowingLimiter.fetch(REFRESH_URL, {
			method: "POST",
			headers: { cookie: sessionCookieHeader(session) },
		});
		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toMatchObject({ email: session.email });
	});

	it("responds 429 RATE_LIMITED on login when the limiter rejects", async () => {
		const session = await seedUserAndLogin();

		const res = await rejectingLimiter.fetch(LOGIN_URL, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: session.email, password: "s3cret-pw" }),
		});
		expect(res.status).toBe(429);
		await expect(res.json()).resolves.toMatchObject({
			error: { code: "RATE_LIMITED" },
		});
	});
});

describe("POST /api/auth/logout", () => {
	it("revokes the refresh token, clears cookies, and always responds 204", async () => {
		const session = await seedUserAndLogin();

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

describe("refresh token retention bound", () => {
	async function insertTokenRow(options: {
		userId: string;
		tokenHash: string;
		expiresAt: string;
		revokedAt: string | null;
	}): Promise<void> {
		await env.finance_application
			.prepare(
				"INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
			)
			.bind(
				uuidV7(),
				options.userId,
				options.tokenHash,
				options.expiresAt,
				options.revokedAt,
				new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
			)
			.run();
	}

	it("purges expired and long-revoked rows on login while valid rows remain", async () => {
		const session = await seedUserAndLogin();
		// Seed an extra login so the just-created token row is not the one
		// being purged: it is valid and must survive.
		await insertTokenRow({
			userId: session.userId,
			tokenHash: await hashToken(generateRefreshToken()),
			expiresAt: new Date(Date.now() - 1000).toISOString(), // expired
			revokedAt: null,
		});
		await insertTokenRow({
			userId: session.userId,
			tokenHash: await hashToken(generateRefreshToken()),
			expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
			revokedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), // revoked 8 days ago
		});

		// A fresh login triggers the opportunistic purge.
		const relogin = await fetchApp(LOGIN_URL, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: session.email, password: "s3cret-pw" }),
		});
		expect(relogin.status).toBe(200);

		const rows = await env.finance_application
			.prepare(
				"SELECT token_hash FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NULL",
			)
			.bind(session.userId)
			.all<{ token_hash: string }>();
		const hashes = rows.results.map((row) => row.token_hash);
		// Exactly the still-valid rows remain: the seeded login's token plus the
		// relogin's new token; the expired and long-revoked rows are gone.
		expect(hashes).toHaveLength(2);
		expect(hashes).toContain(await hashToken(session.refresh));
	});
});
