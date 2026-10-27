# Tasks

## 1. Server: extract repositories and utilities

- [x] 1.1 Create `server/api/src/utils/datetime.ts` with `isoNow()` and `refreshExpiryIso()` moved verbatim from `routes/auth.ts`; update `routes/auth.ts` imports and verify `pnpm --filter @finance-application/api test tests/auth` passes unchanged
- [x] 1.2 Create `repositories/user-repository.ts` (`createUserRepository(db)`) owning `findByEmail`, `findById`, `insert`; move the corresponding Drizzle queries out of `routes/auth.ts` and the `requireAuth` middleware; verify `pnpm --filter @finance-application/api test tests/auth` passes
- [x] 1.3 Create `repositories/refresh-token-repository.ts` (`createRefreshTokenRepository(db)`) owning `findByHash`, `insert`, `revokeById`, `revokeByHash`, and the rotation batch; verify `pnpm --filter @finance-application/api test tests/auth` passes
- [x] 1.4 Add repository unit tests under `tests/repositories/` using the existing `@cloudflare/vitest-plugin` workers setup; verify `pnpm --filter @finance-application/api test` passes including the workers suite

## 2. Server: auth service and slim controllers

- [x] 2.1 Create `services/auth-service.ts` with `createAuthService({ users, refreshTokens, jwtSecret })` exposing `register`, `login`, `me`, `refresh`, `logout` returning plain outcomes (discriminated results, no Hono responses); wire `lib/password`, `lib/tokens` via deps; verify service unit tests in `tests/services/auth-service.test.ts` (fake repos) cover email-taken, invalid credentials, successful registration/login, refresh rotation, and logout
- [x] 2.2 Move `requireAuth` to `middleware/auth.ts` using the user repository; verify `pnpm --filter @finance-application/api test tests/auth` passes
- [x] 2.3 Rewrite `routes/auth.ts` handlers as controllers that only validate, delegate to the auth service, set cookies via `lib/session`, and map outcomes to status codes; confirm no route handler contains SQL, hashing, or token generation; verify `pnpm --filter @finance-application/api test` and `pnpm --filter @finance-application/api typecheck` pass

## 3. Shared packages: schemas and api-client

- [x] 3.1 Scaffold `packages/schemas` (pnpm workspace, `pnpm add` only) exporting plain-Zod `emailSchema`, `passwordSchema`, `registerBodySchema`, `loginBodySchema`, `userResponseSchema`, `errorEnvelopeSchema` with `z.infer` types; add schema tests in the package; verify `pnpm --filter @finance-application/schemas test` passes
- [x] 3.2 Re-point `server/api/src/schemas/auth.ts` to import the shared schemas and attach `@hono/zod-openapi` metadata (or the D2 fallback of composing shared field schemas); verify `pnpm --filter @finance-application/api test tests/docs.test.ts tests/auth` passes so the OpenAPI document and contracts are unchanged
- [x] 3.3 Scaffold `packages/api-client` moving `apiFetch`/`ApiError`/error-envelope decoding from `apps/web/src/lib/api-client.ts`, and add typed `login`, `register`, `me`, `refresh`, `logout` functions with types from `packages/schemas`; add client unit tests (mocked fetch); verify `pnpm --filter @finance-application/api-client test` passes
- [x] 3.4 Confirm no duplicate Zod versions across workspaces (`pnpm why zod` shows one resolved version) and that `packages/api-client` imports no server-only or React modules

## 4. Web: services, hooks, and shadcn forms

- [x] 4.1 Add `apps/web/src/services/auth-service.ts` adapting `packages/api-client` (session-aware `meQueryOptions` with 401 → refresh → retry, error-message mapping); verify hook tests in `tests/hooks/` with a mocked service cover login/register/logout cache updates on the `["me"]` key
- [x] 4.2 Create `apps/web/src/hooks/use-auth.ts` (`useMe`, `useLogin`, `useRegister`, `useLogout`) as thin TanStack Query wrappers over the service and delete `apps/web/src/lib/auth.ts` after re-pointing `dashboard.tsx`, `app-header.tsx`, and route tests; verify `pnpm --filter @finance-application/web test` passes
- [x] 4.3 Add `form` and `card` primitives to `packages/ui` via the shadcn CLI against the existing `components.json` (apply the D5 `field`-component fallback if base-nova ships no compatible `form`), add `react-hook-form` and `@hookform/resolvers` to `apps/web` with `pnpm add`; verify `pnpm --filter @finance-application/ui typecheck` passes
- [x] 4.4 Rebuild `login.tsx` and `register.tsx` on shadcn Form + `zodResolver` from `packages/schemas` with per-field errors, server error codes mapped to form-level errors, and no inline validation regexes left in routes; verify `pnpm --filter @finance-application/web test tests/routes/login.test.tsx tests/routes/register.test.tsx` passes with updated assertions

## 5. Full verification

- [x] 5.1 Run the full monorepo gate — `pnpm -r test`, `pnpm -r typecheck`, `pnpm -r lint`, and the API production build (`pnpm --filter @finance-application/api build`) — and confirm all pass
- [x] 5.2 Manually verify the dev end-to-end flow (register → dashboard → logout → login) against `wrangler dev` + `vite dev` and confirm the OpenAPI/Scalar docs render the unchanged auth contract
- [x] 5.3 Review the diff for security hygiene: no secrets or tokens logged, no DB access outside repositories, `packages/api-client` free of server-only imports; document any known limitations in the change notes
