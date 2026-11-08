# Proposal

## Why

Currently, separate dialog components exist for creating and editing entities (`create-account-dialog` and `edit-account-dialog`, `create-category-dialog` and `edit-category-dialog`, `create-transaction-dialog` and `edit-transaction-dialog`, and `create-transfer-dialog` and `edit-transfer-dialog`). These pairs duplicate nearly identical form schemas, UI layouts, field inputs, validation wiring, and error presentations, resulting in excessive code duplication and higher maintenance burden when updating forms or styling. Consolidating each pair into a unified dialog component reduces lines of code, ensures behavioral and visual consistency, and simplifies route components.

## What Changes

- Consolidate account create and edit dialogs into a single `AccountFormDialog` component that switches between create and edit mode based on whether an account entity is provided.
- Consolidate category create and edit dialogs into a single `CategoryFormDialog` component supporting both creation and editing.
- Consolidate transaction create and edit dialogs into a single `TransactionFormDialog` component supporting both creation and editing.
- Consolidate transfer create and edit dialogs into a single `TransferFormDialog` component supporting both creation and editing.
- Provide backwards-compatible re-exports or clean up calling sites in `apps/web/src/routes/accounts.tsx`, `apps/web/src/routes/categories.tsx`, and `apps/web/src/routes/transactions.tsx`.
- Preserve existing form validation, toast notifications, error handling, and boxy geometric styling with sharp corners (zero border-radius).

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `web-ui`: Adds a requirement for unified entity form dialogs covering modal lifecycle, mode switching (create vs. edit), form resetting, field disabling for locked properties, and consistent mutation feedback.

## Impact

- **Affected code**:
  - `apps/web/src/components/accounts/`: Unify `create-account-dialog.tsx` and `edit-account-dialog.tsx` into `account-form-dialog.tsx`.
  - `apps/web/src/components/categories/`: Unify `create-category-dialog.tsx` and `edit-category-dialog.tsx` into `category-form-dialog.tsx`.
  - `apps/web/src/components/transactions/`: Unify `create-transaction-dialog.tsx` and `edit-transaction-dialog.tsx` into `transaction-form-dialog.tsx`.
  - `apps/web/src/components/transfers/`: Unify `create-transfer-dialog.tsx` and `edit-transfer-dialog.tsx` into `transfer-form-dialog.tsx`.
  - `apps/web/src/routes/accounts.tsx`, `categories.tsx`, `transactions.tsx`: Update imports and component invocations to use unified dialogs.
- **APIs & dependencies**: No backend API changes, no new npm packages.
- **Testing**: Web route tests (`accounts.test.tsx`, `categories.test.tsx`, `transactions.test.tsx`) must continue passing without regression.
