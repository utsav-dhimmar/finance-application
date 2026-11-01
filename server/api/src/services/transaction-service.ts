import type { Transaction } from "@/db/schema";
import type { ErrorCode } from "@/lib/error";
import type {
	TransactionStatus,
	TransactionType,
} from "@finance-application/schemas";
import type { AccountRepository } from "@/repositories/account-repository";
import type { CategoryRepository } from "@/repositories/category-repository";
import type { TransactionRepository } from "@/repositories/transaction-repository";
import { isoNow } from "@/utils/datetime";
import {
	transactionStatusSchema,
	transactionTypeSchema,
} from "@finance-application/schemas";

export interface TransactionView {
	id: string;
	type: TransactionType;
	amountMinor: number;
	date: string;
	accountId: string;
	accountName: string | null;
	categoryId: string;
	categoryName: string | null;
	notes: string | null;
	status: TransactionStatus;
	archivedAt: string | null;
	deletedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

function toView(
	row: Transaction & { accountName?: string | null; categoryName?: string | null },
): TransactionView {
	// The DB CHECK constraints guarantee the enum values; parsing here keeps
	// the view types honest without an unsafe cast.
	return {
		id: row.id,
		type: transactionTypeSchema.parse(row.type),
		amountMinor: row.amountMinor,
		date: row.date,
		accountId: row.accountId,
		accountName: row.accountName ?? null,
		categoryId: row.categoryId,
		categoryName: row.categoryName ?? null,
		notes: row.notes,
		status: transactionStatusSchema.parse(row.status),
		archivedAt: row.archivedAt,
		deletedAt: row.deletedAt,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

// Each method fails with exactly one code so controllers can map it to a
// literal response status.
export type TransactionOutcome<T, E extends ErrorCode> =
	| { ok: true; value: T }
	| { ok: false; code: E };

// Creation carries a `replayed` flag on success so the route can answer
// 201 (fresh) or 200 (idempotent replay) without re-inspecting the row.
export type CreateTransactionOutcome =
	| { ok: true; value: TransactionView; replayed: boolean }
	| { ok: false; code: "ACCOUNT_INELIGIBLE" | "CATEGORY_INELIGIBLE" };
export type GetTransactionOutcome =
	TransactionOutcome<TransactionView, "NOT_FOUND">;
export type UpdateTransactionOutcome = TransactionOutcome<
	TransactionView,
	| "NOT_FOUND"
	| "ACCOUNT_INELIGIBLE"
	| "CATEGORY_INELIGIBLE"
	| "TRANSACTION_TRANSITION_INVALID"
>;
export type TransitionTransactionOutcome = TransactionOutcome<
	TransactionView,
	"NOT_FOUND" | "TRANSACTION_TRANSITION_INVALID" | "RESTORE_CONFLICT"
>;

export interface TransactionList {
	transactions: TransactionView[];
	page: number;
	pageSize: number;
	total: number;
}

export interface CreateTransactionInput {
	userId: string;
	id: string;
	type: string;
	amountMinor: number;
	date: string;
	accountId: string;
	categoryId: string;
	notes?: string | null;
}

export interface UpdateTransactionInput {
	userId: string;
	transactionId: string;
	amountMinor?: number;
	date?: string;
	accountId?: string;
	categoryId?: string;
	notes?: string | null;
}

export interface RestoreTransactionInput {
	userId: string;
	transactionId: string;
	accountId?: string;
	categoryId?: string;
}

export interface ListTransactionsFilters {
	status: TransactionStatus;
	from?: string;
	to?: string;
	type?: string;
	accountId?: string;
	categoryId?: string;
	q?: string;
	page: number;
	pageSize: number;
}

// Lifecycle state machine: exactly these transitions are valid; anything else
// is a conflict.
const VALID_TRANSITIONS: Record<
	TransactionStatus,
	readonly TransactionStatus[]
> = {
	active: ["archived", "deleted"],
	archived: ["active"],
	deleted: ["active"],
};

export interface TransactionServiceDeps {
	transactions: TransactionRepository;
	accounts: AccountRepository;
	categories: CategoryRepository;
}

export function createTransactionService(deps: TransactionServiceDeps) {
	const { transactions, accounts, categories } = deps;

	async function requireOwnedTransaction(
		userId: string,
		transactionId: string,
	): Promise<Transaction | undefined> {
		const transaction = await transactions.findById(transactionId);
		if (!transaction || transaction.userId !== userId) {
			return undefined;
		}
		return transaction;
	}

	// Only active accounts accept new postings; historical transactions keep
	// referencing archived accounts, so eligibility applies at write time only.
	async function checkAccountEligibility(
		userId: string,
		accountId: string,
	): Promise<boolean> {
		const account = await accounts.findById(accountId);
		return Boolean(
			account && account.userId === userId && account.status === "active",
		);
	}

	async function checkCategoryEligibility(
		userId: string,
		categoryId: string,
		type: string,
	): Promise<boolean> {
		const category = await categories.findById(categoryId);
		return Boolean(
			category &&
				category.userId === userId &&
				category.status === "active" &&
				category.type === type,
		);
	}

	async function transitionTo(
		userId: string,
		transactionId: string,
		target: TransactionStatus,
		reassignment?: { accountId?: string; categoryId?: string },
	): Promise<TransitionTransactionOutcome> {
		const transaction = await requireOwnedTransaction(userId, transactionId);
		if (!transaction) {
			return { ok: false, code: "NOT_FOUND" };
		}
		const allowed = VALID_TRANSITIONS[transaction.status as TransactionStatus];
		if (!allowed?.includes(target)) {
			return { ok: false, code: "TRANSACTION_TRANSITION_INVALID" };
		}
		const nowIso = isoNow();
		// Restore resolves against the transaction's own references unless the
		// caller reassigns; deleted targets block the restore, archived ones do
		// not (their transactions' effects remain part of current balances).
		const resolveAccountId = reassignment?.accountId ?? transaction.accountId;
		const resolveCategoryId =
			reassignment?.categoryId ?? transaction.categoryId;
		if (target === "active") {
			const account = await accounts.findById(resolveAccountId);
			if (!account || account.userId !== userId || account.status === "deleted") {
				return { ok: false, code: "RESTORE_CONFLICT" };
			}
			const category = await categories.findById(resolveCategoryId);
			const categoryType = reassignment?.categoryId
				? transaction.type
				: category?.type;
			if (
				!category ||
				category.userId !== userId ||
				category.status === "deleted" ||
				categoryType !== transaction.type
			) {
				return { ok: false, code: "RESTORE_CONFLICT" };
			}
		}
		const timestamps =
			target === "archived"
				? { archivedAt: nowIso, deletedAt: null }
				: target === "deleted"
					? { archivedAt: null, deletedAt: nowIso }
					: { archivedAt: null, deletedAt: null };
		const updated = await transactions.updateStatus(
			transactionId,
			target,
			timestamps,
			nowIso,
		);
		if (!updated) {
			return { ok: false, code: "NOT_FOUND" };
		}
		if (reassignment?.accountId !== undefined || reassignment?.categoryId !== undefined) {
			const withRefs = await transactions.updateDetails(
				transactionId,
				{
					...(reassignment.accountId !== undefined
						? { accountId: reassignment.accountId }
						: {}),
					...(reassignment.categoryId !== undefined
						? { categoryId: reassignment.categoryId }
						: {}),
				},
				nowIso,
			);
			if (!withRefs) {
				return { ok: false, code: "NOT_FOUND" };
			}
		}
		const finalRow = await transactions.findByIdWithRefs(transactionId);
		if (!finalRow) {
			return { ok: false, code: "NOT_FOUND" };
		}
		return {
			ok: true,
			value: toView({
				...finalRow.transaction,
				accountName: finalRow.accountName,
				categoryName: finalRow.categoryName,
			}),
		};
	}

	return {
		// Creation is idempotent: a repeated request with the same
		// client-generated id returns the existing transaction without
		// re-applying any balance effect.
		async create(
			input: CreateTransactionInput,
		): Promise<CreateTransactionOutcome> {
			const existing = await transactions.findById(input.id);
			if (existing && existing.userId === input.userId) {
				const row = await transactions.findByIdWithRefs(input.id);
				if (row) {
					return {
						ok: true,
						value: toView({
							...row.transaction,
							accountName: row.accountName,
							categoryName: row.categoryName,
						}),
						replayed: true,
					};
				}
			}
			if (!(await checkAccountEligibility(input.userId, input.accountId))) {
				return { ok: false, code: "ACCOUNT_INELIGIBLE" };
			}
			if (
				!(await checkCategoryEligibility(
					input.userId,
					input.categoryId,
					input.type,
				))
			) {
				return { ok: false, code: "CATEGORY_INELIGIBLE" };
			}
			const nowIso = isoNow();
			try {
				await transactions.insert({
					id: input.id,
					userId: input.userId,
					type: input.type,
					amountMinor: input.amountMinor,
					date: input.date,
					accountId: input.accountId,
					categoryId: input.categoryId,
					notes: input.notes ?? null,
					createdAt: nowIso,
					updatedAt: nowIso,
				});
			} catch {
				// Lost a create race to the same id: the winner's row is the
				// idempotent answer, not an error.
				const row = await transactions.findByIdWithRefs(input.id);
				if (row && row.transaction.userId === input.userId) {
					return {
						ok: true,
						value: toView({
							...row.transaction,
							accountName: row.accountName,
							categoryName: row.categoryName,
						}),
						replayed: true,
					};
				}
				throw new Error("transaction insert failed without a replay row");
			}
			const row = await transactions.findByIdWithRefs(input.id);
			if (!row) {
				return { ok: false, code: "ACCOUNT_INELIGIBLE" };
			}
			return {
				ok: true,
				value: toView({
					...row.transaction,
					accountName: row.accountName,
					categoryName: row.categoryName,
				}),
				replayed: false,
			};
		},

		async list(
			userId: string,
			filters: ListTransactionsFilters,
		): Promise<TransactionList> {
			const { rows, total } = await transactions.list(userId, filters);
			return {
				transactions: rows.map((row) =>
					toView({
						...row.transaction,
						accountName: row.accountName,
						categoryName: row.categoryName,
					}),
				),
				page: filters.page,
				pageSize: filters.pageSize,
				total,
			};
		},

		async get(
			userId: string,
			transactionId: string,
		): Promise<GetTransactionOutcome> {
			const row = await transactions.findByIdWithRefs(transactionId);
			if (!row || row.transaction.userId !== userId) {
				return { ok: false, code: "NOT_FOUND" };
			}
			return {
				ok: true,
				value: toView({
					...row.transaction,
					accountName: row.accountName,
					categoryName: row.categoryName,
				}),
			};
		},

		// Edits recompute balances implicitly: balances are derived from the
		// ledger, so the update lands atomically in one row write.
		async update(
			input: UpdateTransactionInput,
		): Promise<UpdateTransactionOutcome> {
			const transaction = await requireOwnedTransaction(
				input.userId,
				input.transactionId,
			);
			if (!transaction) {
				return { ok: false, code: "NOT_FOUND" };
			}
			if (transaction.status !== "active") {
				return { ok: false, code: "TRANSACTION_TRANSITION_INVALID" };
			}
			if (
				input.accountId !== undefined &&
				input.accountId !== transaction.accountId &&
				!(await checkAccountEligibility(input.userId, input.accountId))
			) {
				return { ok: false, code: "ACCOUNT_INELIGIBLE" };
			}
			if (
				input.categoryId !== undefined &&
				input.categoryId !== transaction.categoryId &&
				!(await checkCategoryEligibility(
					input.userId,
					input.categoryId,
					transaction.type,
				))
			) {
				return { ok: false, code: "CATEGORY_INELIGIBLE" };
			}
			const updated = await transactions.updateDetails(
				input.transactionId,
				{
					...(input.amountMinor !== undefined
						? { amountMinor: input.amountMinor }
						: {}),
					...(input.date !== undefined ? { date: input.date } : {}),
					...(input.accountId !== undefined
						? { accountId: input.accountId }
						: {}),
					...(input.categoryId !== undefined
						? { categoryId: input.categoryId }
						: {}),
					...(input.notes !== undefined ? { notes: input.notes } : {}),
				},
				isoNow(),
			);
			if (!updated) {
				return { ok: false, code: "NOT_FOUND" };
			}
			const row = await transactions.findByIdWithRefs(input.transactionId);
			if (!row) {
				return { ok: false, code: "NOT_FOUND" };
			}
			return {
				ok: true,
				value: toView({
					...row.transaction,
					accountName: row.accountName,
					categoryName: row.categoryName,
				}),
			};
		},

		async archive(
			userId: string,
			transactionId: string,
		): Promise<TransitionTransactionOutcome> {
			return transitionTo(userId, transactionId, "archived");
		},

		async remove(
			userId: string,
			transactionId: string,
		): Promise<TransitionTransactionOutcome> {
			return transitionTo(userId, transactionId, "deleted");
		},

		// Restoring re-applies the transaction's balance effect exactly once
		// (deleted transactions carry zero effect while trashed). Blocked when
		// the referenced account or category has been deleted unless the caller
		// reassigns to an eligible replacement.
		async restore(
			input: RestoreTransactionInput,
		): Promise<TransitionTransactionOutcome> {
			return transitionTo(input.userId, input.transactionId, "active", {
				accountId: input.accountId,
				categoryId: input.categoryId,
			});
		},

		// Permanent deletion: only from trash, never automatic, physically
		// removes the row. A trashed transaction has zero balance effect, so no
		// balance or report can change.
		async destroy(
			userId: string,
			transactionId: string,
		): Promise<TransitionTransactionOutcome> {
			const transaction = await requireOwnedTransaction(userId, transactionId);
			if (!transaction) {
				return { ok: false, code: "NOT_FOUND" };
			}
			if (transaction.status !== "deleted") {
				return { ok: false, code: "TRANSACTION_TRANSITION_INVALID" };
			}
			const removed = await transactions.delete(transactionId);
			if (!removed) {
				return { ok: false, code: "NOT_FOUND" };
			}
			return {
				ok: true,
				value: toView({ ...transaction, status: "deleted" }),
			};
		},

		transition: transitionTo,
	};
}

export type TransactionService = ReturnType<typeof createTransactionService>;
