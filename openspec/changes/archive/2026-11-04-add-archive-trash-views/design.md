# Design

## Context

All four record types have `?status=archived|deleted` list endpoints, restore endpoints with their conflict semantics, and inline lifecycle tabs on their entity pages. Transactions and transfers already have permanent-delete routes; accounts and categories do not. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- One Archive page and one Trash page covering all record types, reusing existing per-entity components and flows.
- Close the permanent-delete gap for accounts/categories behind a strict reference-count gate.
- Prove the exclusion guarantee once, cross-cuttingly, with integration tests.

**Non-Goals:**
- New lifecycle semantics for any single record type (all already specced).
- Bulk operations, retention policies, audit logging, soft-delete of already-archived records (state machine forbids it).
- Changing any entity page's existing tabs.

## Decisions

- **Compose, don't rebuild**: the unified pages render the existing per-entity card/table components inside record-type tabs, fed by the existing `?status=` endpoints. Alternative (dedicated aggregated endpoints returning all types at once) rejected — four cheap parallel queries from the client beat a bespoke aggregation endpoint, and TanStack Query fetches them concurrently.
- **Permanent-delete gate via strict reference counts, with FK enforcement as the last line of defense.** `DELETE /api/accounts/:id` and `DELETE /api/categories/:id` are valid only from `deleted` status and only when the reference count is zero across every lifecycle status (accounts: no transactions or transfers reference them — active, archived, or trashed; categories: no transactions in any status) — else `PERMANENT_DELETE_BLOCKED` (409) with copy explaining the history-preservation policy. The count must cover trashed referencers too, not just non-deleted ones: D1 always enforces foreign keys (`PRAGMA foreign_keys = OFF` is a no-op; verified in this repo's D1 test environment), so the physical `DELETE` of a row referenced even only by tombstoned records is rejected by the `RESTRICT` constraints. The explicit strict count check produces a meaningful error instead of a raw constraint failure; the FKs remain the final guard. Consequence (product decision): a trash record referenced by any history can only be permanently removed after the referencing trash records are themselves permanently deleted or restored.
- **No schema changes**: reference counts come from repository count helpers (the transaction repository's per-account/per-category counts and a new per-account transfer count, all status-unfiltered for the strict gate); nothing new to migrate. The database's enforced `RESTRICT` FKs are what make the strict gate mandatory rather than optional hardening — with them, a looser non-deleted-only gate would let the count check pass and then fail the physical delete with a raw constraint error.
- **Error code reuse**: restore flows surface the same codes (`ACCOUNT_NAME_TAKEN`, `CATEGORY_NAME_TAKEN`, `RESTORE_CONFLICT`, transition conflicts); the only new code is `PERMANENT_DELETE_BLOCKED`.
- **Nav**: `app-header.tsx` gains Archive and Trash entries; entity pages keep inline tabs — shared dialog/confirm components mean the unified pages add composition, not logic.
- **Balances can't change**: permanent delete only removes tombstoned rows, which contribute zero to every balance/report by the inclusion rules. Integration tests assert balances before/after permanent deletes of all four types.

## Risks / Trade-offs

- [Trash records can block permanent deletion of their referencers] → Accepted product decision (strict gate): an account/category referenced even only by trashed records cannot be permanently removed until those records are restored or themselves permanently deleted. Alternative (nullable FK columns + `ON DELETE SET NULL` migration on transactions/transfers) rejected to keep the schema stable; dropping the enforced FKs was rejected to preserve write-time integrity on the ledger. The blocking is what D1's always-enforced FKs would impose anyway — surfaced as an explicit, explained 409 instead of a raw constraint failure. The null-name "unavailable" read paths already in the repositories become purely defensive modeling, not a reachable state through these endpoints.
- [Four parallel queries per unified page] → Trivial at single-user scale; a combined endpoint can be added later without UI changes since the tabs already fetch per type.
- [Permanent delete of accounts orphaning transfers] → Impossible for non-deleted referencers by the gate; deleted transfers referencing a permanently deleted account resolve names to null like transactions.
- [Users expecting archive→delete shortcuts] → The lifecycle state machine (already specced) forbids archived→deleted; the unified pages expose only legal actions.
