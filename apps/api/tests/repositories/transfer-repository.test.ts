/// <reference types="@cloudflare/vitest-plugin/types" />
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import type { Transfer } from "@/db/schema";
import { uuidV7 } from "@/lib/uuid";
import { createAccountRepository } from "@/repositories/account-repository";
import {
	createTransferRepository,
	type NewTransferRow,
} from "@/repositories/transfer-repository";
import { createUserRepository } from "@/repositories/user-repository";

const db = getDb(env);
const repo = createTransferRepository(db);
const users = createUserRepository(db);
const accounts = createAccountRepository(db);

const nowIso = new Date().toISOString();

let userId: string;
let bankAccountId: string;
let walletAccountId: string;
let thirdAccountId: string;

let sequence = 0;

async function insertTransfer(overrides: {
	sourceAccountId?: string;
	destinationAccountId?: string;
	amountMinor?: number;
	date?: string;
	status?: string;
	notes?: string | null;
}): Promise<Transfer> {
	sequence += 1;
	const row: NewTransferRow = {
		id: uuidV7(),
		userId,
		sourceAccountId: overrides.sourceAccountId ?? bankAccountId,
		destinationAccountId: overrides.destinationAccountId ?? walletAccountId,
		amountMinor: overrides.amountMinor ?? 1000,
		date: overrides.date ?? "2026-01-15",
		notes: overrides.notes ?? null,
		createdAt: `2026-01-${String(10 + (sequence % 10)).padStart(2, "0")}T00:00:00.000Z`,
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
	return inserted;
}

beforeEach(async () => {
	await env.finance_application.exec(
		"DELETE FROM transfers; DELETE FROM transactions; DELETE FROM categories; DELETE FROM accounts; DELETE FROM refresh_tokens; DELETE FROM users;",
	);
	userId = (
		await users.insert({
			id: uuidV7(),
			email: "transfer-repo@example.com",
			passwordHash: "hash",
			createdAt: nowIso,
			updatedAt: nowIso,
		})
	).id;
	bankAccountId = (
		await accounts.insert({
			id: uuidV7(),
			userId,
			name: "HDFC Bank",
			type: "bank",
			openingBalanceMinor: 0,
			createdAt: nowIso,
			updatedAt: nowIso,
		})
	).id;
	walletAccountId = (
		await accounts.insert({
			id: uuidV7(),
			userId,
			name: "Wallet",
			type: "wallet",
			openingBalanceMinor: 0,
			createdAt: nowIso,
			updatedAt: nowIso,
		})
	).id;
	thirdAccountId = (
		await accounts.insert({
			id: uuidV7(),
			userId,
			name: "Cash",
			type: "cash",
			openingBalanceMinor: 0,
			createdAt: nowIso,
			updatedAt: nowIso,
		})
	).id;
});

describe("TransferRepository.signed sums", () => {
	it("subtracts on the source, adds on the destination", async () => {
		await insertTransfer({ amountMinor: 5000 });
		await insertTransfer({
			sourceAccountId: walletAccountId,
			destinationAccountId: bankAccountId,
			amountMinor: 1200,
		});

		expect(await repo.sumNonDeletedEffects(bankAccountId)).toBe(-5000 + 1200);
		expect(await repo.sumNonDeletedEffects(walletAccountId)).toBe(5000 - 1200);
		expect(await repo.sumNonDeletedEffects(thirdAccountId)).toBe(0);

		const byAccount = await repo.sumNonDeletedEffectsByAccount(userId);
		expect(byAccount.get(bankAccountId)).toBe(-3800);
		expect(byAccount.get(walletAccountId)).toBe(3800);
		expect(byAccount.get(thirdAccountId) ?? 0).toBe(0);
	});

	it("includes archived effects and excludes deleted ones", async () => {
		await insertTransfer({ amountMinor: 3000 });
		await insertTransfer({ amountMinor: 700, status: "archived" });
		await insertTransfer({ amountMinor: 999, status: "deleted" });

		expect(await repo.sumNonDeletedEffects(bankAccountId)).toBe(-3700);
		expect(await repo.sumNonDeletedEffects(walletAccountId)).toBe(3700);

		const byAccount = await repo.sumNonDeletedEffectsByAccount(userId);
		expect(byAccount.get(bankAccountId)).toBe(-3700);
		expect(byAccount.get(walletAccountId)).toBe(3700);
	});

	it("scopes sums to the owning user", async () => {
		await insertTransfer({ amountMinor: 4000 });
		const otherUserId = (
			await users.insert({
				id: uuidV7(),
				email: "transfer-repo-other@example.com",
				passwordHash: "hash",
				createdAt: nowIso,
				updatedAt: nowIso,
			})
		).id;
		const byOther = await repo.sumNonDeletedEffectsByAccount(otherUserId);
		expect(byOther.size).toBe(0);
	});
});

describe("TransferRepository.findByIdWithRefs", () => {
	it("resolves both account names regardless of account lifecycle", async () => {
		await insertTransfer({ notes: "cash withdrawal" });
		await accounts.updateStatus(
			walletAccountId,
			"archived",
			{ archivedAt: nowIso, deletedAt: null },
			nowIso,
		);
		const all = await repo.list(userId, {
			status: "active",
			page: 1,
			pageSize: 10,
		});
		expect(all.rows[0]?.sourceAccountName).toBe("HDFC Bank");
		expect(all.rows[0]?.destinationAccountName).toBe("Wallet");
		expect(all.rows[0]?.transfer.notes).toBe("cash withdrawal");
	});
});

describe("TransferRepository.list filters and pagination", () => {
	beforeEach(async () => {
		await insertTransfer({
			amountMinor: 1000,
			date: "2026-01-05",
			notes: "atm run",
		});
		await insertTransfer({
			amountMinor: 50000,
			date: "2026-01-20",
			sourceAccountId: walletAccountId,
			destinationAccountId: bankAccountId,
		});
		await insertTransfer({
			amountMinor: 2000,
			date: "2026-02-10",
			sourceAccountId: bankAccountId,
			destinationAccountId: thirdAccountId,
		});
		await insertTransfer({
			amountMinor: 3000,
			date: "2026-02-15",
			status: "archived",
		});
		await insertTransfer({
			amountMinor: 4000,
			date: "2026-02-20",
			status: "deleted",
		});
	});

	it("paginates with total over the whole filtered set", async () => {
		const page1 = await repo.list(userId, {
			status: "active",
			page: 1,
			pageSize: 2,
		});
		expect(page1.total).toBe(3);
		expect(page1.rows).toHaveLength(2);
		// date DESC ordering: newest first
		expect(page1.rows[0]?.transfer.date).toBe("2026-02-10");

		const page2 = await repo.list(userId, {
			status: "active",
			page: 2,
			pageSize: 2,
		});
		expect(page2.rows).toHaveLength(1);
		expect(page2.rows[0]?.transfer.date).toBe("2026-01-05");
	});

	it("filters by date range inclusively", async () => {
		const result = await repo.list(userId, {
			status: "active",
			from: "2026-01-05",
			to: "2026-01-20",
			page: 1,
			pageSize: 10,
		});
		expect(result.total).toBe(2);
	});

	it("matches the account filter on either side", async () => {
		// The bank is the source of two active transfers and the destination of
		// one, so all three match.
		const asSource = await repo.list(userId, {
			status: "active",
			accountId: bankAccountId,
			page: 1,
			pageSize: 10,
		});
		expect(asSource.total).toBe(3);

		const asDestination = await repo.list(userId, {
			status: "active",
			accountId: thirdAccountId,
			page: 1,
			pageSize: 10,
		});
		expect(asDestination.total).toBe(1);
		expect(asDestination.rows[0]?.transfer.destinationAccountId).toBe(
			thirdAccountId,
		);
	});

	it("combines date range and account filters", async () => {
		const result = await repo.list(userId, {
			status: "active",
			accountId: bankAccountId,
			from: "2026-02-01",
			page: 1,
			pageSize: 10,
		});
		expect(result.total).toBe(1);
		expect(result.rows[0]?.transfer.date).toBe("2026-02-10");
	});

	it("searches notes and both account names case-insensitively", async () => {
		const byNotes = await repo.list(userId, {
			status: "active",
			q: "ATM",
			page: 1,
			pageSize: 10,
		});
		expect(byNotes.total).toBe(1);
		expect(byNotes.rows[0]?.transfer.notes).toBe("atm run");

		const bySourceName = await repo.list(userId, {
			status: "active",
			q: "hdfc",
			page: 1,
			pageSize: 10,
		});
		// HDFC is a source or destination of every active transfer.
		expect(bySourceName.total).toBe(3);

		const byDestinationName = await repo.list(userId, {
			status: "active",
			q: "cash",
			page: 1,
			pageSize: 10,
		});
		expect(byDestinationName.total).toBe(1);
		expect(byDestinationName.rows[0]?.transfer.destinationAccountId).toBe(
			thirdAccountId,
		);
	});

	it("lists archived and deleted slices by status", async () => {
		const archived = await repo.list(userId, {
			status: "archived",
			page: 1,
			pageSize: 10,
		});
		expect(archived.total).toBe(1);

		const deleted = await repo.list(userId, {
			status: "deleted",
			page: 1,
			pageSize: 10,
		});
		expect(deleted.total).toBe(1);
	});
});

describe("TransferRepository.update and lifecycle", () => {
	it("updates details and keeps other fields", async () => {
		const inserted = await insertTransfer({ notes: "before" });
		const updated = await repo.updateDetails(
			inserted.id,
			{ amountMinor: 4242, notes: "after" },
			nowIso,
		);
		expect(updated?.amountMinor).toBe(4242);
		expect(updated?.notes).toBe("after");
		expect(updated?.sourceAccountId).toBe(bankAccountId);
		expect(updated?.destinationAccountId).toBe(walletAccountId);
	});

	it("reassigns sides through updateDetails", async () => {
		const inserted = await insertTransfer({});
		const updated = await repo.updateDetails(
			inserted.id,
			{
				sourceAccountId: walletAccountId,
				destinationAccountId: thirdAccountId,
			},
			nowIso,
		);
		expect(updated?.sourceAccountId).toBe(walletAccountId);
		expect(updated?.destinationAccountId).toBe(thirdAccountId);
	});

	it("updateStatus sets lifecycle timestamps", async () => {
		const inserted = await insertTransfer({});
		const archived = await repo.updateStatus(
			inserted.id,
			"archived",
			{ archivedAt: nowIso, deletedAt: null },
			nowIso,
		);
		expect(archived?.status).toBe("archived");
		expect(archived?.archivedAt).toBe(nowIso);

		const restored = await repo.updateStatus(
			inserted.id,
			"active",
			{ archivedAt: null, deletedAt: null },
			nowIso,
		);
		expect(restored?.status).toBe("active");
		expect(restored?.archivedAt).toBeNull();
	});

	it("physically deletes only the targeted row", async () => {
		const inserted = await insertTransfer({ status: "deleted" });
		const other = await insertTransfer({});
		expect(await repo.deleteIfDeleted(inserted.id)).toBe(true);
		expect(await repo.findById(inserted.id)).toBeUndefined();
		expect(await repo.findById(other.id)).toBeDefined();
		// The status guard: an active row is never physically removed, and a
		// removed row cannot be removed twice.
		expect(await repo.deleteIfDeleted(other.id)).toBe(false);
		expect(await repo.deleteIfDeleted(inserted.id)).toBe(false);
	});
});
