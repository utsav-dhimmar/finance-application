# Design

## Context

Both scaffolds are in place and verified: `server/api` (Hono + `@hono/zod-openapi` on Cloudflare Workers, D1 binding, Drizzle factory with no schema yet, shared error envelope, `@/` alias, `tests/` folder) and `apps/web` (TanStack Start + Query with a per-request `QueryClient` in router context, `packages/ui` shadcn/Base UI design system, Vite dev proxy `/api` → `127.0.0.1:8787`). This is the first persistence-bearing and first security-sensitive change. See proposal.md for motivation; specs/user-auth/spec.md for the behavioral contract.

## Goals / Non-Goals

**Goals:**

- Standard email+password auth with Argon2id hashing and JWT sessions, Workers-compatible end to end.
- First Drizzle schema and migration pipeline for D1, reusable by every future feature.
- Session handling that is safe by default: HttpOnly cookies, hashed refresh tokens at rest, rotation on refresh, generic credential errors.
- Web pages and guards that make the session tangible: register, login, dashboard, sign out, reload persistence.

**Non-Goals:**

- Email verification, password reset, rate limiting, and account lockout — follow-ups.
- Single-account lockdown for the deployed instance — open registration for now (recorded assumption).
- OAuth/passkeys; the typed `api-client` package (the web keeps a thin fetch wrapper).
- Reuse-detection for stolen refresh-token families (rotation + revocation only).

## Decisions

### D1. Cookie transport for both tokens — not Bearer headers

The access and refresh JWTs are set as `HttpOnly; Secure; SameSite=Lax` cookies (`access_token`, `refresh_token`, `/`-scoped for access, `/api/auth`-scoped for refresh). Rationale: the only consumer today is this same-origin web app; HttpOnly cookies are immune to XSS token theft, work with SSR-safe requests, and need no client-side token store. CSRF is mitigated by `SameSite=Lax` (cross-site POSTs carry no cookies); the API accepts no cross-origin credentialed requests because no CORS is configured. *Alternative rejected*: `Authorization: Bearer` with an in-memory access token — required for the future Android client, but it reintroduces XSS exposure and a client token store; when Android arrives, the endpoints gain a Bearer path behind the same middleware without changing the cookie behavior.

### D2. Argon2id via `hash-wasm` — the Workers-viable Argon2

Native `node-argon2`/`@node-rs/argon2` are native addons and cannot run on Workers. `hash-wasm` was the original choice here, but implementation proved the Workers runtime (and the vitest workers pool, identically) **disallows dynamic WebAssembly compilation** — hash-wasm's runtime `WebAssembly.compile` fails with "Wasm code generation disallowed by embedder" under real `wrangler dev`, so it cannot run on Workers at all. The Argon2id implementation is therefore `@noble/hashes`' pure-TypeScript `argon2id` (audited library, no WASM), wrapped with PHC-string encoding/decoding and a constant-time comparison in `src/lib/password.ts`. Parameters follow OWASP's baseline: `m=19456 KiB, t=2, p=1`, output stored as the PHC-formatted string in `users.password_hash`. *Alternative rejected*: PBKDF2 via WebCrypto (native and fast, but the user mandated Argon2). **Risk**: pure-JS Argon2id at these parameters costs roughly 0.5–1.5 s of CPU per hash — acceptable for a single-user app locally and on Workers paid plans (30 s CPU), but near or above the free-tier CPU limit; the deployment change must target a paid plan or lower the parameters deliberately, and this is recorded as an open deployment constraint, not silently dropped.

### D3. Access tokens — `hono/jwt`, HS256, 15 minutes

`hono/jwt` (bundled with Hono, WebCrypto-based, Workers-native) signs and verifies. Claims: `sub` (user id, UUIDv7), `iat`, `exp` (15 min). The secret comes from `env.JWT_SECRET` — a `.dev.vars` file locally (gitignored; `.dev.vars.example` committed with a placeholder) and `wrangler secret put JWT_SECRET` in production; `Env` is extended via a typed interface augmentation next to the generated `worker-configuration.d.ts`. `requireAuth` middleware verifies the token and loads the user from D1 by `sub` (fresh email, rejects tokens for deleted users), populating `c.var.user`; auth endpoints compose it. *Alternative*: asymmetric keys (RS256) — unnecessary for a single-service API.

### D4. Refresh tokens — random, hashed, rotated

A refresh token is 32 random bytes (`crypto.getRandomValues`, Workers-native) encoded base64url. The `refresh_tokens` row stores the SHA-256 hash (WebCrypto `digest`), the user id, and a 30-day expiry. `POST /api/auth/refresh` verifies hash + expiry + not-revoked in one query, then uses a D1 `batch` to atomically revoke the presented token and insert its replacement (D1 has no interactive transactions; `batch` is its atomic unit). Logout revokes by hash. Reuse of a revoked token is rejected as `INVALID_REFRESH_TOKEN`; family-wide revocation on reuse is a recorded follow-up, not scope creep here.

### D5. First Drizzle schema and migration pipeline

`server/api/src/db/schema.ts` defines:

```
users:            id (uuid pk), email (unique, nocase), password_hash, created_at, updated_at
refresh_tokens:   id (uuid pk), user_id (fk -> users.id, on delete cascade),
                  token_hash (unique), expires_at, revoked_at (nullable), created_at
```

Timestamps are stored as ISO-8601 text in UTC (D1 has no native datetime type; text sorts correctly and avoids driver conversion). Migrations: `drizzle-kit generate` writes SQL into `server/api/migrations/` (declared in `drizzle.config.ts` and as wrangler's `migrations_dir`), applied locally with `wrangler d1 migrations apply finance-application --local`; `getDb()` gains the schema for typed queries. Money is not involved yet; the paise/integer rules bind when transactions arrive.

### D6. Server tests — `@cloudflare/vitest-pool-workers` for auth, node pool for the rest

Auth endpoints hit real D1 (uniqueness, cascade delete, batch atomicity), so endpoint tests run in the designed-for pool: `@cloudflare/vitest-pool-workers` with `poolMatchGlobs` scoping only `tests/auth/**/*.test.ts` to the workers pool against a local D1 database with migrations applied — the upgrade path recorded when the scaffolds were built. Existing unit tests (envelope, schemas, routes) stay on the node pool untouched. Password and token primitives are pure WASM/WebCrypto and are unit-tested on the node pool (hash→verify roundtrip, wrong-password rejection, JWT expiry, refresh hash determinism).

### D7. Web session — one `['me']` query, mutations for writes

`src/lib/api-client.ts` wraps `fetch` with same-origin credentials and JSON error-envelope decoding. Session state is a single `useQuery(['me'])` (fetches `/api/auth/me`); on `401` it transparently tries `POST /api/auth/refresh` once and retries, so an expired access token is invisible to the user (spec: reload persistence). Login/register/logout are `useMutation`s that invalidate `['me']` and navigate. Route guards: `beforeLoad` on `/dashboard` checks the query client's `['me']` state and `throw redirect({ to: '/login' })` when unauthenticated; `/login` and `/register` do the inverse to `/dashboard`. *Alternative rejected*: a global axios-style interceptor — TanStack Query is already the server-state layer.

### D8. Pages and components

`/register` and `/login` use shadcn `input`/`label` (added to `packages/ui` via the registry) with the existing `button`; server errors render above the form, field errors inline. A small app header (in `apps/web/src/components`) shows the brand, the signed-in email, and Sign out on authed pages. `/dashboard` is deliberately minimal (email + sign out) — it is the guard proof, not a feature page.

## Risks / Trade-offs

- [Argon2id CPU cost on Workers free tier] → documented constraint (D2); deployment change must use a paid plan or consciously lower parameters; local dev and CI are unaffected.
- [CSRF residual risk with cookie auth] → `SameSite=Lax` blocks cross-site POST cookies; no CORS surface; a synchronizer-token layer is a follow-up if the threat model grows.
- [D1 `batch` is the only atomicity primitive] → rotation uses one batch (revoke + insert); nothing else needs transactions in this change.
- [vitest-pool-workers setup friction (version pinning, Windows)] → scoped via `poolMatchGlobs`; if the pool blocks on Windows, fallback is a D1 stub behind the same test contracts — surfaced, not silent.
- [This change builds on two unarchived scaffold changes] → code-level dependencies are all merged and verified; archiving order is bookkeeping only.
- [`hono/jwt` cookie helpers assume Bearer for some flows] → tokens are verified explicitly from the cookie via `jwt.verify`; no framework cookie magic is relied on.

## Migration Plan

Additive: new tables (no existing data), new endpoints, new pages. Rollback is dropping the tables and removing the auth modules. Existing endpoint behavior and the landing page are unchanged. Production deployment (secrets, paid-plan CPU) is deferred to the deploy change, which will inherit the constraint recorded in D2.

## Open Questions

None blocking. Registration lockdown (single-account), password reset, and rate limiting are deferred follow-ups, not decisions this change needs.
