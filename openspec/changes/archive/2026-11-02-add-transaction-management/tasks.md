# Tasks

## 1. Shared contracts (`packages/schemas`)

- [x] 1.1 Add `transactions.ts` with `transactionTypeSchema` (`income|expense`), lifecycle `transactionStatusSchema` (`active|archived|deleted`), `transactionDateSchema` (`YYYY-MM-DD` with real-calendar-date refinement), `transactionAmountSchema` (positive integer paise), `createTransactionBodySchema` (client `id` UUIDv7, type, amountMinor, date, accountId, categoryId, optional notes), `updateTransactionBodySchema` (partial, no status), `restoreTransactionBodySchema` (optional `accountId`/`categoryId`), `transactionListQuerySchema` (from, to, type, accountId, categoryId, q, page, pageSize ≤ 100), `transactionResponseSchema`, and `transactionListResponseSchema` (transactions + page/pageSize/total), inferring types with `z.infer`; export from the package index. Verify with unit tests covering amount/date/id validation edges (zero, negative, fractional, `2026-02-30` rejected, non-UUID7 id rejected) — `pnpm --filter @finance-application/schemas test && pnpm --filter @finance-application/schemas typecheck`.

## 2. Database schema and migration (`server/api`)

- [x] 2.1 Add the `transactions` table to `src/db/schema.ts`: client-generated UUIDv7 text PK, `user_id` FK to users (cascade), `type` CHECK (`income|expense`), `amount_minor` positive integer, `date` text (`YYYY-MM-DD`), `account_id` FK to accounts (restrict), `category_id` FK to categories (restrict), nullable `notes`, `status` CHECK (`active|archived|deleted`) default `active`, `archived_at`, `deleted_at`, `created_at`, `updated_at`; indexes `(user_id, date DESC)`, `(user_id, account_id, date DESC)`, `(user_id, category_id)`, `(user_id, status, date DESC)`. Generate the migration with drizzle-kit and apply to local D1; verify table + indexes in `sqlite_master` and that typecheck passes — `pnpm --filter @finance-application/api typecheck`.
- [x] 2.2 Add `@tanstack/react-table` to `apps/web` via `pnpm add` if not already present. Verify installation and that the web app typechecks — `pnpm --filter @finance-application/web typecheck`.

## 3. Repository (`server/api`)

- [x] 3.1 Create `src/repositories/transaction-repository.ts` owning all Drizzle queries: insert, findById (with account/category joins for names), filtered+paginated list, sum of signed non-deleted effects per account, count queries, update fields, update status with timestamps, physical delete. Verify with repository integration tests in the workers test config: signed sums (income +, expense −, deleted excluded, archived included), filter combinations, and pagination math — `pnpm --filter @finance-application/api test`.

## 4. Service layer (`server/api`)

- [x] 4.1 Implement `transaction-service.ts`: idempotent create (eligibility checks account active, category active + compatible; PK-conflict replay → existing record), get, list, update (same eligibility on changed references; non-active transaction → conflict), lifecycle transitions (same table as accounts/categories → `TRANSACTION_TRANSITION_INVALID`), restore with deleted-target validation and optional reassignment (`RESTORE_CONFLICT`), and permanent delete (only from `deleted` status). Add new codes to the `ErrorCode` union in `src/lib/error.ts`. Verify with service unit tests covering every error path, the transition matrix, idempotent replay, and restore validation — `pnpm --filter @finance-application/api test`.
- [x] 4.2 Wire the balance engine: account-service `computeCurrentBalance` now receives the real signed sum from the transaction repository; replace the `hasPostedTransactions` stub with a real count query and `getReferencingTransactionCount` in the category repository with a real count query. Verify with integration tests: creating a transaction now locks the account's opening balance/type (409 `ACCOUNT_FIELD_LOCKED`) and its category's type (409 `CATEGORY_TYPE_LOCKED`); deleting/restoring the only transaction unlocks them — `pnpm --filter @finance-application/api test`.

## 5. API routes (`server/api`)

- [x] 5.1 Create `src/schemas/transactions.ts` (OpenAPI metadata wrappers mirroring `schemas/accounts.ts`) and `src/routes/transactions.ts` with `@hono/zod-openapi` routes: `POST /api/transactions` (201/200 replay), `GET /api/transactions` (filters + pagination), `GET /api/transactions/:id`, `PATCH /api/transactions/:id`, `POST /api/transactions/:id/archive|delete|restore`, `DELETE /api/transactions/:id` (permanent) — all behind `requireAuth`, wired into `src/app.ts`. Verify `GET /api/openapi` includes the transaction paths via the docs test — `pnpm --filter @finance-application/api test`.
- [x] 5.2 Write route contract tests: 401 without session; 201/200 idempotency pair; 400 validation cases (zero/negative/fractional amount, bad date); 409 ineligible account/category; 409 edit of archived; list filters (date range, type, account, category, search) and pagination envelope; archive keeps balance, delete reverses it, restore re-applies exactly once (assert via `GET /api/accounts` balances); restore blocked by deleted account and succeeds with reassignment; invalid-transition 409; permanent delete removes the row; cross-user isolation. Verify — `pnpm --filter @finance-application/api test`.

## 6. Typed API client (`packages/api-client`)

- [x] 6.1 Add `src/transactions.ts` with typed functions `createTransaction`, `listTransactions(query)`, `getTransaction`, `updateTransaction`, `archiveTransaction`, `deleteTransaction`, `restoreTransaction`, `permanentlyDeleteTransaction` over `apiFetch`, re-exported from the index. Verify with client tests asserting paths, methods, bodies, and error-envelope decoding — `pnpm --filter @finance-application/api-client test && pnpm --filter @finance-application/api-client typecheck`.

## 7. Web service and hooks (`apps/web`)

- [x] 7.1 Create `src/services/transactions-service.ts` (query options keyed `["transactions", filters]`, mutation wrappers, error-code-to-copy mapping) and `src/hooks/use-transactions.ts` (`useTransactions(filters)`, create/update/archive/delete/restore/permanent-delete hooks invalidating transaction keys AND account keys on success). Verify with hook/service tests following `tests/hooks/use-accounts.test.tsx` patterns — `pnpm --filter @finance-application/web test`.

## 8. Transactions UI (`apps/web`)

- [x] 8.1 Build the `/transactions` route shell: filter bar (date range, type, account, category selects fed by active accounts/categories, debounced search), TanStack Table with server-side pagination controls, per-state loading skeleton / empty / error-with-retry, and a Transactions link in `app-header.tsx`. Verify with route tests for rendering states and filter wiring — `pnpm --filter @finance-application/web test`.
- [x] 8.2 Build the create dialog: income/expense toggle, amount (rupee input via the shared paise parsing), date picker, account select (active only), category select (active + type-compatible, re-filtered when type or account changes), optional notes, inline per-field errors, pending state, idempotent UUIDv7 generation client-side. Verify with form tests (validation errors surface, eligibility filtering, valid submit calls the mutation) — `pnpm --filter @finance-application/web test`.
- [x] 8.3 Build the edit dialog (same fields, active transactions only) and the detail dialog (all fields, lifecycle badge, resolving archived/deleted references). Verify with form/render tests including the archived-edit rejection path — `pnpm --filter @finance-application/web test`.
- [x] 8.4 Wire lifecycle actions: archive and soft-delete with `AlertDialog` confirmations; restore from Archive/Trash tabs including the deleted-target conflict path prompting reassignment; permanent delete with typed confirmation; success/error toasts; transaction list and account balances refresh after every mutation. Verify with interaction tests covering confirm, cancel, conflict, and permanent-delete paths — `pnpm --filter @finance-application/web test`.

## 9. Integration verification

- [x] 9.1 Run the full monorepo gates and confirm all pass: `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`; confirm the OpenAPI document validates via the server docs test and re-read the migration against the design's index plan.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied (`/openspec-archive-change`), then verify the archived result.
- When the transfers epic is proposed, carry forward: the signed-effect SUM pattern, idempotent-create pattern, and account-key invalidation convention.
