# Tasks — harden-security-audit-findings

## 1. Ledger integrity fixes (server/api)

- [x] 1.1 Fix restore category-type guard in `transaction-service.transitionTo`: resolve the replacement category, compare its **actual type** and require `status === 'active'` for reassignment targets (archived/deleted → conflict), keep non-reassignment path as-is; split the `RESTORE_CONFLICT` message into "deleted reference" vs "category type mismatch" variants. Verify: new service test — restore expense transaction with income-category replacement returns conflict; existing reassignment test still green (`pnpm --filter @finance-application/api test`).
- [x] 1.2 Batch restore-with-reassignment writes: wrap `updateStatus` + `updateDetails` in `db.batch` in transaction and transfer services. Verify: existing restore tests pass; new assertion that both writes commit or neither (service fake honoring batch).
- [x] 1.3 Add `status='deleted'` guard to all four permanent-delete repository methods (`DELETE ... WHERE id = ? AND status = 'deleted'`) with a rows-affected check surfacing the existing conflict error. Verify: service test — permanent delete of an active row (concurrent-restore simulation) returns conflict and leaves the row.
- [x] 1.4 Account field lock counts transfer sides: add a non-deleted-transfer-sides count for the account and OR it into the lock gate in `account-service.update`. Verify: new service test — transfers-only account rejects opening-balance/type PATCH with `ACCOUNT_FIELD_LOCKED`; trash-unlocks test still passes.
- [x] 1.5 Escape LIKE wildcards: add `escapeLike` helper (`\`, `%`, `_`) and apply with `ESCAPE '\'` at transaction, transfer, and activity LIKE sites. Verify: schema-level unit tests + one workers-pool search test asserting a literal `%` query matches only literal data.
- [x] 1.6 Amount caps: introduce the shared max constant `999_999_999_999_900` paise (13-digit whole rupees × 100, matching the web form's existing cap) in `packages/schemas`; (DB CHECK constraints dropped: D1 cannot rebuild FK-referenced tables — see design decision 9). Apply to `transactionAmountSchema`, transfer amount, and `amountMinorSchema` (accounts opening balance). Verify: schema unit tests reject cap+1 and accept cap; existing fixtures pass.
- [x] 1.7 ID-conflict response: create-path PK-collision catch returns `409 ID_CONFLICT` (identical body for any colliding row) in transaction and transfer services. Verify: workers-pool test — create with a foreign user's existing id returns 409 ID_CONFLICT, not 500.
- [x] 1.8 Pagination hygiene: `page` schema `.max(10_000)`; append unique `id` (and activity's id columns) to every list/aggregate ORDER BY. Verify: schema tests reject page 10_001; workers-pool test walking pages with tied (date, createdAt) rows sees no repeat/skip.

## 2. Migration and schema

- [x] 2.1 Generate migration `0006`: `users.token_version INTEGER NOT NULL DEFAULT 0` (CHECK constraints dropped — D1 limitation, design decision 9). Verify: `pnpm exec drizzle-kit generate` produces the migration; diff reviewed; local `wrangler d1 migrations apply finance-application --local` succeeds and existing rows unaffected.
- [x] 2.2 Update Drizzle schema (`server/api/src/db/schema.ts`) to match, keeping the migration diff empty on re-generation. Verify: `drizzle-kit generate` emits no further changes.

## 3. Auth and session hardening (server/api)

- [x] 3.1 Disable registration: register route returns `403 REGISTRATION_DISABLED` before any body processing or lookup; remove register service usage from the route; update `packages/api-client` auth module error handling if needed. Verify: workers-pool test — register with valid and invalid bodies both return the identical 403 envelope.
- [x] 3.2 Refactor API test setup: add `seedUser`/`seedUserAndLogin` test helpers (insert user via repository with `hashPassword`, then login over HTTP for cookies); migrate every workers-pool test that used register; replace register-route tests with disabled-state tests. Verify: full `pnpm --filter @finance-application/api test` green (both pools).
- [x] 3.3 Fix rotation race: conditional `UPDATE ... AND revoked_at IS NULL`, read `meta.changes`, skip INSERT and return `INVALID_REFRESH_TOKEN` when 0. Verify: new workers-pool concurrency test (two concurrent refreshes sharing one cookie, ≤20 interleaving retries) asserts exactly one 200 and one unrevoked replacement row.
- [x] 3.4 tokenVersion: access JWT gains `ver` (version-0 default for tokens without the claim); `requireAuth` rejects `ver` mismatch; logout increments the version in the same batch as the refresh revoke. Verify: workers-pool tests — post-logout access token rejected with 401; pre-deploy-style token without `ver` still accepted while version is 0.
- [x] 3.5 Constant-time login: module-level dummy PHC hash verified when `findByEmail` misses. Verify: workers-pool test — unknown-email login returns the generic 401 (behavioral); note the cost-parity rationale in the service doc comment.
- [x] 3.6 Rate limiting: add the Workers rate-limit binding to `wrangler.jsonc` + `env.d.ts`; check before credential work in register/login/refresh (login keyed `login:{ip}:{email}`, others `{endpoint}:{ip}`); return `429 RATE_LIMITED` envelope; make the limiter injectable so tests can stub it. Verify: workers-pool tests with a stubbed limiter — over-limit login returns 429 with no Argon2id call observed; under-limit requests pass.
- [x] 3.7 Cookie prefixes: rename to `__Host-access_token` (path `/`) and `__Secure-refresh_token` (path `/api/auth`), update `session.ts` constants and every read/clear site. Verify: workers-pool test asserts Set-Cookie names and attributes; existing session flows green.
- [x] 3.8 Refresh-token purge: after successful login/refresh, delete the user's expired rows and rows revoked more than 7 days ago; log-and-continue on failure. Verify: workers-pool test — stale revoked row disappears on next login; valid rows remain.

## 4. Platform (server/api + assets)

- [x] 4.1 Docs gating: read `docs_enabled` from env; when unset/false, `/api/openapi` and `/api/docs` return the standard 404 `NOT_FOUND` envelope; `.dev.vars.example` documents the local default `"true"`. Verify: workers-pool tests both states (env override in the vitest config); existing docs test updated to the enabled case.
- [x] 4.2 `Cache-Control: no-store` on all `/api/*` responses via middleware mounted before routes. Verify: workers-pool test asserts the header on a success, a validation error, and a 404.
- [x] 4.3 Security headers for assets: add `apps/web/public/_headers` with `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`; confirm Vite copies it into `dist/client`. Verify: workers-pool test asserts headers on the shell and on an SPA-fallback path.

## 5. Web client (apps/web)

- [x] 5.1 Cache reset on identity change: `queryClient.clear()` in `useLogin`/`useRegister` `onSuccess` and `useLogout` `onSettled` (before navigation; `['me']` re-seeded after). Verify: new jsdom test — principal A's cached rows are absent after B signs in; existing auth hook tests green.
- [x] 5.2 Register page closed state: `/register` renders a registration-closed message with a `/login` link and no form. Verify: jsdom route test asserts the message and link.
- [x] 5.3 Gate TanStack devtools behind `import.meta.env.DEV`. Verify: production build contains no devtools code (build + grep check documented in the task).

## 6. Repo, CI, and docs

- [x] 6.1 CI: pin `actions/checkout`, `pnpm/action-setup`, `actions/setup-node` to full commit SHAs; add `permissions: contents: read`. Verify: workflow YAML parses; `pnpm turbo run typecheck lint test build` green in CI.
- [x] 6.2 `.gitignore`: add `.env.*`. Verify: `git check-ignore .env.production` succeeds.
- [x] 6.3 Error logging: `app.ts` onError logs `error.name` and `error.message` only. Verify: unit test on the error handler output shape.
- [x] 6.4 Cleanup: delete the caller-less `countNonDeletedByCategory`; remove the unsafe cast in `verifyAccessToken` (narrow the JWT payload explicitly). Verify: typecheck + full lint clean; grep shows no remaining references.
- [x] 6.5 README deployment notes: Cloudflare WAF rate-limit rule for `/api/auth/*` (one-time owner step), `docs_enabled` explanation, and the remote-DDL drift check command (`wrangler d1 migrations list finance-application --remote`). Verify: doc section review.
- [x] 6.6 Update `user-story/01-inital/main.md` single-user claim note and README auth section to reflect disabled registration. Verify: docs consistent with 403 behavior.

## 7. Full verification

- [x] 7.1 Run the complete offline pipeline: `pnpm turbo run typecheck lint test build` (all workspaces, both vitest pools). Verify: all green.
- [x] 7.2 Cross-check implementation against every delta scenario in this change's `specs/` (walk each scenario, name its test). Verify: a mapping note in the PR description; no unimplemented scenario.
- [x] 7.3 Re-validate audit lead closure: NV-1 (rotation concurrency test), NV-2 (restore type test), NV-3 (client cache test) each covered by a landed test. Verify: pointers to the three tests recorded in the PR description.
