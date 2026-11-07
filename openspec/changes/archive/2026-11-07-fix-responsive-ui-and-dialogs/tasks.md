# Tasks

## 1. UI Primitives & Viewport Containment

- [x] 1.1 Update `DialogContent` in `packages/ui/src/components/dialog.tsx` to enforce viewport bounds (`max-h-[min(90dvh,calc(100%-2rem))]`, `overflow-y-auto`, touch-friendly padding) and support responsive size variants (`sm`, `md`, `lg`), verifying that dialogs do not clip off-screen.
- [x] 1.2 Update `AlertDialogContent` in `packages/ui/src/components/alert-dialog.tsx` to enforce `max-w-[calc(100%-2rem)]` and `max-h-[min(90dvh,calc(100%-2rem))]` with vertical scrolling, verifying confirmation dialogs stay fully reachable on mobile viewports.
- [x] 1.3 Audit dialog wrappers across `apps/web` (`create-transaction-dialog`, `edit-transaction-dialog`, `create-transfer-dialog`, `edit-transfer-dialog`, `create-account-dialog`, `create-category-dialog`) to ensure form bodies scroll smoothly while submission buttons remain accessible.

## 2. Responsive Navigation & Application Shell

- [x] 2.1 Refactor `AppHeader` in `apps/web/src/components/app-header.tsx` to render inline navigation on desktop (`md:` and above) and collapse into an accessible mobile menu/drawer on compact viewports (< 768px).
- [x] 2.2 Implement mobile menu overlay with navigation links to Dashboard, Accounts, Categories, Transactions, Archive, Trash, Settings, active user indicator, and Sign out action, verifying that clicking any link navigates and closes the menu.
- [x] 2.3 Verify `AppHeader` renders cleanly without wrapping or creating horizontal scrollbars at 320px, 375px, and 768px viewports.

## 3. Responsive Pages, Data Tables & Filter Bars

- [x] 3.1 Update `apps/web/src/routes/transactions.tsx` filter bar to use responsive stacking (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7`) and ensure the activity data table is wrapped in a dedicated touch-scrollable container with minimum column widths.
- [x] 3.2 Update `archive-trash` panels in `apps/web/src/components/archive-trash/*.tsx` to ensure all archive and trash tables scroll horizontally within their containers on mobile viewports.
- [x] 3.3 Adjust page headers, metric cards, and period selectors on `dashboard.tsx`, `accounts.tsx`, `categories.tsx`, and `settings.tsx` to flex-wrap cleanly on mobile viewports without clipping text or buttons.

## 4. Verification & Quality Checks

- [x] 4.1 Run unit and component tests across `apps/web` and `packages/ui` (`pnpm --filter @finance-application/web test` and `pnpm --filter @finance-application/ui test`) and verify all tests pass.
- [x] 4.2 Run repository type checking (`pnpm run typecheck` or `pnpm turbo run check:types`) and linter (`pnpm run check`) to ensure strict TypeScript and styling compliance.
