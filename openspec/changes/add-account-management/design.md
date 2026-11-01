# Design

## Context

The server already establishes the patterns this change follows (see `refactor-auth-architecture`): thin `@hono/zod-openapi` route controllers → service (business rules) → repository (Drizzle queries), a shared error envelope with typed `ErrorCode`s and a `validationHook`, `requireAuth` middleware resolving `c.get("user")`, ISO-8601 UTC text timestamps, UUIDv7 ids via `lib/uuid.ts`, and drizzle-kit migrations in `server/api/migrations/`. `packages/schemas` holds plain-Zod contracts (types via `z.infer`), `packages/api-client` wraps `apiFetch`, and `apps/web` consumes both through a services layer plus TanStack Query hooks. Existing UI primitives in `packages/ui`: button, card, field, input, label, separator.

The product policies in this change (uniqueness rule, opening-balance storage, nonzero-balance deletion, US-005 deferral) were confirmed with the product owner — see proposal.md.

## Goals / Non-Goals

**Goals:**

- Establish the `accounts` table and the balance formula (`opening + Σ posted balance-affecting transactions`) at a single seam the transactions epic will plug into.
- Enforce the lifecycle state machine and uniqueness invariant in the database and the service, not just the UI.
- Keep the API contract mobile-ready: plain-Zod schemas in `packages/schemas`, typed client in `packages/api-client`, no web-only assumptions.

**Non-Goals:**

- US-005 transaction-history view; `transactions`/`transfers` schema (owned by later epics).
- Permanent deletion / retention policy; per-account currency; display preferences (color, icon, order); app-wide Trash/Archive shell (this change provides account-scoped tabs only).
- Idempotency-key machinery (see Decisions).

## Decisions

### 1. Opening balance is a column on `accounts`

`opening_balance_minor` lives on the account row. Balance computation is `openingBalanceMinor + Σ(balance-affecting posted transactions)` — a pure function over a transaction sum the service passes in; today that sum is always 0.

*Alternative rejected:* an `opening_balance` transaction row created on account creation. It would couple this epic to the not-yet-designed transactions schema, make creation a two-record write, and blur the "no income/expense side effects" rule. Opening-balance *adjustments* after history exists become explicit balance-adjustment transactions — semantics the transactions epic will define (main.md defers them there).

### 2. Current balance is computed on read, not materialized

No `current_balance` column. With no transactions, a materialized column would just mirror `opening_balance_minor` and create a second source of truth. The transactions epic can denormalize into a running column later via a migration without changing the API contract.

*Alternative rejected:* `current_balance_minor` maintained transactionally — premature optimization with drift risk.

### 3. Lifecycle: single `status` column + transition table

`status TEXT NOT NULL CHECK (status IN ('active','archived','deleted'))` with nullable `archived_at` / `deleted_at`. The service owns the transition table: `active→archived`, `active→deleted`, `archived→active`, `deleted→active`; anything else is a conflict (409). One status column cannot represent two states at once, satisfying main.md §3.3.

*Alternative rejected:* `is_archived` / `is_deleted` flags — allow inconsistent combinations and make queries error-prone.

### 4. Case-insensitive uniqueness via normalized column + partial unique index

`name_normalized` (trim + lowercase, maintained on every write alongside `name`) with a **partial** unique index `CREATE UNIQUE INDEX accounts_user_name_unique ON accounts (user_id, name_normalized) WHERE status != 'deleted'`. Drizzle supports `.where()` on unique indexes.

- Deleted names are reusable (confirmed policy); archived names still block because an archived account can be restored and must not collide on restore.
- *Alternative rejected:* expression index on `lower(name)` — drizzle-kit's expression-index generation is fragile; an explicit column is portable and inspectable.
- Note: `lower()` case-folds ASCII only; Devanagari names are unaffected by casing, so uniqueness is exact-match for them. Accepted.

### 5. Restore-vs-name-conflict policy

Restoring an archived/deleted account whose (normalized) name is now taken by a non-deleted account is rejected with a name-conflict error. To keep a path forward, the restore endpoint accepts an optional `newName` that (if provided) is applied atomically as part of the restore, subject to normal uniqueness validation. Auto-renaming was rejected because it silently changes user data.

### 6. Field-lock rule is server-side and stubbed at one seam

`PATCH` rejects `openingBalanceMinor` / `type` changes when the account has ≥ 1 posted transaction. No transactions table exists yet, so the service exposes `hasPostedTransactions(accountId)` returning `false` (vacuously true condition today — no transactions exist at all). The transactions epic replaces this stub with the real query. The API contract, error path, and tests exist from day one so the epic only swaps an implementation, not a contract.

### 7. API surface (contract)

| Method | Path | Success | Errors |
|---|---|---|---|
| `POST` | `/api/accounts` | 201 account | 400 validation, 409 name taken |
| `GET` | `/api/accounts?status=active\|archived\|deleted` | 200 `{ accounts, combinedBalanceMinor }` | 400 bad status |
| `GET` | `/api/accounts/:id` | 200 account | 404 |
| `PATCH` | `/api/accounts/:id` | 200 account | 400, 404, 409 name taken / field locked / non-active |
| `POST` | `/api/accounts/:id/archive` | 200 account | 404, 409 invalid transition |
| `POST` | `/api/accounts/:id/delete` | 200 account | 404, 409 invalid transition |
| `POST` | `/api/accounts/:id/restore` (optional body `{ newName? }`) | 200 account | 404, 409 invalid transition / name taken |

Account response: `{ id, name, type, openingBalanceMinor, currentBalanceMinor, status, archivedAt, deletedAt, createdAt, updatedAt }`. `combinedBalanceMinor` always sums **active** accounts regardless of the `status` filter. New `ErrorCode` constants (`ACCOUNT_NAME_TAKEN`, `ACCOUNT_TRANSITION_INVALID`, `ACCOUNT_FIELD_LOCKED`) are added to the union in `lib/error.ts` and mirrored in the OpenAPI responses. All routes mount behind `requireAuth`.

*Alternative rejected:* `DELETE /api/accounts/:id` for soft-delete — reserves the verb for future permanent deletion; an explicit `/delete` action keeps the two operations distinct.

### 8. Money handling

`packages/schemas` owns: `accountTypeSchema` (enum), `amountMinorSchema` (strict integer), and `amountInputSchema` — a decimal-string input (rupees) transformed to integer paise via exact string parsing (split on `.`; pad/truncate to exactly 2 fraction digits; reject > 2 decimals). Float arithmetic (`Number(s) * 100`) is forbidden — `1250.50 * 100 = 125049.999…`. Display formatting (paise → `₹1,250.50`) is a small web-local helper for now; it moves to a shared package when Android needs it.

### 9. Web structure

- `services/accounts-service.ts` — query options (`["accounts", status]` keys) + mutation wrappers over the api-client.
- `hooks/use-accounts.ts` — `useAccounts(status)`, `useCreateAccount`, `useUpdateAccount`, `useArchiveAccount`, `useDeleteAccount`, `useRestoreAccount` (TanStack Query; mutations invalidate the accounts keys).
- `/accounts` route — combined-balance header; Tabs (Active / Archived / Trash); account cards (name, type badge, balance); create/edit `Dialog` forms via react-hook-form + `zodResolver` on the shared schemas; `AlertDialog` confirmations for archive/delete; restore (with rename prompt on name conflict); loading skeletons, empty states per tab, error state with retry, success toasts.
- `packages/ui` gains the needed shadcn primitives (`dialog`, `alert-dialog`, `tabs`, `select`, `badge`, `sonner` or equivalent toast) via the shadcn CLI, following the existing components.json setup.
- Header navigation gains an Accounts link.

### 10. Idempotency deferred, with a stated reason

Account creation is protected against retry duplicates by the unique-name constraint (a retried identical create fails with a conflict instead of duplicating). Idempotency-key machinery is introduced by the transactions epic, where duplicate mutations cost money. Recorded here so the omission is a decision, not an oversight.

## Risks / Trade-offs

- [drizzle-kit mis-generating the partial unique index] → Verify the generated SQL in migration review; if wrong, hand-edit the migration file with an explicit `CREATE UNIQUE INDEX ... WHERE` statement and note why.
- [Balance seam forgotten by the transactions epic, which recomputes balances ad hoc] → Single exported `computeCurrentBalance(openingMinor, postedSumMinor)` + unit tests documenting the contract; referenced in the epic's design.
- [Lock-rule stub (`hasPostedTransactions`) never replaced] → Explicit doc-comment + this design; the transactions epic's tasks must include wiring the real check (no transaction may be created against a locked-field change path).
- [`name` / `name_normalized` drift] → One normalization function, applied in the repository on every insert/update; repo tests assert both columns.
- [Restore conflicts with a reused name frustrate users] → Explicit 409 + optional `newName` restore flow surfaces the conflict immediately with a path forward.
- [Combined balance semantics (active-only) may surprise users with archived accounts] → The accounts page shows the combined total only on the Active tab, labeled as "across active accounts".

## Migration Plan

1. `drizzle-kit generate` → `0001_add_accounts.sql` (additive `CREATE TABLE` + indexes only).
2. Apply to local D1 via wrangler in dev; verify indexes exist (`sqlite_master`).
3. Rollback before release = drop the table (no user data exists yet). After release, standard additive-migration care applies; no destructive statements are involved.

## Open Questions

None — product policies were confirmed with the product owner before this design (see proposal.md "Explicit product policies").
