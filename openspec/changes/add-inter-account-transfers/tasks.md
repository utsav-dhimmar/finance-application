# Tasks

## 1. Shared contracts (`packages/schemas`)

- [ ] 1.1 Add `transfers.ts` with `createTransferBodySchema` (client `id` UUIDv7, amountMinor positive integer, date, sourceAccountId, destinationAccountId, optional notes; same-account refinement), `updateTransferBodySchema` (partial, no status), `restoreTransferBodySchema` (optional `sourceAccountId`/`destinationAccountId`), `transferListQuerySchema` (from, to, accountId, q, page, pageSize ≤ 100), `transferResponseSchema` (with resolved account names), and `transferListResponseSchema` (transfers + page/pageSize/total); export from the package index. Verify with unit tests covering same-account, amount, and date edges — `pnpm --filter @finance-application/schemas test && pnpm --filter @finance-application/schemas typecheck`.

## 2. Database schema and migration (`server/api`)

- [ ] 2.1 Add the `transfers` table to `src/db/schema.ts`: client-generated UUIDv7 text PK, `user_id` FK to users (cascade), `source_account_id` FK to accounts (restrict), `destination_account_id` FK to accounts (restrict), `amount_minor` positive integer, `date` text (`YYYY-MM-DD`), nullable `notes`, `status` CHECK (`active|archived|deleted`) default `active`, `archived_at`, `deleted_at`, `created_at`, `updated_at`; indexes `(user_id, date DESC)`, `(user_id, source_account_id, date DESC)`, `(user_id, destination_account_id, date DESC)`, `(user_id, status, date DESC)`. Generate the migration with drizzle-kit, apply to local D1, verify table + indexes in `sqlite_master`, and confirm typecheck — `pnpm --filter @finance-application/api typecheck`.

## 3. Repository (`server/api`)

- [ ] 3.1 Create `src/repositories/transfer-repository.ts` owning all Drizzle queries: insert, findById (with both account joins for names), filtered+paginated list, per-account signed transfer sums (out as source, in as destination, deleted excluded), count queries, update fields, update status with timestamps, physical delete. Verify with repository integration tests: signed sums per side, deleted excluded / archived included, filter combinations, pagination math — `pnpm --filter @finance-application/api test`.

## 4. Balance engine and service (`server/api`)

- [ ] 4.1 Extend the account balance computation to include transfer sums from the transfer repository (one seam, single ownership unchanged), and implement `transfer-service.ts`: idempotent create (distinct active accounts; PK-conflict replay → existing record), get, list, update (same eligibility; non-active transfer → conflict), lifecycle transitions → `TRANSFER_TRANSITION_INVALID`, restore with deleted-target validation and optional reassignment (`RESTORE_CONFLICT`), permanent delete (only from `deleted` status). Add new codes to the `ErrorCode` union in `src/lib/error.ts`. Verify with service unit tests covering every error path, the transition matrix, and replay — `pnpm --filter @finance-application/api test`.
- [ ] 4.2 Implement the unified activity query (account-scoped transactions `UNION ALL` transfer sides with direction tags, merged count, pagination) in a repository helper. Verify with integration tests: a transfer appears in both accounts' histories with correct direction; category filters exclude transfers; pagination over mixed fixtures is stable — `pnpm --filter @finance-application/api test`.

## 5. API routes (`server/api`)

- [ ] 5.1 Create `src/schemas/transfers.ts` (OpenAPI metadata wrappers) and `src/routes/transfers.ts` with `@hono/zod-openapi` routes: `POST /api/transfers` (201/200 replay), `GET /api/transfers`, `GET /api/transfers/:id`, `PATCH /api/transfers/:id`, `POST /api/transfers/:id/archive|delete|restore`, `DELETE /api/transfers/:id` (permanent), plus the activity endpoint for account history — all behind `requireAuth`, wired into `src/app.ts`. Verify `GET /api/openapi` includes the new paths via the docs test — `pnpm --filter @finance-application/api test`.
- [ ] 5.2 Write route contract tests: 401 without session; 201/200 idempotency pair; 400 validation cases; 409 same-account and ineligible-account; balances via `GET /api/accounts` decrease/increase exactly once on create, are unchanged on archive, reverse on delete, re-apply exactly once on restore; edit-both-sides rebalancing; restore blocked by deleted account and succeeds with reassignment; invalid-transition 409; permanent delete; cross-user isolation. Verify — `pnpm --filter @finance-application/api test`.

## 6. Typed API client (`packages/api-client`)

- [ ] 6.1 Add `src/transfers.ts` with typed functions `createTransfer`, `listTransfers(query)`, `getTransfer`, `updateTransfer`, `archiveTransfer`, `deleteTransfer`, `restoreTransfer`, `permanentlyDeleteTransfer` over `apiFetch`, re-exported from the index. Verify with client tests asserting paths, methods, bodies, and error-envelope decoding — `pnpm --filter @finance-application/api-client test && pnpm --filter @finance-application/api-client typecheck`.

## 7. Web service and hooks (`apps/web`)

- [ ] 7.1 Create `src/services/transfers-service.ts` (query options keyed `["transfers", filters]`, mutation wrappers, error-code-to-copy mapping) and `src/hooks/use-transfers.ts` (`useTransfers(filters)`, create/update/archive/delete/restore/permanent-delete hooks invalidating transfer keys AND account keys on success). Verify with hook/service tests following the established patterns — `pnpm --filter @finance-application/web test`.

## 8. Transfers UI (`apps/web`)

- [ ] 8.1 Add the create-transfer dialog (source/destination selects fed by active accounts with same-account validation, amount via shared paise parsing, date, notes, client UUIDv7 generation) reachable from the transactions page header; transfer rows in the history view with direction badges ("in"/"out"), lifecycle badges, and detail view; filters extend with a transfer-aware type option. Verify with form and render tests (validation, same-account rejection, direction display) — `pnpm --filter @finance-application/web test`.
- [ ] 8.2 Build the edit dialog for active transfers (both sides editable with eligibility) and wire lifecycle actions: archive/soft-delete with `AlertDialog` confirmations, restore including the deleted-target conflict path prompting reassignment, permanent delete with typed confirmation; success/error toasts; list and account balances refresh after every mutation. Verify with interaction tests covering confirm, cancel, conflict, and permanent-delete paths — `pnpm --filter @finance-application/web test`.

## 9. Integration verification

- [ ] 9.1 Run the full monorepo gates and confirm all pass: `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`; confirm the OpenAPI document validates via the server docs test and re-read the migration against the design's index plan.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied (`/openspec-archive-change`), then verify the archived result.
- When the reporting epic is proposed, carry forward: the signed-sum helpers for transactions and transfers (income/expense totals must exclude transfers), and the activity feed as the dashboard's recent-activity source.
