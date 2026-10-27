# Proposal

## Why

The current basic-auth implementation concentrates all logic in route handlers (`server/api/src/routes/auth.ts` mixes validation, SQL, token lifecycle, and cookie handling) and, on the web app, in route components (`apps/web/src/routes/login.tsx` / `register.tsx` inline validation, API calls, and query logic). There is no repository, service, or controller separation, no shared schema package, no frontend API service layer, and no dedicated TanStack Query hooks — so the code is hard to test in isolation, duplicates validation rules across client and server, and will not scale to the finance features (transactions, budgets, recurring entries) that build on the same patterns.

## What Changes

- **Server layering** — split `routes/auth.ts` into thin controllers (route handlers that only parse, delegate, and respond), an `AuthService` (business rules: registration, credential check, session issuance, refresh-token rotation, logout), and repository modules (`UserRepository`, `RefreshTokenRepository`) that own all Drizzle queries. Extract shared helpers into a `utils/` module.
- **New `packages/schemas`** — shared plain-Zod schemas (`emailSchema`, `passwordSchema`, `registerBodySchema`, `loginBodySchema`, `userResponseSchema`) as the single source of truth for auth validation rules. The server layers `@hono/zod-openapi` metadata on top of these in its own schema modules; the web app consumes them directly for form validation. Type inference via `z.infer` only.
- **New `packages/api-client`** — shared typed HTTP client (`apiFetch`, `ApiError`, error-envelope decoding) plus typed auth endpoint functions (`login`, `register`, `me`, `refresh`, `logout`). No server-only imports, no secrets.
- **Web service + hooks layer** — routes no longer call fetch or manage query state. `apps/web/src/services/` adapts the api-client to app needs (session-aware `me` with one refresh-and-retry); `apps/web/src/hooks/` exposes `useMe`, `useLogin`, `useRegister`, `useLogout` built on TanStack Query over the service.
- **Proper shadcn forms** — login and register forms adopt shadcn/ui Form components (react-hook-form + `@hookform/resolvers/zod`) wired to the shared schemas, giving per-field errors and accessible markup. Add the required UI primitives to `packages/ui`.
- **No API contract change** — endpoints, status codes, error envelopes, cookie behavior, and the OpenAPI document remain externally equivalent. Existing server and web tests keep passing after being re-pointed at the new module boundaries.

## Capabilities

### New Capabilities

(none — this is an internal-architecture refactor; the API contract and user-visible behavior are unchanged, so no spec deltas are warranted)

### Modified Capabilities

(none)

## Impact

- **Code** — `server/api/src/routes/auth.ts` (rewritten as controllers), new `server/api/src/services/`, `server/api/src/repositories/`, `server/api/src/utils/`; `apps/web/src/lib/auth.ts` (replaced by services + hooks), `apps/web/src/lib/api-client.ts` (moves to `packages/api-client`), `apps/web/src/routes/login.tsx`, `register.tsx`, `dashboard.tsx`; new `packages/schemas`, `packages/api-client`; additions to `packages/ui`.
- **Dependencies** — web gains `react-hook-form` and `@hookform/resolvers`; new workspace packages added via `pnpm add` only.
- **Tests** — server tests re-targeted at services/repos (route tests stay as contract tests); web tests re-pointed at hooks; new unit tests for the auth service and repositories.
- **Risk** — mostly mechanical restructuring; the refresh-token rotation and cookie paths are the most delicate and must be covered by the existing `tests/auth/*` suites before and after.
