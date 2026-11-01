/// <reference types="@cloudflare/vitest-plugin/types" />
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { createUserRepository } from "@/repositories/user-repository";
import {
	createCategoryRepository,
	normalizeCategoryName,
	type NewCategoryRow,
} from "@/repositories/category-repository";
import { uuidV7 } from "@/lib/uuid";

const db = getDb(env);
const repo = createCategoryRepository(db);
const users = createUserRepository(db);

const nowIso = new Date().toISOString();

let userId: string;

async function insertCategory(overrides: {
	name?: string;
	type?: string;
	status?: string;
	color?: string | null;
	icon?: string | null;
}): Promise<{ id: string; name: string }> {
	const row: NewCategoryRow = {
		id: uuidV7(),
		userId,
		name: overrides.name ?? "Groceries",
		type: overrides.type ?? "expense",
		color: overrides.color ?? null,
		icon: overrides.icon ?? null,
		createdAt: nowIso,
		updatedAt: nowIso,
	};
	const inserted = await repo.insert(row);
	if (overrides.status !== undefined && overrides.status !== "active") {
		await repo.updateStatus(
			inserted.id,
			overrides.status,
			overrides.status === "archived"
				? { archivedAt: nowIso, deletedAt: null }
				: { archivedAt: null, deletedAt: nowIso },
			nowIso,
		);
	}
	return { id: inserted.id, name: inserted.name };
}

beforeEach(async () => {
	await env.finance_application.exec(
		"DELETE FROM categories; DELETE FROM accounts; DELETE FROM refresh_tokens; DELETE FROM users;",
	);
	userId = (
		await users.insert({
			id: uuidV7(),
			email: "category-repo@example.com",
			passwordHash: "hash",
			createdAt: nowIso,
			updatedAt: nowIso,
		})
	).id;
});

describe("normalizeCategoryName", () => {
	it("trims and lowercases", () => {
		expect(normalizeCategoryName("  Groceries  ")).toBe("groceries");
	});
});

describe("CategoryRepository", () => {
	it("inserts a category and finds it by id, mirroring name into name_normalized", async () => {
		const inserted = await insertCategory({
			name: "Groceries",
			type: "expense",
			color: "#22C55E",
			icon: "shopping-cart",
		});
		const found = await repo.findById(inserted.id);
		expect(found?.name).toBe("Groceries");
		expect(found?.nameNormalized).toBe("groceries");
		expect(found?.type).toBe("expense");
		expect(found?.color).toBe("#22C55E");
		expect(found?.icon).toBe("shopping-cart");
		expect(found?.status).toBe("active");
	});

	it("enforces case-insensitive uniqueness among non-deleted categories of one user", async () => {
		await insertCategory({ name: "Groceries" });
		await expect(insertCategory({ name: "groceries" })).rejects.toThrow();
	});

	it("enforces uniqueness across types: an income category blocks an expense duplicate", async () => {
		await insertCategory({ name: "Salary", type: "income" });
		await expect(insertCategory({ name: "salary", type: "expense" })).rejects.toThrow();
	});

	it("allows the same name for different users", async () => {
		const otherUser = (
			await users.insert({
				id: uuidV7(),
				email: "other-category-repo@example.com",
				passwordHash: "hash",
				createdAt: nowIso,
				updatedAt: nowIso,
			})
		).id;
		await insertCategory({ name: "Groceries" });
		const row = await repo.insert({
			id: uuidV7(),
			userId: otherUser,
			name: "Groceries",
			type: "expense",
			color: null,
			icon: null,
			createdAt: nowIso,
			updatedAt: nowIso,
		});
		expect(row.userId).toBe(otherUser);
	});

	it("allows reusing a name once the previous category is soft-deleted", async () => {
		const original = await insertCategory({ name: "Groceries" });
		await repo.updateStatus(
			original.id,
			"deleted",
			{ archivedAt: null, deletedAt: nowIso },
			nowIso,
		);
		const replacement = await insertCategory({ name: "groceries" });
		expect(replacement.id).not.toBe(original.id);
	});

	it("listByStatus filters by status", async () => {
		const active = await insertCategory({ name: "Active" });
		await insertCategory({ name: "Archived", status: "archived" });
		await insertCategory({ name: "Deleted", status: "deleted" });

		const activeList = await repo.listByStatus(userId, "active");
		expect(activeList.map((c) => c.id)).toEqual([active.id]);

		const archivedList = await repo.listByStatus(userId, "archived");
		expect(archivedList).toHaveLength(1);
		expect(archivedList[0]?.status).toBe("archived");
	});

	it("findNonDeletedByNameNormalized ignores deleted categories", async () => {
		const category = await insertCategory({ name: "Groceries" });
		const found = await repo.findNonDeletedByNameNormalized(
			userId,
			"groceries",
		);
		expect(found?.id).toBe(category.id);

		await repo.updateStatus(
			category.id,
			"deleted",
			{ archivedAt: null, deletedAt: nowIso },
			nowIso,
		);
		const afterDelete = await repo.findNonDeletedByNameNormalized(
			userId,
			"groceries",
		);
		expect(afterDelete).toBeUndefined();
	});

	it("updateDetails rewrites name and name_normalized together and sets presentation values", async () => {
		const category = await insertCategory({ name: "Old Name" });
		const updated = await repo.updateDetails(
			category.id,
			{ name: "  New Name  ", color: "#FF0000", icon: "utensils" },
			nowIso,
		);
		expect(updated?.name).toBe("  New Name  ");
		expect(updated?.nameNormalized).toBe("new name");
		expect(updated?.color).toBe("#FF0000");
		expect(updated?.icon).toBe("utensils");

		const cleared = await repo.updateDetails(
			category.id,
			{ color: null, icon: null },
			nowIso,
		);
		expect(cleared?.color).toBeNull();
		expect(cleared?.icon).toBeNull();
	});

	it("updateStatus sets status and lifecycle timestamps", async () => {
		const category = await insertCategory({ name: "Lifecycle" });
		const archived = await repo.updateStatus(
			category.id,
			"archived",
			{ archivedAt: nowIso, deletedAt: null },
			nowIso,
		);
		expect(archived?.status).toBe("archived");
		expect(archived?.archivedAt).toBe(nowIso);
		expect(archived?.deletedAt).toBeNull();

		const restored = await repo.updateStatus(
			category.id,
			"active",
			{ archivedAt: null, deletedAt: null },
			nowIso,
		);
		expect(restored?.status).toBe("active");
		expect(restored?.archivedAt).toBeNull();
	});

	it("updateStatusWithRename applies rename and reactivation in one statement", async () => {
		const category = await insertCategory({ name: "Old", status: "deleted" });
		const updated = await repo.updateStatusWithRename(
			category.id,
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

	it("getReferencingTransactionCount reports zero while no transactions exist", async () => {
		const category = await insertCategory({ name: "Seam" });
		expect(await repo.getReferencingTransactionCount(category.id)).toBe(0);
	});
});
