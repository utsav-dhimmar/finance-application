import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountResponse } from "@finance-application/schemas";
import {
	archiveAccount,
	createAccount,
	deleteAccount,
	getAccount,
	listAccounts,
	restoreAccount,
	updateAccount,
} from "../src/accounts";

const account: AccountResponse = {
	id: "uuid-1",
	name: "HDFC Bank",
	type: "bank",
	openingBalanceMinor: 125050,
	currentBalanceMinor: 125050,
	status: "active",
	archivedAt: null,
	deletedAt: null,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn(
			async () =>
				new Response(JSON.stringify(account), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
		),
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("account client functions", () => {
	it("createAccount posts the body to /api/accounts", async () => {
		const body = {
			name: "HDFC Bank",
			type: "bank" as const,
			openingBalanceMinor: 125050,
		};
		await expect(createAccount(body)).resolves.toEqual(account);
		expect(vi.mocked(fetch)).toHaveBeenCalledWith(
			"/api/accounts",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify(body),
			}),
		);
	});

	it("listAccounts defaults to the active status", async () => {
		await listAccounts();
		const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
		expect(url).toBe("/api/accounts?status=active");
	});

	it("listAccounts passes the requested status", async () => {
		await listAccounts("archived");
		const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
		expect(url).toBe("/api/accounts?status=archived");
	});

	it("getAccount fetches by id", async () => {
		await getAccount("uuid-1");
		const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
		expect(url).toBe("/api/accounts/uuid-1");
	});

	it("updateAccount patches by id", async () => {
		const body = { name: "Renamed" };
		await updateAccount("uuid-1", body);
		expect(vi.mocked(fetch)).toHaveBeenCalledWith(
			"/api/accounts/uuid-1",
			expect.objectContaining({
				method: "PATCH",
				body: JSON.stringify(body),
			}),
		);
	});

	it.each([
		["archive", archiveAccount, "/api/accounts/uuid-1/archive"],
		["delete", deleteAccount, "/api/accounts/uuid-1/delete"],
		["restore", restoreAccount, "/api/accounts/uuid-1/restore"],
	])("%s posts to its lifecycle endpoint", async (_label, action, url) => {
		await action("uuid-1");
		expect(vi.mocked(fetch)).toHaveBeenCalledWith(
			url,
			expect.objectContaining({ method: "POST" }),
		);
	});

	it("restoreAccount sends an optional new name", async () => {
		await restoreAccount("uuid-1", { newName: "Restored" });
		expect(vi.mocked(fetch)).toHaveBeenCalledWith(
			"/api/accounts/uuid-1/restore",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ newName: "Restored" }),
			}),
		);
	});
});
