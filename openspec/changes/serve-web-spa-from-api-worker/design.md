# Design

## Context

The web app (TanStack Start 1.169.4, Vite 8, 7 routes — dashboard, transactions, accounts, categories, login, register, index) currently builds in SSR mode (`dist/client` + `dist/server`) with no deployment target wired. All data flows through TanStack Query fetches to the relative `/api/...` paths (zero `createServerFn` usage — verified); the API is a Hono worker with a provisioned remote D1 database. The user decided SSR is not worth a second worker for a private single-user app (explore session: options A–D compared; A won). See proposal.md; specs/web-platform/spec.md is the behavioral contract.

## Goals / Non-Goals

**Goals:**

- One Worker serving both the SPA (static assets, zero compute per page request) and the API (Hono under `/api/`).
- Hard-refresh-safe client-side routing via SPA fallback.
- Zero new dependencies; minimal config surface (one vite option, one wrangler block).
- Unchanged local dev loop and unchanged CI pipeline.

**Non-Goals:**

- No `@cloudflare/vite-plugin` — it exists to bundle workers with Vite; our worker is bundled by wrangler and the SPA build is static-only after this change.
- No Cloudflare Pages, no preview-deployment setup, no custom cache rules.
- No changes to API endpoints, auth flow, or data access.
- No removal of the shell/layout structure — the prerendered shell keeps first paint non-blank.

## Decisions

### D1. SPA mode via the built-in option — no framework migration

`tanstackStart({ spa: { enabled: true } })` in `apps/web/vite.config.ts`. Verified against the installed plugin (`spaSchema` in `@tanstack/start-plugin-core`): `enabled` defaults true when the block is present, the shell prerenders to `/_shell` (`prerender.outputPath`) and is masked at `/` (`maskPath`). Route content renders client-side after hydration. One implementation wrinkle discovered while verifying: Cloudflare's SPA fallback serves `index.html`, but the plugin emits the shell as `_shell.html` and `prerender.outputPath: "/"` produces a file literally named `.html` — so the build runs a post-build copy (`apps/web/scripts/copy-spa-shell.mjs`, wired into the `build` script) bridging `_shell.html` → `index.html`. _Alternatives rejected_: TanStack Router router-only mode (larger migration of an already-working app for no user-visible gain); staying SSR (the second-worker cost the user rejected).

### D2. Static assets on the existing worker — the assets layer, not Hono

`server/api/wrangler.jsonc` gains:

```jsonc
"assets": {
  "directory": "../../apps/web/dist/client",
  "not_found_handling": "single-page-application",
  "run_worker_first": ["/api/*"]
}
```

Cloudflare's assets layer serves matching files directly without invoking the worker (free, fast); `run_worker_first` routes `/api/*` to Hono before the fallback can swallow it; `not_found_handling: "single-page-application"` returns the shell for every other path so deep links and hard refreshes work. _Alternatives rejected_: Hono serving assets via `env.ASSETS` (pays worker invocation per asset); Pages (second product, cross-origin).

### D3. API 404 semantics survive untouched

`app.notFound` in `server/api` keeps returning the `NOT_FOUND` envelope; after this change it only ever fires for `/api/*` (assets handle everything else). No code change — the delta spec pins the behavior so the SPA fallback can never regress it.

### D4. Deploy flow — one build, one deploy, package-scoped command

Cloudflare build command stays `pnpm run build` (turbo builds all packages). Because `wrangler deploy --dry-run` validates the assets directory, `api#build` genuinely consumes `web#build`'s output — and turbo runs package builds in parallel unless told otherwise, which CI caught (fresh runner, no leftover `dist`). Fix: `server/api/turbo.json` (package configuration) adds `"dependsOn": ["^build", "@finance-application/web#build"]` to the API's build task, so the web build always completes first — verified from a clean state (both `dist` dirs deleted). Deploy command becomes `cd server/api && npx wrangler deploy` (the fix already identified for the API-only deploy; unchanged by this change). Local `pnpm --filter @finance-application/api exec wrangler deploy` requires a prior web build — documented in README.

### D5. Dev loop unchanged, with one documented caveat

`vite dev` + `/api` proxy remains the daily loop (SPA mode renders client-side in dev; the proxy still reaches `wrangler dev`). `wrangler dev` on 8787 now also serves the SPA from the assets dir — but only reflects the last `vite build`, not live edits. Documented in README; not a problem since the proxy flow is the primary loop.

## Risks / Trade-offs

- [Cross-package asset directory (`../../apps/web/dist/client`) fails validation or deploy if the web build hasn't run] → Cloudflare builds run `pnpm run build` (all packages) before deploy; local deploys documented to run the full build first; `wrangler deploy --dry-run` in CI catches a missing directory on every push.
- [`run_worker_first` misconfiguration lets the SPA fallback swallow API routes] → the delta spec's API-precedence and unknown-API-path scenarios are smoke-tested in the integration task against the running worker.
- [Stale SSR-era deltas in unarchived scaffold changes contradict this change] → companion artifact updates named in the proposal; revise before archiving either change.
- [HTTP 404 for unknown app routes becomes 200 + client-side view] → accepted and spec'd; APIs keep real 404s. Users see the same not-found UI.
- [Auth flows render client-side only] → verified acceptable: login/register are client forms hitting the API; no server-rendered auth state exists today.
- [Hash-based asset names + SPA fallback could serve stale HTML after deploys] → Cloudflare assets invalidate on deploy; the shell is small and uncached by default. Revisit only if staleness is observed.

## Migration Plan

Additive config change; rollback is deleting the assets block and reverting the vite option. No data, schema, or API contract changes. Verification order: build web → `wrangler dev` → smoke-test asset serving, SPA fallback, API precedence, API 404 → dry-run in CI → dashboard deploy command set → push and verify the live deployment.

## Open Questions

None — the serving model, option names, and plugin support were verified during exploration against the installed packages.
