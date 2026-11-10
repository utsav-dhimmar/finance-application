import { ApiError } from "@finance-application/api-client";
import type { AccountResponse } from "@finance-application/schemas";
import { describe, expect, it } from "vitest";

import {
	ACCOUNTS_QUERY_KEY,
	accountsQueryKey,
	accountsQueryOptions,
	archiveExistingAccount,
	createNewAccount,
	deleteExistingAccount,
	getAccountsErrorMessage,
	restoreTrashedAccount,
} from "@/services/accounts-service";
import { jsonResponse } from "@/session/fetch-mock";
import { makeRegisteredMachine } from "./helpers";

const account: AccountResponse = {
	id: "acc-1",
	name: "HDFC Bank",
	type: "bank",
	openingBalanceMinor: 100000,
	currentBalanceMinor: 125050,
	status: "active",
	archivedAt: null,
	deletedAt: null,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("accounts service", () => {
	it("exposes the shared accounts query key and per-status slices", () => {
		expect(ACCOUNTS_QUERY_KEY).toEqual(["accounts"]);
		expect(accountsQueryKey("active")).toEqual(["accounts", "active"]);
		expect(accountsQueryKey("deleted")).toEqual(["accounts", "deleted"]);
	});

	it("query options carry web-parity staleness and the status in the path", async () => {
		const { fetchMock } = makeRegisteredMachine({
			"GET /api/accounts": (init?: RequestInit) => {
				const headers = init?.headers as Record<string, string> | undefined;
				expect(headers?.cookie).toContain("access-value-123");
				return jsonResponse(200, {
					accounts: [account],
					combinedBalanceMinor: 125050,
				});
			},
		});
		const options = accountsQueryOptions("active");
		expect(options.staleTime).toBe(30_000);
		const result = await options.queryFn();
		expect(result.accounts).toHaveLength(1);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("create, archive, delete, and restore hit the documented endpoints", async () => {
		const { fetchMock } = makeRegisteredMachine({
			"POST /api/accounts": () => jsonResponse(201, account),
			"POST /api/accounts/acc-1/archive": () => jsonResponse(200, account),
			"POST /api/accounts/acc-1/delete": () => jsonResponse(200, account),
			"POST /api/accounts/acc-1/restore": () => jsonResponse(200, account),
		});
		await createNewAccount({
			name: "HDFC Bank",
			type: "bank",
			openingBalanceMinor: 0,
		});
		await archiveExistingAccount("acc-1");
		await deleteExistingAccount("acc-1");
		await restoreTrashedAccount("acc-1", { newName: "HDFC" });
		const calls = fetchMock.mock.calls as unknown as Array<
			[string, RequestInit]
		>;
		expect(JSON.parse(calls[0]?.[1]?.body as string)).toEqual({
			name: "HDFC Bank",
			type: "bank",
			openingBalanceMinor: 0,
		});
		expect(calls[1]?.[1]?.method).toBe("POST");
		expect(calls[3]?.[1]?.body).toBe(JSON.stringify({ newName: "HDFC" }));
	});

	it("maps account error codes to the web's user copy", () => {
		const fallback = "Could not save the account. Is the API running?";
		expect(
			getAccountsErrorMessage(
				new ApiError(409, "ACCOUNT_NAME_TAKEN", "name taken", []),
				fallback,
			),
		).toBe("An account with this name already exists. Try a different name.");
		expect(
			getAccountsErrorMessage(
				new ApiError(409, "ACCOUNT_FIELD_LOCKED", "locked", []),
				fallback,
			),
		).toBe(
			"This account has transactions, so its opening balance and type can no longer be changed.",
		);
		expect(
			getAccountsErrorMessage(
				new ApiError(500, "SOMETHING_ELSE", "boom", []),
				fallback,
			),
		).toBe("boom");
		expect(getAccountsErrorMessage(new Error("nope"), fallback)).toBe(fallback);
	});
});
