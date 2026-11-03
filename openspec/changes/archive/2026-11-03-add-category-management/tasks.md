# Tasks

## 1. Shared contracts (`packages/schemas`)

- [x] 1.1 Add `categories.ts` with `categoryTypeSchema` (`income|expense`), lifecycle `categoryStatusSchema` (`active|archived|deleted`), `categoryColorSchema` (`#RRGGBB` hex string), `categoryIconSchema` (bounded Lucide icon-name string), `CATEGORY_NAME_MAX_LENGTH` (reuse the accounts value), `createCategoryBodySchema`, `updateCategoryBodySchema` (partial with same field rules), `restoreCategoryBodySchema` (optional `newName`), `categoryResponseSchema`, and `categoryListResponseSchema`, inferring types with `z.infer`; export from the package index. Verify with unit tests covering name/color/icon validation edges (blank name, oversized name, bad hex, oversized icon) — `pnpm --filter @finance-application/schemas test && pnpm --filter @finance-application/schemas typecheck`.

## 2. Database schema and migration (`server/api`)

- [x] 2.1 Add the `categories` table to `src/db/schema.ts`: UUIDv7 text id, `user_id` FK to users (cascade), `name`, `name_normalized`, `type` CHECK (`income|expense`), nullable `color`, nullable `icon`, `status` CHECK (`active|archived|deleted`) default `active`, `archived_at`, `deleted_at`, `created_at`, `updated_at`; partial unique index `(user_id, name_normalized) WHERE status != 'deleted'` plus `(user_id, status)` index. Generate the migration with drizzle-kit; verify the generated SQL contains the partial-index `WHERE` clause and hand-edit the SQL file with an explicit statement if not. Verify by applying the migration to local D1 (`wrangler d1 migrations apply`) and inspecting `sqlite_master` for table and indexes.
- [x] 2.2 Confirm `pnpm --filter @finance-application/api typecheck` passes with the new schema and that existing server tests still pass.

## 3. Shared normalization refactor (`server/api`)

- [x] 3.1 Extract the account name-normalization function into `src/lib/name-normalization.ts` and update `account-repository.ts` to import it with zero behavior change; the new category repository will consume the same helper. Verify the full existing server suite passes unchanged — `pnpm --filter @finance-application/api test`.

## 4. Repository (`server/api`)

- [x] 4.1 Create `src/repositories/category-repository.ts` owning all Drizzle queries: insert (writing `name` and `name_normalized` via the shared normalization helper), findById, listByStatus, update name/type/color/icon, update status with timestamps, `getReferencingTransactionCount` stub returning 0 (doc comment: transactions epic implements it). Verify with repository integration tests in the workers test config: duplicate normalized name insert is rejected across types while both categories are non-deleted, reuse succeeds after one is soft-deleted, and `name`/`name_normalized` co-write assertions — `pnpm --filter @finance-application/api test`.

## 5. Service layer (`server/api`)

- [x] 5.1 Implement `category-service.ts`: create (normalize + cross-type uniqueness → `CATEGORY_NAME_TAKEN`), get/list, update (uniqueness; type change guarded by `getReferencingTransactionCount` > 0 → `CATEGORY_TYPE_LOCKED`; non-active category → `CATEGORY_TRANSITION_INVALID`), and the lifecycle transition table `active→archived`, `active→deleted`, `archived→active`, `deleted→active` (anything else → `CATEGORY_TRANSITION_INVALID`; restore applies optional `newName` atomically, conflict → `CATEGORY_NAME_TAKEN`). Add the new codes to the `ErrorCode` union in `src/lib/error.ts`. Verify with service unit tests covering every error path and the full transition matrix, including injected referencing counts 0 and 1 for the type-lock guard — `pnpm --filter @finance-application/api test`.

## 6. API routes (`server/api`)

- [x] 6.1 Create `src/schemas/categories.ts` (OpenAPI metadata wrappers over the shared package schemas, mirroring `schemas/accounts.ts`) and `src/routes/categories.ts` with `@hono/zod-openapi` route definitions for all seven endpoints behind `requireAuth`, registering the new error responses, and wiring the module into `src/app.ts`. Verify `GET /api/openapi` includes the category paths via the existing docs test — `pnpm --filter @finance-application/api test`.
- [x] 6.2 Write route contract tests: 401 without session; 201 create body shape; 400 for each validation case (blank name, bad type, bad hex color); 409 duplicate name ignoring case including the cross-type case; list returns only requested status; 404 unknown id; PATCH rename success and conflict; PATCH type change on unused category and non-active 409s; archive/delete/restore happy paths; invalid-transition 409; restore 409 on reused name and success via `newName`. Verify — `pnpm --filter @finance-application/api test`.

## 7. Typed API client (`packages/api-client`)

- [x] 7.1 Add `src/categories.ts` with typed functions `createCategory`, `listCategories(status)`, `getCategory`, `updateCategory`, `archiveCategory`, `deleteCategory`, `restoreCategory` over `apiFetch`, re-exported from the index. Verify with client tests asserting paths, methods, bodies, and error-envelope decoding — `pnpm --filter @finance-application/api-client test && pnpm --filter @finance-application/api-client typecheck`.

## 8. Web service and hooks (`apps/web`)

- [x] 8.1 Create `src/services/categories-service.ts` (query options keyed `["categories", status]`, mutation wrappers, error-code-to-copy mapping) and `src/hooks/use-categories.ts` (`useCategories(status)`, create/update/archive/delete/restore hooks invalidating category keys on success). Verify with hook/service tests following `tests/hooks/use-accounts.test.tsx` patterns — `pnpm --filter @finance-application/web test`.

## 9. Categories UI (`apps/web`)

- [x] 9.1 Build the `/categories` route: Active/Archived/Trash tabs, category cards with name, type badge, and color/icon presentation, per-tab loading skeleton / empty / error-with-retry states, and a Categories link in `app-header.tsx`. Verify with route tests for rendering states and tab filtering — `pnpm --filter @finance-application/web test`.
- [x] 9.2 Build the create-category dialog: react-hook-form + `zodResolver` on `createCategoryBodySchema`, type select, optional color and icon inputs, inline per-field errors, disabled/pending submit, success closes and refreshes the list. Verify with form tests (validation errors surface, valid submit calls the mutation) — `pnpm --filter @finance-application/web test`.
- [x] 9.3 Build the edit dialog for active categories (name, type, color, icon; `CATEGORY_TYPE_LOCKED` and name-conflict 409s surface as inline form errors), reachable only from the Active tab. Verify with form tests including the 409 error path — `pnpm --filter @finance-application/web test`.
- [x] 9.4 Wire lifecycle actions: archive and delete with `AlertDialog` confirmations; restore from Archive/Trash tabs, including the name-conflict 409 path prompting for a new name (`newName` restore); success and error toasts; lists refresh after every mutation. Verify with interaction tests covering confirm, cancel, and conflict paths — `pnpm --filter @finance-application/web test`.

## 10. Integration verification

- [x] 10.1 Run the full monorepo gates and confirm all pass: `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`; confirm the OpenAPI document still validates via the server docs test and review the final migration once more against the design's partial-index requirement.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied (`/openspec-archive-change`), then verify the archived result.
- When the transactions epic is proposed, carry forward: the `getReferencingTransactionCount` seam replacement, compatible-type category selection, and the shared normalization helper.
