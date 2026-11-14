# Tasks

## 1. Authenticated shell

- [ ] 1.1 Build `src/components/app-header.tsx` (user email from the session, sign-out control wired to the auth service) and convert `src/app/(app)/` to an Expo Router `<Tabs>` layout with Dashboard (initial), Transactions, Accounts, Categories entries; Dashboard and Transactions render a minimal "not available yet" notice; remove the stub `(app)/index.tsx` home; verify by rendering the app in Expo Go — header persists across tabs, sign-out returns to sign-in.
- [x] 1.2 Add `tests/components/app-header.test.tsx` asserting the email is visible, the sign-out control triggers the logout flow, and the placeholder tabs render the notice; verify the tests pass.

## 2. Shared screen building blocks

- [x] 2.1 Add `src/lib/format.ts` (minor units → currency string with API symbol + `minorUnitExponent`, tabular-numeral typography prop) and port the web formatter's test cases to `tests/lib/format.test.ts`; verify the outputs match the web helper.
- [x] 2.2 Add shared components: `src/components/shared/confirm-dialog.tsx` (boxy Modal confirm) and `src/components/shared/restore-name-dialog.tsx` (rename prompt on restore conflict), with component tests in `tests/components/shared/` verifying confirm/cancel flows and the rename retry path; verify tests pass.

## 3. Accounts screen

- [ ] 3.1 Build the Accounts screen: `src/app/(app)/accounts.tsx` with account cards (name, type, balance) and active/archived/deleted status tabs driven by the accounts query, plus `src/components/accounts/account-card.tsx` and `account-form-dialog.tsx` (unified create/edit, `accountFormSchema` via zodResolver); verify in Expo Go against the running API: list renders, empty state shows per tab, create/edit submits parsed values.
- [x] 3.2 Wire account lifecycle: archive, delete, and restore actions through confirm-dialog and the account hooks, with restore-name conflict handling; add `tests/components/accounts/*.test.tsx` covering the spec scenarios (view with balances, empty state, create, invalid form blocks, edit, archive/delete confirm, restore, restore-with-new-name); verify tests pass.
- [x] 3.3 Verify invalidations: after each account mutation the accounts list and report summary keys refetch (hook test), and toasts show success/error copy (hook test); verify tests pass.

## 4. Categories screen

- [ ] 4.1 Build the Categories screen: `src/app/(app)/categories.tsx` with category cards (name, type, color swatch, icon) and status tabs, plus `src/components/categories/category-card.tsx` and `category-form-dialog.tsx` (unified create/edit, `categoryFormSchema` via zodResolver, color/icon pickers constrained to the shared schema's rules); verify in Expo Go: list renders, empty state per tab, create/edit works.
- [x] 4.2 Wire category lifecycle with confirm-dialog and restore-name handling; add `tests/components/categories/*.test.tsx` covering the spec scenarios (view, empty state, create, invalid form blocks, edit, archive/delete/restore lifecycle with name conflict); verify tests pass.

## 5. Pipeline verification

- [x] 5.1 Run `pnpm turbo run typecheck lint test build` from the repository root and confirm `apps/android` passes all four tasks; run `pnpm format:check` (format touched files if needed); verify the boxy style claim by reviewing each new screen for zero-radius surfaces in the theme.
