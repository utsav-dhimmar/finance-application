/// <reference types="@cloudflare/vitest-plugin/types" />
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { createUserRepository } from "@/repositories/user-repository";
import {
	createAccountRepository,
	normalizeAccountName,
} from "@/repositories/account-repository";
import { uuidV7 } from "@/lib/uuid";

const db = getDb(env);
const repo = createAccountRepository(db);
const users = createUserRepository(db);

const nowIso = new Date().toISOString();

let userId: string;

async function insertAccount(overrides: {
	name?: string;
	type?: string;
	status?: string;
	openingBalanceMinor?: number;
}): Promise<{ id: string; name: string }> {
	const name = overrides.name ?? "HDFC Bank";
	const row = await repo.insert({
		id: uuidV7(),
		userId,
		name,
		type: overrides.type ?? "bank",
		openingBalanceMinor: overrides.openingBalanceMinor ?? 0,
		createdAt: nowIso,
		updatedAt: nowIso,
	});
	if (overrides.status !== undefined && overrides.status !== "active") {
		await repo.updateStatus(
			row.id,
			overrides.status,
			overrides.status === "archived"
				? { archivedAt: nowIso, deletedAt: null }
				: { archivedAt: null, deletedAt: nowIso },
			nowIso,
		);
	}
	return { id: row.id, name: row.name };
}

beforeEach(async () => {
	await env.finance_application.exec(
		"DELETE FROM accounts; DELETE FROM refresh_tokens; DELETE FROM users;",
	);
	userId = (
		await users.insert({
			id: uuidV7(),
			email: "account-repo@example.com",
			passwordHash: "hash",
			createdAt: nowIso,
			updatedAt: nowIso,
		})
	).id;
});

describe("normalizeAccountName", () => {
	it("trims and lowercases", () => {
		expect(normalizeAccountName("  HDFC Bank  ")).toBe("hdfc bank");
	});
});

describe("AccountRepository", () => {
	it("inserts an account and finds it by id, mirroring name into name_normalized", async () => {
		const inserted = await insertAccount({ name: "HDFC Bank" });
		const found = await repo.findById(inserted.id);
		expect(found?.name).toBe("HDFC Bank");
		expect(found?.nameNormalized).toBe("hdfc bank");
		expect(found?.status).toBe("active");
	});

	it("enforces case-insensitive uniqueness among non-deleted accounts of one user", async () => {
		await insertAccount({ name: "HDFC Bank" });
		await expect(insertAccount({ name: "hdfc bank" })).rejects.toThrow();
	});

	it("allows the same name for different users", async () => {
		const otherUser = (
			await users.insert({
				id: uuidV7(),
				email: "other@example.com",
				passwordHash: "hash",
				createdAt: nowIso,
				updatedAt: nowIso,
			})
		).id;
		await insertAccount({ name: "HDFC Bank" });
		const row = await repo.insert({
			id: uuidV7(),
			userId: otherUser,
			name: "HDFC Bank",
			type: "bank",
			openingBalanceMinor: 0,
			createdAt: nowIso,
			updatedAt: nowIso,
		});
		expect(row.userId).toBe(otherUser);
	});

	it("allows reusing a name once the previous account is soft-deleted", async () => {
		const original = await insertAccount({ name: "HDFC Bank" });
		await repo.updateStatus(
			original.id,
			"deleted",
			{ archivedAt: null, deletedAt: nowIso },
			nowIso,
		);
		const replacement = await insertAccount({ name: "hdfc bank" });
		expect(replacement.id).not.toBe(original.id);
	});

	it("listByStatus filters by status", async () => {
		const active = await insertAccount({ name: "Active" });
		await insertAccount({ name: "Archived", status: "archived" });
		await insertAccount({ name: "Deleted", status: "deleted" });

		const activeList = await repo.listByStatus(userId, "active");
		expect(activeList.map((a) => a.id)).toEqual([active.id]);

		const archivedList = await repo.listByStatus(userId, "archived");
		expect(archivedList).toHaveLength(1);
		expect(archivedList[0]?.status).toBe("archived");
	});

	it("findNonDeletedByNameNormalized ignores deleted accounts", async () => {
		const account = await insertAccount({ name: "HDFC Bank" });
		const found = await repo.findNonDeletedByNameNormalized(
			userId,
			"hdfc bank",
		);
		expect(found?.id).toBe(account.id);

		await repo.updateStatus(
			account.id,
			"deleted",
			{ archivedAt: null, deletedAt: nowIso },
			nowIso,
		);
		const afterDelete = await repo.findNonDeletedByNameNormalized(
			userId,
			"hdfc bank",
		);
		expect(afterDelete).toBeUndefined();
	});

	it("updateDetails rewrites name and name_normalized together", async () => {
		const account = await insertAccount({ name: "Old Name" });
		const updated = await repo.updateDetails(
			account.id,
			{ name: "  New Name  " },
			nowIso,
		);
		expect(updated?.name).toBe("  New Name  ");
		expect(updated?.nameNormalized).toBe("new name");
	});

	it("updateStatus sets status and lifecycle timestamps", async () => {
		const account = await insertAccount({ name: "Lifecycle" });
		const archived = await repo.updateStatus(
			account.id,
			"archived",
			{ archivedAt: nowIso, deletedAt: null },
			nowIso,
		);
		expect(archived?.status).toBe("archived");
		expect(archived?.archivedAt).toBe(nowIso);
		expect(archived?.deletedAt).toBeNull();

		const restored = await repo.updateStatus(
			account.id,
			"active",
			{ archivedAt: null, deletedAt: null },
			nowIso,
		);
		expect(restored?.status).toBe("active");
		expect(restored?.archivedAt).toBeNull();
	});

	it("updateStatusWithRename applies rename and reactivation in one statement", async () => {
		const account = await insertAccount({ name: "Old", status: "deleted" });
		const updated = await repo.updateStatusWithRename(
			account.id,
			"active",
			"Renamed",
			{ archivedAt: null, deletedAt: null },
			nowIso,
		);
		expect(updated?.status).toBe("active");
		expect(updated?.name).toBe("Renamed");
		expect(updated?.nameNormalized).toBe("renamed");
		expect(updated?.deletedAt).toBeNull();
	});
});
