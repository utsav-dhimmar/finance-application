# Tasks

## 1. Shared contracts (`packages/schemas`)

- [x] 1.1 Add `accounts.ts` with `accountTypeSchema` (`cash|bank|wallet`), lifecycle `accountStatusSchema` (`active|archived|deleted`), `amountMinorSchema` (strict integer paise), and `amountInputSchema` (decimal rupee string → integer paise via exact string parsing: reject more than 2 fraction digits, pad shorter ones, no float arithmetic). Verify with unit tests covering paise conversion edge cases (`.5` → 50, `1250.50` → 125050, `1250.505` rejected, non-numeric rejected, negative allowed) — `pnpm --filter @finance-application/schemas test`.
- [x] 1.2 Add `createAccountBodySchema`, `updateAccountBodySchema` (partial with same field rules), `restoreAccountBodySchema` (optional `newName`), `accountResponseSchema`, `accountListResponseSchema` (accounts + `combinedBalanceMinor`), inferring types with `z.infer`; export from the package index. Verify `pnpm --filter @finance-application/schemas test && pnpm --filter @finance-application/schemas typecheck`.

## 2. Database schema and migration (`server/api`)

- [x] 2.1 Add the `accounts` table to `src/db/schema.ts`: UUIDv7 text id, `user_id` FK to users (cascade), `name`, `name_normalized`, `type` CHECK (`cash|bank|wallet`), `opening_balance_minor` integer not null default 0, `status` CHECK (`active|archived|deleted`) default `active`, `archived_at`, `deleted_at`, `created_at`, `updated_at`; partial unique index `(user_id, name_normalized) WHERE status != 'deleted'` plus `(user_id, status)` index. Generate the migration with drizzle-kit; verify the generated SQL contains the partial-index `WHERE` clause and hand-edit the SQL file with an explicit statement if not. Verify by applying the migration to local D1 (`wrangler d1 migrations apply`) and inspecting `sqlite_master` for table and indexes.
- [x] 2.2 Confirm `pnpm --filter @finance-application/api typecheck` passes with the new schema and that existing server tests still pass.

## 3. Repository (`server/api`)

- [x] 3.1 Create `src/repositories/account-repository.ts` owning all Drizzle queries: insert (writing `name` and `name_normalized` from one normalization function), findById, listByStatus, update name/type/opening balance, update status with timestamps, count by status. Verify with repository integration tests in the workers test config: duplicate normalized name insert is rejected while both accounts are non-deleted, reuse succeeds after one is soft-deleted, and `name`/`name_normalized` co-write assertions — `pnpm --filter @finance-application/api test`.

## 4. Service layer (`server/api`)

- [x] 4.1 Export pure `computeCurrentBalance(openingBalanceMinor, postedTransactionsSumMinor)` from `src/services/account-service.ts` with a doc comment marking it as the single balance seam for the transactions epic. Verify with unit tests (zero-sum, positive-sum, negative result preserved as-is).
- [x] 4.2 Implement `account-service.ts`: create (normalize + uniqueness → `ACCOUNT_NAME_TAKEN`), get/list (balances via `computeCurrentBalance`, `combinedBalanceMinor` always over active accounts), update (uniqueness; field-lock via `hasPostedTransactions` stub returning `false` documented as the transactions-epic seam → `ACCOUNT_FIELD_LOCKED`; non-active account → `ACCOUNT_TRANSITION_INVALID`), and the lifecycle transition table `active→archived`, `active→deleted`, `archived→active`, `deleted→active` (anything else → `ACCOUNT_TRANSITION_INVALID`; restore applies optional `newName` atomically, conflict → `ACCOUNT_NAME_TAKEN`). Add the new codes to the `ErrorCode` union in `src/lib/error.ts`. Verify with service unit tests covering every error path and the full transition matrix — `pnpm --filter @finance-application/api test`.

## 5. API routes (`server/api`)

- [x] 5.1 Create `src/routes/accounts.ts` with `@hono/zod-openapi` route definitions layering OpenAPI metadata on the `packages/schemas` schemas (mirroring `routes/auth.ts`), mounting all seven endpoints behind `requireAuth`, registering new error responses, and wiring the module into `src/app.ts`. Verify `GET /api/openapi` includes the account paths via the existing docs test — `pnpm --filter @finance-application/api test`.
- [x] 5.2 Write route contract tests: 401 without session; 201 create with location-free body shape; 400 for each validation case (blank name, bad type, fractional paise); 409 duplicate name ignoring case; list returns only requested status with combined balance over active accounts (mixed-status fixture); 404 unknown id; PATCH rename success and rename conflict; PATCH locked-field and non-active 409s; archive/delete/restore happy paths; invalid-transition 409; restore 409 on reused name and success via `newName`. Verify — `pnpm --filter @finance-application/api test`.

## 6. Typed API client (`packages/api-client`)

- [x] 6.1 Add `src/accounts.ts` with typed functions `createAccount`, `listAccounts(status)`, `getAccount`, `updateAccount`, `archiveAccount`, `deleteAccount`, `restoreAccount` over `apiFetch`, re-exported from the index. Verify with client tests asserting paths, methods, bodies, and error-envelope decoding — `pnpm --filter @finance-application/api-client test && pnpm --filter @finance-application/api-client typecheck`.

## 7. UI primitives (`packages/ui`)

- [x] 7.1 Add the shadcn primitives this change needs (`dialog`, `alert-dialog`, `tabs`, `select`, `badge`, toast/`sonner`) using the existing `components.json` setup and `pnpm add` for any new package deps. Verify the package typechecks and builds — `pnpm --filter @finance-application/ui typecheck`.

## 8. Web service and hooks (`apps/web`)

- [ ] 8.1 Create `src/services/accounts-service.ts` (query options keyed `["accounts", status]`, mutation wrappers) and `src/hooks/use-accounts.ts` (`useAccounts(status)`, create/update/archive/delete/restore hooks invalidating account keys on success), plus a `formatPaise` display helper (integer paise → `₹` string, sign preserved). Verify with hook/service tests following `tests/hooks/use-auth.test.tsx` patterns (query keys, cache invalidation, error mapping) — `pnpm --filter @finance-application/web test`.

## 9. Accounts UI (`apps/web`)

- [x] 9.1 Build the `/accounts` route: combined-balance header ("across active accounts", Active tab only), Active/Archived/Trash tabs, account cards with name, type badge and balance, per-tab loading skeleton / empty / error-with-retry states, and an Accounts link in `app-header.tsx`. Verify with route tests for rendering states and tab filtering — `pnpm --filter @finance-application/web test`.
- [x] 9.2 Build the create-account dialog: react-hook-form + `zodResolver` on `createAccountBodySchema`, rupee-string opening-balance field, inline per-field errors, disabled/pending submit, success closes and refreshes the list. Verify with form tests (validation errors surface, valid submit calls the mutation) — `pnpm --filter @finance-application/web test`.
- [x] 9.3 Build the edit dialog for active accounts (name, type, opening balance; server-side lock 409s surface as inline form errors), reachable only from the Active tab. Verify with form tests including the 409 error path — `pnpm --filter @finance-application/web test`.
- [x] 9.4 Wire lifecycle actions: archive and delete with `AlertDialog` confirmations; restore from Archive/Trash tabs, including the name-conflict 409 path prompting for a new name (`newName` restore); success and error toasts; lists and combined balance refresh after every mutation. Verify with interaction tests covering confirm, cancel, and conflict paths — `pnpm --filter @finance-application/web test`.

## 10. Integration verification

- [x] 10.1 Run the full monorepo gates and confirm all pass: `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`; confirm the OpenAPI document still validates via the server docs test and review the final migration once more against the design's partial-index requirement.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied (`/openspec-archive-change`), then verify the archived result.
- When the transactions epic is proposed, carry forward: the `hasPostedTransactions` stub replacement, the field-lock enforcement, and opening-balance adjustment semantics.
