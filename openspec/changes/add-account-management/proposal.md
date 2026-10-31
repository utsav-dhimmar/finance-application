# Proposal

## Why

Authentication and the frontend shell are complete, but the application has no financial functionality. Account management is the first epic of the approved product backlog (`user-story/01-inital/01-account-management.md`, US-001–US-004) and the foundation every later feature — transactions, transfers, budgets, reports — references. Until accounts exist, the app cannot track money at all.

## What Changes

- **New `accounts` table** (D1 + Drizzle migration): UUIDv7 id, `user_id` scoping, name, type (`cash` | `bank` | `wallet`), `opening_balance_minor` in paise (integer), lifecycle status (`active` | `archived` | `deleted`) with transition timestamps, audit timestamps.
- **Account REST API** (authenticated, OpenAPI-documented): create, list with current balances and a combined balance, get one, edit, archive, soft-delete (trash), restore. All responses use the existing error envelope; all inputs validated with Zod.
- **Shared contracts**: plain-Zod account schemas in `packages/schemas` (single source of truth, reused by web forms and the future mobile client) and typed endpoint functions in `packages/api-client`.
- **Web UI** (`apps/web`): Accounts page with Active / Archived / Trash tabs, combined-balance summary, create and edit dialogs (react-hook-form + shared schemas), archive/delete with confirmation dialogs, restore actions, and loading / empty / error / success states.
- **Explicit product policies** (confirmed with the product owner):
  - Account names are case-insensitively unique among non-deleted accounts; a deleted account's name can be reused.
  - Opening balance is stored as a column on the account, not as a transaction; account creation never creates income/expense records.
  - Opening balance and account type become locked once the account has any posted transactions; until then both are editable. (With this change, no transactions exist yet.)
  - Archiving and soft-deleting are allowed regardless of balance, with explicit confirmation; both are reversible; transactions are never cascade-affected.
  - Single-currency: INR with amounts in paise; accounts carry no per-account currency in this change.
  - Negative balances are permitted and displayed as-is.
- **Explicitly deferred**: US-005 (per-account transaction history view) moves to the transactions/transfers epics, which own the records it displays. No permanent-deletion flow (no approved retention policy). Per-account currencies and display preferences (color/icon/order) come with the preferences story.

## Capabilities

### New Capabilities

- `accounts`: Owning, viewing, and maintaining financial accounts — creation, editing, balances, and the active/archived/deleted lifecycle, including the rules that keep balances and history consistent.

### Modified Capabilities

(none)

## Impact

- **`server/api`** — new `accounts` Drizzle table + migration; new `routes/accounts.ts`, `services/account-service.ts`, `repositories/account-repository.ts`, `schemas/accounts.ts`; new `ErrorCode` values; route registration and OpenAPI document extended; unit + contract tests (Vitest, incl. `@cloudflare/vitest-plugin` workers config if the existing suite pattern requires it).
- **`packages/schemas`** — new `accounts.ts` (types, create/update bodies, account response, list response, lifecycle enums); exported from the package index.
- **`packages/api-client`** — new `accounts.ts` typed functions over `apiFetch`; no new dependencies.
- **`apps/web`** — new `/accounts` route (list + tabs), create/edit dialogs, lifecycle mutation hooks via TanStack Query, new service module `services/accounts-service.ts`; sidebar/header navigation gains an Accounts entry; new UI states and tests.
- **Database** — one additive migration creating the `accounts` table (no destructive changes; no changes to existing tables).
- **Dependencies** — none expected; all needed libraries (react-hook-form, zod resolvers, TanStack Query, shadcn primitives) are already installed. Any addition must go through `pnpm add`.
