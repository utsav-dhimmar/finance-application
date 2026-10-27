import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { uuidV7 } from "@/lib/uuid";
import { createUserRepository } from "@/repositories/user-repository";
import {
	createRefreshTokenRepository,
	type NewRefreshTokenRow,
} from "@/repositories/refresh-token-repository";

const db = getDb(env);
const repo = createRefreshTokenRepository(db);
const userRepo = createUserRepository(db);

const nowIso = new Date().toISOString();
const futureIso = new Date(Date.now() + 60_000).toISOString();

async function insertUser(): Promise<string> {
	const user = await userRepo.insert({
		id: uuidV7(),
		email: `refresh-${crypto.randomUUID()}@example.com`,
		passwordHash: "hash",
		createdAt: nowIso,
		updatedAt: nowIso,
	});
	return user.id;
}

function tokenRow(userId: string, tokenHash: string): NewRefreshTokenRow {
	return {
		id: uuidV7(),
		userId,
		tokenHash,
		expiresAt: futureIso,
		revokedAt: null,
		createdAt: nowIso,
	};
}

beforeEach(async () => {
	await env.finance_application.exec("DELETE FROM refresh_tokens; DELETE FROM users;");
});

describe("RefreshTokenRepository", () => {
	it("inserts and finds a token by hash", async () => {
		const userId = await insertUser();
		const row = tokenRow(userId, "hash-1");

		await repo.insert(row);
		const found = await repo.findByTokenHash("hash-1");
		expect(found?.userId).toBe(userId);
		expect(found?.revokedAt).toBeNull();

		expect(await repo.findByTokenHash("unknown")).toBeUndefined();
	});

	it("revokes by id and by token hash", async () => {
		const userId = await insertUser();
		await repo.insert(tokenRow(userId, "hash-a"));
		const second = tokenRow(userId, "hash-b");
		await repo.insert(second);

		await repo.revokeById(second.id, nowIso);
		expect((await repo.findByTokenHash("hash-b"))?.revokedAt).toBe(nowIso);

		await repo.revokeByTokenHash("hash-a", nowIso);
		expect((await repo.findByTokenHash("hash-a"))?.revokedAt).toBe(nowIso);
	});

	it("revokeAndReplace revokes the old token and stores the replacement atomically", async () => {
		const userId = await insertUser();
		const old = tokenRow(userId, "hash-old");
		await repo.insert(old);

		const replacement = tokenRow(userId, "hash-new");
		await repo.revokeAndReplace(old.id, nowIso, replacement);

		expect((await repo.findByTokenHash("hash-old"))?.revokedAt).toBe(nowIso);
		const replaced = await repo.findByTokenHash("hash-new");
		expect(replaced?.id).toBe(replacement.id);
		expect(replaced?.revokedAt).toBeNull();
	});
});
