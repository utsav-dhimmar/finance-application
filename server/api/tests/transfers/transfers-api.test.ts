/// <reference types="@cloudflare/vitest-plugin/types" />
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { hashPassword } from "@/lib/password";
import { ACCESS_COOKIE } from "@/lib/session";
import { uuidV7 } from "@/lib/uuid";
import { createAccountRepository } from "@/repositories/account-repository";
import { createTransferRepository } from "@/repositories/transfer-repository";
import { createUserRepository } from "@/repositories/user-repository";
import { isoNow } from "@/utils/datetime";
import { cookieHeader, fetchApp, seedUserAndLogin } from "../helpers";

const BASE = "https://test.local/api/transfers";
const ACCOUNTS_URL = "https://test.local/api/accounts";
const ACTIVITY_URL = "https://test.local/api/activity";
const CATEGORIES_URL = "https://test.local/api/categories";
const TRANSACTIONS_URL = "https://test.local/api/transactions";

function jsonResponseInit(
	method: string,
	body?: unknown,
	cookie?: string,
): RequestInit {
	return {
		method,
		headers: {
			...(body !== undefined ? { "content-type": "application/json" } : {}),
			...(cookie ? { cookie } : {}),
		},
		...(body !== undefined ? { body: JSON.stringify(body) } : {}),
	};
}

async function freshCookie(): Promise<string> {
	const session = await seedUserAndLogin();
	return cookieHeader({ [ACCESS_COOKIE]: session.access });
}

async function createAccount(
	cookie: string,
	body: Record<string, unknown>,
): Promise<{ id: string; currentBalanceMinor: number }> {
	const res = await fetchApp(
		ACCOUNTS_URL,
		jsonResponseInit("POST", body, cookie),
	);
	expect(res.status).toBe(201);
	return (await res.json()) as { id: string; currentBalanceMinor: number };
}

async function createCategory(cookie: string, name: string): Promise<string> {
	const res = await fetchApp(
		CATEGORIES_URL,
		jsonResponseInit("POST", { name, type: "expense" }, cookie),
	);
	expect(res.status).toBe(201);
	return ((await res.json()) as { id: string }).id;
}

async function postTransfer(
	cookie: string,
	body: Record<string, unknown>,
): Promise<Response> {
	return fetchApp(BASE, jsonResponseInit("POST", body, cookie));
}

async function balanceOf(cookie: string, accountId: string): Promise<number> {
	const res = await fetchApp(`${ACCOUNTS_URL}/${accountId}`, {
		headers: { cookie },
	});
	const parsed = (await res.json()) as { currentBalanceMinor: number };
	return parsed.currentBalanceMinor;
}

interface TransferPayload {
	[key: string]: unknown;
}

function validTransferBody(
	sourceAccountId: string,
	destinationAccountId: string,
	overrides: TransferPayload = {},
): TransferPayload {
	return {
		id: uuidV7(),
		amountMinor: 125050,
		date: "2026-01-15",
		sourceAccountId,
		destinationAccountId,
		...overrides,
	};
}

beforeEach(async () => {
	await env.finance_application.exec(
		"DELETE FROM transfers; DELETE FROM transactions; DELETE FROM categories; DELETE FROM accounts; DELETE FROM refresh_tokens; DELETE FROM users;",
	);
});

describe("authentication", () => {
	it("rejects transfer endpoints without a session", async () => {
		expect((await fetchApp(BASE, jsonResponseInit("POST", {}))).status).toBe(
			401,
		);
		expect((await fetchApp(BASE)).status).toBe(401);
		expect((await fetchApp(`${BASE}/some-id`)).status).toBe(401);
		expect(
			(await fetchApp(`${BASE}/some-id/archive`, jsonResponseInit("POST")))
				.status,
		).toBe(401);
		expect(
			(await fetchApp(`${BASE}/some-id`, jsonResponseInit("DELETE"))).status,
		).toBe(401);
		expect((await fetchApp(ACTIVITY_URL)).status).toBe(401);
	});
});

describe("create transfer", () => {
	it("creates with 201 and moves both balances exactly once", async () => {
		const cookie = await freshCookie();
		const source = await createAccount(cookie, {
			name: "HDFC Bank",
			type: "bank",
			openingBalanceMinor: 10000,
		});
		const destination = await createAccount(cookie, {
			name: "Wallet",
			type: "wallet",
			openingBalanceMinor: 0,
		});

		const res = await postTransfer(
			cookie,
			validTransferBody(source.id, destination.id),
		);
		expect(res.status).toBe(201);
		const created = (await res.json()) as {
			id: string;
			sourceAccountId: string;
			destinationAccountId: string;
			amountMinor: number;
			status: string;
		};
		expect(created).toMatchObject({
			sourceAccountId: source.id,
			destinationAccountId: destination.id,
			amountMinor: 125050,
			status: "active",
		});
		expect(await balanceOf(cookie, source.id)).toBe(10000 - 125050);
		expect(await balanceOf(cookie, destination.id)).toBe(125050);
	});

	it("replays the existing transfer with 200 and no second balance effect", async () => {
		const cookie = await freshCookie();
		const source = await createAccount(cookie, {
			name: "HDFC Bank",
			type: "bank",
			openingBalanceMinor: 10000,
		});
		const destination = await createAccount(cookie, {
			name: "Wallet",
			type: "wallet",
			openingBalanceMinor: 0,
		});
		const body = validTransferBody(source.id, destination.id);
		const first = await postTransfer(cookie, body);
		expect(first.status).toBe(201);

		const replay = await postTransfer(cookie, body);
		expect(replay.status).toBe(200);
		const replayed = (await replay.json()) as { id: string };
		const created = (await first.json()) as { id: string };
		expect(replayed.id).toBe(created.id);
		expect(await balanceOf(cookie, source.id)).toBe(10000 - 125050);
		expect(await balanceOf(cookie, destination.id)).toBe(125050);
	});

	it.each([
		["zero amount", { amountMinor: 0 }],
		["negative amount", { amountMinor: -100 }],
		["fractional paise", { amountMinor: 12.5 }],
		["invalid date", { date: "2026-02-30" }],
		["non-UUIDv7 id", { id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301" }],
		["missing source", { sourceAccountId: "" }],
	])("rejects a body with a %s with 400", async (_label, patch) => {
		const cookie = await freshCookie();
		const source = await createAccount(cookie, { name: "A", type: "bank" });
		const destination = await createAccount(cookie, {
			name: "B",
			type: "cash",
		});
		const res = await postTransfer(
			cookie,
			validTransferBody(source.id, destination.id, patch),
		);
		expect(res.status).toBe(400);
		await expect(res.json()).resolves.toMatchObject({
			error: { code: "VALIDATION_ERROR" },
		});
	});

	it("rejects identical source and destination with 409", async () => {
		const cookie = await freshCookie();
		const account = await createAccount(cookie, { name: "A", type: "bank" });
		const res = await postTransfer(
			cookie,
			validTransferBody(account.id, account.id),
		);
		expect(res.status).toBe(409);
		await expect(res.json()).resolves.toMatchObject({
			error: { code: "SAME_ACCOUNT_TRANSFER" },
		});
		expect(await balanceOf(cookie, account.id)).toBe(0);
	});

	it("rejects ineligible accounts with 409 and creates nothing", async () => {
		const cookie = await freshCookie();
		const source = await createAccount(cookie, { name: "A", type: "bank" });
		const archived = await createAccount(cookie, { name: "B", type: "cash" });
		const archiveRes = await fetchApp(
			`${ACCOUNTS_URL}/${archived.id}/archive`,
			jsonResponseInit("POST", undefined, cookie),
		);
		expect(archiveRes.status).toBe(200);

		const res = await postTransfer(
			cookie,
			validTransferBody(source.id, archived.id),
		);
		expect(res.status).toBe(409);
		await expect(res.json()).resolves.toMatchObject({
			error: { code: "ACCOUNT_INELIGIBLE" },
		});

		const list = await fetchApp(`${BASE}?status=archived`, {
			headers: { cookie },
		});
		expect(((await list.json()) as { total: number }).total).toBe(0);
	});

	it("allows transfers that overdraw either balance", async () => {
		const cookie = await freshCookie();
		const source = await createAccount(cookie, {
			name: "A",
			type: "bank",
			openingBalanceMinor: 100,
		});
		const destination = await createAccount(cookie, {
			name: "B",
			type: "cash",
		});
		const res = await postTransfer(
			cookie,
			validTransferBody(source.id, destination.id, { amountMinor: 500 }),
		);
		expect(res.status).toBe(201);
		expect(await balanceOf(cookie, source.id)).toBe(-400);
	});

	it("answers 409 ID_CONFLICT for a client id already owned by another user", async () => {
		const session = await seedUserAndLogin();
		const cookie = cookieHeader({ [ACCESS_COOKIE]: session.access });
		const source = await createAccount(cookie, { name: "A", type: "bank" });
		const destination = await createAccount(cookie, {
			name: "B",
			type: "cash",
		});

		// A second user, seeded directly (no session): two accounts of their own
		// and a transfer already holding the colliding id.
		const db = getDb(env);
		const otherUserId = uuidV7();
		const now = isoNow();
		await createUserRepository(db).insert({
			id: otherUserId,
			email: "transfer-conflict-peer@test.local",
			passwordHash: hashPassword("s3cret-pw"),
			createdAt: now,
			updatedAt: now,
		});
		const otherSourceId = uuidV7();
		const otherDestinationId = uuidV7();
		const accountRepo = createAccountRepository(db);
		for (const [accountId, name] of [
			[otherSourceId, "Peer Source"],
			[otherDestinationId, "Peer Destination"],
		] as const) {
			await accountRepo.insert({
				id: accountId,
				userId: otherUserId,
				name,
				type: "bank",
				openingBalanceMinor: 0,
				createdAt: now,
				updatedAt: now,
			});
		}
		const collidingId = uuidV7();
		await createTransferRepository(db).insert({
			id: collidingId,
			userId: otherUserId,
			sourceAccountId: otherSourceId,
			destinationAccountId: otherDestinationId,
			amountMinor: 999,
			date: "2026-01-10",
			notes: null,
			createdAt: now,
			updatedAt: now,
		});

		const res = await postTransfer(
			cookie,
			validTransferBody(source.id, destination.id, { id: collidingId }),
		);
		expect(res.status).toBe(409);
		const body: unknown = await res.json();
		expect(body).toMatchObject({ error: { code: "ID_CONFLICT" } });
		// The neutral conflict response must not leak the other user's row.
		const bodyText = JSON.stringify(body);
		expect(bodyText).not.toContain("Peer Source");
		expect(bodyText).not.toContain(otherSourceId);
	});
});

describe("lifecycle balance effects", () => {
	async function seedActiveTransfer(cookie: string) {
		const source = await createAccount(cookie, {
			name: "HDFC Bank",
			type: "bank",
			openingBalanceMinor: 0,
		});
		const destination = await createAccount(cookie, {
			name: "Wallet",
			type: "wallet",
			openingBalanceMinor: 0,
		});
		const res = await postTransfer(
			cookie,
			validTransferBody(source.id, destination.id, { amountMinor: 30000 }),
		);
		expect(res.status).toBe(201);
		const transfer = (await res.json()) as { id: string };
		return { source, destination, transfer };
	}

	it("archive preserves both effects, delete reverses, restore re-applies once", async () => {
		const cookie = await freshCookie();
		const { source, destination, transfer } = await seedActiveTransfer(cookie);
		expect(await balanceOf(cookie, source.id)).toBe(-30000);
		expect(await balanceOf(cookie, destination.id)).toBe(30000);

		const archive = await fetchApp(
			`${BASE}/${transfer.id}/archive`,
			jsonResponseInit("POST", undefined, cookie),
		);
		expect(archive.status).toBe(200);
		expect(await balanceOf(cookie, source.id)).toBe(-30000);
		expect(await balanceOf(cookie, destination.id)).toBe(30000);

		// Archiving an already-archived transfer is invalid.
		expect(
			(
				await fetchApp(
					`${BASE}/${transfer.id}/archive`,
					jsonResponseInit("POST", undefined, cookie),
				)
			).status,
		).toBe(409);

		// Deleting an archived transfer skips a state: invalid.
		expect(
			(
				await fetchApp(
					`${BASE}/${transfer.id}/delete`,
					jsonResponseInit("POST", undefined, cookie),
				)
			).status,
		).toBe(409);

		const restore = await fetchApp(
			`${BASE}/${transfer.id}/restore`,
			jsonResponseInit("POST", undefined, cookie),
		);
		expect(restore.status).toBe(200);
		expect(await balanceOf(cookie, source.id)).toBe(-30000);
		expect(await balanceOf(cookie, destination.id)).toBe(30000);

		const softDelete = await fetchApp(
			`${BASE}/${transfer.id}/delete`,
			jsonResponseInit("POST", undefined, cookie),
		);
		expect(softDelete.status).toBe(200);
		expect(await balanceOf(cookie, source.id)).toBe(0);
		expect(await balanceOf(cookie, destination.id)).toBe(0);

		const restoreAgain = await fetchApp(
			`${BASE}/${transfer.id}/restore`,
			jsonResponseInit("POST", undefined, cookie),
		);
		expect(restoreAgain.status).toBe(200);
		expect(await balanceOf(cookie, source.id)).toBe(-30000);
		expect(await balanceOf(cookie, destination.id)).toBe(30000);
	});

	it("edits rebalance the old pair away and the new pair in", async () => {
		const cookie = await freshCookie();
		const from = await createAccount(cookie, { name: "From", type: "bank" });
		const to = await createAccount(cookie, { name: "To", type: "wallet" });
		const newSource = await createAccount(cookie, {
			name: "New",
			type: "cash",
		});
		const newDestination = await createAccount(cookie, {
			name: "Dest",
			type: "bank",
		});
		const { transfer } = await seedActiveTransfer(cookie);

		const edit = await fetchApp(
			`${BASE}/${transfer.id}`,
			jsonResponseInit(
				"PATCH",
				{
					sourceAccountId: newSource.id,
					destinationAccountId: newDestination.id,
					amountMinor: 5000,
				},
				cookie,
			),
		);
		expect(edit.status).toBe(200);
		expect(await balanceOf(cookie, from.id)).toBe(0);
		expect(await balanceOf(cookie, to.id)).toBe(0);
		expect(await balanceOf(cookie, newSource.id)).toBe(-5000);
		expect(await balanceOf(cookie, newDestination.id)).toBe(5000);
	});

	it("rejects an edit that collapses both sides into one account", async () => {
		const cookie = await freshCookie();
		const { source, transfer } = await seedActiveTransfer(cookie);

		const edit = await fetchApp(
			`${BASE}/${transfer.id}`,
			jsonResponseInit("PATCH", { destinationAccountId: source.id }, cookie),
		);
		expect(edit.status).toBe(409);
		await expect(edit.json()).resolves.toMatchObject({
			error: { code: "SAME_ACCOUNT_TRANSFER" },
		});
	});

	it("blocks restore on a deleted account and succeeds with reassignment", async () => {
		const cookie = await freshCookie();
		const { source, destination, transfer } = await seedActiveTransfer(cookie);
		const replacement = await createAccount(cookie, {
			name: "Replacement",
			type: "cash",
		});

		const softDelete = await fetchApp(
			`${BASE}/${transfer.id}/delete`,
			jsonResponseInit("POST", undefined, cookie),
		);
		expect(softDelete.status).toBe(200);
		expect(await balanceOf(cookie, source.id)).toBe(0);
		expect(await balanceOf(cookie, destination.id)).toBe(0);

		// Deleting the destination makes plain restore impossible.
		const removeDestination = await fetchApp(
			`${ACCOUNTS_URL}/${destination.id}/delete`,
			jsonResponseInit("POST", undefined, cookie),
		);
		expect(removeDestination.status).toBe(200);

		const blocked = await fetchApp(
			`${BASE}/${transfer.id}/restore`,
			jsonResponseInit("POST", undefined, cookie),
		);
		expect(blocked.status).toBe(409);
		await expect(blocked.json()).resolves.toMatchObject({
			error: { code: "RESTORE_CONFLICT" },
		});

		const restored = await fetchApp(
			`${BASE}/${transfer.id}/restore`,
			jsonResponseInit(
				"POST",
				{ destinationAccountId: replacement.id },
				cookie,
			),
		);
		expect(restored.status).toBe(200);
		const restoredTransfer = (await restored.json()) as {
			destinationAccountId: string;
		};
		expect(restoredTransfer.destinationAccountId).toBe(replacement.id);
		expect(await balanceOf(cookie, source.id)).toBe(-30000);
		expect(await balanceOf(cookie, replacement.id)).toBe(30000);
	});

	it("rejects invalid transitions with 409 and keeps the status", async () => {
		const cookie = await freshCookie();
		const { transfer } = await seedActiveTransfer(cookie);

		// Soft-delete first, then try to archive the trashed transfer.
		const softDelete = await fetchApp(
			`${BASE}/${transfer.id}/delete`,
			jsonResponseInit("POST", undefined, cookie),
		);
		expect(softDelete.status).toBe(200);
		const archive = await fetchApp(
			`${BASE}/${transfer.id}/archive`,
			jsonResponseInit("POST", undefined, cookie),
		);
		expect(archive.status).toBe(409);
		await expect(archive.json()).resolves.toMatchObject({
			error: { code: "TRANSFER_TRANSITION_INVALID" },
		});

		// Restoring an active transfer is not a transition.
		const restore = await fetchApp(
			`${BASE}/${transfer.id}/restore`,
			jsonResponseInit("POST", undefined, cookie),
		);
		expect(restore.status).toBe(200);
		const restoreAgain = await fetchApp(
			`${BASE}/${transfer.id}/restore`,
			jsonResponseInit("POST", undefined, cookie),
		);
		expect(restoreAgain.status).toBe(409);
	});

	it("permanently deletes only from trash", async () => {
		const cookie = await freshCookie();
		const { transfer } = await seedActiveTransfer(cookie);

		// Active transfers cannot be permanently deleted.
		const premature = await fetchApp(
			`${BASE}/${transfer.id}`,
			jsonResponseInit("DELETE", undefined, cookie),
		);
		expect(premature.status).toBe(409);

		await fetchApp(
			`${BASE}/${transfer.id}/delete`,
			jsonResponseInit("POST", undefined, cookie),
		);
		const destroy = await fetchApp(
			`${BASE}/${transfer.id}`,
			jsonResponseInit("DELETE", undefined, cookie),
		);
		expect(destroy.status).toBe(200);
		const gone = await fetchApp(`${BASE}/${transfer.id}`, {
			headers: { cookie },
		});
		expect(gone.status).toBe(404);
	});
});

describe("list filters", () => {
	it("filters by status, date range, and account on either side", async () => {
		const cookie = await freshCookie();
		const bank = await createAccount(cookie, { name: "Bank", type: "bank" });
		const wallet = await createAccount(cookie, {
			name: "Wallet",
			type: "wallet",
		});
		const cash = await createAccount(cookie, { name: "Cash", type: "cash" });

		await postTransfer(
			cookie,
			validTransferBody(bank.id, wallet.id, { date: "2026-01-05" }),
		);
		await postTransfer(
			cookie,
			validTransferBody(wallet.id, cash.id, { date: "2026-02-10" }),
		);
		await postTransfer(
			cookie,
			validTransferBody(bank.id, cash.id, { date: "2026-03-15" }),
		);

		const all = await fetchApp(BASE, { headers: { cookie } });
		const allList = (await all.json()) as { total: number };
		expect(allList.total).toBe(3);

		const ranged = await fetchApp(`${BASE}?from=2026-01-01&to=2026-01-31`, {
			headers: { cookie },
		});
		expect(((await ranged.json()) as { total: number }).total).toBe(1);

		// The wallet is involved in two transfers (once per side).
		const byAccount = await fetchApp(`${BASE}?accountId=${wallet.id}`, {
			headers: { cookie },
		});
		expect(((await byAccount.json()) as { total: number }).total).toBe(2);

		const archived = await fetchApp(`${BASE}?status=archived`, {
			headers: { cookie },
		});
		expect(((await archived.json()) as { total: number }).total).toBe(0);
	});

	it("keeps users isolated from each other's transfers", async () => {
		const cookie = await freshCookie();
		const source = await createAccount(cookie, { name: "A", type: "bank" });
		const destination = await createAccount(cookie, {
			name: "B",
			type: "cash",
		});
		const created = await postTransfer(
			cookie,
			validTransferBody(source.id, destination.id),
		);
		const transfer = (await created.json()) as { id: string };

		const otherCookie = await freshCookie();
		expect(
			(await fetchApp(`${BASE}/${transfer.id}`, { headers: { otherCookie } }))
				.status,
		).toBe(401);
		expect(
			(
				await fetchApp(`${BASE}/${transfer.id}`, {
					headers: { cookie: otherCookie },
				})
			).status,
		).toBe(404);
		const otherList = await fetchApp(BASE, {
			headers: { cookie: otherCookie },
		});
		expect(((await otherList.json()) as { total: number }).total).toBe(0);
	});
});

describe("account activity endpoint", () => {
	it("shows the transfer in both accounts' histories with direction", async () => {
		const cookie = await freshCookie();
		const bank = await createAccount(cookie, { name: "Bank", type: "bank" });
		const wallet = await createAccount(cookie, {
			name: "Wallet",
			type: "wallet",
		});
		const created = await postTransfer(
			cookie,
			validTransferBody(bank.id, wallet.id, { amountMinor: 5000 }),
		);
		const transfer = (await created.json()) as { id: string };

		const bankHistory = await fetchApp(`${ACTIVITY_URL}?accountId=${bank.id}`, {
			headers: { cookie },
		});
		expect(bankHistory.status).toBe(200);
		const bankActivity = (await bankHistory.json()) as {
			activity: Array<{
				id: string;
				kind: string;
				direction: string | null;
				amountMinor: number;
				counterpartyAccountId: string | null;
			}>;
			total: number;
		};
		expect(bankActivity.total).toBe(1);
		expect(bankActivity.activity[0]).toMatchObject({
			id: transfer.id,
			kind: "transfer",
			direction: "out",
			amountMinor: -5000,
			counterpartyAccountId: wallet.id,
		});

		const walletHistory = await fetchApp(
			`${ACTIVITY_URL}?accountId=${wallet.id}`,
			{
				headers: { cookie },
			},
		);
		const walletActivity = (await walletHistory.json()) as {
			activity: Array<{ direction: string | null; amountMinor: number }>;
		};
		expect(walletActivity.activity[0]).toMatchObject({
			direction: "in",
			amountMinor: 5000,
		});
	});

	it("interleaves with transactions and excludes transfers from category filters", async () => {
		const cookie = await freshCookie();
		const bank = await createAccount(cookie, { name: "Bank", type: "bank" });
		const wallet = await createAccount(cookie, {
			name: "Wallet",
			type: "wallet",
		});
		const category = await createCategory(cookie, "Groceries");
		await postTransfer(
			cookie,
			validTransferBody(bank.id, wallet.id, { amountMinor: 5000 }),
		);
		const txn = await fetchApp(
			TRANSACTIONS_URL,
			jsonResponseInit(
				"POST",
				{
					id: uuidV7(),
					type: "expense",
					amountMinor: 900,
					date: "2026-01-10",
					accountId: bank.id,
					categoryId: category,
				},
				cookie,
			),
		);
		expect(txn.status).toBe(201);

		const everything = await fetchApp(`${ACTIVITY_URL}?accountId=${bank.id}`, {
			headers: { cookie },
		});
		const everythingList = (await everything.json()) as {
			activity: Array<{ kind: string }>;
			total: number;
		};
		expect(everythingList.total).toBe(2);

		const byCategory = await fetchApp(
			`${ACTIVITY_URL}?accountId=${bank.id}&categoryId=${category}`,
			{ headers: { cookie } },
		);
		const byCategoryList = (await byCategory.json()) as {
			activity: Array<{ kind: string }>;
			total: number;
		};
		expect(byCategoryList.total).toBe(1);
		expect(byCategoryList.activity[0]?.kind).toBe("transaction");
	});

	it("returns 404 for an unknown or foreign account", async () => {
		const cookie = await freshCookie();
		const missing = await fetchApp(`${ACTIVITY_URL}?accountId=${uuidV7()}`, {
			headers: { cookie },
		});
		expect(missing.status).toBe(404);
	});
});
