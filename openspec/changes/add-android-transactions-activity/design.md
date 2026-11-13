# Design

## Context

The shell, shared dialogs (`confirm-dialog`, `restore-name-dialog`), currency formatter, and the web-parity data layer exist from the two previous changes. The web's `/transactions` page renders the unified activity feed (`activityItemSchema`: one row per account side, signed `amountMinor`, transfer rows carry `counterpartyAccountId`, transaction rows carry category) through TanStack Table with a filter reducer (`TransactionsFilterState`: tab, type, accountId, categoryId, from/to, q, page) where every filter change resets the page. Contracts: `listTransactionsQuerySchema`, `transferListQuerySchema`, `activityListQuerySchema`, `transactionFormSchema`, `transferFormSchema` (with source ≠ destination refinement).

## Goals / Non-Goals

**Goals:**

- Port the transactions view's full capability in a mobile idiom: list instead of table, load-more instead of page buttons.
- Keep all filter and form semantics identical to the web (same schemas, same reset behavior, same error copy).

**Non-Goals:**

- Dashboard screen (next change).
- Aggregate archive/trash routes.
- Any change to the activity/transaction/transfer API contracts or shared packages.

## Decisions

- **FlatList over TanStack Table.** The web's table is a desktop idiom; RN's virtualized `FlatList` with boxy row cards is the native equivalent and reuses the same `activityItemSchema` rows. Signed amounts render with the same rules as the web (`formatSignedAmount` semantics: income credits, expense debits, transfer ± by `direction`), via the shared currency formatter.
- **`useInfiniteQuery` for the feed.** The web pages with explicit controls; on mobile, a "Load more" control over `useInfiniteQuery` (page param advancing) is idiomatic while consuming the identical paginated endpoint. Query key family matches the data-layer service (filters serialized into the key); every filter or tab change starts a fresh list, mirroring the web reducer's page reset.
- **Filter UI.** A single collapsible filter row above the list: type select (transaction types + the transfer-aware option), account select, category select (disabled for transfer-only type, mirroring the web's type-change rule), from/to date fields using `@react-native-community/datetimepicker` (installed via `npx expo install` for SDK-compatible versions), and a debounced search input. Filter state lives in one reducer like the web's, so behavior parity is reviewable side by side.
- **Form dialogs.** One unified transaction form dialog (create/edit) bound to `transactionFormSchema` and one transfer form dialog bound to `transferFormSchema` — both `useForm<Input, unknown, Output>` with zodResolver, RN `Controller`-bound inputs, reusing the dialog chrome and validation-message patterns from change 2. The transfer dialog enforces the different-accounts rule through the schema (not ad-hoc UI logic).
- **Lifecycle actions** reuse the confirm-dialog and the transaction/transfer hooks from the data layer; restoration flows match change 2's (restore, with name-prompt only where the API requires it — transactions/transfers have no unique-name conflict, so no restore-name dialog here).
- **Date handling stays string-based.** The date picker yields local calendar fields that are serialized as `YYYY-MM-DD` strings for the API — no `Date`-object round-trips in state, preserving the repo's no-timezone-shift rule; the picker's value is derived from the string and written back as a string.

## Risks / Trade-offs

- [datetimepicker in Expo Go / SDK 58 compatibility] → Install with `npx expo install` and verify with `expo-doctor`; fallback is a plain `YYYY-MM-DD` text input validated by the shared date schema.
- [Infinite query + filter key churn] → Filter reducer resets pages on every filter change (same as web), so stale-page states can't accumulate; hook tests assert key serialization matches the web's `transactionsQueryKey` conventions.
- [Two-sided transfer rows rendering] → An unscoped feed can contain the same transfer id twice (one row per side); rows render as-is like the web (no dedup), which the feed tests cover.
- [1052-line web page ported piecemeal] → Split into small components (row, filters, dialogs) with tests per component; the reducer is ported as a pure function with unit tests before UI wiring.

## Migration Plan

1. Port the filter reducer with unit tests; add the activity infinite-query hook + service support.
2. Build the feed list + filters; verify against the running API.
3. Transaction form dialog + lifecycle; then transfer form dialog + lifecycle.
4. Full pipeline run.

Rollback: revert `apps/android`; no shared or server state is touched.

## Open Questions

None.
