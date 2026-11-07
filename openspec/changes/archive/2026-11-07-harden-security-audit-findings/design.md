# Design — harden-security-audit-findings

## Context

Audit run-1 (`C:\Users\utsav\security-audit-skill\finance-application\run-1\`) verified five leads and recorded ~30 hardening notes against commit `3ca2df0`. The server is one Hono worker on Cloudflare with D1; sessions are HS256 cookie JWTs (15 min) plus rotating hashed refresh tokens (30 days); balances are derived; the SPA is a static asset with TanStack Query. Registration must end up hard-disabled (owner account already exists in prod), rate limiting must exist in-app plus a one-time Cloudflare WAF rule, and docs must be config-gated. Existing test suites: node-pool unit tests, workers-pool API tests (miniflare D1, `JWT_SECRET` injected), jsdom web tests.

## Goals / Non-Goals

Goals: close audit leads NV-1..NV-3 and the accepted subset of NV-4/NV-5 mitigations; land the accepted hardening set with a regression test each; keep every spec delta small and testable.

Non-Goals: no refresh-token family revocation (decided against); no new framework/deps beyond the Workers rate-limit binding; no self-hosting the Scalar bundle (docs are off in prod; dev is trusted); no cron triggers (purge is opportunistic); no changes to money math or reporting semantics.

## Decisions

1. **Registration disable — unconditional route rejection.** `routes/auth.ts` register handler returns `403 REGISTRATION_DISABLED` before reading the body (no lookup, no hashing, no disclosure). The register Zod schema stays for the error contract. `/register` page becomes a static "registration closed" notice with a login link. *Alternative considered:* env kill switch or first-user-then-lock — rejected by owner decision (2026-11-06 grilling). **Consequence:** API tests that self-register are refactored to a `seedUser` helper that inserts the user via `auth-service`/repository and logs in over HTTP to obtain cookies; register-route tests become disabled-state assertions.

2. **Rotation race — conditional UPDATE + rows-changed check.** `revokeAndReplace` becomes `UPDATE refresh_tokens SET revoked_at=? WHERE id=? AND revoked_at IS NULL` inside the existing batch, then reads `meta.changes`; when 0, the service returns `INVALID_REFRESH_TOKEN` and skips the INSERT. D1 batch atomicity already covers the pair; the guard closes the check-then-act window. Regression test drives two concurrent `Promise.all` refreshes (retry loop ≤20 iterations for interleaving). *Alternative:* SELECT-per-user serialization — heavier, unnecessary.

3. **tokenVersion — column + claim + middleware check.** Migration adds `users.token_version INTEGER NOT NULL DEFAULT 0`. Access JWT gains `ver` (existing tokens without `ver` are treated as version 0, so in-flight sessions survive deploy). `requireAuth` rejects mismatch. Logout increments the version in the same batch as the refresh-token revoke (single-user cost is trivial). *Alternative:* token denylist — rejected (new table, more state).

4. **Rate limiting — Workers rate-limit binding.** One binding (`RATE_LIMITER`, e.g. 30 requests / 60 s window) keyed per request: login uses `login:{ip}:{email}`, register/refresh use `{endpoint}:{ip}`. Checked before body parsing of credentials; `429 RATE_LIMITED` envelope. Binding config lives in `wrangler.jsonc`; local workers-pool tests get the binding via the vitest miniflare config (same pattern as `JWT_SECRET`). The Cloudflare WAF rule (dashboard, once) is documented in README, not code. *Alternatives:* D1-backed limiter (extra table + latency), in-memory Map (per-isolate, ineffective).

5. **Constant-time login — fixed dummy hash.** A module-level constant PHC string (generated once with the same parameters) is verified when `findByEmail` misses. Cost parity with the found-user path. No spec-visible change beyond timing.

6. **Purge — opportunistic DELETE on login/refresh.** After a successful session write, `DELETE FROM refresh_tokens WHERE user_id=? AND (expires_at < now OR (revoked_at IS NOT NULL AND revoked_at < now - 7d))`. Bounded, no cron. Runs in the same request; failure is non-fatal (logged, not thrown).

7. **Restore reassignment validation — single guard rewrite.** In `transaction-service.transitionTo`: resolve the replacement category/account, require `status==='active'` and (categories) `type===transaction.type` for **reassignment targets**, while existing archived references remain restorable per spec. Error messages split: `RESTORE_CONFLICT` code stays, message distinguishes "deleted reference" vs "category type mismatch". The account-side restore check (existence/ownership/not-deleted) is unchanged. Note: the transfers spec already required active replacement accounts — code now matches it.

8. **Field lock counts transfer sides.** New repository count (`non-deleted transfer sides referencing the account`) OR'd with the existing transaction count in `account-service.update`'s lock gate; `updateDetails` untouched. Spec wording change recorded in the accounts delta. Regression: transfers-only account rejects opening-balance/type PATCH; trash-unlocks behavior still holds when all referencing records are soft-deleted.

9. **Amount caps — one shared constant, Zod-enforced.** Max = `999_999_999_999_900` paise (13-digit whole rupees × 100, matching the existing web form cap; ≈1e14 < 2^53), enforced in `packages/schemas` (transactions, transfers, accounts). **No DB CHECK constraints**: adding a CHECK requires a SQLite table rebuild, and D1 cannot disable foreign-key enforcement (`PRAGMA foreign_keys=OFF` is a no-op; `defer_foreign_keys` fails on miniflare), so rebuilding the RESTRICT-referenced `accounts`/`transactions`/`transfers` tables is not safely possible. The Zod boundary is the authoritative validation layer (AGENTS.md); the existing DB CHECKs stay as-is.

10. **Search literals — escape helper.** `escapeLike(q)` replaces `\`, `%`, `_` with `\`-prefixed forms; the three LIKE sites (transaction, transfer, activity repositories) wrap with `ESCAPE '\'`. Activity repository's raw-SQL needle uses the same helper.

11. **ID conflict + pagination hygiene.** Create-path catch for PK violations returns `409 ID_CONFLICT` (identical body regardless of who owns the colliding row). `page` schema gains `.max(10_000)`; every list/aggregate ORDER BY appends `id` (and `createdAt`-then-`id` for activity's union — ordered by its output columns then transaction id).

12. **Docs gating — one wrangler var.** `docs_enabled` read from env (`.dev.vars` sets `"true"` locally; prod unset → disabled). `/api/openapi` and `/api/docs` middleware returns the standard 404 envelope when disabled. The Scalar route and OpenAPI doc registration stay mounted behind the flag.

13. **Headers — `_headers` file + no-store middleware.** `apps/web/public/_headers` (new public dir, copied into `dist/client` by Vite) sets `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` for `/*`; verified against the wrangler assets behavior in the workers-pool test. Hono middleware adds `Cache-Control: no-store` to every `/api/*` response (applied before routes).

14. **Client cache reset — `queryClient.clear()`.** Called in `useLogin`/`useRegister` `onSuccess` and `useLogout` `onSettled` before navigation; `['me']` is re-seeded by the existing setQueryData. jsdom regression test seeds principal A's entries and asserts they are gone after B signs in.

## Risks / Trade-offs

- [Registration disable breaks every API test that self-registers] → `seedUser` helper lands in the same change; suite green before merge (tasks gate on it).
- [Cookie rename invalidates all sessions at deploy] → Acceptable (single user); refresh flow re-establishes via login. Old-name cookies are cleared by the existing clearSession path once updated names are set.
- [tokenVersion increments on every logout add a write] → Negligible at single-user scale; batched with the revoke write.
- [Rate-limit binding may not be emulated identically by miniflare] → Tests assert the 429 contract via the binding's test double behavior; if workerd emulation differs, the binding call is wrapped so tests can stub `env.RATE_LIMITER.limit`.
- [New DB CHECKs fail on legacy rows] → Moot: CHECK constraints dropped (see decision 9 — not addable on D1); caps enforced at the Zod boundary only.
- [`_headers` interacts with asset URL matching] → Covered by a workers-pool assertion on shell + fallback responses.
- [Rotating `ORDER BY` additions may change page composition] → Only stabilizes ordering; acceptance test walks pages and asserts no repeat/skip.

## Migration Plan

1. Ship migration `0006_*` (token_version column + amount CHECKs) with the code in one deploy.
2. At deploy: in-flight access tokens (no `ver`) remain valid ≤15 min via version-0 default; old cookie names expire naturally; users re-login once.
3. Post-deploy owner steps (documented in README): add the Cloudflare WAF rate-limit rule for `/api/auth/*`; confirm `docs_enabled` is unset in prod; run `wrangler d1 migrations list finance-application --remote` (and a `sqlite_master` diff) to confirm applied state.
4. Rollback: revert deploy; migration is additive (column + CHECKs) and safe to leave.

## Open Questions

None — the 2026-11-06 grilling settled registration strategy, rate-limit strategy, session scope, docs strategy, field-lock direction, and packaging.
