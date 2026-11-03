# Tasks

## 1. SPA build and worker assets

- [x] 1.1 Enable SPA mode in `apps/web/vite.config.ts` (`tanstackStart({ spa: { enabled: true } })`) per design D1; verify `pnpm --filter @finance-application/web build` succeeds and `dist/client` contains the prerendered shell HTML and hashed assets
- [x] 1.2 Add the static assets block to `server/api/wrangler.jsonc` (`directory: ../../apps/web/dist/client`, `not_found_handling: "single-page-application"`, `run_worker_first: ["/api/*"]`) per design D2; verify after the web build that `pnpm --filter @finance-application/api exec wrangler deploy --dry-run` validates the config and lists the assets directory

## 2. Integration verification

- [x] 2.1 Build the web app, start `wrangler dev`, and smoke-test the four spec behaviors against http://127.0.0.1:8787: a built asset path returns `200`, `/` returns the shell HTML, `/transactions` returns the shell (SPA fallback), `/api/hello` returns API JSON, and `/api/does-not-exist` returns the `404` `NOT_FOUND` envelope; verify in the browser that a hard refresh on `/transactions` renders the view and an unknown path renders the not-found view; stop the server
- [x] 2.2 Run the full pipeline with `pnpm turbo run typecheck lint test build` and verify every task exits 0 with no test regressions; confirm the CI workflow needs no changes (the dry-run build in CI now also validates the assets config per design D4)
- [x] 2.3 Update `README.md`: local deploy note (web build before `wrangler deploy`), the single-worker serving model, the `wrangler dev` serves-last-build caveat, and the Cloudflare deploy command; verify each documented command runs as written

## 3. Deployment

- [x] 3.1 In the Cloudflare dashboard, set the Worker's deploy command to `cd server/api && npx wrangler deploy` (build command unchanged: `pnpm run build`); verify the setting is saved
- [x] 3.2 Commit, push, and verify the Cloudflare build deploys successfully; verify against the live URL: `/` serves the shell, a client route hard-refresh renders, `/api/*` returns API responses, and an unknown `/api/*` path returns the `404` envelope

## Workflow follow-up

- Companion artifact updates before archiving anything (separate `/openspec-update-change` runs): revise the SSR-era `web-platform` delta in `scaffold-tanstack-start-web` and scope the `api-platform` not-found requirement to `/api/` in `scaffold-project-hono-api`.
- Archive this change once review, CI, and the live deployment are satisfied (`/openspec-archive-change`).
