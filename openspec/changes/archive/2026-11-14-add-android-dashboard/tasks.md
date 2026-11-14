# Tasks

## 1. Period selection

- [x] 1.1 Port the period logic to `src/components/dashboard/period.ts` — mode state (month/year), current-month default from the device's local clock, `periodLabel` with the web's month-name table — with unit tests in `tests/components/dashboard/period.test.ts` asserting web-parity labels and the `reportPeriodQuerySchema`-valid period values; verify tests pass.

## 2. Dashboard screen

- [ ] 2.1 Build `src/app/(app)/dashboard.tsx` replacing the placeholder: period mode switch + month/year selects, and the income/expenses/net-cash-flow summary cards (`src/components/dashboard/summary-cards.tsx`) formatted via the shared currency helper with tabular numerals and a negative-identifiable net value; verify in Expo Go against the running API: default period is the current month, switching mode/period refetches, cards match the web for the same period.
- [ ] 2.2 Build the category breakdown bar list (`src/components/dashboard/category-breakdown.tsx`): largest-first rows with amount, `sharePercent`-proportional bar widths (clamped 0–100), and the generic fallback name for null `categoryName`; add `tests/components/dashboard/category-breakdown.test.tsx` covering ordering, 0%/100% shares, and the deleted-category fallback; verify tests pass and the section renders in Expo Go.
- [x] 2.3 Build the account balances section (`src/components/dashboard/account-balances.tsx`): active accounts with balances plus the combined balance, and the zero/no-accounts state; add `tests/components/dashboard/dashboard-screen.test.tsx` rendering the whole screen with a stubbed report-summary fixture (pattern: `apps/web/tests/routes/dashboard.test.tsx`) covering the spec scenarios — cards, breakdown, balances, and the no-accounts state; verify tests pass.
- [x] 2.4 Run `pnpm turbo run typecheck lint test build` from the repository root and confirm `apps/android` passes all four tasks; run `pnpm format:check` (format touched files if needed); confirm no tab renders the placeholder notice anymore by reviewing each `(app)` route.
