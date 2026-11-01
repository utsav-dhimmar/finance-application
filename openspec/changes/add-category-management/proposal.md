# Proposal

## Why

Accounts exist but cannot organize money yet. Categories are the next epic of the approved backlog (`user-story/01-inital/04-category-management.md`, US-017–US-019) and a hard prerequisite for the transactions epic: every income/expense transaction must reference a compatible active category. Building categories first follows the backlog's implementation order and lets the transaction change consume finished contracts.

## What Changes

- **New `categories` table** (D1 + Drizzle migration): UUIDv7 id, `user_id` scoping, name, `name_normalized`, type (`income` | `expense`), optional presentation fields (color, icon), lifecycle status (`active` | `archived` | `deleted`) with transition timestamps, audit timestamps.
- **Category REST API** (authenticated, OpenAPI-documented): create, list, get one, edit, archive, soft-delete (trash), restore — mirroring the accounts endpoints' shape and error envelope.
- **Shared contracts**: plain-Zod category schemas in `packages/schemas` and typed endpoint functions in `packages/api-client`.
- **Web UI** (`apps/web`): Categories page with Active / Archived / Trash tabs, create and edit dialogs, archive/delete confirmations, restore actions (including rename-on-restore), and loading / empty / error states; navigation entry.
- **Explicit product policies** (confirmed with the product owner):
  - Category names are case-insensitively unique among the user's non-deleted categories **across both types** (an income "Salary" blocks an expense "salary"); a deleted category's name is reusable; restore resolves name conflicts by explicitly providing a new name.
  - Changing a category's type (income ↔ expense) is rejected with a conflict error while any non-deleted transaction references it. No transactions exist in this change, so the guard is installed with a referencing-count seam (always 0) that the transactions epic wires up.
  - Archived and deleted categories are excluded from new-transaction selection but their records are never cascade-modified; historical transaction references will resolve by id (no snapshot rewriting).
  - Category creation never creates any other financial record.
- **Explicitly deferred**: category usage counts and per-category report figures (reporting epic); default/seed category sets (no hardcoded list is required by the backlog).

## Capabilities

### New Capabilities

- `categories`: Owning and maintaining income/expense categories — creation, editing, presentation, and the active/archived/deleted lifecycle, with uniqueness and history-preservation rules that keep transaction organization consistent.

### Modified Capabilities

(none)

## Impact

- **`server/api`** — new `categories` Drizzle table + migration; new `routes/categories.ts`, `services/category-service.ts`, `repositories/category-repository.ts`, `schemas/categories.ts`; new `ErrorCode` values (`CATEGORY_NAME_TAKEN`, `CATEGORY_TRANSITION_INVALID`, `CATEGORY_TYPE_LOCKED`); route registration and OpenAPI document extended; unit + workers integration tests. Small refactor: extract the shared name-normalization helper so accounts and categories reuse it (no behavior change).
- **`packages/schemas`** — new `categories.ts` (type/status enums, create/update/restore bodies, response schemas, form schema with presentation fields); exported from the package index.
- **`packages/api-client`** — new `src/categories.ts` typed functions over `apiFetch`; no new dependencies.
- **`apps/web`** — new `/categories` route (tabs + cards), create/edit dialogs, lifecycle mutation hooks via TanStack Query keyed `["categories", status]`; navigation gains a Categories entry.
- **`packages/ui`** — only primitives already added for accounts (dialog, alert-dialog, tabs, select, badge, input, sonner) are reused; a color input uses native controls.
- **Database** — one additive migration creating the `categories` table; no changes to existing tables.
- **Dependencies** — none expected; any addition must go through `pnpm add`.
