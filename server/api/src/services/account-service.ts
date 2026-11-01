import type { Account } from "@/db/schema";
import type { ErrorCode } from "@/lib/error";
import { uuidV7 } from "@/lib/uuid";
import type { AccountStatus, AccountType } from "@finance-application/schemas";
import type { AccountRepository } from "@/repositories/account-repository";
import { normalizeAccountName } from "@/repositories/account-repository";
import { isoNow } from "@/utils/datetime";
import {
	accountStatusSchema,
	accountTypeSchema,
} from "@finance-application/schemas";

export interface AccountView {
	id: string;
	name: string;
	type: AccountType;
	openingBalanceMinor: number;
	currentBalanceMinor: number;
	status: AccountStatus;
	archivedAt: string | null;
	deletedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

// SEAM: the single balance computation point. `postedTransactionsSumMinor` is
// the sum of the account's balance-affecting posted transactions; no such
// records exist yet, so callers currently pass 0. Every balance in the app
// must come through this function so the formula has exactly one definition,
// and the transactions epic extends it without changing its callers.
export function computeCurrentBalance(
	openingBalanceMinor: number,
	postedTransactionsSumMinor: number,
): number {
	return openingBalanceMinor + postedTransactionsSumMinor;
}

function toView(account: Account): AccountView {
	// The DB CHECK constraints guarantee the enum values; parsing here keeps
	// the view types honest without an unsafe cast.
	return {
		...account,
		type: accountTypeSchema.parse(account.type),
		status: accountStatusSchema.parse(account.status),
		currentBalanceMinor: computeCurrentBalance(account.openingBalanceMinor, 0),
	};
}

// Each method fails with exactly one code so controllers can map it to a
// literal response status.
export type AccountOutcome<T, E extends ErrorCode> =
	| { ok: true; value: T }
	| { ok: false; code: E };

export type CreateAccountOutcome = AccountOutcome<
	AccountView,
	"ACCOUNT_NAME_TAKEN"
>;
export type GetAccountOutcome = AccountOutcome<AccountView, "NOT_FOUND">;
export type UpdateAccountOutcome = AccountOutcome<
	AccountView,
	| "NOT_FOUND"
	| "ACCOUNT_NAME_TAKEN"
	| "ACCOUNT_FIELD_LOCKED"
	| "ACCOUNT_TRANSITION_INVALID"
>;
export type TransitionAccountOutcome = AccountOutcome<
	AccountView,
	"NOT_FOUND" | "ACCOUNT_TRANSITION_INVALID" | "ACCOUNT_NAME_TAKEN"
>;

export interface AccountList {
	accounts: AccountView[];
	combinedBalanceMinor: number;
}

export interface CreateAccountInput {
	userId: string;
	name: string;
	type: string;
	openingBalanceMinor: number;
}

export interface UpdateAccountInput {
	userId: string;
	accountId: string;
	name?: string;
	type?: string;
	openingBalanceMinor?: number;
}

export interface RestoreAccountInput {
	userId: string;
	accountId: string;
	newName?: string;
}

// SEAM: the opening-balance/type lock depends on whether any posted
// transaction references the account. No transactions table exists yet, so
// the condition is vacuously false today; the transactions epic replaces this
// wiring (no transaction may be created while bypassing the lock check).
async function hasPostedTransactions(_accountId: string): Promise<boolean> {
	return false;
}

// Lifecycle state machine: exactly these transitions are valid; anything else
// is a conflict. Archived and deleted accounts are not editable.
const VALID_TRANSITIONS: Record<AccountStatus, readonly AccountStatus[]> = {
	active: ["archived", "deleted"],
	archived: ["active"],
	deleted: ["active"],
};

export interface AccountServiceDeps {
	accounts: AccountRepository;
	hasPostedTransactions?: (accountId: string) => Promise<boolean>;
}

export function createAccountService(deps: AccountServiceDeps) {
	const { accounts } = deps;
	const postedCheck = deps.hasPostedTransactions ?? hasPostedTransactions;

	async function requireOwnedAccount(
		userId: string,
		accountId: string,
	): Promise<Account | undefined> {
		const account = await accounts.findById(accountId);
		if (!account || account.userId !== userId) {
			return undefined;
		}
		return account;
	}

	async function findNameConflict(userId: string, name: string) {
		return accounts.findNonDeletedByNameNormalized(
			userId,
			normalizeAccountName(name),
		);
	}

	async function transitionTo(
		userId: string,
		accountId: string,
		target: AccountStatus,
		options?: { newName?: string },
	): Promise<TransitionAccountOutcome> {
		const account = await requireOwnedAccount(userId, accountId);
		if (!account) {
			return { ok: false, code: "NOT_FOUND" };
		}
		const allowed = VALID_TRANSITIONS[account.status as AccountStatus];
		if (!allowed?.includes(target)) {
			return { ok: false, code: "ACCOUNT_TRANSITION_INVALID" };
		}
		const nowIso = isoNow();
		const timestamps =
			target === "archived"
				? { archivedAt: nowIso, deletedAt: null }
				: target === "deleted"
					? { archivedAt: null, deletedAt: nowIso }
					: { archivedAt: null, deletedAt: null };
		if (target === "active") {
			// A name taken while the account was archived or deleted blocks the
			// restore; the caller can retry with an explicit `newName`, applied
			// atomically with the reactivation.
			const requestedName = options?.newName ?? account.name;
			const conflict = await findNameConflict(userId, requestedName);
			if (conflict && conflict.id !== accountId) {
				return { ok: false, code: "ACCOUNT_NAME_TAKEN" };
			}
			if (options?.newName !== undefined) {
				const renamed = await accounts.updateStatusWithRename(
					accountId,
					target,
					options.newName,
					timestamps,
					nowIso,
				);
				if (!renamed) {
					return { ok: false, code: "NOT_FOUND" };
				}
				return { ok: true, value: toView(renamed) };
			}
		}
		const updated = await accounts.updateStatus(
			accountId,
			target,
			timestamps,
			nowIso,
		);
		if (!updated) {
			return { ok: false, code: "NOT_FOUND" };
		}
		return { ok: true, value: toView(updated) };
	}

	return {
		// Creation never writes any income/expense record: the opening balance
		// lives on the account row itself.
		async create(input: CreateAccountInput): Promise<CreateAccountOutcome> {
			const conflict = await findNameConflict(input.userId, input.name);
			if (conflict) {
				return { ok: false, code: "ACCOUNT_NAME_TAKEN" };
			}
			const nowIso = isoNow();
			const account = await accounts.insert({
				id: uuidV7(),
				userId: input.userId,
				name: input.name,
				type: input.type,
				openingBalanceMinor: input.openingBalanceMinor,
				createdAt: nowIso,
				updatedAt: nowIso,
			});
			return { ok: true, value: toView(account) };
		},

		// `combinedBalanceMinor` always sums the current balances of the user's
		// active accounts, regardless of which status slice was requested.
		async list(userId: string, status: AccountStatus): Promise<AccountList> {
			const [filtered, active] = await Promise.all([
				accounts.listByStatus(userId, status),
				accounts.listByStatus(userId, "active"),
			]);
			return {
				accounts: filtered.map(toView),
				combinedBalanceMinor: active.reduce(
					(sum, account) =>
						sum + computeCurrentBalance(account.openingBalanceMinor, 0),
					0,
				),
			};
		},

		async get(userId: string, accountId: string): Promise<GetAccountOutcome> {
			const account = await requireOwnedAccount(userId, accountId);
			if (!account) {
				return { ok: false, code: "NOT_FOUND" };
			}
			return { ok: true, value: toView(account) };
		},

		async update(input: UpdateAccountInput): Promise<UpdateAccountOutcome> {
			const account = await requireOwnedAccount(input.userId, input.accountId);
			if (!account) {
				return { ok: false, code: "NOT_FOUND" };
			}
			if (account.status !== "active") {
				return { ok: false, code: "ACCOUNT_TRANSITION_INVALID" };
			}
			const touchesLockedField =
				input.type !== undefined || input.openingBalanceMinor !== undefined;
			if (touchesLockedField && (await postedCheck(input.accountId))) {
				return { ok: false, code: "ACCOUNT_FIELD_LOCKED" };
			}
			if (input.name !== undefined) {
				const conflict = await findNameConflict(input.userId, input.name);
				if (conflict && conflict.id !== input.accountId) {
					return { ok: false, code: "ACCOUNT_NAME_TAKEN" };
				}
			}
			const updated = await accounts.updateDetails(
				input.accountId,
				{
					name: input.name,
					type: input.type,
					openingBalanceMinor: input.openingBalanceMinor,
				},
				isoNow(),
			);
			if (!updated) {
				return { ok: false, code: "NOT_FOUND" };
			}
			return { ok: true, value: toView(updated) };
		},

		async archive(
			userId: string,
			accountId: string,
		): Promise<TransitionAccountOutcome> {
			return transitionTo(userId, accountId, "archived");
		},

		async remove(
			userId: string,
			accountId: string,
		): Promise<TransitionAccountOutcome> {
			return transitionTo(userId, accountId, "deleted");
		},

		// Restoring keeps all account data; when the name was taken while the
		// account was archived/deleted, the conflict is surfaced and the caller
		// can retry with an explicit `newName` applied atomically on restore.
		async restore(
			input: RestoreAccountInput,
		): Promise<TransitionAccountOutcome> {
			return transitionTo(input.userId, input.accountId, "active", {
				newName: input.newName,
			});
		},

		transition: transitionTo,
	};
}

export type AccountService = ReturnType<typeof createAccountService>;
