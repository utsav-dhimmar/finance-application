# Proposal

## Why

The web app fetches everything client-side after mount: every protected page renders a loading shell, waits for `/api/me` to resolve, then fires its data queries, and only redirects unauthenticated visitors after that auth round-trip completes. The router already declares `defaultPreload: "intent"`, but with no route loaders it prefetches code chunks only, never data. An audit against Vercel's React performance guidelines also found recharts statically bundled into the dashboard route and a duplicated per-route auth-guard pattern, so navigation latency and the dashboard's initial JS cost are both higher than they need to be — while all existing behavior stays the same.

## What Changes

- **Route-level data loading**: add TanStack Router `loader`s that warm the TanStack Query cache via `queryClient.ensureQueryData` (auth session plus each page's primary data), so queries start during navigation in parallel and link hover/intent preload now also prefetches data.
- **Route-level authentication guard**: replace the `useEffect`-based redirect duplicated across protected pages (dashboard, transactions, accounts, categories, archive, trash, settings) with a router-level guard that redirects to `/login` before any protected content renders, per the existing user-auth redirect requirements. Public pages stay public.
- **Deferred chart bundle**: lazy-load the dashboard's chart components (React.lazy + Suspense) so recharts is fetched off the dashboard's critical path; the dashboard shell and summary cards render immediately, with skeletons in the chart slots.
- **Search debounce simplification** (internal refactor, no behavior change): move the transactions search debounce from an input-state → debounce-state → effect-dispatch chain to a handler-scheduled dispatch, removing one render per keystroke.
- **Bundle audit**: verify the production build tree-shakes `lucide-react` barrel imports; change imports only if the audit shows measurable dead weight.

Non-goals: no change to API endpoints, query keys, invalidation rules, visual design, or financial logic. No SSR/streaming rework (app ships as SPA shell per web-platform).

## Capabilities

### New Capabilities

<!-- none: route loading and bundle discipline extend the existing platform capability -->

### Modified Capabilities

- `web-platform`: add requirements for route-level data prefetch on navigation/intent preload, router-level authentication redirect before protected content renders, and deferred loading of the chart bundle on the dashboard.

## Impact

- **Code**: `apps/web/src/router.tsx` (guard helpers/context), all `apps/web/src/routes/*.tsx` (loaders, guard removal, chart lazy-loading), `apps/web/src/components/charts/*` (lazy-compatible wrappers), `apps/web/src/routes/transactions.tsx` (debounce), `apps/web/src/services/*` (query options reused by loaders — no key or shape changes).
- **Specs**: `openspec/specs/web-platform/spec.md` gains three requirements (delta in this change); `user-auth` redirect scenarios remain satisfied — the guard now enforces them earlier.
- **Behavior**: externally observable changes are limited to faster navigation (data fetched in parallel during navigation; hover preload) and chart-slot skeletons while recharts loads. Redirects, page content, error states, and financial calculations are unchanged.
- **Risks**: loaders run during navigation, so a failing query must not block rendering the page shell — loaders prefetch best-effort with existing retry/error states intact. Auth guard must preserve the "redirect without rendering protected content" guarantee including on hard reloads and deep links.
