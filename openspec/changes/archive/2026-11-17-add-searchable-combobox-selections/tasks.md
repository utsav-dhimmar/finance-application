# Tasks

## 1. UI primitives

- [x] 1.1 Track the already-scaffolded `packages/ui/src/components/combobox.tsx`, `input-group.tsx`, and `textarea.tsx` as part of this change (`textarea.tsx` is a compile-time import of `input-group.tsx`, so it cannot stay untracked); convert the registry `@/components/*` imports to relative imports matching the package convention; verify `pnpm --filter @finance-application/ui typecheck` and `pnpm --filter @finance-application/ui lint` pass

## 2. Shared combobox wrapper

- [x] 2.1 Create `apps/web/src/components/shared/combobox-select-field.tsx` per design.md: Popup composition (trigger button showing the selected label, search input with `showTrigger={false}` inside `ComboboxContent`), explicit case-insensitive `contains` filter via `useComboboxFilter()` exposed from the UI combobox module, object↔id value mapping over `items: { value: string; label: string }[]`, `ComboboxEmpty` message, `id`/`disabled`/`aria-label`/`className`/`invalid` passthrough; verified with `pnpm --filter @finance-application/web typecheck`
- [x] 2.2 Add `apps/web/tests/components/combobox-select-field.test.tsx` covering: typing narrows options case-insensitively (substring match), selecting an option fires `onValueChange` with the item id, the trigger displays the selected label, and Escape closes the popup without changing the value; verify with the web workspace vitest run scoped to this file

## 3. Transaction form call sites

- [x] 3.1 Replace the Account and Category `Select`s in `apps/web/src/components/transactions/transaction-form-dialog.tsx` with the wrapper, preserving field ids, placeholder text, the `(archived)` account label handling, and the current-balance hint; verify with `pnpm --filter @finance-application/web typecheck` and the existing web test suite scoped to transaction-related tests
- [x] 3.2 Add a test rendering the transaction form dialog that opens the account/category comboboxes, asserts a search input is present, and selects an option; verify the test passes

## 4. Transfer form call sites

- [x] 4.1 Replace the From-account and To-account `Select`s in `apps/web/src/components/transfers/transfer-form-dialog.tsx` with the wrapper, preserving ids and side-specific placeholder/selected-value rendering; verify with `pnpm --filter @finance-application/web typecheck` and a test that both comboboxes render with search inputs and selection populates each side independently

## 5. Recurring expense form call site

- [x] 5.1 Replace the Account and Category `Select`s in `apps/web/src/routes/recurring-expenses.tsx` with the wrapper (both are user-driven entity picks; the category select was initially missed in planning), keeping the interval control as a plain `Select` and preserving the route's `rounded-none` boxy styling on the trigger and popup; verify with `pnpm --filter @finance-application/web typecheck` and a test that the account/category comboboxes render with search inputs while the interval control remains a select without one

## 6. Transaction list filter call sites

- [x] 6.1 Replace the Account and Category filter `Select`s in `apps/web/src/routes/transactions.tsx` with the wrapper, keeping `All accounts`/`All categories` as the first items, the `ALL_ACCOUNTS`/`ALL_CATEGORIES` sentinel mapping, and the Type filter as a plain `Select`; verify with `pnpm --filter @finance-application/web typecheck`
- [x] 6.2 Add a route-level test following the `apps/web/tests/routes/` helper pattern: typing narrows the filter options, picking an option dispatches the corresponding filter action, and picking `All accounts`/`All categories` restores the unfiltered list; verify the test passes

## 7. Integration verification

- [x] 7.1 Run `pnpm typecheck`, `pnpm lint`, and `pnpm test` from the repo root and confirm all pass
- [x] 7.2 Run `pnpm build` from the repo root and confirm the production build succeeds
- [x] 7.3 Manual pass on the dev server: search narrows options in all eight converted fields, selections persist in forms, the current-balance hint still updates on account change, filter reset entries still clear filters, and combobox popups stay contained inside the entity form dialogs

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
