# Tasks

## 1. Router-level authentication guard

- [x] 1.1 Create `src/lib/route-guards.ts` with `guardAuthenticated` (await `ensureQueryData(meQueryOptions())` from the router context; `throw redirect({ to: "/login" })` when the session resolves to `null`; swallow and continue when the me query rejects) and `guardUnauthenticated` (inverse: redirect authenticated users to `/dashboard`). Keep it out of `router.tsx` so route files never import the router module (import cycle). Verify: unit tests covering the three me outcomes (null → redirect thrown, user → resolves, rejection → resolves without redirect) pass.
- [x] 1.2 Wire `beforeLoad: guardAuthenticated` into `dashboard`, `transactions`, `accounts`, `categories`, `archive`, `trash`, `settings`, `recurring-expenses` and `beforeLoad: guardUnauthenticated` into `login`, `register`; delete each route's duplicated `useEffect` redirect and the auth-only early-return shells (keep query-pending/loading shells that remain necessary). Verify: `pnpm --filter @finance-application/web typecheck` passes and a grep of `apps/web/src/routes` finds no remaining `me.data === null` redirect effects.
- [x] 1.3 Add a router-level test: an unauthenticated deep link to a protected route redirects to `/login` with no protected content rendered; update component tests that depended on the removed per-page guards (e.g., the recurring-expenses auth-gated test) to seed the query cache instead. Verify: `pnpm --filter @finance-application/web test` passes.

## 2. Route-level data prefetch loaders

- [x] 2.1 Add the `/dashboard` loader: after the guard, best-effort `ensureQueryData` (each wrapped in `catch`) for `reportsQueryOptions` on the loader-computed default period, `activityQueryOptions({})`, the due-recurring query options, and `preferencesQueryOptions()`. Verify: a test navigating to `/dashboard` with a stubbed fetch asserts all four slices are warmed (cache contains their keys) before the component mounts.
- [x] 2.2 Add the `/transactions` loader: guard + best-effort prefetch of the default-filter `activityQueryOptions` (module-constant initial filter state), `accountsQueryOptions("active")`, `categoriesQueryOptions("active")`, and `preferencesQueryOptions()`. Verify: same cache-warmed assertion pattern as 2.1.
- [x] 2.3 Add loaders for `/accounts` (accounts "active"), `/categories` (categories "active"), `/settings` (preferences), `/recurring-expenses` (recurring list default filter + due + accounts + categories), and `/archive` + `/trash` (each route's default tab slice). Verify: cache-warmed assertions per route as in 2.1.
- [x] 2.4 Verify intent preload now fetches data: run the dev server, hover a nav link, and confirm the target route's data request fires in the network tab; confirm fresh cached slices do not re-request on navigation. Verify: observed behavior recorded in the change notes.

- [x] 2.6 Migrate loaders and the guard off the deprecated `queryClient.ensureQueryData` (query-core 5.104 deprecation, TS 6387) to `queryClient.query({ ...options, staleTime: "static" })` across all 9 files / 18 call sites. Verify: `grep ensureQueryData apps/web/src` finds nothing, typecheck and lint are clean, and the loader cache-warming, guard, and prefetch-failure tests still pass (15/15).

Observed behavior (dev servers, Chromium via automation): from `/accounts`, hovering the Transactions nav link fired `/api/activity?status=active&page=1&pageSize=20` and `/api/categories?status=active` before any click (both cold slices), while already-fresh slices stayed silent. After clicking through to `/transactions`, the full interaction logged each API call exactly once — the hover-prefetched slices were not re-requested.
- [x] 2.5 Verify prefetch failure does not block rendering: with the API stubbed to reject for one slice, navigating to that route still renders the page with its existing error/retry state. Verify: dedicated test passes.

## 3. Deferred chart bundle loading

- [x] 3.1 Convert the three dashboard chart imports to `React.lazy`, wrap each chart slot in `Suspense` with the existing Skeleton styling, and add a slot-local error boundary (reset key derived from the period) rendering a retry affordance. Verify: component tests assert the skeleton placeholder renders while the chart chunk resolves, the dashboard renders non-chart sections with the chart import failing, and retry re-mounts after the boundary reset.
- [x] 3.2 Run the bundle audit: `pnpm --filter @finance-application/web build`, inspect emitted chunks, and confirm recharts appears only in lazily imported chunks; record the entry-chunk contribution of `lucide-react` and act only on measurable dead weight. Verify: build output inspected and the audit result noted in the change.

Audit result (build `vite v8.3.5`, client assets): recharts ships only in lazily imported chunks — `chart-*.js` (95 KB gzipped, the recharts/d3 core), `income-expense-comparison-chart-*.js` (16 KB gzipped), `PieChart-*.js` (5.5 KB gzipped); none of them appear in the entry chunk (`index-*.js`, 320 KB gzipped). `lucide-react` shows zero `createLucideIcon` occurrences in any chunk (v1.x inlines per-icon SVGs; tree-shaking removes unused icons), so no barrel-import rework is warranted.

## 4. Search debounce refactor

- [x] 4.1 In `transactions.tsx`, replace the `useDebounce` → `useEffect` dispatch chain with an `onChange` handler that dispatches `setSearchInput` and schedules the 300 ms `applyDebouncedQuery` dispatch via a `useRef` timeout (cleared on unmount). Delete `use-debounce.ts` and its tests if no callers remain. Verify: transactions search tests still pass (debounce semantics preserved) and `pnpm --filter @finance-application/web test` is green.

Note: one pre-existing transactions test ("requires typing DELETE…") clicked the Trash tab immediately after mount without waiting for the page shell to clear; the refactored scheduling exposed that race. The test now waits for the tab like its siblings (3-line addition, same coverage).

## 5. Integration verification

- [x] 5.1 Run workspace-wide typecheck, lint, and tests (`pnpm typecheck`, `pnpm lint`, `pnpm test`). Verify: all green, failures triaged before completion.
- [x] 5.2 Manual smoke in dev: hard reload a protected route with a valid session (stays on route), without a session (redirects to `/login` before content), and first open of `/dashboard` (non-chart sections paint before charts). Verify: observed behaviors match the spec scenarios.

Observed behavior: a fresh unauthenticated deep link to `/dashboard` redirected to `/login` with no dashboard content rendered; signing in landed on the dashboard; a hard reload stayed on `/dashboard` with the session restored; with seeded data the dashboard rendered the summary cards and account card alongside the lazily loaded pies (recharts SVG present after the shell painted).

## Workflow follow-up

- Run `openspec validate --change optimize-web-loading-performance` before review.
- Archive the change after the project's review requirements are satisfied.
