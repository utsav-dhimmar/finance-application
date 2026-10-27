# Tasks

## 1. Schema, migrations, and secrets

- [x] 1.1 Add `drizzle-kit` as a dev dependency and create `drizzle.config.ts` pointing its output at `server/api/migrations/`; add `migrations_dir` to `wrangler.jsonc`; verify `pnpm install` resolves the tool
- [x] 1.2 Define `src/db/schema.ts` per design D5 (`users`, `refresh_tokens` with unique email nocase, unique token_hash, FK cascade) and pass the schema to `getDb()`; verify `pnpm --filter @finance-application/api typecheck` passes
- [x] 1.3 Generate the migration with `drizzle-kit generate` and apply it locally with `wrangler d1 migrations apply finance-application --local`; verify both tables exist by querying them via `wrangler d1 execute --local`
- [x] 1.4 Add `JWT_SECRET` handling: `.dev.vars` (gitignored) with a locally generated secret, committed `.dev.vars.example`, and an `Env` interface augmentation for the secret; verify `wrangler types` still regenerates cleanly and `pnpm --filter @finance-application/api typecheck` passes

## 2. Password and token primitives

- [x] 2.1 Add `hash-wasm` via `pnpm add` and implement `src/lib/password.ts` (`hashPassword`, `verifyPassword` using Argon2id m=19456/t=2/p=1, PHC output per design D2); verify unit tests in `tests/lib/` cover hash→verify roundtrip and wrong-password rejection
- [x] 2.2 Implement `src/lib/tokens.ts` per design D3/D4: `signAccessToken`/`verifyAccessToken` via `hono/jwt` (HS256, 15-min `exp`), `generateRefreshToken` (32 random bytes, base64url) and `hashToken` (SHA-256 hex); verify unit tests cover expiry enforcement, refresh-token randomness, and hash determinism

## 3. Auth endpoints

- [x] 3.1 Add `@cloudflare/vitest-plugin` (successor of the deprecated `@cloudflare/vitest-pool-workers`, vitest 4 compatible) with `vitest.workers.config.mts` scoped to `tests/auth/**` against a local D1 database with migrations applied via `readD1Migrations`/`applyD1Migrations` per design D6; verify one smoke test reads the `users` table through the pool and the existing node-pool tests still pass
- [x] 3.2 Extend `src/lib/error.ts` with the new codes (`EMAIL_TAKEN`, `AUTH_INVALID_CREDENTIALS`, `UNAUTHENTICATED`, `INVALID_REFRESH_TOKEN`); verify the envelope unit tests cover the new codes
- [x] 3.3 Implement `requireAuth` middleware (verify access cookie via `verifyAccessToken`, load the user from D1, populate `c.var.user`) and `POST /api/auth/register` per design D2/D3; verify pool tests cover 201 with cookie set, 409 `EMAIL_TAKEN` (case-insensitive), 400 validation, and that the stored hash is a PHC Argon2id string
- [x] 3.4 Implement `POST /api/auth/login`; verify pool tests cover success, and identical generic `401 AUTH_INVALID_CREDENTIALS` bodies for wrong password and unknown email
- [x] 3.5 Implement `GET /api/auth/me` behind `requireAuth`; verify pool tests cover 200 with the user's id/email and `401 UNAUTHENTICATED` with a missing, malformed, and expired token
- [x] 3.6 Implement `POST /api/auth/refresh` with D1 `batch` rotation (revoke presented token + insert replacement) per design D4; verify pool tests cover rotation success with fresh cookies, and `401 INVALID_REFRESH_TOKEN` for absent, unknown, expired, and revoked tokens, and that the presented token's row is revoked after success
- [x] 3.7 Implement `POST /api/auth/logout` (revoke by hash, clear both cookies, always `204`); verify pool tests cover logout with a session and with no cookies, and that the revoked token can no longer refresh

## 4. Web session layer

- [x] 4.1 Add `src/lib/api-client.ts` (same-origin fetch wrapper, JSON error-envelope decoding) and session hooks per design D7: `useMe` (`['me']` query with single transparent refresh-and-retry on 401), `useLogin`, `useRegister`, `useLogout` mutations that invalidate `['me']`; verify render tests with `fetch` stubbed cover the me-success, refresh-and-retry, and logout-invalidate flows
- [x] 4.2 Add shadcn `input` and `label` to `packages/ui` via the registry and wire `@finance-application/ui` exports; verify `packages/ui` typechecks and the components import as `@finance-application/ui/components/input|label`

## 5. Pages and guards

- [x] 5.1 Build `/register` and `/login` pages with shadcn forms per design D8 (client-side validation, server error display, navigate to `/dashboard` on success); verify render tests cover field validation, the generic login error, and the duplicate-email error on register
- [x] 5.2 Build the `/dashboard` page and the app header (email + Sign out) per design D8; verify render tests cover the email display and that Sign out invokes the logout mutation
- [x] 5.3 Wire route guards per design D7, implemented as client-side component guards (SSR-safe: relative fetches are unavailable during server render) — `/dashboard` redirects to `/login` when the me query resolves null, `/login`/`/register` redirect to `/dashboard` when authenticated; verify guard unit tests cover both redirect directions and that the production build passes

## 6. Integration verification

- [x] 6.1 Run `pnpm turbo run typecheck lint test build` and verify every task exits 0 across all packages (node-pool and workers-pool tests included)
- [x] 6.2 Start both dev servers and smoke-test the full flow in the browser: register → land on `/dashboard` showing the email, reload (session persists via refresh), sign out → redirected to `/login`, wrong password shows the generic error, and re-login succeeds; verify `/api/auth/me` returns `401 UNAUTHENTICATED` after logout; stop both servers
- [x] 6.3 Document the auth endpoints, pages, `.dev.vars` setup, and the migration command in `README.md`; verify each documented command runs as written
- [ ] 6.4 After the implementing commits are pushed, verify the GitHub Actions workflow runs green

## Workflow follow-up

- Archive the change once review and CI are satisfied (`/openspec-archive-change`).
- After archive, confirm `openspec list --specs` shows `user-auth` alongside `api-platform` and `web-platform`.
- Recorded follow-ups for future changes: single-account lockdown, password reset, rate limiting, refresh-token reuse detection, Bearer-token path for the Android client.
