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
- **Permanent-delete gate via reference counts, not FK enforcement alone.** `DELETE /api/accounts/:id` and `DELETE /api/categories/:id` are valid only from `deleted` status and only when the reference count (non-deleted transactions/transfers for accounts; non-deleted transactions for categories) is zero — else `PERMANENT_DELETE_BLOCKED` (409) with copy explaining the history-preservation policy. The FK `RESTRICT` constraints remain as the last line of defense; the explicit count check produces a meaningful error instead of a raw constraint failure.
- **Dangling references after permanent deletion are handled, not feared.** Permanent deletion of a category/account can only happen when no *non-deleted* record references it, but *deleted* transactions in trash may still reference it. Reads of such transactions resolve the name to null and the UI displays "unavailable" — never an error. This is specced explicitly because it's the one genuinely new failure mode.
- **Error code reuse**: restore flows surface the same codes (`ACCOUNT_NAME_TAKEN`, `CATEGORY_NAME_TAKEN`, `RESTORE_CONFLICT`, transition conflicts); the only new code is `PERMANENT_DELETE_BLOCKED`.
- **No schema changes**: reference counts come from the transaction/transfer repositories' existing count helpers (the same queries installed by the transactions change for locking); nothing new to migrate.
- **Nav**: `app-header.tsx` gains Archive and Trash entries; entity pages keep inline tabs — shared dialog/confirm components mean the unified pages add composition, not logic.
- **Balances can't change**: permanent delete only removes tombstoned rows, which contribute zero to every balance/report by the inclusion rules. Integration tests assert balances before/after permanent deletes of all four types.

## Risks / Trade-offs

- [Dangling references displaying "unavailable"] → Explicitly specced and tested; alternative (blocking permanent delete whenever even deleted records reference it) would make trash records permanent hoarders of tombstones and contradicts US-023.
- [Four parallel queries per unified page] → Trivial at single-user scale; a combined endpoint can be added later without UI changes since the tabs already fetch per type.
- [Permanent delete of accounts orphaning transfers] → Impossible for non-deleted referencers by the gate; deleted transfers referencing a permanently deleted account resolve names to null like transactions.
- [Users expecting archive→delete shortcuts] → The lifecycle state machine (already specced) forbids archived→deleted; the unified pages expose only legal actions.
