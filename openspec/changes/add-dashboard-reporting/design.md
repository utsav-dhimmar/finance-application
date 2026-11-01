# Design

## Context

Transactions and transfers provide signed-sum helpers per account and per period; balances are derived. The dashboard route (`apps/web/src/routes/dashboard.tsx`) is an explicit placeholder, and Recharts is the AGENTS.md chart convention. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- One server-side aggregation service owning every inclusion rule, so the overview, breakdowns, and future reports can never disagree.
- Dashboard as the single entry point for period-based financial understanding.

**Non-Goals:**
- Saved/custom reports, CSV export, trend forecasting, budgets-vs-actuals.
- Caching or materialized aggregates (single-user data volumes).
- Client-side aggregation — all totals come from the API so the future mobile client reuses identical rules.

## Decisions

- **One summary endpoint, period expressed as `month=YYYY-MM` or `year=YYYY`.** Exactly one parameter required (else `INVALID_PERIOD` validation error); the server converts to inclusive `from`/`to` date bounds. Alternative (raw from/to only) rejected: month/year is the product's primary navigation and the server should own boundary correctness (US-021's "consistent date boundaries"). Raw `from`/`to` is additionally accepted for the historical-report path; month/year and from/to are mutually exclusive.
- **Aggregations via SQL SUM over existing indexes**, reusing the transaction repository's signed-sum helpers with a date-range extension rather than loading rows into the service. Category breakdown is one `GROUP BY category_id` query (non-deleted transactions in range, expense side) joined to categories for names — resolving names by id regardless of status, per the no-snapshot decision from the categories change.
- **Income/expense/net computed from transactions only.** Transfers are structurally absent from the aggregation query (different table), making "never income or expense" impossible to violate by accident.
- **Balance section reuses the account service's list-with-balances** (combined over active accounts only) — no duplicate balance math in the report service.
- **Charts**: expense-by-category pie (top categories, "Other" bucket for the tail) and income-vs-expense bars across sub-periods (12 monthly buckets for a year; daily buckets for a month) computed in the same summary query family. Chart rendering lives in `apps/web` with Recharts; the API returns plain numeric series so the future mobile client can chart differently.
- **Timezone policy**: all dates are calendar dates (`YYYY-MM-DD` text); period boundaries are pure string comparisons on transaction dates — no timestamp conversion anywhere, eliminating timezone shift (AGENTS.md). The client's "current month" selection uses the browser's local date; stored data is unaffected.
- **UI composition**: period selector + summary cards (income/expense/net) + pie + bars + account balance cards (existing `formatPaise` money display) + recent-activity feed via the existing unified activity endpoint (from the transfers change). Empty states distinguish "no accounts yet" (onboarding nudge to create one) from "no activity this period".
- **Verification of US-021 filters**: the transactions page already filters by date range, account, and category; the integration tests in this change assert archived-account/category filtering behavior end-to-end, and the transactions page gains no new UI.

## Risks / Trade-offs

- [Aggregation queries growing expensive with history] → All queries hit the existing `(user_id, date)` indexes with bounded ranges; single-user volumes keep this fast. Materialized rollups are a future optimization if needed.
- [Pie chart "Other" bucket hiding detail] → Top-N categories + explicit "Other" keeps the chart legible; the full breakdown list remains available below the chart.
- [Period-boundary bugs silently corrupting reports] → Boundary cases (first/last day inclusion, leap-year February, year views spanning December→January) are explicit integration test fixtures.
- [Recharts bundle size] → Import only the used chart components; acceptable for a single dashboard route.
