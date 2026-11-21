# Design

## Context

The app is a TanStack Start SPA (prerendered shell + Cloudflare static serving) whose router context already carries a `QueryClient`; `router.tsx` sets `defaultPreload: "intent"` and `defaultPreloadStaleTime: 0`, but no route defines a `loader`, so intent preload fetches only code chunks. Every protected page duplicates the same component-level pattern: `useMe()` + `useEffect` redirect when `me.data === null` + an early-return loading shell, with data queries starting only after mount. The dashboard statically imports three chart components, pulling recharts into the dashboard chunk on first navigation. All page data flows through `services/*-service.ts` modules that export shared `*QueryOptions` factories — the same factories `useQuery` consumes today can warm the cache from loaders, so no data-shaping logic is duplicated.

## Goals / Non-Goals

**Goals:**

- Start each route's data requests during navigation (parallel, before mount) using loaders + `queryClient.ensureQueryData` over the existing query-option factories.
- Enforce authentication at the routing layer once, replacing the per-page `useEffect` guards.
- Keep recharts off the dashboard's critical path via `React.lazy` + `Suspense`.
- Preserve every existing observable behavior except timing (loading → content) and chart-slot placeholders.

**Non-Goals:**

- No SSR/streaming rework or server functions (app ships as SPA shell per `web-platform`).
- No changes to API endpoints, query keys, cache invalidation families, or the `serializeFilters` key canon.
- No virtualization/table refactors; React Compiler already covers those re-render rules.
- No new dependencies.

## Decisions

### D1: Loaders call `ensureQueryData` on existing query options (best-effort prefetch)

Each data-backed route's `loader` awaits `context.queryClient.ensureQueryData(<page's queryOptions>)` for the slices the page renders on first paint. Example mapping: `/dashboard` → `me` (guard) + `reportsQueryOptions(current-month default)` + `activityQueryOptions({})` + due-recurring + `preferencesQueryOptions()`; `/transactions` → guard + default-filter `activityQueryOptions` + `accountsQueryOptions("active")` + `categoriesQueryOptions("active")` + preferences; other routes follow the same "what the page renders from cache on first paint" rule.

- Why not SSR server functions: the web-platform spec fixes SPA-shell static serving; loaders already run before component mount on navigation and on hard reload, which is the waterfall we are removing.
- Why `queryClient.query({ ...options, staleTime: 'static' })` instead of raw fetch (migrated off the deprecated `ensureQueryData` per query-core 5.104): it dedupes with in-flight queries and the component's `useQuery` then reads the warm cache with zero code duplication. `'static'` treats existing cached data as never stale — only missing or invalidated slices fetch — so mutation invalidation still forces a refresh on the next navigation, while purely time-stale slices are served from cache (the page's own `useQuery` keeps its 30s freshness refetch).
- **Loader failures must not block rendering**: wrap each data prefetch in `catch(() => undefined)` so a failed prefetch falls back to the page's existing pending/error/retry states (spec: best-effort). The auth guard is the one deliberate exception (D2).

### D2: Router-level guard via `beforeLoad` + shared helper

Add a shared `guardAuthenticated({ context })` helper: `await ensureQueryData(meQueryOptions())`; if the session resolves to `null`, `throw redirect({ to: "/login" })`; if the me query *throws* (API unreachable — distinct from "not signed in"), swallow the error and let the page proceed, preserving today's behavior where the page shows its loading shell and the hook surfaces the failure. Each protected route (`dashboard`, `transactions`, `accounts`, `categories`, `archive`, `trash`, `settings`, `recurring-expenses`) adds `beforeLoad: guardAuthenticated` and drops its `useEffect` guard, early-return shells stay for query-pending states. `login`/`register` get the inverse guard (authenticated → `/dashboard`) per the existing user-auth requirement.

- Why per-route `beforeLoad` + helper instead of a pathless layout route: a `_authed` layout would move every route file and change route IDs for a one-line-per-route win; revisit only if the protected set grows again.
- `fetchSessionUser` already performs refresh-once-on-401, so a hard reload holding a valid refresh cookie restores the session inside the guard before anything renders.
- Components keep calling `useMe()` — it reads the loader-warmed cache; no component auth state is introduced.

### D3: Dashboard loaders prefetch the default period only

The period (mode/month/year) lives in component state defaulting to the current month. The loader computes the same default and prefetches that one report slice; period changes continue through `useQuery`. Prefetching every conceivable period is out of scope; hover preload covers period changes once navigated.

### D4: Charts via `React.lazy` + `Suspense` + slot-local error boundary

The dashboard imports the three chart components with `lazy(() => import(...))` and wraps each chart slot in `Suspense` with the existing `Skeleton` styling as fallback. A small slot-local error boundary (class component, reset key = period key) renders a retry affordance when the chunk import fails, satisfying the containment scenario. `packages/ui`'s `chart.tsx` keeps its static recharts import — it is only reachable from the now-lazy chart modules, so recharts lands in a lazy chunk; verify via build output rather than restructuring the shared package.

- Why not `next/dynamic` or route-level `lazyRouteComponent`: TanStack Start (no Next.js); route code-splitting already exists — the win is deferring recharts off the dashboard chunk itself.
- Why an error boundary instead of bare Suspense: a rejected chunk import unmounts the subtree; without a boundary the whole route would crash (spec: failure contained to chart slots).

### D5: Debounce moves from effect chain to handler scheduling

In `transactions.tsx`, the search input currently round-trips input state → `useDebounce` state → `useEffect` → `applyDebouncedQuery` dispatch. Replace with: the `onChange` handler dispatches `setSearchInput` and (re)schedules a 300 ms timeout (held in a `useRef`) that dispatches `applyDebouncedQuery`; an unmount-only effect clears the timer. One render per keystroke instead of three, same 300 ms settle semantics (`rerender-move-effect-to-event`). `useDeferredValue` was rejected: it does not debounce network calls and would multiply requests. If no other caller remains, delete `use-debounce.ts` with its tests.

### D6: Bundle audit is verify-then-act

Run `vite build`, inspect the emitted chunk list: assert recharts appears only in a lazily imported chunk and check `lucide-react` contribution to the entry chunk (it is ESM tree-shakeable; expect no action). Change imports only if the audit shows measurable dead weight — otherwise record the result and stop.

## Risks / Trade-offs

- [Failed prefetch could hide data errors early] → loaders catch all data-prefetch rejections; page-level pending/error/retry states remain the single source of truth, tested by existing suites.
- [jsdom tests render components without router loaders, so guard removal could regress redirect tests] → update affected tests to seed the query cache (or drive the real router) and keep one router-level test asserting the unauthenticated redirect; component tests keep stubbing `useMe` for pending states.
- [Guard "swallow me-query errors" could mask an API outage as an eternal loading shell] → that is today's behavior; surfacing a route-level error state is a separate UX change out of scope.
- [Intent preload now fetches data on hover — extra requests] → bounded by the 30s query `staleTime` and existing `defaultPreloadStaleTime: 0`; read-only GET endpoints only, matching the current mutation-free prefetch profile.
- [Recharts regression via a future static import] → D6's build-output check becomes the review step for any dashboard change.

## Migration Plan

Single PR, client-only: implement loaders/guards → lazy charts → debounce refactor, run `pnpm typecheck`, lint, Vitest, `vite build` audit (D6). No DB, API, or spec-behavior migration. Rollback = revert the commit; the app reverts to mount-time fetching with no data-format residue.

## Open Questions

None — per-route prefetch lists follow D1's rule and are enumerated in tasks.
