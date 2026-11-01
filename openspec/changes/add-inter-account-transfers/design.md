# Design

## Context

Transactions now exist with derived balances (`opening + Σ signed non-deleted transaction effects`), idempotent client-UUIDv7 creation, and a working lifecycle table. This change adds a second balance-affecting record type. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- Paired atomic balance effects that provably satisfy the account balance identity extended with transfer sides.
- Transfers visible in either account's history with clear direction (the deferred part of US-005).
- Zero income/expense contamination, enforced structurally rather than by convention.

**Non-Goals:**
- Multi-leg or split transfers, scheduled/recurring transfers, cross-currency transfers.
- A separate transfers page (management happens inside the existing history/transactions surface).
- Category involvement of any kind.

## Decisions

- **Separate `transfers` table, not paired transaction rows.** Alternative: two linked transaction rows (expense + income). Rejected — lifecycle would need to keep two rows in lockstep forever, category would be required (transfers have none), and reporting would need a permanent "is-transfer" carve-out on every aggregate. A single row with `source_account_id`/`destination_account_id` makes "both sides move together" a property of the row, not an invariant to maintain.
- **Balance engine extension, same derived approach.** Account current balance becomes `opening_balance_minor + Σ(signed non-deleted transaction effects) + Σ(transfer effects: −amount as source, +amount as destination, deleted excluded)`. Implemented as one additional indexed SUM in the same service seam, so the balance identity stays a pure function of history and cannot drift. The account service keeps single ownership of balance computation.
- **Idempotent create, same replay contract** as transactions: client UUIDv7 id required, repeated id returns the existing transfer (200), new id returns 201. PK-conflict race handled by catch-and-re-read.
- **Eligibility at write time**: both accounts must be `active` and distinct (`SAME_ACCOUNT_TRANSFER` conflict). Deleted references never block reads — history resolves names by id regardless of status.
- **Restore with deleted-target validation and optional per-side reassignment**: restore body accepts optional `sourceAccountId`/`destinationAccountId` replacements, validated like creation; either side on an archived account is allowed. Mirrors the transactions restore contract exactly (`RESTORE_CONFLICT` reuse).
- **Unified activity query for account history**: the history/transactions surface gains an activity query `UNION ALL`-ing account-scoped transactions and transfer sides (each transfer appearing once per involved account, direction-tagged `in`/`out`), sorted by date desc and paginated over the union (two indexed queries + merged count). The plain `GET /api/transactions` endpoint stays transactions-only — clean contract for reporting and the future mobile client — while the UI history consumes the unified activity endpoint. Alternative (single merged mega-endpoint for everything) rejected: muddies the transactions contract the reporting epic will consume.
- **`GET /api/transfers`** list endpoint (date-range/account/search filters + pagination) for direct transfer management, mirroring the transactions list; transfer rows in the UI reuse the transaction row components with a direction badge.
- **Lifecycle and permanent delete identical to transactions**: same transition table (`TRANSFER_TRANSITION_INVALID` new code or reuse `TRANSACTION_TRANSITION_INVALID`? — new `TRANSFER_TRANSITION_INVALID` for precise error mapping), permanent delete only from `deleted` status, per-record with confirmation.

## Risks / Trade-offs

- [Double-counting a side during edit/restore] → All paired mutations run in one D1 batch/transaction; integration tests assert the extended balance identity after every operation, including edit-sides and restore-reassign cases.
- [UNION pagination complexity] → Confined to one repository query with clear count semantics (sum of both sides' matching counts); tested with mixed fixtures. If it ever becomes a maintenance burden, the activity feed can be materialized later without changing the spec.
- [Transfers without categories appearing in category-filtered views] → Category filters simply exclude transfers by construction (different table); documented in the activity query.
- [Two balance-affecting record types multiplying future aggregates] → The reporting epic consumes the transaction and transfer repositories through their existing signed-sum helpers instead of re-deriving effects, keeping aggregate logic in one place.
