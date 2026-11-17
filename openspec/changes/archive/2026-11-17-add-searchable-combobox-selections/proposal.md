# Proposal

## Why

Categories and accounts are user-driven lists that grow over time, but every account/category selection in the web app uses a plain select that forces users to scroll the entire list to find an option. Adding an inline search input to the same popup makes selection fast and scalable, and the combobox primitive is already scaffolded in `packages/ui` (unused until now), so this is the right moment to wire it in.

## What Changes

- Commit the existing (untracked, unused) Base UI combobox primitive in `packages/ui` (`combobox.tsx`, its dependency `input-group.tsx`, and `textarea.tsx`, which `input-group.tsx` compiles against) and make it available to the web app. Registry `@/components/*` imports are converted to the package's relative-import convention; `textarea.tsx` gains no usage beyond this compile dependency.
- Replace the plain select with a searchable combobox for every selection whose options are user-driven and can grow:
  - Transaction form dialog: Account and Category fields.
  - Transfer form dialog: From-account and To-account fields.
  - Recurring expense form: Account and Category fields.
  - Transaction list filters: Account and Category filters (the "All accounts" / "All categories" entries remain as the first list items, preserving current filter-reset behavior).
- Keep the plain select for small fixed option lists (transaction type, recurrence interval, currency preference); these do not benefit from search.
- Comboboxes are single-select, keyboard-accessible, and filter options by a case-insensitive match on the option label as the user types.
- No API, database, or domain-logic changes: options continue to come from the existing account/category queries, and values written to forms/filters are unchanged IDs.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `web-ui`: Adds a requirement governing searchable combobox selection inputs for user-driven option lists (account/category picks in forms and filters), including which selections use a combobox versus a plain select and how filter "all" reset entries behave.

## Impact

- `packages/ui/src/components/combobox.tsx`, `packages/ui/src/components/input-group.tsx`, and `packages/ui/src/components/textarea.tsx`: committed as part of this change (already present, never imported; `textarea.tsx` only because `input-group.tsx` imports it).
- `apps/web/src/components/transactions/transaction-form-dialog.tsx`, `apps/web/src/components/transfers/transfer-form-dialog.tsx`, `apps/web/src/routes/recurring-expenses.tsx`, `apps/web/src/routes/transactions.tsx`: swap the account/category `Select` usage for combobox wiring.
- No new dependencies: `@base-ui/react` is already a dependency of `packages/ui`.
- No changes to the API, database schema, validation schemas, or stored values.
