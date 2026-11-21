import { describe, expect, it, vi } from "vitest";
import type { Category } from "@/db/schema";
import {
	type CategoryList,
	createCategoryService,
} from "@/services/category-service";

// Fake of the repository interface: service rules are tested here without a
// database; the real repository's SQL behavior is covered by the repository
// tests and the route contract tests.
function createFakeCategoryRepo() {
	let sequence = 0;
	const rows = new Map<string, Category>();
	function row(overrides: Partial<Category> & { id: string }): Category {
		return {
			userId: "user-1",
			name: overrides.id,
			nameNormalized: (overrides.name ?? overrides.id).toLowerCase(),
			type: "expense",
			color: null,
			icon: null,
			status: "active",
			archivedAt: null,
			deletedAt: null,
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-01T00:00:00.000Z",
			...overrides,
		};
	}
	return {
		rows,
		nextId: () => `category-${++sequence}`,
		insert: vi.fn(
			async (input: {
				id: string;
				userId: string;
				name: string;
				type: string;
				color: string | null;
				icon: string | null;
				createdAt: string;
				updatedAt: string;
			}) => {
				const category = row({
					id: input.id,
					userId: input.userId,
					name: input.name,
					nameNormalized: input.name.toLowerCase(),
					type: input.type,
					color: input.color,
					icon: input.icon,
					createdAt: input.createdAt,
					updatedAt: input.updatedAt,
				});
				rows.set(category.id, category);
				return category;
			},
		),
		findById: vi.fn(async (id: string) => rows.get(id)),
		listByStatus: vi.fn(async (_userId: string, status: string) =>
			[...rows.values()]
				.filter((category) => category.status === status)
				.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
		),
		findNonDeletedByNameNormalized: vi.fn(
			async (userId: string, nameNormalized: string) =>
				[...rows.values()].find(
					(category) =>
						category.userId === userId &&
						category.nameNormalized === nameNormalized &&
						category.status !== "deleted",
				),
		),
		updateDetails: vi.fn(
			async (
				id: string,
				patch: {
					name?: string;
					type?: string;
					color?: string | null;
					icon?: string | null;
				},
				updatedAt: string,
			) => {
				const category = rows.get(id);
				if (!category) {
					return undefined;
				}
				const updated: Category = {
					...category,
					...(patch.name !== undefined
						? {
								name: patch.name,
								nameNormalized: patch.name.toLowerCase(),
							}
						: {}),
					...(patch.type !== undefined ? { type: patch.type } : {}),
					...(patch.color !== undefined ? { color: patch.color } : {}),
					...(patch.icon !== undefined ? { icon: patch.icon } : {}),
					updatedAt,
				};
				rows.set(id, updated);
				return updated;
			},
		),
		updateStatus: vi.fn(
			async (
				id: string,
				status: string,
				timestamps: { archivedAt: string | null; deletedAt: string | null },
				updatedAt: string,
			) => {
				const category = rows.get(id);
				if (!category) {
					return undefined;
				}
				const updated: Category = {
					...category,
					status,
					archivedAt: timestamps.archivedAt,
					deletedAt: timestamps.deletedAt,
					updatedAt,
				};
				rows.set(id, updated);
				return updated;
			},
		),
		updateStatusWithRename: vi.fn(
			async (
				id: string,
				status: string,
				newName: string,
				timestamps: { archivedAt: string | null; deletedAt: string | null },
				updatedAt: string,
			) => {
				const category = rows.get(id);
				if (!category) {
					return undefined;
				}
				const updated: Category = {
					...category,
					status,
					name: newName,
					nameNormalized: newName.toLowerCase(),
					archivedAt: timestamps.archivedAt,
					deletedAt: timestamps.deletedAt,
					updatedAt,
				};
				rows.set(id, updated);
				return updated;
			},
		),
	};
}

type FakeRepo = ReturnType<typeof createFakeCategoryRepo>;

// Structurally satisfies CategoryServiceDeps["categories"].
function asRepo(fake: FakeRepo) {
	return fake as unknown as Parameters<
		typeof createCategoryService
	>[0]["categories"];
}

function createdId(
	outcome: { ok: true; value: { id: string } } | { ok: false },
): string {
	if (!outcome.ok) {
		throw new Error("seed failed");
	}
	return outcome.value.id;
}

describe("createCategoryService.create", () => {
	it("creates a category with presentation defaults of null", async () => {
		const repo = createFakeCategoryRepo();
		const service = createCategoryService({ categories: asRepo(repo) });
		// Names arrive boundary-trimmed (categoryNameSchema trims at the API
		// layer); the service mirrors that contract.
		const outcome = await service.create({
			userId: "user-1",
			name: "Groceries",
			type: "expense",
		});
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) {
			return;
		}
		expect(outcome.value).toMatchObject({
			name: "Groceries",
			type: "expense",
			color: null,
			icon: null,
			status: "active",
		});
	});

	it("keeps supplied presentation values", async () => {
		const repo = createFakeCategoryRepo();
		const service = createCategoryService({ categories: asRepo(repo) });
		const outcome = await service.create({
			userId: "user-1",
			name: "Groceries",
			type: "expense",
			color: "#22C55E",
			icon: "shopping-cart",
		});
		expect(outcome.ok).toBe(true);
		if (outcome.ok) {
			expect(outcome.value.color).toBe("#22C55E");
			expect(outcome.value.icon).toBe("shopping-cart");
		}
	});

	it("rejects a duplicate name ignoring case", async () => {
		const repo = createFakeCategoryRepo();
		const service = createCategoryService({ categories: asRepo(repo) });
		await service.create({
			userId: "user-1",
			name: "Groceries",
			type: "expense",
		});
		const outcome = await service.create({
			userId: "user-1",
			name: "GROCERIES",
			type: "expense",
		});
		expect(outcome).toEqual({ ok: false, code: "CATEGORY_NAME_TAKEN" });
	});

	it("rejects a cross-type duplicate name", async () => {
		const repo = createFakeCategoryRepo();
		const service = createCategoryService({ categories: asRepo(repo) });
		await service.create({ userId: "user-1", name: "Salary", type: "income" });
		const outcome = await service.create({
			userId: "user-1",
			name: "salary",
			type: "expense",
		});
		expect(outcome).toEqual({ ok: false, code: "CATEGORY_NAME_TAKEN" });
	});

	it("scopes uniqueness to one user", async () => {
		const repo = createFakeCategoryRepo();
		const service = createCategoryService({ categories: asRepo(repo) });
		await service.create({
			userId: "user-1",
			name: "Groceries",
			type: "expense",
		});
		const outcome = await service.create({
			userId: "user-2",
			name: "Groceries",
			type: "expense",
		});
		expect(outcome.ok).toBe(true);
	});
});

describe("createCategoryService.list and get", () => {
	it("lists only the requested status slice", async () => {
		const repo = createFakeCategoryRepo();
		const service = createCategoryService({ categories: asRepo(repo) });
		const active = createdId(
			await service.create({
				userId: "user-1",
				name: "Active",
				type: "expense",
			}),
		);
		const archived = createdId(
			await service.create({
				userId: "user-1",
				name: "Archived",
				type: "income",
			}),
		);
		await service.transition("user-1", archived, "archived");

		const activeList: CategoryList = await service.list("user-1", "active");
		expect(activeList.categories.map((c) => c.id)).toEqual([active]);

		const archivedList = await service.list("user-1", "archived");
		expect(archivedList.categories.map((c) => c.id)).toEqual([archived]);
	});

	it("returns another user's category as NOT_FOUND", async () => {
		const repo = createFakeCategoryRepo();
		const service = createCategoryService({ categories: asRepo(repo) });
		const id = createdId(
			await service.create({
				userId: "user-1",
				name: "Groceries",
				type: "expense",
			}),
		);
		expect(await service.get("user-2", id)).toEqual({
			ok: false,
			code: "NOT_FOUND",
		});
		expect(await service.get("user-1", "no-such-id")).toEqual({
			ok: false,
			code: "NOT_FOUND",
		});
	});
});

describe("createCategoryService.update", () => {
	it("renames an active category", async () => {
		const repo = createFakeCategoryRepo();
		const service = createCategoryService({ categories: asRepo(repo) });
		const id = createdId(
			await service.create({
				userId: "user-1",
				name: "Groceries",
				type: "expense",
			}),
		);
		const outcome = await service.update({
			userId: "user-1",
			categoryId: id,
			name: "Food",
		});
		expect(outcome.ok).toBe(true);
		if (outcome.ok) {
			expect(outcome.value.name).toBe("Food");
		}
	});

	it("allows keeping the category's own name", async () => {
		const repo = createFakeCategoryRepo();
		const service = createCategoryService({ categories: asRepo(repo) });
		const id = createdId(
			await service.create({
				userId: "user-1",
				name: "Groceries",
				type: "expense",
			}),
		);
		const outcome = await service.update({
			userId: "user-1",
			categoryId: id,
			name: "GROCERIES",
		});
		expect(outcome.ok).toBe(true);
	});

	it("rejects renaming to a taken name", async () => {
		const repo = createFakeCategoryRepo();
		const service = createCategoryService({ categories: asRepo(repo) });
		await service.create({ userId: "user-1", name: "Other", type: "expense" });
		const id = createdId(
			await service.create({
				userId: "user-1",
				name: "Groceries",
				type: "expense",
			}),
		);
		const outcome = await service.update({
			userId: "user-1",
			categoryId: id,
			name: "other",
		});
		expect(outcome).toEqual({ ok: false, code: "CATEGORY_NAME_TAKEN" });
	});

	it("changes the type while no transactions reference the category", async () => {
		const repo = createFakeCategoryRepo();
		const referencing = vi.fn(async () => 0);
		const service = createCategoryService({
			categories: asRepo(repo),
			getReferencingTransactionCount: referencing,
		});
		const id = createdId(
			await service.create({
				userId: "user-1",
				name: "Flexible",
				type: "expense",
			}),
		);
		const outcome = await service.update({
			userId: "user-1",
			categoryId: id,
			type: "income",
		});
		expect(outcome.ok).toBe(true);
		if (outcome.ok) {
			expect(outcome.value.type).toBe("income");
		}
		expect(referencing).toHaveBeenCalledWith(id);
	});

	it("rejects the type change while a transaction references the category", async () => {
		const repo = createFakeCategoryRepo();
		const service = createCategoryService({
			categories: asRepo(repo),
			getReferencingTransactionCount: async () => 1,
		});
		const id = createdId(
			await service.create({ userId: "user-1", name: "Used", type: "expense" }),
		);
		const outcome = await service.update({
			userId: "user-1",
			categoryId: id,
			type: "income",
		});
		expect(outcome).toEqual({ ok: false, code: "CATEGORY_TYPE_LOCKED" });
		const row = repo.rows.get(id);
		expect(row?.type).toBe("expense");
	});

	it("does not consult the referencing count when the type is unchanged", async () => {
		const repo = createFakeCategoryRepo();
		const referencing = vi.fn(async () => 1);
		const service = createCategoryService({
			categories: asRepo(repo),
			getReferencingTransactionCount: referencing,
		});
		const id = createdId(
			await service.create({ userId: "user-1", name: "Same", type: "expense" }),
		);
		const outcome = await service.update({
			userId: "user-1",
			categoryId: id,
			name: "Renamed",
		});
		expect(outcome.ok).toBe(true);
		expect(referencing).not.toHaveBeenCalled();
	});

	it("updates and clears presentation values", async () => {
		const repo = createFakeCategoryRepo();
		const service = createCategoryService({ categories: asRepo(repo) });
		const id = createdId(
			await service.create({
				userId: "user-1",
				name: "Groceries",
				type: "expense",
				color: "#22C55E",
				icon: "shopping-cart",
			}),
		);
		const updated = await service.update({
			userId: "user-1",
			categoryId: id,
			color: "#FF0000",
		});
		expect(updated.ok).toBe(true);
		if (updated.ok) {
			expect(updated.value.color).toBe("#FF0000");
			expect(updated.value.icon).toBe("shopping-cart");
		}
		const cleared = await service.update({
			userId: "user-1",
			categoryId: id,
			color: null,
			icon: null,
		});
		expect(cleared.ok).toBe(true);
		if (cleared.ok) {
			expect(cleared.value.color).toBeNull();
			expect(cleared.value.icon).toBeNull();
		}
	});

	it("rejects editing a non-active category", async () => {
		const repo = createFakeCategoryRepo();
		const service = createCategoryService({ categories: asRepo(repo) });
		const id = createdId(
			await service.create({
				userId: "user-1",
				name: "Groceries",
				type: "expense",
			}),
		);
		await service.transition("user-1", id, "archived");
		const outcome = await service.update({
			userId: "user-1",
			categoryId: id,
			name: "New Name",
		});
		expect(outcome).toEqual({ ok: false, code: "CATEGORY_TRANSITION_INVALID" });
	});

	it("returns NOT_FOUND for unknown or foreign categories", async () => {
		const repo = createFakeCategoryRepo();
		const service = createCategoryService({ categories: asRepo(repo) });
		expect(
			await service.update({
				userId: "user-1",
				categoryId: "ghost",
				name: "X",
			}),
		).toEqual({ ok: false, code: "NOT_FOUND" });
	});
});

describe("createCategoryService lifecycle transitions", () => {
	it("covers the full transition matrix", async () => {
		const repo = createFakeCategoryRepo();
		const service = createCategoryService({ categories: asRepo(repo) });
		async function seed(name: string): Promise<string> {
			return createdId(
				await service.create({ userId: "user-1", name, type: "expense" }),
			);
		}

		// active → archived
		const toArchive = await seed("To Archive");
		const archived = await service.transition("user-1", toArchive, "archived");
		expect(archived.ok).toBe(true);

		// active → deleted
		const toDelete = await seed("To Delete");
		expect((await service.transition("user-1", toDelete, "deleted")).ok).toBe(
			true,
		);

		// archived → active (restore)
		expect((await service.transition("user-1", toArchive, "active")).ok).toBe(
			true,
		);

		// archived → deleted is invalid
		const blocked = await seed("Blocked");
		await service.transition("user-1", blocked, "archived");
		expect(await service.transition("user-1", blocked, "deleted")).toEqual({
			ok: false,
			code: "CATEGORY_TRANSITION_INVALID",
		});

		// deleted → active (restore)
		expect((await service.transition("user-1", toDelete, "active")).ok).toBe(
			true,
		);

		// deleted → archived is invalid
		const trashed = await seed("Trashed");
		await service.transition("user-1", trashed, "deleted");
		expect(await service.transition("user-1", trashed, "archived")).toEqual({
			ok: false,
			code: "CATEGORY_TRANSITION_INVALID",
		});

		// same-status transitions are invalid
		const sameStatus = await seed("Same Status");
		expect(await service.transition("user-1", sameStatus, "active")).toEqual({
			ok: false,
			code: "CATEGORY_TRANSITION_INVALID",
		});

		// unknown ids are NOT_FOUND
		expect(await service.transition("user-1", "ghost", "archived")).toEqual({
			ok: false,
			code: "NOT_FOUND",
		});
	});

	it("rejects restoring when the name was taken, then succeeds with newName", async () => {
		const repo = createFakeCategoryRepo();
		const service = createCategoryService({ categories: asRepo(repo) });
		const id = createdId(
			await service.create({
				userId: "user-1",
				name: "Groceries",
				type: "expense",
			}),
		);
		await service.transition("user-1", id, "deleted");
		await service.create({
			userId: "user-1",
			name: "GROCERIES",
			type: "income",
		});

		const conflict = await service.restore({
			userId: "user-1",
			categoryId: id,
		});
		expect(conflict).toEqual({ ok: false, code: "CATEGORY_NAME_TAKEN" });

		const renamed = await service.restore({
			userId: "user-1",
			categoryId: id,
			newName: "Groceries Restored",
		});
		expect(renamed.ok).toBe(true);
		if (renamed.ok) {
			expect(renamed.value).toMatchObject({
				name: "Groceries Restored",
				status: "active",
				deletedAt: null,
			});
		}
	});

	it("keeps lifecycle timestamps consistent across transitions", async () => {
		const repo = createFakeCategoryRepo();
		const service = createCategoryService({ categories: asRepo(repo) });
		const id = createdId(
			await service.create({
				userId: "user-1",
				name: "Timestamps",
				type: "expense",
			}),
		);
		const archived = await service.transition("user-1", id, "archived");
		if (archived.ok) {
			expect(archived.value.archivedAt).toEqual(expect.any(String));
			expect(archived.value.deletedAt).toBeNull();
		}
		const deleted = await service.transition("user-1", id, "active");
		if (deleted.ok) {
			expect(deleted.value.archivedAt).toBeNull();
			expect(deleted.value.deletedAt).toBeNull();
		}
		const trashed = await service.transition("user-1", id, "deleted");
		if (trashed.ok) {
			expect(trashed.value.archivedAt).toBeNull();
			expect(trashed.value.deletedAt).toEqual(expect.any(String));
		}
	});
});
