# Proposal

## Why

The run-1 security audit (source ref `3ca2df0`, 35/35 coverage units closed, 5 independently verified leads, ~30 hardening notes) found no confirmed exploit but identified five verified defects/risks — a refresh-rotation race that can double-issue sessions, a tautological restore validation guard, a cross-principal client cache leak, unbounded pre-auth CPU with no rate limiting, and an open-registration surface that contradicts the product's single-user claim — plus a set of small correctness and defense-in-depth gaps. This change fixes the accepted subset in one coordinated pass so each fix ships with its regression test and spec delta.

## What Changes

**Auth and sessions (`user-auth`)**
- **BREAKING**: `POST /api/auth/register` is permanently disabled — responds `403 REGISTRATION_DISABLED`; the `/register` page shows a closed message. The owner's account already exists in production; API tests seed users directly instead of self-registering.
- Fix the refresh-rotation race: the rotation UPDATE becomes conditional on `revoked_at IS NULL` with a rows-changed check, so two concurrent refreshes can no longer both succeed (audit lead NV-1).
- Add a per-user `token_version`: access JWTs carry the version, `requireAuth` verifies it, and logout bumps it — the 15-minute access token stops working immediately on logout instead of lingering.
- Add an in-app rate limiter on the auth endpoints (Workers rate-limit binding, keyed per IP and per IP+email) reversing the design doc's recorded deferral; a Cloudflare WAF rule is added once at deployment (documented, not code).
- Constant-time login: a fixed dummy Argon2id verification runs when the email does not exist, closing the response-time existence oracle while keeping the spec-mandated generic message.
- Purge expired/revoked refresh tokens opportunistically on successful login/refresh to bound storage growth.
- Rename cookies to `__Host-access_token` and `__Secure-refresh_token`.

**Ledger integrity (`transactions`, `transfers`, `accounts`)**
- Fix restore-with-reassignment validation: the replacement category's **actual type** is compared (expense onto income currently slips through a tautological guard — audit lead NV-2), replacement targets must be active, and the conflict message distinguishes type mismatch from deleted reference.
- The account opening-balance/type field lock now also counts non-deleted transfer sides, and the spec wording ("posted transaction") is clarified accordingly.
- Permanent delete gains a `status='deleted'` guard (a concurrent restore can no longer be physically deleted mid-flight); restore-with-reassignment writes become one atomic `db.batch`.
- Amounts (`amountMinor`, `openingBalanceMinor`) get an upper bound consistent with the web form's 13-digit whole-rupee cap; search treats `%` and `_` as literal characters; client-generated id collisions with any existing row return a neutral `409 ID_CONFLICT` instead of `500`; list pagination gains a page-number cap and a unique `id` ORDER BY tiebreaker.

**Platform (`api-platform`, `web-platform`)**
- **BREAKING**: `/api/openapi` and `/api/docs` are served only when documentation is enabled by configuration (on in local development, off in production).
- API responses get `Cache-Control: no-store`; static assets/SPA fallback get security headers (`frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`) via a `_headers` file.

**Client and repo hygiene**
- TanStack Query cache is cleared on login/register/logout (previous principal's cached rows can no longer render for the next principal — audit lead NV-3); TanStack devtools render only in dev.
- CI: pin Actions to commit SHAs, add a least-privilege `permissions` block; `.gitignore` covers `.env.*`; error logging keeps only `error.name`/`error.message`; dead code and the one unsafe cast are removed; README documents the WAF rule, docs flag, and a remote-DDL drift check command.

## Capabilities

### New Capabilities

None — every fix lands inside an existing capability's boundary.

### Modified Capabilities

- `user-auth`: registration disabled (replaces open-registration requirement and register-page flow); logout immediately invalidates the access token via token version; session tokens gain a version claim and cookie renames; new rate-limiting and refresh-token purge requirements; constant-time login.
- `api-platform`: API self-documentation becomes configuration-gated; new cache-directive requirement for API responses.
- `web-platform`: served static assets and SPA fallback carry security headers.
- `accounts`: field lock covers transfer sides; opening balance gains an upper bound.
- `transactions`: literal wildcard search, amount upper bound, neutral id-conflict response, page cap and stable pagination order.
- `transfers`: same search, amount, id-conflict, and pagination changes.

## Impact

- `server/api`: auth routes/service/middleware/repositories, refresh-token repository, transaction/transfer/account services and repositories, list schemas, `wrangler.jsonc` (rate-limit binding, docs flag), one migration (`users.token_version`, amount CHECKs), `app.ts` (no-store middleware, docs gating).
- `packages/schemas`: amount caps, page cap; response/error code additions.
- `apps/web`: `use-auth.ts` (cache clear), register page, `__root.tsx` devtools gate; cookie rename is invisible to the client (HttpOnly).
- Tests: registration-dependent API tests refactored to seed users + login; new regression tests for the rotation race, restore type guard, field-lock transfers, pagination stability, rate limiting, and docs gating.
- CI/deploy: `.github/workflows/ci.yml`, `.gitignore`, README deployment notes (WAF rule, docs flag, remote-DDL check). Deployed sessions survive via the version-0 default; old cookie names invalidate in-flight sessions once at deploy.
