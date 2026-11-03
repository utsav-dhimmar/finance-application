import type { TransferStatus } from "@finance-application/schemas";
import { transferStatusSchema } from "@finance-application/schemas";
import type { Transfer } from "@/db/schema";
import type { ErrorCode } from "@/lib/error";
import type { AccountRepository } from "@/repositories/account-repository";
import type { TransferRepository } from "@/repositories/transfer-repository";
import { isoNow } from "@/utils/datetime";

export interface TransferView {
	id: string;
	amountMinor: number;
	date: string;
	sourceAccountId: string;
	sourceAccountName: string | null;
	destinationAccountId: string;
	destinationAccountName: string | null;
	notes: string | null;
	status: TransferStatus;
	archivedAt: string | null;
	deletedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

function toView(
	row: Transfer & {
		sourceAccountName?: string | null;
		destinationAccountName?: string | null;
	},
): TransferView {
	// The DB CHECK constraints guarantee the enum values; parsing here keeps
	// the view types honest without an unsafe cast.
	return {
		id: row.id,
		amountMinor: row.amountMinor,
		date: row.date,
		sourceAccountId: row.sourceAccountId,
		sourceAccountName: row.sourceAccountName ?? null,
		destinationAccountId: row.destinationAccountId,
		destinationAccountName: row.destinationAccountName ?? null,
		notes: row.notes,
		status: transferStatusSchema.parse(row.status),
		archivedAt: row.archivedAt,
		deletedAt: row.deletedAt,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

// Each method fails with exactly one code so controllers can map it to a
// literal response status.
export type TransferOutcome<T, E extends ErrorCode> =
	| { ok: true; value: T }
	| { ok: false; code: E };

// Creation carries a `replayed` flag on success so the route can answer
// 201 (fresh) or 200 (idempotent replay) without re-inspecting the row.
export type CreateTransferOutcome =
	| { ok: true; value: TransferView; replayed: boolean }
	| { ok: false; code: "ACCOUNT_INELIGIBLE" | "SAME_ACCOUNT_TRANSFER" };
export type GetTransferOutcome = TransferOutcome<TransferView, "NOT_FOUND">;
export type UpdateTransferOutcome = TransferOutcome<
	TransferView,
	| "NOT_FOUND"
	| "ACCOUNT_INELIGIBLE"
	| "SAME_ACCOUNT_TRANSFER"
	| "TRANSFER_TRANSITION_INVALID"
>;
export type TransitionTransferOutcome = TransferOutcome<
	TransferView,
	| "NOT_FOUND"
	| "TRANSFER_TRANSITION_INVALID"
	| "SAME_ACCOUNT_TRANSFER"
	| "RESTORE_CONFLICT"
>;

export interface TransferList {
	transfers: TransferView[];
	page: number;
	pageSize: number;
	total: number;
}

export interface CreateTransferInput {
	userId: string;
	id: string;
	sourceAccountId: string;
	destinationAccountId: string;
	amountMinor: number;
	date: string;
	notes?: string | null;
}

export interface UpdateTransferInput {
	userId: string;
	transferId: string;
	sourceAccountId?: string;
	destinationAccountId?: string;
	amountMinor?: number;
	date?: string;
	notes?: string | null;
}

export interface RestoreTransferInput {
	userId: string;
	transferId: string;
	sourceAccountId?: string;
	destinationAccountId?: string;
}

export interface ListTransfersFilters {
	status: TransferStatus;
	from?: string;
	to?: string;
	accountId?: string;
	q?: string;
	page: number;
	pageSize: number;
}

// Lifecycle state machine: exactly these transitions are valid; anything else
// is a conflict.
const VALID_TRANSITIONS: Record<TransferStatus, readonly TransferStatus[]> = {
	active: ["archived", "deleted"],
	archived: ["active"],
	deleted: ["active"],
};

export interface TransferServiceDeps {
	transfers: TransferRepository;
	accounts: AccountRepository;
}

export function createTransferService(deps: TransferServiceDeps) {
	const { transfers, accounts } = deps;

	async function requireOwnedTransfer(
		userId: string,
		transferId: string,
	): Promise<Transfer | undefined> {
		const transfer = await transfers.findById(transferId);
		if (!transfer || transfer.userId !== userId) {
			return undefined;
		}
		return transfer;
	}

	// Only active accounts accept new postings; historical transfers keep
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

	async function transitionTo(
		userId: string,
		transferId: string,
		target: TransferStatus,
		reassignment?: {
			sourceAccountId?: string;
			destinationAccountId?: string;
		},
	): Promise<TransitionTransferOutcome> {
		const transfer = await requireOwnedTransfer(userId, transferId);
		if (!transfer) {
			return { ok: false, code: "NOT_FOUND" };
		}
		const allowed = VALID_TRANSITIONS[transfer.status as TransferStatus];
		if (!allowed?.includes(target)) {
			return { ok: false, code: "TRANSFER_TRANSITION_INVALID" };
		}
		const nowIso = isoNow();
		// Restore resolves against the transfer's own references unless the
		// caller reassigns; deleted targets block the restore, archived ones do
		// not (their transfers' effects remain part of current balances).
		const resolveSourceId =
			reassignment?.sourceAccountId ?? transfer.sourceAccountId;
		const resolveDestinationId =
			reassignment?.destinationAccountId ?? transfer.destinationAccountId;
		if (target === "active") {
			if (resolveSourceId === resolveDestinationId) {
				return { ok: false, code: "SAME_ACCOUNT_TRANSFER" };
			}
			for (const accountId of [resolveSourceId, resolveDestinationId]) {
				const account = await accounts.findById(accountId);
				if (
					!account ||
					account.userId !== userId ||
					account.status === "deleted"
				) {
					return { ok: false, code: "RESTORE_CONFLICT" };
				}
			}
		}
		const timestamps =
			target === "archived"
				? { archivedAt: nowIso, deletedAt: null }
				: target === "deleted"
					? { archivedAt: null, deletedAt: nowIso }
					: { archivedAt: null, deletedAt: null };
		const updated = await transfers.updateStatus(
			transferId,
			target,
			timestamps,
			nowIso,
		);
		if (!updated) {
			return { ok: false, code: "NOT_FOUND" };
		}
		if (
			reassignment?.sourceAccountId !== undefined ||
			reassignment?.destinationAccountId !== undefined
		) {
			const withRefs = await transfers.updateDetails(
				transferId,
				{
					...(reassignment.sourceAccountId !== undefined
						? { sourceAccountId: reassignment.sourceAccountId }
						: {}),
					...(reassignment.destinationAccountId !== undefined
						? { destinationAccountId: reassignment.destinationAccountId }
						: {}),
				},
				nowIso,
			);
			if (!withRefs) {
				return { ok: false, code: "NOT_FOUND" };
			}
		}
		const finalRow = await transfers.findByIdWithRefs(transferId);
		if (!finalRow) {
			return { ok: false, code: "NOT_FOUND" };
		}
		return {
			ok: true,
			value: toView({
				...finalRow.transfer,
				sourceAccountName: finalRow.sourceAccountName,
				destinationAccountName: finalRow.destinationAccountName,
			}),
		};
	}

	return {
		// Creation is idempotent: a repeated request with the same
		// client-generated id returns the existing transfer without re-applying
		// any balance effect.
		async create(input: CreateTransferInput): Promise<CreateTransferOutcome> {
			const existing = await transfers.findById(input.id);
			if (existing && existing.userId === input.userId) {
				const row = await transfers.findByIdWithRefs(input.id);
				if (row) {
					return {
						ok: true,
						value: toView({
							...row.transfer,
							sourceAccountName: row.sourceAccountName,
							destinationAccountName: row.destinationAccountName,
						}),
						replayed: true,
					};
				}
			}
			if (input.sourceAccountId === input.destinationAccountId) {
				return { ok: false, code: "SAME_ACCOUNT_TRANSFER" };
			}
			if (
				!(await checkAccountEligibility(input.userId, input.sourceAccountId))
			) {
				return { ok: false, code: "ACCOUNT_INELIGIBLE" };
			}
			if (
				!(await checkAccountEligibility(
					input.userId,
					input.destinationAccountId,
				))
			) {
				return { ok: false, code: "ACCOUNT_INELIGIBLE" };
			}
			const nowIso = isoNow();
			try {
				await transfers.insert({
					id: input.id,
					userId: input.userId,
					sourceAccountId: input.sourceAccountId,
					destinationAccountId: input.destinationAccountId,
					amountMinor: input.amountMinor,
					date: input.date,
					notes: input.notes ?? null,
					createdAt: nowIso,
					updatedAt: nowIso,
				});
			} catch {
				// Lost a create race to the same id: the winner's row is the
				// idempotent answer, not an error.
				const row = await transfers.findByIdWithRefs(input.id);
				if (row && row.transfer.userId === input.userId) {
					return {
						ok: true,
						value: toView({
							...row.transfer,
							sourceAccountName: row.sourceAccountName,
							destinationAccountName: row.destinationAccountName,
						}),
						replayed: true,
					};
				}
				throw new Error("transfer insert failed without a replay row");
			}
			const row = await transfers.findByIdWithRefs(input.id);
			if (!row) {
				return { ok: false, code: "ACCOUNT_INELIGIBLE" };
			}
			return {
				ok: true,
				value: toView({
					...row.transfer,
					sourceAccountName: row.sourceAccountName,
					destinationAccountName: row.destinationAccountName,
				}),
				replayed: false,
			};
		},

		async list(
			userId: string,
			filters: ListTransfersFilters,
		): Promise<TransferList> {
			const { rows, total } = await transfers.list(userId, filters);
			return {
				transfers: rows.map((row) =>
					toView({
						...row.transfer,
						sourceAccountName: row.sourceAccountName,
						destinationAccountName: row.destinationAccountName,
					}),
				),
				page: filters.page,
				pageSize: filters.pageSize,
				total,
			};
		},

		async get(userId: string, transferId: string): Promise<GetTransferOutcome> {
			const row = await transfers.findByIdWithRefs(transferId);
			if (!row || row.transfer.userId !== userId) {
				return { ok: false, code: "NOT_FOUND" };
			}
			return {
				ok: true,
				value: toView({
					...row.transfer,
					sourceAccountName: row.sourceAccountName,
					destinationAccountName: row.destinationAccountName,
				}),
			};
		},

		// Edits recompute balances implicitly: balances are derived from the
		// ledgers, so the update lands atomically in one row write.
		async update(input: UpdateTransferInput): Promise<UpdateTransferOutcome> {
			const transfer = await requireOwnedTransfer(
				input.userId,
				input.transferId,
			);
			if (!transfer) {
				return { ok: false, code: "NOT_FOUND" };
			}
			if (transfer.status !== "active") {
				return { ok: false, code: "TRANSFER_TRANSITION_INVALID" };
			}
			// The distinct-accounts rule applies to the merged pair: a patch
			// moving one side onto the other is a conflict.
			const mergedSourceId = input.sourceAccountId ?? transfer.sourceAccountId;
			const mergedDestinationId =
				input.destinationAccountId ?? transfer.destinationAccountId;
			if (mergedSourceId === mergedDestinationId) {
				return { ok: false, code: "SAME_ACCOUNT_TRANSFER" };
			}
			if (
				input.sourceAccountId !== undefined &&
				input.sourceAccountId !== transfer.sourceAccountId &&
				!(await checkAccountEligibility(input.userId, input.sourceAccountId))
			) {
				return { ok: false, code: "ACCOUNT_INELIGIBLE" };
			}
			if (
				input.destinationAccountId !== undefined &&
				input.destinationAccountId !== transfer.destinationAccountId &&
				!(await checkAccountEligibility(
					input.userId,
					input.destinationAccountId,
				))
			) {
				return { ok: false, code: "ACCOUNT_INELIGIBLE" };
			}
			const updated = await transfers.updateDetails(
				input.transferId,
				{
					...(input.amountMinor !== undefined
						? { amountMinor: input.amountMinor }
						: {}),
					...(input.date !== undefined ? { date: input.date } : {}),
					...(input.sourceAccountId !== undefined
						? { sourceAccountId: input.sourceAccountId }
						: {}),
					...(input.destinationAccountId !== undefined
						? { destinationAccountId: input.destinationAccountId }
						: {}),
					...(input.notes !== undefined ? { notes: input.notes } : {}),
				},
				isoNow(),
			);
			if (!updated) {
				return { ok: false, code: "NOT_FOUND" };
			}
			const row = await transfers.findByIdWithRefs(input.transferId);
			if (!row) {
				return { ok: false, code: "NOT_FOUND" };
			}
			return {
				ok: true,
				value: toView({
					...row.transfer,
					sourceAccountName: row.sourceAccountName,
					destinationAccountName: row.destinationAccountName,
				}),
			};
		},

		async archive(
			userId: string,
			transferId: string,
		): Promise<TransitionTransferOutcome> {
			return transitionTo(userId, transferId, "archived");
		},

		async remove(
			userId: string,
			transferId: string,
		): Promise<TransitionTransferOutcome> {
			return transitionTo(userId, transferId, "deleted");
		},

		// Restoring re-applies the transfer's balance effects exactly once
		// (deleted transfers carry zero effect while trashed). Blocked when a
		// referenced account has been deleted unless the caller reassigns that
		// side to an eligible replacement; archived targets are allowed.
		async restore(
			input: RestoreTransferInput,
		): Promise<TransitionTransferOutcome> {
			return transitionTo(input.userId, input.transferId, "active", {
				sourceAccountId: input.sourceAccountId,
				destinationAccountId: input.destinationAccountId,
			});
		},

		// Permanent deletion: only from trash, never automatic, physically
		// removes the row. A trashed transfer has zero balance effect, so no
		// balance or report can change.
		async destroy(
			userId: string,
			transferId: string,
		): Promise<TransitionTransferOutcome> {
			const transfer = await requireOwnedTransfer(userId, transferId);
			if (!transfer) {
				return { ok: false, code: "NOT_FOUND" };
			}
			if (transfer.status !== "deleted") {
				return { ok: false, code: "TRANSFER_TRANSITION_INVALID" };
			}
			const removed = await transfers.delete(transferId);
			if (!removed) {
				return { ok: false, code: "NOT_FOUND" };
			}
			return {
				ok: true,
				value: toView({ ...transfer, status: "deleted" }),
			};
		},

		transition: transitionTo,
	};
}

export type TransferService = ReturnType<typeof createTransferService>;
