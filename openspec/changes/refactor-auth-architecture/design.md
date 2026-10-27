# Design

## Context

The API contract (endpoints `POST /api/auth/register|login|refresh|logout`, `GET /api/auth/me`, error envelope, cookie session) is frozen — see proposal.md. Constraints that shape the design:

- **Runtime**: Hono on Cloudflare Workers; the Drizzle instance is built per request from the D1 binding (`getDb(c.env)`), so repositories and services must receive dependencies per request rather than import a global singleton. `JWT_SECRET` arrives on `c.env`.
- **Validation**: the server uses `@hono/zod-openapi` (Zod v4) for route schemas; the web app needs plain Zod for form validation. Both must resolve to one shared Zod package.
- **Web stack**: TanStack Start + TanStack Router + TanStack Query (no QueryClient provider gap — existing tests use `tests/routes/helpers.tsx`). `packages/ui` is a shadcn registry package using the `base-nova` style on Base UI primitives, exporting `./components/*` by path.
- **Existing tests**: server has route-level suites (`tests/auth/*`), lib unit suites, and a workers-config suite; web has route tests. These are the safety net for a behavior-preserving refactor.

## Goals / Non-Goals

**Goals:**

- Layered server architecture: routes as controllers, `AuthService` for business rules, repositories for all Drizzle access, `utils/` for generic pure helpers.
- One source of truth for auth validation rules (`packages/schemas`) consumed by both server and web.
- Shared framework-agnostic HTTP client (`packages/api-client`) with typed auth endpoints.
- Frontend structure: `services/` (API adapters) → `hooks/` (TanStack Query) → routes (render only).
- shadcn Form-based login/register with Zod-resolver validation and per-field errors.

**Non-Goals:**

- No endpoint, status-code, error-envelope, cookie, token-TTL, or OpenAPI-document changes.
- No changes to refresh-token rotation semantics, idempotency, or security properties.
- No Android app, no auth-UI redesign beyond form components, no new finance features.
- No renaming `apps/web` route files or changing routing/guard logic beyond re-pointing it at hooks.

## Decisions

### D1 — Server layering: factory functions over classes-as-singletons

`server/api/src` gains:

```text
routes/auth.ts        # controllers: parse → delegate → respond (no SQL, no hashing)
middleware/auth.ts    # requireAuth middleware (uses user repository)
services/auth-service.ts   # createAuthService(deps) — business rules
repositories/user-repository.ts        # createUserRepository(db)
repositories/refresh-token-repository.ts
utils/datetime.ts     # isoNow, refreshExpiryIso (pure helpers)
```

- Repositories are created via `createUserRepository(db)` / `createRefreshTokenRepository(db)` because the Drizzle instance is per-request. Services are created via `createAuthService({ users, refreshTokens, jwtSecret })` — the service receives token primitives (`signAccessToken`, `hashPassword`, …) as deps or imports the pure crypto helpers from `lib/` directly; either is acceptable, constructor-style deps chosen for service-level unit tests with fakes.
- `lib/` keeps the cohesive security primitives it already has (`password`, `tokens`, `session`, `error`, `uuid`); generic non-domain helpers (date formatting) move to `utils/`. Having both is intentional: `lib/` = domain/security primitives, `utils/` = generic pure helpers.
- `AuthService` methods return plain results (`{ user }`, discriminated outcomes like `{ ok: false, code: "EMAIL_TAKEN" }`) instead of Hono responses, so controllers decide status codes and cookie side effects stay in `lib/session` invoked by controllers.

*Alternative considered*: Nest-style classes with decorators — rejected, overkill for a Hono worker; factories keep tree-shaking and the Workers bundle small.

### D2 — `packages/schemas`: plain Zod, OpenAPI metadata stays server-side

- `packages/schemas` exports `emailSchema`, `passwordSchema`, `registerBodySchema`, `loginBodySchema`, `userResponseSchema`, `errorEnvelopeSchema` as plain `zod` v4 schemas with `z.infer` types. It depends only on `zod` (workspace-pinned to the same major the server uses) — no `@hono/zod-openapi`, no Hono, so the web app can import it freely.
- The server's `src/schemas/auth.ts` keeps its role as the OpenAPI layer: it imports the shared schemas and attaches `.openapi()` metadata. `@hono/zod-openapi` augments Zod v4's schema interface, so metadata can be attached to schemas created by plain `zod` **provided both packages resolve to the same Zod instance** (enforce via workspace `zod` single version).
- Fallback if the augmentation does not apply across packages: the server module rebuilds the route schemas by composing the shared field schemas (`emailSchema`, `passwordSchema`) inside `z.object({ ... })` created with `@hono/zod-openapi`'s `z` — rules stay single-sourced even if object-level schemas are rebuilt.

*Alternative considered*: putting `.openapi()` metadata in the shared package (rejected — would force every client to install `@hono/zod-openapi`) and keeping two schema sets (rejected — drift, the current bug).

### D3 — `packages/api-client`: transport + typed endpoints, no app policy

- Moves `apiFetch` and `ApiError` (error-envelope decoding) out of `apps/web/src/lib/api-client.ts`. Exports typed auth functions: `login(body)`, `register(body)`, `me()`, `refresh()`, `logout()` with request/response types imported from `packages/schemas`.
- Depends on `packages/schemas` and `zod` only — no React, no TanStack, no secrets. Base-URL handling: default relative paths (same-origin cookies); an optional `baseUrl` option future-proofs the Android client without adding policy now.
- The session-aware policy (401 → refresh once → retry `me`) is **app policy**, not transport: it stays in `apps/web/src/services/auth-service.ts`.

### D4 — Web structure: services → hooks → routes

```text
apps/web/src/services/auth-service.ts   # session-aware auth calls over packages/api-client
apps/web/src/hooks/use-auth.ts          # useMe, useLogin, useRegister, useLogout (TanStack Query)
apps/web/src/hooks/index.ts
```

- `auth-service.ts` owns `meQueryOptions` (query key, staleTime, refresh-and-retry) and the credential mutation bodies; hooks are thin TanStack Query wrappers that also manage the `["me"]` cache on success. Routes consume hooks only; no `fetch` and no `ApiError` handling beyond display mapping (kept as a small `getAuthErrorMessage` util in the service module or `src/lib/errors.ts`).
- Existing behavior preserved: mutation `onSuccess` seeds `["me"]`, logout nulls it.

### D5 — Forms: shadcn Form + react-hook-form + Zod resolver

- Add the `form` and `card` primitives to `packages/ui` (shadcn CLI against the existing `components.json`, base-nova style). `react-hook-form` and `@hookform/resolvers` are added to `apps/web` (the form library is an app concern; `packages/ui` declares it as a peer dependency as the shadcn registry expects).
- Login/register use `useForm` with `zodResolver(registerBodySchema)` from `packages/schemas` — client validation rules can never drift from the server's. Server error codes (`EMAIL_TAKEN`, `AUTH_INVALID_CREDENTIALS`) map to form-level errors via `setError`; field-level errors render through `FormMessage`.
- If the base-nova registry does not ship a `form` component compatible with Base UI, fall back to the registry's `field` components with manual `safeParse` wiring in a small reusable `useZodForm`-style hook — decision point during implementation, logged in the task.

### D6 — Test strategy mirrors the layers

- Service unit tests: fake repositories, no DB — covers email-taken, bad credentials, rotation logic.
- Repository tests: existing `@cloudflare/vitest-plugin` workers setup (D1) — one suite per repository.
- Route tests (`tests/auth/*`) become pure contract tests; they should pass unmodified if the refactor is truly behavior-preserving (only imports may shift).
- Web: hook tests with mocked service; route tests keep using `tests/routes/helpers.tsx`, re-pointed at hooks.

## Risks / Trade-offs

- **OpenAPI document drift** → server route schemas must produce the same document; `tests/docs.test.ts` guards this, keep it green before/after.
- **Duplicate `zod` versions across workspaces** breaks D2 metadata attachment → pin a single workspace `zod` version; verify with `pnpm why zod`.
- **base-nova registry may lack a `form` component** → D5 fallback documented; does not block the schema/service/hook work.
- **Refresh-rotation regressions** (the most delicate path: batch revoke+insert, expiry compare) → repositories extracted with existing `tests/auth/refresh-logout.test.ts` as the gate; no logic edits during the move.
- **Larger change surface** (3 new packages + 2 apps) → task order lands server layering, then packages, then web, each committable and testable independently; web keeps working off the old `lib/` modules until its stage.

## Migration Plan

1. Server: extract repositories → service → slim controllers; run server suites (no behavior change expected).
2. Packages: add `packages/schemas`, `packages/api-client`; re-point server schema module and web `api-client` imports; run both suites.
3. Web: add services/hooks, rebuild forms on shadcn Form; run web suites.
4. Rollback: each stage is an independent commit; revert commits in reverse. No data or schema changes, no deployment coordination.

## Open Questions

None — the base-nova `form` availability (D5) is the only unknown and has a documented fallback that does not change scope or specs.
