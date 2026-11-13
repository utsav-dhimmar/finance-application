# Design

## Context

The shell, currency formatter, report-summary service/hook (`use-report-summary`, staleTime 30 s), and shared building blocks exist from the previous changes. The web dashboard (`apps/web/src/routes/dashboard.tsx`) derives the default period from the browser's local clock (current month), offers a month/year mode switch with `periodLabel` rendering (month name + year, or the year), shows income/expenses/net cash-flow cards, three Recharts charts, and an account-balances section with the combined balance. `reportSummaryResponseSchema` carries totals, `categoryBreakdown` (with `sharePercent` and nullable `categoryName`), `comparison` series, `accounts`, and `combinedBalanceMinor`.

## Goals / Non-Goals

**Goals:**

- Dashboard parity for everything that is not a chart: period selection, totals, breakdown, balances.
- Pure StyleSheet presentation — no chart or drawing dependency.

**Non-Goals:**

- The income-vs-expenses split and comparison-over-time charts (later change, needs an RN chart library decision — victory-native vs gifted-charts per the earlier grilling outcome).
- Any API or shared-package change; custom date-range (`from`/`to`) period input — the web only exposes month/year modes, and mobile matches.

## Decisions

- **Period state mirrors the web reducer.** `mode: "month" | "year"` + month/year values from the device's local clock (`new Date()` locally — the same rule as the web; no timezone conversion since both sides compare pure `YYYY-MM`/`YYYY` strings), rendered by a `periodLabel` helper ported with the web's month-name table. The period feeds `use-report-summary` and lands in the query key, so a period change is a cache-aware refetch.
- **Breakdown as proportional bar list.** Each category row: name, formatted amount, and a bar whose width is `sharePercent` of the row width (`flexGrow` on an inner boxy `View`) — the StyleSheet substitute for the expenses-by-category chart, matching the user's "summary cards + top categories as bar lists" decision. The nullable `categoryName` renders the same fallback label the web uses for permanently deleted categories.
- **Month/year pickers without new dependencies.** Month selection is a paged select from the shared select primitives (12 months + year), not a calendar sheet — the web uses `<select>`-equivalents too. No `@react-native-community/datetimepicker` need here since periods are month/year strings, not dates.
- **Charts deferred, data ready.** The `comparison` series arrives in the response but is not rendered in this change; the later charts change consumes it without new API work. This keeps the dashboard's data layer final even though its presentation grows later.
- **Placeholder removal.** The dashboard's placeholder screen is replaced; after this change no tab renders the "not available yet" notice, which the shell spec's generic pending-notice scenario permits (it only governs undelivered tabs).

## Risks / Trade-offs

- [Bar widths as percentage flex misrender at extremes] → Clamp shares to 0–100 and cover 0% and 100% shares in the component tests.
- [Local-clock default differs from the API's month semantics] → Both the web and this app resolve the default period on the client from the local clock by design; the report endpoint re-derives bounds from the strings, so no silent shift is possible.
- [Dashboard feels sparse without the two charts] → Accepted per the agreed scope; the totals, breakdown bars, and balances carry the at-a-glance purpose until the charts change lands.

## Migration Plan

1. Port `periodLabel` + period state with unit tests.
2. Build the screen: cards, breakdown bars, balances; replace the placeholder.
3. Full pipeline run.

Rollback: revert `apps/android`; no shared or server state is touched.

## Open Questions

None.
