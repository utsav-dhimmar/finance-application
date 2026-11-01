# Proposal

## Why

All the raw data exists — accounts, categories, transactions, transfers — but the user has no aggregated view of their finances. Epic E of the approved backlog (`user-story/01-inital/04-category-management.md` §8, US-020–US-021). The dashboard route is currently an explicit placeholder. This change turns it into the financial overview and establishes the reporting inclusion rules (archived vs deleted, transfers excluded) that every future report depends on.

## What Changes

- **Reporting API** (authenticated, OpenAPI-documented): a period summary endpoint returning income, expenses, net cash flow, expense-by-category breakdown, and account balances for a selected month or year (and arbitrary date ranges); all aggregations computed server-side from the existing signed-sum helpers.
- **Reporting inclusion rules** (confirmed with the product owner):
  - Active **and** archived transactions count in income/expense totals and category breakdowns; soft-deleted transactions never count.
  - Transfers never count as income or expense anywhere.
  - Per-account and combined current balances follow the accounts spec (combined over active accounts only); transactions of archived accounts still count in period income/expense reporting.
  - Breakdowns and lists resolve category/account names by id regardless of the referenced record's lifecycle state.
- **Dashboard UI** (`apps/web`): period selector (month/year), income/expense/net summary cards, expense-by-category pie chart (Recharts), income-vs-expense bar chart across the period's natural sub-periods (days in a month view, months in a year view), account balance cards with combined balance, and a recent-activity feed from the existing unified activity endpoint; loading / empty / error states.
- **Historical review (US-021)**: date-range and account/category filtering arrive through the transactions list filters delivered by the transactions epic; this change verifies and documents them against the reporting rules rather than duplicating UI.
- **Explicitly deferred**: month-over-month trend lines, custom saved reports, export/CSV, per-account historical balance charts, budgets-vs-actuals.

## Capabilities

### New Capabilities

- `reporting`: Aggregated financial overview — period income/expense/net totals, category breakdowns, and account balance summaries, computed under explicit inclusion rules for archived and deleted records and with transfers permanently excluded.

### Modified Capabilities

(none — account balance semantics are already specified; this change consumes them)

## Impact

- **`server/api`** — new `routes/reports.ts`, `services/report-service.ts` (aggregation queries over the transaction and transfer repositories' sum helpers), `schemas/reports.ts`; new `ErrorCode` value `INVALID_PERIOD`; OpenAPI document extended; unit + workers integration tests with mixed-status fixtures asserting every inclusion rule.
- **`packages/schemas`** — new `reports.ts` (period query schema, summary response schemas); exported from the package index.
- **`packages/api-client`** — new `src/reports.ts` typed functions; no new dependencies.
- **`apps/web`** — dashboard route rebuilt: period selector, summary cards, two Recharts charts, account balance cards, recent-activity feed; new `useReports` hooks; Recharts added via `pnpm add`.
- **`packages/ui`** — primitives reused; chart containers are local to `apps/web`.
- **Database** — no schema changes; aggregations use existing indexes.
- **Dependencies** — `recharts` (AGENTS.md convention) added to `apps/web` via `pnpm add`.
