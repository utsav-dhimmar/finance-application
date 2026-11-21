import { describe, expect, it, vi } from "vitest";
import type { Account, Transfer } from "@/db/schema";
import {
	createTransferService,
	type TransferList,
} from "@/services/transfer-service";

const UUID_V7 = "018f6a2c-9b7d-7ce2-8f3a-1d4e5f6a7b8c";

// Fakes of the two repository interfaces: service rules are tested here
// without a database; the real repository's SQL behavior is covered by the
// repository integration tests and the route contract tests.
function createFakes() {
	let sequence = 0;
	const transferRows = new Map<string, Transfer>();
	const accountRows = new Map<string, Account>();

	function accountRow(overrides: Partial<Account> & { id: string }): Account {
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

	function transferRow(
		overrides: Partial<Transfer> & { id: string },
	): Transfer {
		return {
			userId: "user-1",
			sourceAccountId: "acc-a",
			destinationAccountId: "acc-b",
			amountMinor: 1000,
			date: "2026-01-15",
			notes: null,
			status: "active",
			archivedAt: null,
			deletedAt: null,
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-01T00:00:00.000Z",
			...overrides,
		};
	}

	const transfers = {
		rows: transferRows,
		insert: vi.fn(async (input: Transfer) => {
			if (transferRows.has(input.id)) {
				throw new Error("UNIQUE constraint failed: transfers.id");
			}
			// Mirror the table defaults the real INSERT applies.
			const row: Transfer = {
				...input,
				status: input.status ?? "active",
				archivedAt: input.archivedAt ?? null,
				deletedAt: input.deletedAt ?? null,
			};
			transferRows.set(row.id, row);
			return row;
		}),
		findById: vi.fn(async (id: string) => transferRows.get(id)),
		findByIdWithRefs: vi.fn(async (id: string) => {
			const transfer = transferRows.get(id);
			if (!transfer) {
				return undefined;
			}
			return {
				transfer,
				sourceAccountName:
					accountRows.get(transfer.sourceAccountId)?.name ?? null,
				destinationAccountName:
					accountRows.get(transfer.destinationAccountId)?.name ?? null,
			};
		}),
		list: vi.fn(
			async (
				_userId: string,
				filters: { status: string; page: number; pageSize: number },
			) => {
				const matching = [...transferRows.values()].filter(
					(t) => t.status === filters.status,
				);
				const start = (filters.page - 1) * filters.pageSize;
				const rows = matching
					.slice(start, start + filters.pageSize)
					.map((transfer) => ({
						transfer,
						sourceAccountName:
							accountRows.get(transfer.sourceAccountId)?.name ?? null,
						destinationAccountName:
							accountRows.get(transfer.destinationAccountId)?.name ?? null,
					}));
				const result: { rows: typeof rows; total: number } = {
					rows,
					total: matching.length,
				};
				return result;
			},
		),
		updateDetails: vi.fn(
			async (id: string, patch: Partial<Transfer>, updatedAt: string) => {
				const transfer = transferRows.get(id);
				if (!transfer) {
					return undefined;
				}
				const updated: Transfer = { ...transfer, ...patch, updatedAt };
				transferRows.set(id, updated);
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
				const transfer = transferRows.get(id);
				if (!transfer) {
					return undefined;
				}
				const updated: Transfer = {
					...transfer,
					status,
					archivedAt: timestamps.archivedAt,
					deletedAt: timestamps.deletedAt,
					updatedAt,
				};
				transferRows.set(id, updated);
				return updated;
			},
		),
		deleteIfDeleted: vi.fn(async (id: string) => {
			const transfer = transferRows.get(id);
			if (transfer?.status !== "deleted") {
				return false;
			}
			return transferRows.delete(id);
		}),
		updateStatusAndDetails: vi.fn(
			async (
				id: string,
				status: string,
				timestamps: { archivedAt: string | null; deletedAt: string | null },
				patch: Partial<Transfer>,
				updatedAt: string,
			) => {
				const transfer = transferRows.get(id);
				if (!transfer) {
					return undefined;
				}
				const updated: Transfer = {
					...transfer,
					status,
					archivedAt: timestamps.archivedAt,
					deletedAt: timestamps.deletedAt,
					...patch,
					updatedAt,
				};
				transferRows.set(id, updated);
				return updated;
			},
		),
	};

	const accounts = {
		findById: vi.fn(async (id: string) => accountRows.get(id)),
	};

	function seedAccount(overrides: Partial<Account> & { id: string }): Account {
		const account = accountRow(overrides);
		accountRows.set(account.id, account);
		return account;
	}

	function seedTransfer(
		overrides: Partial<Transfer> & { id: string },
	): Transfer {
		const transfer = transferRow(overrides);
		transferRows.set(transfer.id, transfer);
		return transfer;
	}

	function nextId(): string {
		return `txn-${++sequence}`;
	}

	// The fakes implement only the members the service uses; the cast documents
	// that gap the same way the transaction-service tests do.
	const service = createTransferService({
		transfers,
		accounts,
	} as unknown as Parameters<typeof createTransferService>[0]);

	return {
		service,
		transfers,
		accounts,
		seedAccount,
		seedTransfer,
		nextId,
	};
}

describe("createTransferService.create", () => {
	const validInput = {
		userId: "user-1",
		id: UUID_V7,
		sourceAccountId: "acc-a",
		destinationAccountId: "acc-b",
		amountMinor: 125050,
		date: "2026-01-15",
	};

	it("creates a transfer between distinct active accounts", async () => {
		const fakes = createFakes();
		fakes.seedAccount({ id: "acc-a" });
		fakes.seedAccount({ id: "acc-b" });
		const outcome = await fakes.service.create(validInput);
		expect(outcome).toEqual({
			ok: true,
			value: expect.objectContaining({
				id: UUID_V7,
				amountMinor: 125050,
				sourceAccountName: "acc-a",
				destinationAccountName: "acc-b",
				status: "active",
			}),
			replayed: false,
		});
	});

	it("replays the existing transfer for a repeated client id", async () => {
		const fakes = createFakes();
		fakes.seedAccount({ id: "acc-a" });
		fakes.seedAccount({ id: "acc-b" });
		await fakes.service.create(validInput);
		const replay = await fakes.service.create({
			...validInput,
			amountMinor: 999,
		});
		expect(replay).toEqual({
			ok: true,
			value: expect.objectContaining({ id: UUID_V7, amountMinor: 125050 }),
			replayed: true,
		});
		expect(fakes.transfers.insert).toHaveBeenCalledTimes(1);
	});

	it("answers with the replay row when the insert loses a race", async () => {
		const fakes = createFakes();
		fakes.seedAccount({ id: "acc-a" });
		fakes.seedAccount({ id: "acc-b" });
		fakes.transfers.insert.mockRejectedValueOnce(
			new Error("UNIQUE constraint failed: transfers.id"),
		);
		fakes.seedTransfer({ id: UUID_V7 });
		const outcome = await fakes.service.create(validInput);
		expect(outcome).toEqual({
			ok: true,
			value: expect.objectContaining({ id: UUID_V7 }),
			replayed: true,
		});
	});

	it("rejects identical source and destination accounts", async () => {
		const fakes = createFakes();
		fakes.seedAccount({ id: "acc-a" });
		const outcome = await fakes.service.create({
			...validInput,
			destinationAccountId: "acc-a",
		});
		expect(outcome).toEqual({ ok: false, code: "SAME_ACCOUNT_TRANSFER" });
	});

	it.each(["archived", "deleted"])(
		"rejects an %s source account",
		async (status) => {
			const fakes = createFakes();
			fakes.seedAccount({ id: "acc-a", status });
			fakes.seedAccount({ id: "acc-b" });
			const outcome = await fakes.service.create(validInput);
			expect(outcome).toEqual({ ok: false, code: "ACCOUNT_INELIGIBLE" });
		},
	);

	it("rejects an ineligible destination account", async () => {
		const fakes = createFakes();
		fakes.seedAccount({ id: "acc-a" });
		fakes.seedAccount({ id: "acc-b", status: "deleted" });
		const outcome = await fakes.service.create(validInput);
		expect(outcome).toEqual({ ok: false, code: "ACCOUNT_INELIGIBLE" });
	});

	it("rejects accounts owned by another user", async () => {
		const fakes = createFakes();
		fakes.seedAccount({ id: "acc-a", userId: "user-2" });
		fakes.seedAccount({ id: "acc-b" });
		const outcome = await fakes.service.create(validInput);
		expect(outcome).toEqual({ ok: false, code: "ACCOUNT_INELIGIBLE" });
	});
});

describe("createTransferService.get and list", () => {
	it("resolves both account names on get", async () => {
		const fakes = createFakes();
		fakes.seedAccount({ id: "acc-a", name: "HDFC Bank" });
		fakes.seedAccount({ id: "acc-b", name: "Wallet" });
		fakes.seedTransfer({ id: UUID_V7 });
		const outcome = await fakes.service.get("user-1", UUID_V7);
		expect(outcome).toEqual({
			ok: true,
			value: expect.objectContaining({
				sourceAccountName: "HDFC Bank",
				destinationAccountName: "Wallet",
			}),
		});
	});

	it("hides other users' transfers behind NOT_FOUND", async () => {
		const fakes = createFakes();
		fakes.seedTransfer({ id: UUID_V7, userId: "user-2" });
		expect(await fakes.service.get("user-1", UUID_V7)).toEqual({
			ok: false,
			code: "NOT_FOUND",
		});
	});

	it("lists transfers with pagination fields", async () => {
		const fakes = createFakes();
		fakes.seedTransfer({ id: "t-1" });
		fakes.seedTransfer({ id: "t-2", status: "archived" });
		const list = (await fakes.service.list("user-1", {
			status: "active",
			page: 1,
			pageSize: 20,
		})) as TransferList;
		expect(list.total).toBe(1);
		expect(list.transfers).toHaveLength(1);
		expect(list.page).toBe(1);
	});
});

describe("createTransferService.update", () => {
	it("edits an active transfer's amount, date, and notes", async () => {
		const fakes = createFakes();
		fakes.seedAccount({ id: "acc-a" });
		fakes.seedAccount({ id: "acc-b" });
		fakes.seedTransfer({ id: UUID_V7 });
		const outcome = await fakes.service.update({
			userId: "user-1",
			transferId: UUID_V7,
			amountMinor: 4242,
			date: "2026-02-01",
			notes: "updated",
		});
		expect(outcome).toEqual({
			ok: true,
			value: expect.objectContaining({
				amountMinor: 4242,
				date: "2026-02-01",
				notes: "updated",
			}),
		});
	});

	it("rebalances when both sides move to other accounts", async () => {
		const fakes = createFakes();
		fakes.seedAccount({ id: "acc-a" });
		fakes.seedAccount({ id: "acc-b" });
		fakes.seedAccount({ id: "acc-c" });
		fakes.seedAccount({ id: "acc-d" });
		fakes.seedTransfer({ id: UUID_V7 });
		const outcome = await fakes.service.update({
			userId: "user-1",
			transferId: UUID_V7,
			sourceAccountId: "acc-c",
			destinationAccountId: "acc-d",
		});
		expect(outcome).toEqual({
			ok: true,
			value: expect.objectContaining({
				sourceAccountId: "acc-c",
				destinationAccountId: "acc-d",
			}),
		});
	});

	it("rejects a patch that merges the sides into one account", async () => {
		const fakes = createFakes();
		fakes.seedAccount({ id: "acc-a" });
		fakes.seedAccount({ id: "acc-b" });
		fakes.seedTransfer({ id: UUID_V7 });
		expect(
			await fakes.service.update({
				userId: "user-1",
				transferId: UUID_V7,
				destinationAccountId: "acc-a",
			}),
		).toEqual({ ok: false, code: "SAME_ACCOUNT_TRANSFER" });
		expect(
			await fakes.service.update({
				userId: "user-1",
				transferId: UUID_V7,
				sourceAccountId: "acc-b",
			}),
		).toEqual({ ok: false, code: "SAME_ACCOUNT_TRANSFER" });
	});

	it("rejects a changed side on an ineligible account", async () => {
		const fakes = createFakes();
		fakes.seedAccount({ id: "acc-a" });
		fakes.seedAccount({ id: "acc-b" });
		fakes.seedAccount({ id: "acc-c", status: "archived" });
		fakes.seedTransfer({ id: UUID_V7 });
		const outcome = await fakes.service.update({
			userId: "user-1",
			transferId: UUID_V7,
			sourceAccountId: "acc-c",
		});
		expect(outcome).toEqual({ ok: false, code: "ACCOUNT_INELIGIBLE" });
	});

	it("rejects editing archived and deleted transfers", async () => {
		const fakes = createFakes();
		fakes.seedTransfer({ id: UUID_V7, status: "archived" });
		expect(
			await fakes.service.update({
				userId: "user-1",
				transferId: UUID_V7,
				amountMinor: 500,
			}),
		).toEqual({ ok: false, code: "TRANSFER_TRANSITION_INVALID" });
		fakes.seedTransfer({ id: "t-del", status: "deleted" });
		expect(
			await fakes.service.update({
				userId: "user-1",
				transferId: "t-del",
				amountMinor: 500,
			}),
		).toEqual({ ok: false, code: "TRANSFER_TRANSITION_INVALID" });
	});

	it("hides other users' transfers behind NOT_FOUND", async () => {
		const fakes = createFakes();
		fakes.seedTransfer({ id: UUID_V7, userId: "user-2" });
		expect(
			await fakes.service.update({
				userId: "user-1",
				transferId: UUID_V7,
				amountMinor: 500,
			}),
		).toEqual({ ok: false, code: "NOT_FOUND" });
	});
});

describe("createTransferService lifecycle", () => {
	it.each([
		["active", "archived", true],
		["active", "deleted", true],
		["archived", "active", true],
		["deleted", "active", true],
		["archived", "deleted", false],
		["deleted", "archived", false],
		["active", "active", false],
	])("allows %s → %s: %s", async (from, target, allowed) => {
		const fakes = createFakes();
		// Restore targets resolve against the transfer's own references.
		fakes.seedAccount({ id: "acc-a" });
		fakes.seedAccount({ id: "acc-b" });
		fakes.seedTransfer({ id: UUID_V7, status: from });
		const outcome =
			target === "archived"
				? await fakes.service.archive("user-1", UUID_V7)
				: target === "deleted"
					? await fakes.service.remove("user-1", UUID_V7)
					: await fakes.service.restore({
							userId: "user-1",
							transferId: UUID_V7,
						});
		if (allowed) {
			expect(outcome).toEqual({
				ok: true,
				value: expect.objectContaining({ status: target }),
			});
		} else {
			expect(outcome).toEqual({
				ok: false,
				code: "TRANSFER_TRANSITION_INVALID",
			});
		}
	});

	it("restoring keeps the archived-target allowance", async () => {
		const fakes = createFakes();
		fakes.seedAccount({ id: "acc-a" });
		fakes.seedAccount({ id: "acc-b", status: "archived" });
		fakes.seedTransfer({ id: UUID_V7, status: "deleted" });
		const outcome = await fakes.service.restore({
			userId: "user-1",
			transferId: UUID_V7,
		});
		expect(outcome).toEqual({
			ok: true,
			value: expect.objectContaining({ status: "active" }),
		});
	});

	it("blocks restoring onto a deleted account", async () => {
		const fakes = createFakes();
		fakes.seedAccount({ id: "acc-a" });
		fakes.seedAccount({ id: "acc-b", status: "deleted" });
		fakes.seedTransfer({ id: UUID_V7, status: "deleted" });
		const outcome = await fakes.service.restore({
			userId: "user-1",
			transferId: UUID_V7,
		});
		expect(outcome).toEqual({
			ok: false,
			code: "RESTORE_CONFLICT",
			reason: "deleted_reference",
		});
		expect(fakes.transfers.rows.get(UUID_V7)?.status).toBe("deleted");
	});

	it("blocks restoring when a reassigned side targets a deleted account", async () => {
		const fakes = createFakes();
		fakes.seedAccount({ id: "acc-a" });
		fakes.seedAccount({ id: "acc-b" });
		fakes.seedAccount({ id: "acc-c", status: "deleted" });
		fakes.seedTransfer({ id: UUID_V7, status: "deleted" });
		const outcome = await fakes.service.restore({
			userId: "user-1",
			transferId: UUID_V7,
			destinationAccountId: "acc-c",
		});
		expect(outcome).toEqual({
			ok: false,
			code: "RESTORE_CONFLICT",
			reason: "deleted_reference",
		});
		expect(fakes.transfers.rows.get(UUID_V7)?.destinationAccountId).toBe(
			"acc-b",
		);
	});

	it("restores with reassignment onto the new pair", async () => {
		const fakes = createFakes();
		fakes.seedAccount({ id: "acc-a", status: "deleted" });
		fakes.seedAccount({ id: "acc-c" });
		fakes.seedAccount({ id: "acc-d" });
		fakes.seedTransfer({ id: UUID_V7, status: "deleted" });
		const outcome = await fakes.service.restore({
			userId: "user-1",
			transferId: UUID_V7,
			sourceAccountId: "acc-c",
			destinationAccountId: "acc-d",
		});
		expect(outcome).toEqual({
			ok: true,
			value: expect.objectContaining({
				status: "active",
				sourceAccountId: "acc-c",
				destinationAccountId: "acc-d",
			}),
		});
	});

	it("rejects a reassignment that collapses both sides into one account", async () => {
		const fakes = createFakes();
		fakes.seedAccount({ id: "acc-a", status: "deleted" });
		fakes.seedAccount({ id: "acc-b" });
		fakes.seedTransfer({ id: UUID_V7, status: "deleted" });
		const outcome = await fakes.service.restore({
			userId: "user-1",
			transferId: UUID_V7,
			sourceAccountId: "acc-b",
		});
		expect(outcome).toEqual({ ok: false, code: "SAME_ACCOUNT_TRANSFER" });
		expect(fakes.transfers.rows.get(UUID_V7)?.status).toBe("deleted");
	});

	it("permanently deletes only from the deleted status", async () => {
		const fakes = createFakes();
		fakes.seedTransfer({ id: "t-active" });
		expect(await fakes.service.destroy("user-1", "t-active")).toEqual({
			ok: false,
			code: "TRANSFER_TRANSITION_INVALID",
		});
		expect(fakes.transfers.rows.has("t-active")).toBe(true);

		fakes.seedTransfer({ id: "t-trash", status: "deleted" });
		const outcome = await fakes.service.destroy("user-1", "t-trash");
		expect(outcome).toEqual({
			ok: true,
			value: expect.objectContaining({ id: "t-trash", status: "deleted" }),
		});
		expect(fakes.transfers.rows.has("t-trash")).toBe(false);
		expect(await fakes.service.destroy("user-1", "t-trash")).toEqual({
			ok: false,
			code: "NOT_FOUND",
		});
	});
});
