/// <reference types="@cloudflare/vitest-plugin/types" />
import { env, exports } from "cloudflare:workers";
import { getDb } from "@/db";
import { hashPassword } from "@/lib/password";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/session";
import { uuidV7 } from "@/lib/uuid";
import { createUserRepository } from "@/repositories/user-repository";
import { isoNow } from "@/utils/datetime";

// The main worker's default export, invoked with real bindings so requests
// carry env (D1 + JWT_SECRET) like production traffic does.
const worker = (
	exports as {
		default: { fetch: (req: Request, envVal: unknown) => Promise<Response> };
	}
).default;

export function fetchApp(url: string, init?: RequestInit): Promise<Response> {
	return worker.fetch(new Request(url, init), env);
}

export function workerWithEnv(overrides: Record<string, unknown>) {
	// The runtime supplies the main worker's real env on every
	// exports.default.fetch call — the second argument we pass is ignored — so
	// binding overrides are applied by temporarily mutating the shared env
	// object around each request. The cast is required because swapping a
	// binding by dynamic key needs an index signature the typed Env lacks;
	// only known binding keys are written and every write is restored.
	// Tests run sequentially within a file, so the scoped swap cannot leak
	// between tests.
	const envRecord = env as unknown as Record<string, unknown>;
	return {
		async fetch(url: string, init?: RequestInit): Promise<Response> {
			const originals = new Map<string, unknown>();
			const absent = new Set<string>();
			for (const [key, value] of Object.entries(overrides)) {
				if (key in envRecord) {
					originals.set(key, envRecord[key]);
				} else {
					absent.add(key);
				}
				envRecord[key] = value;
			}
			try {
				return await worker.fetch(new Request(url, init), env);
			} finally {
				for (const [key, original] of originals) {
					envRecord[key] = original;
				}
				for (const key of absent) {
					delete envRecord[key];
				}
			}
		},
	};
}

export function cookieValue(res: Response, name: string): string | undefined {
	const header = res.headers
		.getSetCookie()
		.find((entry) => entry.startsWith(`${name}=`));
	return header?.split(";")[0]?.slice(name.length + 1);
}

export function cookieHeader(pairs: Record<string, string>): string {
	return Object.entries(pairs)
		.map(([key, value]) => `${key}=${value}`)
		.join("; ");
}

export interface SessionCookies {
	access: string;
	refresh: string;
	userId: string;
	email: string;
}

let userSequence = 0;

// Registration is disabled at the API (single-user product), so tests seed the
// user directly through the repository and establish a session via login. A
// unique email per call keeps the rate limiter's per-email keys cold.
export async function seedUserAndLogin(
	password = "s3cret-pw",
): Promise<SessionCookies> {
	const email = `user-${++userSequence}@test.local`;
	const db = getDb(env);
	const userId = uuidV7();
	await createUserRepository(db).insert({
		id: userId,
		email,
		passwordHash: hashPassword(password),
		createdAt: isoNow(),
		updatedAt: isoNow(),
	});
	const res = await fetchApp("https://test.local/api/auth/login", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ email, password }),
	});
	if (res.status !== 200) {
		throw new Error(`seeded login failed with status ${res.status}`);
	}
	const access = cookieValue(res, ACCESS_COOKIE);
	const refresh = cookieValue(res, REFRESH_COOKIE);
	if (!access || !refresh) {
		throw new Error("login did not set session cookies");
	}
	return { access, refresh, userId, email };
}
