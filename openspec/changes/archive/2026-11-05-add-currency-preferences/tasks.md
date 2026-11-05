# Tasks

## 1. Shared contracts (`packages/schemas`)

- [x] 1.1 Add `preferences.ts` with the supported display-currency union (initially `INR` only), `currencyCodeSchema`, `preferencesResponseSchema` (`currencyCode`, `currencySymbol`, `minorUnitExponent`), and `updatePreferencesBodySchema`; export from the package index. Verify with unit tests covering the code validation and response shape — `pnpm --filter @finance-application/schemas test && pnpm --filter @finance-application/schemas typecheck`.

## 2. Database schema and migration (`server/api`)

- [x] 2.1 Add the `user_preferences` table to `src/db/schema.ts`: `user_id` text PK FK to users (cascade), `currency_code` text not null default `'INR'` CHECK against the supported union, `created_at`, `updated_at`. Generate the migration with drizzle-kit, apply to local D1, verify in `sqlite_master`, and confirm typecheck — `pnpm --filter @finance-application/api typecheck`.

## 3. Registry, repository, and service (`server/api`)

- [x] 3.1 Create `src/lib/currency-registry.ts` (code → symbol + minor-unit exponent, INR only) importing the supported-code union from `packages/schemas`, `src/repositories/preference-repository.ts` (read with insert-or-ignore default, upsert), and `src/preference-service.ts` naming per existing convention (`services/preference-service.ts`): read (lazily defaulted, response resolving registry metadata) and update (`UNSUPPORTED_CURRENCY` validation). Add the new code to the `ErrorCode` union in `src/lib/error.ts`. Verify with service unit tests covering default creation, update, and unsupported-code rejection — `pnpm --filter @finance-application/api test`.

## 4. API routes (`server/api`)

- [x] 4.1 Create `src/schemas/preferences.ts` (OpenAPI metadata wrappers) and `src/routes/preferences.ts` with `@hono/zod-openapi` routes `GET /api/preferences` and `PATCH /api/preferences` behind `requireAuth`, wired into `src/app.ts`. Verify `GET /api/openapi` includes the preference paths via the docs test — `pnpm --filter @finance-application/api test`.
- [x] 4.2 Write route contract tests: 401 without session; GET returns defaults for a fresh user and creates exactly one row; PATCH happy path persists; 400 for unsupported currency and unknown/blank fields; no financial record (accounts/transactions/transfers/categories) is modified by any preference operation (assert snapshots). Verify — `pnpm --filter @finance-application/api test`.

## 5. Typed API client (`packages/api-client`)

- [x] 5.1 Add `src/preferences.ts` with typed functions `getPreferences` and `updatePreferences` over `apiFetch`, re-exported from the index. Verify with client tests asserting paths, methods, bodies, and error decoding — `pnpm --filter @finance-application/api-client test && pnpm --filter @finance-application/api-client typecheck`.

## 6. Currency-aware formatting (`apps/web`)

- [x] 6.1 Refactor `src/lib/money.ts` to `formatMinorUnits(minor, currency)` deriving fraction digits from the exponent (pure integer arithmetic), keeping `formatPaise` as an INR-defaulted wrapper so existing call sites are unchanged; generalize `paiseToRupeeInput` the same way. Verify existing money tests pass unmodified plus new tests for exponent-derived digits — `pnpm --filter @finance-application/web test`.

## 7. Web service, hooks, and Settings UI (`apps/web`)

- [x] 7.1 Create `src/services/preferences-service.ts` (query options keyed `["preferences"]`, mutation wrapper, error-code-to-copy mapping) and `src/hooks/use-preferences.ts` (`usePreferences`, `useUpdatePreferences` invalidating the preferences key). Verify with hook/service tests — `pnpm --filter @finance-application/web test`.
- [x] 7.2 Build the `/settings` route: preferences card with the currency select (options from the shared supported union), react-hook-form + `zodResolver` on `updatePreferencesBodySchema`, pending state, success/error toasts, loading/error/empty states, and a Settings link in `app-header.tsx`. Verify with route and form tests including the unsupported-currency 400 path — `pnpm --filter @finance-application/web test`.

## 8. Integration verification

- [x] 8.1 Run the full monorepo gates and confirm all pass: `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`; confirm the OpenAPI document validates via the server docs test.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied (`/openspec-archive-change`), then verify the archived result. This is the final epic of `user-story/01-inital`; on archive, the initial user story's implementation is complete (integration testing, security review, and deployment validation per main.md step 10 remain as project-level follow-ups).
