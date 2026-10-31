import { describe, expect, it, vi } from "vitest";
import type { Account } from "@/db/schema";
import {
	createAccountService,
	computeCurrentBalance,
	type AccountList,
} from "@/services/account-service";

// Fake of the repository interface: service rules are tested here without a
// database; the real repository's SQL behavior is covered by the repository
// tests and the route contract tests.
function createFakeAccountRepo() {
	let sequence = 0;
	const rows = new Map<string, Account>();
	function row(overrides: Partial<Account> & { id: string }): Account {
		return {
			userId: "user-1",
			name: overrides.id,
			nameNormalized: (overrides.name ?? overrides.id).toLowerCase(),
			type: "bank",
			openingBalanceMinor: 0,
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
		nextId: () => `account-${++sequence}`,
		insert: vi.fn(
			async (input: {
				id: string;
				userId: string;
				name: string;
				type: string;
				openingBalanceMinor: number;
				createdAt: string;
				updatedAt: string;
			}) => {
				const account = row({
					id: input.id,
					userId: input.userId,
					name: input.name,
					nameNormalized: input.name.toLowerCase(),
					type: input.type,
					openingBalanceMinor: input.openingBalanceMinor,
					createdAt: input.createdAt,
					updatedAt: input.updatedAt,
				});
				rows.set(account.id, account);
				return account;
			},
		),
		findById: vi.fn(async (id: string) => rows.get(id)),
		listByStatus: vi.fn(async (_userId: string, status: string) =>
			[...rows.values()]
				.filter((account) => account.status === status)
				.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
		),
		findNonDeletedByNameNormalized: vi.fn(
			async (userId: string, nameNormalized: string) =>
				[...rows.values()].find(
					(account) =>
						account.userId === userId &&
						account.nameNormalized === nameNormalized &&
						account.status !== "deleted",
				),
		),
		updateDetails: vi.fn(
			async (
				id: string,
				patch: { name?: string; type?: string; openingBalanceMinor?: number },
				updatedAt: string,
			) => {
				const account = rows.get(id);
				if (!account) {
					return undefined;
				}
				const updated: Account = {
					...account,
					...(patch.name !== undefined
						? {
								name: patch.name,
								nameNormalized: patch.name.toLowerCase(),
							}
						: {}),
					...(patch.type !== undefined ? { type: patch.type } : {}),
					...(patch.openingBalanceMinor !== undefined
						? { openingBalanceMinor: patch.openingBalanceMinor }
						: {}),
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
				const account = rows.get(id);
				if (!account) {
					return undefined;
				}
				const updated: Account = {
					...account,
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
				const account = rows.get(id);
				if (!account) {
					return undefined;
				}
				const updated: Account = {
					...account,
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

type FakeRepo = ReturnType<typeof createFakeAccountRepo>;

// Structurally satisfies AccountServiceDeps["accounts"].
function asRepo(fake: FakeRepo) {
	return fake as unknown as Parameters<
		typeof createAccountService
	>[0]["accounts"];
}

function createdId(
	outcome: { ok: true; value: { id: string } } | { ok: false },
): string {
	if (!outcome.ok) {
		throw new Error("seed failed");
	}
	return outcome.value.id;
}

describe("computeCurrentBalance", () => {
	it("adds the posted transaction sum to the opening balance", () => {
		expect(computeCurrentBalance(125050, 0)).toBe(125050);
		expect(computeCurrentBalance(125050, -500)).toBe(124550);
		expect(computeCurrentBalance(0, -1)).toBe(-1);
	});

	it("preserves negative balances as-is", () => {
		expect(computeCurrentBalance(-100, 0)).toBe(-100);
	});
});

describe("createAccountService.create", () => {
	it("creates an account whose current balance equals the opening balance", async () => {
		const fake = createFakeAccountRepo();
		const service = createAccountService({ accounts: asRepo(fake) });
		const outcome = await service.create({
			userId: "user-1",
			name: "HDFC Bank",
			type: "bank",
			openingBalanceMinor: 125050,
		});
		expect(outcome).toEqual({
			ok: true,
			value: expect.objectContaining({
				name: "HDFC Bank",
				openingBalanceMinor: 125050,
				currentBalanceMinor: 125050,
				status: "active",
			}),
		});
	});

	it("rejects a name that matches a non-deleted account case-insensitively", async () => {
		const fake = createFakeAccountRepo();
		const service = createAccountService({ accounts: asRepo(fake) });
		await service.create({
			userId: "user-1",
			name: "HDFC Bank",
			type: "bank",
			openingBalanceMinor: 0,
		});
		const outcome = await service.create({
			userId: "user-1",
			name: "hdfc bank",
			type: "wallet",
			openingBalanceMinor: 0,
		});
		expect(outcome).toEqual({ ok: false, code: "ACCOUNT_NAME_TAKEN" });
	});
});

describe("createAccountService.list", () => {
	it("combines balances across active accounts only", async () => {
		const fake = createFakeAccountRepo();
		const service = createAccountService({ accounts: asRepo(fake) });
		await service.create({
			userId: "user-1",
			name: "Cash",
			type: "cash",
			openingBalanceMinor: 10000,
		});
		await service.create({
			userId: "user-1",
			name: "Bank",
			type: "bank",
			openingBalanceMinor: 20000,
		});
		const archived = await service.create({
			userId: "user-1",
			name: "Old",
			type: "wallet",
			openingBalanceMinor: 50000,
		});
		await service.archive(
			"user-1",
			(archived as { value: { id: string } }).value.id,
		);

		const active = (await service.list("user-1", "active")) as AccountList;
		expect(active.accounts).toHaveLength(2);
		expect(active.combinedBalanceMinor).toBe(30000);

		const archivedList = (await service.list(
			"user-1",
			"archived",
		)) as AccountList;
		expect(archivedList.accounts).toHaveLength(1);
		// The combined figure still covers active accounts regardless of filter.
		expect(archivedList.combinedBalanceMinor).toBe(30000);
	});
});

describe("createAccountService.update", () => {
	it("renames an active account", async () => {
		const fake = createFakeAccountRepo();
		const service = createAccountService({ accounts: asRepo(fake) });
		const created = (await service.create({
			userId: "user-1",
			name: "Cash",
			type: "cash",
			openingBalanceMinor: 0,
		})) as { value: { id: string } };
		const outcome = await service.update({
			userId: "user-1",
			accountId: created.value.id,
			name: "Pocket Cash",
		});
		expect(outcome).toEqual({
			ok: true,
			value: expect.objectContaining({ name: "Pocket Cash" }),
		});
	});

	it("rejects renaming to a conflicting name", async () => {
		const fake = createFakeAccountRepo();
		const service = createAccountService({ accounts: asRepo(fake) });
		await service.create({
			userId: "user-1",
			name: "Cash",
			type: "cash",
			openingBalanceMinor: 0,
		});
		const other = (await service.create({
			userId: "user-1",
			name: "Bank",
			type: "bank",
			openingBalanceMinor: 0,
		})) as { value: { id: string } };
		const outcome = await service.update({
			userId: "user-1",
			accountId: other.value.id,
			name: "CASH",
		});
		expect(outcome).toEqual({ ok: false, code: "ACCOUNT_NAME_TAKEN" });
	});

	it("rejects type and opening-balance changes once transactions exist", async () => {
		const fake = createFakeAccountRepo();
		const service = createAccountService({
			accounts: asRepo(fake),
			hasPostedTransactions: vi.fn().mockResolvedValue(true),
		});
		const created = (await service.create({
			userId: "user-1",
			name: "Cash",
			type: "cash",
			openingBalanceMinor: 0,
		})) as { value: { id: string } };
		const typeOutcome = await service.update({
			userId: "user-1",
			accountId: created.value.id,
			type: "bank",
		});
		expect(typeOutcome).toEqual({ ok: false, code: "ACCOUNT_FIELD_LOCKED" });
		const balanceOutcome = await service.update({
			userId: "user-1",
			accountId: created.value.id,
			openingBalanceMinor: 100,
		});
		expect(balanceOutcome).toEqual({ ok: false, code: "ACCOUNT_FIELD_LOCKED" });
		// Renaming stays allowed while only the amount fields are locked.
		const renameOutcome = await service.update({
			userId: "user-1",
			accountId: created.value.id,
			name: "Renamed",
		});
		expect(renameOutcome).toEqual({
			ok: true,
			value: expect.objectContaining({ name: "Renamed" }),
		});
	});

	it("allows type and opening-balance changes while no transactions exist", async () => {
		const fake = createFakeAccountRepo();
		const service = createAccountService({ accounts: asRepo(fake) });
		const created = (await service.create({
			userId: "user-1",
			name: "Cash",
			type: "cash",
			openingBalanceMinor: 0,
		})) as { value: { id: string } };
		const outcome = await service.update({
			userId: "user-1",
			accountId: created.value.id,
			type: "bank",
			openingBalanceMinor: 500,
		});
		expect(outcome).toEqual({
			ok: true,
			value: expect.objectContaining({
				type: "bank",
				openingBalanceMinor: 500,
			}),
		});
	});

	it("rejects editing a non-active account", async () => {
		const fake = createFakeAccountRepo();
		const service = createAccountService({ accounts: asRepo(fake) });
		const created = (await service.create({
			userId: "user-1",
			name: "Cash",
			type: "cash",
			openingBalanceMinor: 0,
		})) as { value: { id: string } };
		await service.archive("user-1", created.value.id);
		const outcome = await service.update({
			userId: "user-1",
			accountId: created.value.id,
			name: "New Name",
		});
		expect(outcome).toEqual({ ok: false, code: "ACCOUNT_TRANSITION_INVALID" });
	});

	it("returns NOT_FOUND for an unknown or foreign account", async () => {
		const fake = createFakeAccountRepo();
		const service = createAccountService({ accounts: asRepo(fake) });
		expect(
			await service.update({
				userId: "user-1",
				accountId: "missing",
				name: "X",
			}),
		).toEqual({ ok: false, code: "NOT_FOUND" });
	});
});

describe("createAccountService transitions", () => {
	async function seed(
		service: ReturnType<typeof createAccountService>,
	): Promise<string> {
		return createdId(
			await service.create({
				userId: "user-1",
				name: "Cash",
				type: "cash",
				openingBalanceMinor: 100,
			}),
		);
	}

	it.each([
		["archived", "archived", false],
		["archived", "deleted", false],
		["archived", "active", true],
		["deleted", "active", true],
		["deleted", "archived", false],
		["deleted", "deleted", false],
		["active", "active", false],
	])(
		"applies the transition matrix %s -> %s as %s",
		async (from, target, allowed) => {
			const fake = createFakeAccountRepo();
			const service = createAccountService({ accounts: asRepo(fake) });
			const id = await seed(service);
			if (from === "archived") {
				await service.archive("user-1", id);
			} else if (from === "deleted") {
				await service.remove("user-1", id);
			}
			const outcome = await service.transition(
				"user-1",
				id,
				target as "active",
			);
			if (allowed) {
				expect(outcome).toEqual({
					ok: true,
					value: expect.objectContaining({ status: target }),
				});
			} else {
				expect(outcome).toEqual({
					ok: false,
					code: "ACCOUNT_TRANSITION_INVALID",
				});
			}
		},
	);

	it("stamps lifecycle timestamps matching the new status", async () => {
		const fake = createFakeAccountRepo();
		const service = createAccountService({ accounts: asRepo(fake) });
		const id = await seed(service);
		const archived = (await service.archive("user-1", id)) as {
			value: { archivedAt: string | null; deletedAt: string | null };
		};
		expect(archived.value.archivedAt).toBeTypeOf("string");
		expect(archived.value.deletedAt).toBeNull();
		const restored = (await service.restore({
			userId: "user-1",
			accountId: id,
		})) as { value: { archivedAt: string | null; deletedAt: string | null } };
		expect(restored.value.archivedAt).toBeNull();
		expect(restored.value.deletedAt).toBeNull();
	});

	it("rejects restoring when the name was taken while the account was away", async () => {
		const fake = createFakeAccountRepo();
		const service = createAccountService({ accounts: asRepo(fake) });
		const id = await seed(service);
		await service.remove("user-1", id);
		await service.create({
			userId: "user-1",
			name: "CASH",
			type: "wallet",
			openingBalanceMinor: 0,
		});
		const outcome = await service.restore({ userId: "user-1", accountId: id });
		expect(outcome).toEqual({ ok: false, code: "ACCOUNT_NAME_TAKEN" });
	});

	it("restores with an explicit new name applied atomically", async () => {
		const fake = createFakeAccountRepo();
		const service = createAccountService({ accounts: asRepo(fake) });
		const id = await seed(service);
		await service.remove("user-1", id);
		await service.create({
			userId: "user-1",
			name: "CASH",
			type: "wallet",
			openingBalanceMinor: 0,
		});
		const outcome = await service.restore({
			userId: "user-1",
			accountId: id,
			newName: "Cash restored",
		});
		expect(outcome).toEqual({
			ok: true,
			value: expect.objectContaining({
				status: "active",
				name: "Cash restored",
				deletedAt: null,
			}),
		});
	});

	it("returns NOT_FOUND for transitions on unknown accounts", async () => {
		const fake = createFakeAccountRepo();
		const service = createAccountService({ accounts: asRepo(fake) });
		expect(await service.archive("user-1", "missing")).toEqual({
			ok: false,
			code: "NOT_FOUND",
		});
	});
});

describe("createAccountService scoping", () => {
	it("never returns or mutates another user's account", async () => {
		const fake = createFakeAccountRepo();
		const service = createAccountService({ accounts: asRepo(fake) });
		const id = createdId(
			await service.create({
				userId: "user-1",
				name: "Mine",
				type: "cash",
				openingBalanceMinor: 0,
			}),
		);
		expect(await service.get("user-2", id)).toEqual({
			ok: false,
			code: "NOT_FOUND",
		});
		expect(await service.archive("user-2", id)).toEqual({
			ok: false,
			code: "NOT_FOUND",
		});
	});
});
