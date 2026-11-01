# Proposal

## Why

The web app is a private, single-user finance application: SSR buys it nothing (no SEO, no sharing previews, negligible first-paint gain) while costing a second Worker, a second deploy pipeline, and a cross-origin problem between the web and API workers. The installed TanStack Start (1.169.4) has native SPA mode (verified in the plugin schema: `spa.enabled` with a build-time prerendered shell), which turns the web build into pure static output. Serving that output as Cloudflare Workers static assets **from the existing API worker** gives one origin, one deploy, and zero compute cost for page requests.

## What Changes

- Switch `apps/web` from SSR to **SPA mode**: `tanstackStart({ spa: { enabled: true } })` in `vite.config.ts`. The build prerenders a single HTML shell and all route content renders client-side. No new dependencies.
- Serve the SPA from the existing `finance-application-api` worker via a Workers **static assets** block in `server/api/wrangler.jsonc`:
  - `directory: ../../apps/web/dist/client`
  - `not_found_handling: "single-page-application"` (hard refresh on client routes works)
  - `run_worker_first: ["/api/*"]` (API paths always reach Hono, never the SPA fallback)
- Consequence: unknown **non-API** paths now return the SPA shell with status `200` and the not-found view renders client-side; unknown `/api/*` paths keep returning the JSON error envelope with `404`.
- No `@cloudflare/vite-plugin` — the worker is already bundled by wrangler, and the web build is static-only after this change.
- Deployment: the existing Cloudflare build (`pnpm run build`, which builds all packages via turbo) stays; the Worker's deploy command must target the package (`cd server/api && npx wrangler deploy`) — the fix already identified for the API-only deploy, unchanged.
- Local dev loop unchanged: `vite dev` + `/api` proxy for web work; `wrangler dev` serves the built SPA after a web build.

Out of scope: auth or data-model changes, preview-deployment configuration, custom cache-header tuning, and any change to API endpoint behavior. Client-side rendering of existing routes (dashboard, transactions, accounts, categories, auth views) is behavior-preserving — none use `createServerFn` (verified).

## Capabilities

### New Capabilities

- `web-platform` (delta in this change): adds the serving requirements — single-origin static serving with API precedence, SPA fallback, client-side not-found handling, and preserved API error semantics. Note: a `web-platform` delta also exists in the still-unarchived `scaffold-tanstack-start-web` change with SSR-era requirements; that stale delta must be revised as a companion update (see Impact), since `web-platform` was never synced to a main spec (only `accounts` exists today).

### Modified Capabilities

- None as main specs (none exist for these capabilities yet). The `api-platform` delta in the still-unarchived `scaffold-project-hono-api` scopes its not-found requirement to "unknown paths" — after this change that behavior applies only under `/api/*`; a companion update revises that wording.

## Impact

- **Code**: `apps/web/vite.config.ts` (one option), `server/api/wrangler.jsonc` (one block). No dependency changes, no route/component changes, no test changes expected (component tests never asserted SSR).
- **Behavior**: HTTP 404 for unknown app routes becomes 200 + client-side not-found view (spec'd); `/api/*` semantics unchanged.
- **Companion artifact updates required** (separate workflow, not this change's code):
  1. `scaffold-tanstack-start-web` — its `web-platform` delta's SSR-before-hydration requirement and HTTP-404 requirement are superseded by this change's delta.
  2. `scaffold-project-hono-api` — its `api-platform` not-found requirement needs "under `/api/`" scoping.
  Both changes are still active and unarchived; updating them prevents contradicting deltas from colliding at archive time. Archive order: revise first, then archive either.
- **Deploy config**: Cloudflare dashboard deploy command for the worker (`cd server/api && npx wrangler deploy`); build command unchanged.
- **Docs**: README deploy/dev notes.
