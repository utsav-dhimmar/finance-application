# Proposal

## Why

Users hold multiple accounts, so money moves between them — cash withdrawn from the bank, top-ups to a wallet. Epic C of the approved backlog (`user-story/01-inital/03-inter-account-transfers.md`, US-014–US-016). Without transfers, users must fake such movements as paired expense+income transactions, which corrupts expense and income reporting. Transfers move balances without ever touching income or expense totals.

## What Changes

- **New `transfers` table** (D1 + Drizzle migration): client-generated UUIDv7 id (idempotency key), `user_id` scoping, `source_account_id`, `destination_account_id`, `amount_minor` in positive integer paise, transfer `date` (YYYY-MM-DD), optional notes, lifecycle status (`active` | `archived` | `deleted`) with transition timestamps.
- **Transfer REST API** (authenticated, OpenAPI-documented): idempotent create, paginated list with filters, get one, edit, archive, soft-delete, restore (with optional reassignment), permanent delete (explicit, per-record) — mirroring the transactions endpoints' conventions.
- **Balance engine extension**: account current balances gain the transfer contribution — transfers subtract from the source and add to the destination exactly once while active or archived, and contribute nothing while deleted; derived-balance approach extended (no stored deltas).
- **Unified history view**: the account history view shows transfers interleaved with transactions, with clear in/out direction; transfers are never counted as income or expense.
- **Shared contracts**: plain-Zod transfer schemas in `packages/schemas` and typed endpoint functions in `packages/api-client`.
- **Web UI** (`apps/web`): transfer creation and editing dialogs (source/destination/account eligibility, amount, date, notes), transfer rows in the history view with direction badges, lifecycle actions with confirmations including permanent delete.
- **Explicit product policies** (confirmed with the product owner):
  - Idempotent creation via client UUIDv7 (same replay semantics as transactions).
  - Source and destination must be distinct active accounts; negative resulting balances are allowed and displayed as-is.
  - Archived transfers keep affecting both account balances; soft-deleted transfers affect neither; restoration re-applies both effects exactly once and is rejected if either referenced account has been deleted (archived targets are allowed); restore may reassign either side to an eligible replacement account.
  - Permanent deletion is per-record, requires explicit confirmation, physically removes the row, and is never automatic.
- **Explicitly deferred**: multi-leg/split transfers, scheduled/recurring transfers, cross-currency transfers.

## Capabilities

### New Capabilities

- `transfers`: Moving money between a user's own accounts — idempotent creation with paired atomic balance effects, editing, and the active/archived/deleted lifecycle, with transfers permanently excluded from income and expense semantics.

### Modified Capabilities

(none — account balance behavior already specifies current balance as opening balance plus balance-affecting posted transactions; this change adds the transfer contribution to that computation)

## Impact

- **`server/api`** — new `transfers` Drizzle table + migration (indexes on user/date, source, destination, status); new `routes/transfers.ts`, `services/transfer-service.ts`, `repositories/transfer-repository.ts`, `schemas/transfers.ts`; unified activity query joining transactions and transfers for account history; new `ErrorCode` values (`SAME_ACCOUNT_TRANSFER`, `ACCOUNT_INELIGIBLE` reuse, `RESTORE_CONFLICT` reuse); balance computation extended with transfer sums; OpenAPI document extended; unit + workers integration tests including paired-effect and lifecycle tests.
- **`packages/schemas`** — new `transfers.ts` (create/update/restore bodies, list query, response schemas with pagination); exported from the package index.
- **`packages/api-client`** — new `src/transfers.ts` typed functions; no new dependencies.
- **`apps/web`** — transfer dialogs and rows integrated into the existing transactions page and history view; hooks keyed `["transfers", filters]` plus account-key invalidation; no new route.
- **Database** — one additive migration creating the `transfers` table; no changes to existing tables.
- **Dependencies** — none expected; any addition must go through `pnpm add`.
