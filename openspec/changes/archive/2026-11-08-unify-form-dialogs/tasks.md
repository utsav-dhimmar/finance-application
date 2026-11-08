# Tasks

## 1. Unified Account Form Dialog

- [x] 1.1 Implement `AccountFormDialog` in `apps/web/src/components/accounts/account-form-dialog.tsx` supporting both create and edit modes, form reset on open/entity change, and dynamic lock description, and verify by running targeted account component tests.
- [x] 1.2 Update `apps/web/src/routes/accounts.tsx` to use `AccountFormDialog` and verify `pnpm --filter @finance-application/web test:run accounts.test.tsx` passes.
- [x] 1.3 Remove redundant `create-account-dialog.tsx` and `edit-account-dialog.tsx` (or provide backwards-compatible re-exports) and verify zero dangling imports in `apps/web`.

## 2. Unified Category Form Dialog

- [x] 2.1 Implement `CategoryFormDialog` in `apps/web/src/components/categories/category-form-dialog.tsx` supporting create and edit modes, optional color/icon handling, and conflict error alerts, and verify by running targeted category component tests.
- [x] 2.2 Update `apps/web/src/routes/categories.tsx` to use `CategoryFormDialog` and verify `pnpm --filter @finance-application/web test:run categories.test.tsx` passes.
- [x] 2.3 Remove redundant `create-category-dialog.tsx` and `edit-category-dialog.tsx` (or provide backwards-compatible re-exports) and verify zero dangling imports in `apps/web`.

## 3. Unified Transaction and Transfer Form Dialogs

- [x] 3.1 Implement `TransactionFormDialog` in `apps/web/src/components/transactions/transaction-form-dialog.tsx` supporting create and edit modes, account/category selection, and minor unit conversions, and verify with transaction component tests.
- [x] 3.2 Implement `TransferFormDialog` in `apps/web/src/components/transfers/transfer-form-dialog.tsx` supporting create and edit modes, source/destination account selectors, and minor unit conversions, and verify with transfer component tests.
- [x] 3.3 Update `apps/web/src/routes/transactions.tsx` to use `TransactionFormDialog` and `TransferFormDialog`, and verify `pnpm --filter @finance-application/web test:run transactions.test.tsx` passes.
- [x] 3.4 Remove redundant create/edit dialog files in `components/transactions` and `components/transfers` (or provide backwards-compatible re-exports) and verify zero dangling imports in `apps/web`.

## 4. Verification and Quality Checks

- [x] 4.1 Run TypeScript type check (`pnpm --filter @finance-application/web check:types`) and verify zero type errors.
- [x] 4.2 Run the entire web test suite (`pnpm --filter @finance-application/web test:run`) and verify all test suites pass.
- [x] 4.3 Run linter and formatting checks (`pnpm turbo run lint`) and verify all files pass code quality checks.
