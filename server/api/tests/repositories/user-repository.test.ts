import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { createUserRepository } from "@/repositories/user-repository";
import { uuidV7 } from "@/lib/uuid";

const db = getDb(env);
const repo = createUserRepository(db);

const nowIso = new Date().toISOString();

beforeEach(async () => {
	await env.finance_application.exec("DELETE FROM refresh_tokens; DELETE FROM users;");
});

describe("UserRepository", () => {
	it("inserts a user and finds it by id and email", async () => {
		const row = {
			id: uuidV7(),
			email: "repo-user@example.com",
			passwordHash: "$argon2id$v=19$m=19456,t=2,p=1$abc$def",
			createdAt: nowIso,
			updatedAt: nowIso,
		};

		const inserted = await repo.insert(row);
		expect(inserted).toEqual({ id: row.id, email: row.email });

		const byId = await repo.findById(row.id);
		expect(byId?.email).toBe(row.email);

		const byEmail = await repo.findByEmail(row.email);
		expect(byEmail?.id).toBe(row.id);
	});

	it("returns undefined for unknown id and email", async () => {
		expect(await repo.findById("no-such-id")).toBeUndefined();
		expect(await repo.findByEmail("no-such@example.com")).toBeUndefined();
	});

	it("enforces the unique email index", async () => {
		const row = {
			id: uuidV7(),
			email: "dupe@example.com",
			passwordHash: "hash",
			createdAt: nowIso,
			updatedAt: nowIso,
		};
		await repo.insert(row);
		await expect(repo.insert({ ...row, id: uuidV7() })).rejects.toThrow();
	});
});
