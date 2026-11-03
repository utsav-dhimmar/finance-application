# Tasks

## 1. Shared contracts (`packages/schemas`)

- [x] 1.1 Add `reports.ts` with `reportPeriodQuerySchema` (exactly one of `month=YYYY-MM` / `year=YYYY`, or inclusive `from`/`to` dates; refinement rejecting both forms together), `categoryBreakdownItemSchema`, `reportSummaryResponseSchema` (incomeMinor, expenseMinor, netCashFlowMinor, categoryBreakdown, accounts with balances, combinedBalanceMinor), and `comparisonSeriesSchema` (label + income/expense pairs); export from the package index. Verify with unit tests covering period-form edges (both forms rejected, malformed month, `from > to` rejected) — `pnpm --filter @finance-application/schemas test && pnpm --filter @finance-application/schemas typecheck`.

## 2. Reporting service (`server/api`)

- [x] 2.1 Implement `report-service.ts`: period-bound resolution (month/year → inclusive date bounds), income/expense/net sums over non-deleted transactions in range (transfers structurally excluded), expense breakdown grouped by category with names resolved regardless of category status, sub-period comparison series (monthly buckets for a year, daily for a month, zeros filled), and the balance section reusing the account service's list-with-balances. Verify with service unit tests on a pure query seam: boundary inclusion (first/last day), leap-year February, zero-fill of empty sub-periods, deleted excluded / archived included — `pnpm --filter @finance-application/api test`.

## 3. API routes (`server/api`)

- [x] 3.1 Create `src/schemas/reports.ts` (OpenAPI metadata wrappers) and `src/routes/reports.ts` with `@hono/zod-openapi` route `GET /api/reports/summary` behind `requireAuth`, wired into `src/app.ts`. Verify `GET /api/openapi` includes the report path via the docs test — `pnpm --filter @finance-application/api test`.
- [x] 3.2 Write route contract tests with mixed-status fixtures: 401 without session; month and year happy paths; 400 for invalid periods; archived transactions included, soft-deleted excluded, transfers absent from totals; breakdown includes archived/deleted categories by resolved name; combined balance over active accounts only while an archived account's transactions still count; boundary dates counted exactly once; cross-user isolation; empty-database zeros. Verify — `pnpm --filter @finance-application/api test`.

## 4. Typed API client (`packages/api-client`)

- [x] 4.1 Add `src/reports.ts` with typed function `getReportSummary(query)` over `apiFetch`, re-exported from the index. Verify with client tests asserting path, query serialization, and error-envelope decoding — `pnpm --filter @finance-application/api-client test && pnpm --filter @finance-application/api-client typecheck`.

## 5. Web dashboard (`apps/web`)

- [x] 5.1 Add `recharts` to `apps/web` via `pnpm add` and create `src/services/reports-service.ts` + `src/hooks/use-reports.ts` (query keyed `["reports", period]`, error-code-to-copy mapping). Verify with hook/service tests — `pnpm --filter @finance-application/web test`.
- [x] 5.2 Rebuild `src/routes/dashboard.tsx`: month/year period selector (defaulting to the current month), income/expense/net summary cards with `formatPaise`, expense-by-category pie chart (top-N + Other), income-vs-expense bar chart across sub-periods, active-account balance cards with combined balance, and a recent-activity feed from the existing activity endpoint. Verify with render tests for states — `pnpm --filter @finance-application/web test`.
- [x] 5.3 Implement dashboard states: loading skeletons, error-with-retry, "no accounts yet" onboarding empty state, and "no activity this period" zero state; verify account/transaction mutation hooks invalidate report keys so the dashboard refreshes after recordings. Verify with interaction tests — `pnpm --filter @finance-application/web test`.

## 6. Integration verification

- [x] 6.1 Run the full monorepo gates and confirm all pass: `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`; confirm the OpenAPI document validates via the server docs test. Also exercise the US-021 filter story end-to-end in the transaction route tests (filter by archived account and archived category) to confirm historical reporting works through the list filters.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied (`/openspec-archive-change`), then verify the archived result.
- When the archive/trash epic is proposed, carry forward: the reporting inclusion rules as the acceptance baseline for the unified views.
