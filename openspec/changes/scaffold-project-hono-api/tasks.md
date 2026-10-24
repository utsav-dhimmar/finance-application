# Tasks

## 1. Monorepo foundation

- [x] 1.1 Create root manifests: `package.json` (`packageManager` pnpm@10, `engines.node >=22`, workspace scripts), `pnpm-workspace.yaml` (globs `apps/*`, `packages/*`, `server/*`), `.gitignore`, and `tsconfig.base.json` with `strict: true`; verify `pnpm install` completes without workspace errors
- [x] 1.2 Add `turbo.json` with `build`, `typecheck`, `lint`, `test` pipelines plus Biome configuration (`biome lint` / `biome format` replace ESLint and Prettier); verify `pnpm exec turbo run build typecheck lint test` exits 0 (no-op warning with zero packages is acceptable)
- [x] 1.3 Create `.github/workflows/ci.yml` (push + pull_request, cached pnpm, `pnpm install --frozen-lockfile`, then `pnpm turbo run typecheck lint test build`) per design D8; verify the YAML parses with `pnpm dlx yaml-lint .github/workflows/ci.yml`

## 2. server/api package

- [x] 2.1 Scaffold `server/api`: `package.json` (deps: `hono`, `@hono/zod-openapi`, `zod`, `drizzle-orm`, `@scalar/hono-api-reference`; devDeps: `wrangler`, `typescript`, `vitest`, `@cloudflare/workers-types`), `tsconfig.json` extending the base config, and `vitest.config.ts`; verify `pnpm install` resolves the new workspace package
- [x] 2.2 Create `wrangler.jsonc` (worker name, `main: src/index.ts`, compatibility date, `d1_databases` binding `DB`) and generate `worker-configuration.d.ts` via `wrangler types`; verify the generated file declares the `DB` binding and re-running `wrangler types` produces no diff
- [x] 2.3 Add `src/db.ts` exporting the `getDb(env)` Drizzle factory (wiring only, no schema); verify `pnpm --filter server/api exec tsc --noEmit` passes

## 3. API endpoints

- [x] 3.1 Implement the error envelope in `src/lib/error.ts` (code/message/details shape, Zod-issue mapping via `defaultHook`, `NOT_FOUND` and `INTERNAL_ERROR` constructors per design D2); verify unit tests in `tests/lib/` produce the spec'd envelope from sample Zod issues
- [x] 3.2 Implement `GET /api/hello` in `src/routes/hello.ts`; verify a test in `tests/routes/` asserts status 200, `application/json`, and exact body `{"message":"Hello, World!"}`
- [x] 3.3 Implement `src/schemas/greet.ts` per design D4 (`name` trim/min/max, `greeting` default "Hello", `times` coerced int 1–10 default 1); verify schema unit tests cover defaults, coercion of `"3"`, rejection of `"abc"`, and out-of-range values
- [x] 3.4 Implement `GET /api/greet/{name}` in `src/routes/greet.ts` with path and query validators and a Zod response schema; verify endpoint tests cover the spec scenarios: defaults, `greeting`+`times` supplied, name trimmed, and each 400 case (`times=abc`, `times=11`, blank `greeting`, blank `name`) including the `error.details` path for `times`
- [x] 3.5 Assemble `src/app.ts` (`app.notFound` → `NOT_FOUND` envelope, `app.onError` → `INTERNAL_ERROR`) and the `src/index.ts` worker entry; verify tests assert the 404 JSON envelope on an unknown route and that the entry exports a fetch handler
- [x] 3.6 Add OpenAPI and Scalar routes: `GET /api/openapi` (`.openapi31()`) and `GET /api/docs` (`@scalar/hono-api-reference`); verify tests assert the document lists `/api/hello` and `/api/greet/{name}` and the docs route returns HTML

## 4. Integration verification

- [x] 4.1 Run the full pipeline locally with `pnpm turbo run typecheck lint test build` and verify every task exits 0 (build validates via `wrangler deploy --dry-run` per design D6)
- [x] 4.2 Start `pnpm --filter server/api exec wrangler dev` and smoke-test against the live server: `/api/hello`, `/api/greet/Utsav?greeting=Namaste&times=3`, an invalid `/api/greet/x?times=abc`, and an unknown path; verify responses match the spec deltas, then stop the server
- [x] 4.3 Document setup and dev commands (`pnpm install`, turbo tasks, `wrangler dev`, wrangler types regeneration) in `README.md`; verify each documented command runs as written
- [ ] 4.4 After the implementing commits are pushed, verify the GitHub Actions workflow runs green end-to-end on the branch

## Workflow follow-up

- Archive the change once review and CI are satisfied (`/openspec-archive-change`).
- After archive, confirm `openspec list --specs` shows `api-platform`.
