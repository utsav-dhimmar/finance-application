# Tasks

## 1. Permanent-delete endpoints (`server/api`)

- [ ] 1.1 Add `ErrorCode` value `PERMANENT_DELETE_BLOCKED` to `src/lib/error.ts`, and implement `DELETE /api/accounts/:id` and `DELETE /api/categories/:id` (permanent, valid only from `deleted` status, gated on zero non-deleted referencing transactions/transfers via the existing repository count helpers) in the existing route files, registered in the OpenAPI document. Verify `GET /api/openapi` includes both paths via the docs test — `pnpm --filter @finance-application/api test`.
- [ ] 1.2 Write route contract tests for both endpoints: 401 without session; 404 unknown id; 409 when status is not `deleted`; 409 `PERMANENT_DELETE_BLOCKED` when a non-deleted transaction/transfer references the record; 204 success when unreferenced, with the row physically gone from `sqlite_master`-level checks; balances and report totals unchanged after permanent deletion; a deleted transaction referencing a permanently deleted category reads without error. Verify — `pnpm --filter @finance-application/api test`.

## 2. Typed API client (`packages/api-client`)

- [ ] 2.1 Add `permanentlyDeleteAccount` and `permanentlyDeleteCategory` to `src/accounts.ts` / `src/categories.ts` over `apiFetch`, re-exported from the index. Verify with client tests asserting methods and error decoding — `pnpm --filter @finance-application/api-client test && pnpm --filter @finance-application/api-client typecheck`.

## 3. Unified Archive and Trash views (`apps/web`)

- [ ] 3.1 Create `src/routes/archive.tsx`: record-type tabs (Accounts, Categories, Transactions, Transfers) composing the existing per-entity list components in archived mode, each tab with loading/empty/error states, detail inspection (existing detail dialogs), and restore via the entity's existing restore flow (including rename-on-restore and reassignment conflict paths). Verify with route tests for tab rendering, states, and restore wiring — `pnpm --filter @finance-application/web test`.
- [ ] 3.2 Create `src/routes/trash.tsx`: record-type tabs composing the same components in deleted mode, with restore as above plus per-record permanent delete behind a typed-confirmation `AlertDialog`; ineligible (referenced) accounts/categories surface the `PERMANENT_DELETE_BLOCKED` conflict with explanatory copy; success/error toasts; lists refresh after every mutation. Verify with interaction tests covering confirm, cancel, blocked, and success paths — `pnpm --filter @finance-application/web test`.
- [ ] 3.3 Add Archive and Trash links to `app-header.tsx` and ensure all mutation hooks (accounts, categories, transactions, transfers) invalidate every affected query family so the unified views, entity pages, dashboard, and account balances stay consistent. Verify with hook tests asserting cross-family invalidation — `pnpm --filter @finance-application/web test`.

## 4. Cross-cutting exclusion verification (`server/api`)

- [ ] 4.1 Add an integration test suite asserting the exclusion guarantee across all record types: after archiving and soft-deleting one of each type, ordinary lists (active status), account lists/combined balance, transaction list, category list, transfer list, and the report summary contain none of the hidden records, while the `?status=archived` / `?status=deleted` endpoints contain exactly them. Verify — `pnpm --filter @finance-application/api test`.

## 5. Integration verification

- [ ] 5.1 Run the full monorepo gates and confirm all pass: `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`; confirm the OpenAPI document validates via the server docs test.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied (`/openspec-archive-change`), then verify the archived result.
- When the preferences epic is proposed, carry forward: the unified views' empty-state copy conventions and the cross-family invalidation pattern.
