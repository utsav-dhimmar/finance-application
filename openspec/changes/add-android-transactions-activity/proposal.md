# Proposal

## Why

Accounts and categories are manageable on the device, but the core daily activity — recording transactions and transfers and reviewing the combined feed — is still a placeholder tab. The transactions view is the web app's largest and most-used screen; the phone needs the same capability in a mobile idiom.

## What Changes

- Replace the Transactions tab placeholder with the **activity screen**: the unified activity feed (transactions and transfers from one account-perspective list, the same contract the web uses), rendered as a scrolling list instead of a data table, with status tabs (Active / Archived / Trash), filters (type, account, category, date range, search text), and progressive "load more" pagination over the same paginated API.
- Add **transaction management**: create and edit income/expense transactions through a Zod-validated form dialog (type, amount, date, account, category, notes), with archive, soft-delete, and restore behind confirmation dialogs.
- Add **transfer management**: create and edit transfers between two accounts (amount, date, source, destination, notes) with the shared schema's source ≠ destination rule, surfaced as signed rows per account side in the activity feed, with the same lifecycle actions.
- The signed-amount display (income credits, expense debits, transfers ± by side) mirrors the web's activity rendering rules; amounts format through the established currency helper.
- Dashboard remains the only placeholder tab (its capability ships in the next change).

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `android-ui`: the authenticated tab shell's pending-notice scenario now applies only to the Dashboard tab; activity list, transaction management, and transfer management requirements are added.

## Impact

- `apps/android`: new `(app)/transactions.tsx` screen and `src/components/{transactions,transfers,activity}/` components; a date-picker dependency (`@react-native-community/datetimepicker` via `npx expo install`) for the date-range and form date fields; hook/service additions use the data layer's existing patterns (activity query gains infinite-pagination support).
- `packages/*`, `server/*`, `apps/web` unaffected: the activity, transaction, and transfer API contracts are consumed unchanged.
- Depends on `add-android-data-layer` and `add-android-accounts-categories` (shell, shared dialogs, formatter, hooks).
