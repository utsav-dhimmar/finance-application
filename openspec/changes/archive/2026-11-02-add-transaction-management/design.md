# Design

## Context

Accounts and (after the categories change) categories are complete with their lifecycle patterns, error envelope, and test matrix. Two documented seams await this change: `hasPostedTransactions` (account-service, always `false`) guarding account opening-balance/type edits, and `getReferencingTransactionCount` (category-repository, always 0) guarding category type edits. `computeCurrentBalance(openingBalanceMinor, postedTransactionsSumMinor)` already exists as the balance seam with callers passing 0. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- A transactions ledger whose derived balances are provably consistent with history (spec: balance identity requirement).
- Idempotent creation compatible with the future offline-capable mobile client.
- Filters/pagination that serve both the transactions page and the later reporting epic.
- Live enforcement of the account and category locking rules.

**Non-Goals:**
- Report/dashboard aggregation (reporting epic consumes this change's queries).
- Recurring transactions, budgets, attachments, multi-currency, per-transaction currency.
- Stored-balance ledger (see decision below).

## Decisions

- **Derived balances, not a stored balance column.** Current balance = `opening_balance_minor + SUM(signed effect of non-deleted transactions)` computed per account from an indexed query (the existing `computeCurrentBalance` seam gains a real sum). Alternatives: a stored `balance` column maintained by triggers/service code (faster reads, but every mutation path must maintain it and any bug silently corrupts money — the highest-stakes failure mode in this app) or per-transaction delta rows (over-engineered at single-user scale). Derived sums can never drift from history; list endpoints for a handful of accounts make the cost negligible. If profiling ever demands it, a cached column can be added later without changing behavior.
- **Signed effect lives in the query, not the row.** Income contributes `+amount_minor`, expense `-amount_minor`, decided by `CASE` on `type` in the SUM. One `amount_minor` column (positive integer) instead of signed or per-type columns keeps validation ("amount must be a positive whole number of paise") simple and type-agnostic.
- **Idempotency by client UUIDv7 primary key.** `POST /api/transactions` requires `id` in the body; a conflicting id for the same user returns 200 with the existing record (no mutation), while a new id returns 201. Alternatives: an `Idempotency-Key` header table (extra retention machinery) was rejected; AGENTS.md already mandates UUIDv7 transaction ids, so the natural key is free. The insert-then-conflict race is handled by catching the PK violation and re-reading.
- **Date as `YYYY-MM-DD` text, separate from audit timestamps.** Matches D1/SQLite conventions already in the schema (ISO text), keeps month-boundary comparisons lexicographically exact, and avoids timezone shifts in date-based reports (AGENTS.md). No "no future dates" restriction — the backlog doesn't demand it and planning entries are legitimate; revisitable on request.
- **Eligibility rules at write time only.** Account must be `active`; category must be `active` and type-compatible — enforced on create/edit/restore-target. Historical references to since-archived or since-deleted records stay intact (no joins reject them); the list resolves names by id regardless of status. Error codes: `ACCOUNT_INELIGIBLE`, `CATEGORY_INELIGIBLE`.
- **Restore validation with optional reassignment.** Restore rejects with `RESTORE_CONFLICT` when the referenced account or category is deleted; the restore body accepts optional `accountId`/`categoryId` replacements (validated like creation). Archived targets are allowed, matching the balance policy (archived accounts keep their transactions' effects; archived transactions keep balance effects).
- **One lifecycle table, one service, same transitions** as accounts/categories (`active→archived`, `active→deleted`, `archived→active`, `deleted→active`; else `TRANSACTION_TRANSITION_INVALID`). Permanent delete is a separate `DELETE /api/transactions/:id` route, only valid from `deleted` status.
- **Pagination: offset/limit.** `page` (1-based) + `pageSize` (cap 100) with a total count in the response envelope. Alternatives (keyset cursors) rejected: TanStack Table's page UI and the single-user data volume favor numbered pages; the indexes below keep offset costs trivial. Composite indexes: `(user_id, date DESC)`, `(user_id, account_id, date DESC)`, `(user_id, category_id)`, `(user_id, status, date DESC)`.
- **Search**: case-insensitive `LIKE` across `notes`, joined category name, and account name, combined with the structured filters via AND. (FTS5 rejected as premature for single-user volumes.)
- **Seam replacement**: `hasPostedTransactions` → `COUNT(*) FROM transactions WHERE account_id = ? AND status != 'deleted'`; `getReferencingTransactionCount` → same with `category_id`. Account and category behaviors don't change spec text — they start matching the already-approved specs.
- **UI**: `/transactions` route with a filter bar (date range, type, account, category, search), TanStack Table with server-side pagination, create dialog (income/expense toggle drives account and category option eligibility), edit dialog, detail dialog, lifecycle actions with `AlertDialog` confirmations including permanent-delete, hooks keyed `["transactions", filters]` invalidating account keys on every balance-affecting mutation so account cards stay fresh.

## Risks / Trade-offs

- [Balance consistency across concurrent mutations] → All multi-step mutations (edit, restore-with-reassign) run inside a D1 batch/transaction; balances are derived so no state can persistently diverge. Integration tests assert the balance identity after every operation type.
- [Idempotent replay masking a genuine conflict] → Replay returns 200 only when the existing record's id matches the requester; cross-user collisions are impossible (per-user scoping + PK). Documented 201-vs-200 contract is tested.
- [Offset pagination degrades at very large history] → Capped page size + composite indexes; single-user volumes make this theoretical; keyset can be introduced later behind the same response envelope.
- [LIKE search on every keystroke] → Client debounces the search input; server treats `q` as an ordinary filter.
- [Editing the account/category of archived/deleted transactions must stay impossible] → Edit route checks status first; transition table tests cover it.
