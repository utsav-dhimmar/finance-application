# Proposal

## Why

Accounts and categories exist, but no money movement can be recorded. Transaction management is Epic B of the approved backlog (`user-story/01-inital/02-transaction-management.md`, US-006–US-013) and the core of the product: income and expense records, their effect on account balances, and their lifecycle. It also completes the seams installed by earlier epics (account opening-balance/type locking and category type locking), which currently have stub predicates that always report "no history".

## What Changes

- **New `transactions` table** (D1 + Drizzle migration): client-generated UUIDv7 id (the idempotency key), `user_id` scoping, type (`income` | `expense`), `amount_minor` in positive integer paise, transaction `date` (YYYY-MM-DD, distinct from audit timestamps), `account_id` FK, `category_id` FK, optional notes, lifecycle status (`active` | `archived` | `deleted`) with transition timestamps.
- **Transaction REST API** (authenticated, OpenAPI-documented): idempotent create, paginated list with filters (date range, type, account, category, text search), get one, edit, archive, soft-delete, restore (with optional reassignment), permanent delete (explicit, per-record).
- **Real balance engine**: `computeCurrentBalance` becomes opening balance + sum of non-deleted transactions for the account; active **and** archived transactions affect current balances, deleted do not; all mutations recompute consistently (derived balances, no stored-delta ledger). Account opening-balance/type locking and category type locking become live via real referencing-count queries.
- **Shared contracts**: plain-Zod transaction schemas in `packages/schemas` and typed endpoint functions in `packages/api-client`.
- **Web UI** (`apps/web`): `/transactions` page with filter bar, paginated table (TanStack Table), create/edit dialogs (type toggle drives account and category eligibility), detail view, lifecycle actions with confirmations, loading / empty / error states; navigation entry.
- **Explicit product policies** (confirmed with the product owner):
  - Idempotent creation: the client generates the UUIDv7 id; a repeated create with the same id returns the existing record instead of duplicating.
  - Negative balances are allowed freely; the server never blocks a transaction for overdrawn accounts and displays negatives as-is.
  - Only active accounts are eligible as transaction accounts; only active categories of the compatible type are selectable; historical transactions keep references to archived/deleted records (references resolve by id).
  - Archived transactions keep affecting current balances; soft-deleted transactions stop affecting them; restoration re-applies the effect exactly once and is rejected if the referenced account or category has been deleted (an archived target is allowed); the restore request may reassign the transaction to a different eligible account or category.
  - Permanent deletion is per-record, requires explicit confirmation, physically removes the row, and is never automatic.
- **Explicitly deferred**: per-account transaction history view (US-005) arrives with this change's list filters (`accountId`); income/expense report aggregation and the dashboard move to the reporting epic; recurring transactions, budgets, attachments, and multi-currency stay out of scope.

## Capabilities

### New Capabilities

- `transactions`: Recording and maintaining income and expense transactions — idempotent creation, validation, balance effects, filtering/pagination, editing, and the active/archived/deleted lifecycle with restore and permanent deletion.

### Modified Capabilities

(none — the account and category locking behavior is already specified; this change implements it)

## Impact

- **`server/api`** — new `transactions` Drizzle table + migration (indexes for date/account/category/status queries); new `routes/transactions.ts`, `services/transaction-service.ts`, `repositories/transaction-repository.ts`, `schemas/transactions.ts`; new `ErrorCode` values (`TRANSACTION_NOT_FOUND` reuse of NOT_FOUND, `ACCOUNT_INELIGIBLE`, `CATEGORY_INELIGIBLE`, `RESTORE_CONFLICT`); replaces the `hasPostedTransactions` and `getReferencingTransactionCount` seams with real count queries; balance computation now sums transactions; OpenAPI document extended; unit + workers integration tests including balance-effect and lifecycle tests.
- **`packages/schemas`** — new `transactions.ts` (type/status enums, create/update/restore bodies, list query schema, response schemas with pagination envelope); exported from the package index.
- **`packages/api-client`** — new `src/transactions.ts` typed functions; no new dependencies.
- **`apps/web`** — new `/transactions` route with TanStack Table, filter bar, dialogs, detail view, hooks keyed `["transactions", filters]`; Transactions navigation entry; account/category eligibility wiring in dialogs.
- **Database** — one additive migration creating the `transactions` table; no changes to existing tables.
- **Dependencies** — `@tanstack/react-table` for the web table (already the AGENTS.md convention; added via `pnpm add` if not present).
