# Proposal

## Why

The Transactions tab placeholder was the last missing core screen: without a dashboard, the phone has no at-a-glance view of income, expenses, and balances — the web app's first stop after sign-in.

## What Changes

- Replace the Dashboard tab placeholder with the **dashboard screen**: the reporting summary from the API's report endpoint rendered with pure StyleSheet building blocks.
- Period selection with web parity: month/year mode switch defaulting to the current month from the device's local clock, with month and year pickers; the period label renders like the web's (month name + year, or the year).
- Summary cards for the period: Income, Expenses, and Net cash flow, formatted in the active currency.
- **Expenses by category as a proportional bar list** (largest first, share of period expenses per category) — the StyleSheet substitute for the web's expenses-by-category chart, per the agreed no-chart-library scope.
- Account balances section: active accounts with current balances and the combined balance across active accounts.
- Out of scope (explicitly deferred): the income-vs-expenses split and comparison-over-time charts. They need an RN chart library decision and arrive in a later change; the bar list is the interim presentation for the breakdown.
- With this change, no tab renders a placeholder anymore: all four core destinations are real screens.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `android-ui`: dashboard screen requirements are added (period selection, summary cards, category breakdown, account balances).

## Impact

- `apps/android`: new `(app)/dashboard.tsx` screen and `src/components/dashboard/` components; consumes the report-summary service/hook and currency formatter from the data layer; no new dependencies.
- `packages/*`, `server/*`, `apps/web` unaffected: the report API contract is consumed unchanged.
- Depends on `add-android-data-layer` and `add-android-accounts-categories` (shell, formatter, hooks, shared building blocks); benefits from but does not require the transactions change.
