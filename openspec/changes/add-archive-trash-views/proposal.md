# Proposal

## Why

Every record type now has lifecycle endpoints and inline lifecycle tabs, but archive and trash management is scattered across four pages. Epic F of the approved backlog (`user-story/01-inital/05-archive-and-trash-management.md`, US-022–US-023) calls for dedicated, cross-record-type Archive and Trash management — one place to inspect, restore, or permanently remove hidden records, with validation that never corrupts balances or history.

## What Changes

- **Unified Archive page** (`apps/web`): dedicated navigation entry listing archived records of every type — accounts, categories, transactions, transfers — through record-type tabs, with detail inspection and restore (reusing each entity's existing restore flow, including rename-on-restore and reassignment conflict paths).
- **Unified Trash page** (`apps/web`): dedicated navigation entry listing soft-deleted records of every type, with detail inspection, restore, and per-record permanent deletion behind explicit typed confirmation.
- **Permanent-deletion eligibility rules** (confirmed with the product owner):
  - Transactions and transfers: permanent deletion is per-record with explicit confirmation (endpoints delivered by their own epics; surfaced here).
  - Accounts and categories: permanent deletion is allowed **only** when the record is in trash and nothing non-deleted references it (accounts: no non-deleted transactions or transfers reference them; categories: no non-deleted transactions reference them); otherwise the request is rejected with a conflict error explaining the history-preservation policy. This adds the two missing permanent-delete endpoints.
  - Permanent deletion is never automatic; no retention policy or auto-purge exists.
- **Exclusion guarantee verification**: ordinary lists, dashboards, and reports exclude archived/deleted records — already specced per entity; this change adds cross-cutting integration tests asserting it once, everywhere.
- **Explicitly deferred**: bulk selection/multi-restore, auto-purge/retention policies, audit log of permanent deletions.

## Capabilities

### New Capabilities

- `archive-trash`: Cross-record-type management of archived and deleted records — unified Archive and Trash views, inspection, validated restoration, and eligibility-gated permanent deletion that never corrupts balances or financial history.

### Modified Capabilities

(none — each entity's lifecycle behavior is already specified; this change adds the unified management surface and the two missing permanent-delete endpoints)

## Impact

- **`server/api`** — new `DELETE /api/accounts/:id` and `DELETE /api/categories/:id` (permanent, from deleted status only, reference-count gated); new `ErrorCode` value `PERMANENT_DELETE_BLOCKED`; account/transfer reference counts exposed through repositories; OpenAPI document extended; integration tests.
- **`packages/schemas`** — no new schemas beyond response types for the permanent-delete endpoints' errors; exported constants for eligibility if needed.
- **`packages/api-client`** — new `permanentlyDeleteAccount` and `permanentlyDeleteCategory` functions.
- **`apps/web`** — two new routes (`/archive`, `/trash`) with record-type tabs composing the existing per-entity components (cards, detail dialogs, restore dialogs, confirm dialogs); Archive and Trash links in `app-header.tsx`; entity pages keep their inline tabs (shared components, no duplicated logic).
- **`packages/ui`** — primitives reused; no new dependencies expected anywhere (`pnpm add` for any addition).
- **Database** — no schema changes.
