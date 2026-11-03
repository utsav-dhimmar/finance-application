# Design

## Context

Greenfield repository with a single commit; no code, no workspace, no tooling. AGENTS.md fixes the stack (pnpm, Turborepo, Hono, Zod, Cloudflare Workers/D1, Drizzle, OpenAPI+Scalar, Vitest) and requires TypeScript strict mode, Zod as the source of truth for request validation, and creating packages only when needed. Toolchain verified locally: Node 24.22.1, pnpm 10.33.4, wrangler 4.152.0. See proposal.md for motivation; specs/api-platform/spec.md for the behavioral contract.

## Goals / Non-Goals

**Goals:**

- A minimal-but-real monorepo that future changes extend without rework (workspace globs already cover `apps/*`, `packages/*`, `server/*`).
- One deployable unit: `server/api` as a Cloudflare Worker wrapping a Hono app.
- Validation and OpenAPI documentation generated from the same Zod schemas (single source of truth).
- Provable-quality gates that run locally and in CI: typecheck, lint, test, build.

**Non-Goals:**

- No `apps/web`, no Android, no shared packages (`domain`, `schemas`, `api-client`) — none have a consumer yet.
- No database schema, migrations, or queries — D1/Drizzle is wiring only.
- No deployment target, secrets, or remote D1 provisioning — a later change handles first deploy.
- No auth, rate limiting, or request logging.

## Decisions

### D1. Workspace layout — one package now, globs ready for more

```
/                         root: package.json, pnpm-workspace.yaml, turbo.json, tsconfig.base.json, biome.json
server/api/               the only workspace package (Hono + Worker)
  src/index.ts            worker entry: export default app
  src/app.ts              OpenAPIHono app assembly, routes, error/404 handlers
  src/routes/hello.ts     GET /api/hello
  src/routes/greet.ts     GET /api/greet/{name}
  src/schemas/greet.ts    Zod schemas for name, greeting, times
  src/lib/error.ts        error envelope + defaultHook mapping Zod issues
  src/db.ts               Drizzle client factory over env.DB (unused by routes)
  tests/                  dedicated test folder mirroring src/ (tests/routes/, tests/schemas/, tests/lib/)
  wrangler.jsonc          name, main, compatibility_date, d1_databases binding DB
.github/workflows/ci.yml
```

Imports use the `@/*` path alias (mapped to `src/*` by `compilerOptions.paths` in `server/api/tsconfig.json`). Vitest mirrors the alias via `resolve.alias` in `vitest.config.ts`, and wrangler's esbuild bundle resolves it from the same tsconfig — verified by the `--dry-run` build. Lint and formatting use Biome (`biome lint` / `biome format`), replacing ESLint and Prettier.

`pnpm-workspace.yaml` lists `apps/*`, `packages/*`, `server/*` so future packages need no workspace edits. Turborepo is wired now with `build`, `typecheck`, `lint`, `test` pipelines even though only one package exists — task names stay uniform as packages arrive. _Alternative rejected_: pnpm catalog for shared dependency versions — ceremony with a single package; revisit when `apps/web` lands.

### D2. Hono with `@hono/zod-openapi` — validation and docs from one schema source

Routes are declared with `OpenAPIHono`'s `createRoute`, taking Zod schemas for path and query params. Validation and the OpenAPI document are then generated from the same schemas, satisfying "Zod as source of truth" with no drift between behavior and docs. A `defaultHook` maps every Zod issue into the spec'd error envelope (`error.code` / `error.message` / `error.details[]` with parameter paths), so the 400 body matches the spec exactly. `app.notFound` produces the `NOT_FOUND` envelope; `app.onError` maps unhandled errors to `INTERNAL_ERROR` (500). _Alternatives rejected_: plain `Hono` with hand-rolled `safeParse` in handlers + separately maintained OpenAPI YAML (doc drifts from code); `hono-openapi` middleware style (viable, but `@hono/zod-openapi` is the Hono-org standard and better documented for this pattern).

### D3. Docs routes — `/api/openapi` JSON + `/api/docs` Scalar UI

The OpenAPI JSON is served by the route registry at `/api/openapi` (`.openapi31()`), and `@scalar/hono-api-reference` renders the interactive viewer at `/api/docs` pointing at it. Routes are registered with their full `/api/...` paths (no base-path rewrite), so the document's `paths` entries match the spec verbatim.

### D4. Greet endpoint schema

- `name` (path): `z.string().trim().min(1).max(100)`
- `greeting` (query): `z.string().trim().min(1).max(100).default("Hello")`
- `times` (query): `z.coerce.number().int().min(1).max(10).default(1)` — query strings arrive as text, coercion makes `times=3` valid and `times=abc` a 400.

Response: `{ "messages": string[] }` with `times` copies of `"{greeting}, {name}!"`. Response shape is declared in the route's Zod response schema, so it appears in the OpenAPI doc and is enforced by the framework in tests.

### D5. Worker packaging and types

`src/index.ts` exports the app as the module worker default export (`app` satisfies the fetch handler shape). Bindings come from `wrangler.jsonc`: a `d1_databases` binding `DB` (local-only for now — `wrangler dev`/miniflare provisions local SQLite without a Cloudflare account). `Env` types are generated by `wrangler types` into `worker-configuration.d.ts` (committed) rather than hand-written, and regenerated whenever `wrangler.jsonc` changes. `src/db.ts` exports a factory `getDb(env)` returning `drizzle(env.DB)` — wiring only, no schema import yet.

### D6. Build = `wrangler deploy --dry-run`

`server/api` has no emit step; the Worker is bundled by wrangler at deploy time. Its `build` script therefore runs `wrangler deploy --dry-run --outdir=dist`, which executes the full esbuild bundle without deploying or needing credentials. This catches worker-config and bundling breakage in CI. `typecheck` is separate (`tsc --noEmit`), driven by `tsconfig.base.json` with `strict: true` throughout.

### D7. Tests — Vitest against `app.request()`

Endpoint tests call the Hono app directly (`app.request(path)`) — no HTTP server, fast, and runtime-agnostic; one test module covers each spec requirement (hello, greet defaults/params/trim, each 400 case, error envelope shape, 404 envelope, OpenAPI document contents, Scalar route returning HTML). A small test asserts the worker entry exports a fetch handler. _Alternative rejected_: `@cloudflare/vitest-pool-workers` — worthwhile once real D1 queries exist, pure overhead for in-memory routes now; noted as the natural upgrade when the first persistence change lands.

### D8. CI — single job, full pipeline

GitHub Actions on push and pull_request: pnpm (cached via `actions/setup-node` cache) → `pnpm install --frozen-lockfile` → `pnpm turbo run typecheck lint test build`. One Ubuntu job on Node 24; no matrix — the project is single-runtime. `package.json` pins `engines.node >=22` and `packageManager: pnpm@10` so tooling mismatches fail fast.

## Risks / Trade-offs

- [OpenAPIHono's default validation response doesn't match the spec envelope] → `defaultHook` reformats every issue; a dedicated test asserts the exact envelope, so drift fails CI.
- [`wrangler deploy --dry-run` flags vary across wrangler majors] → wrangler pinned as a devDependency in `server/api` (major-locked); CI exercises the dry-run on every push.
- [Local D1 without a Cloudflare account] → miniflare's local SQLite backs the binding in dev; remote provisioning is explicitly deferred to a future deploy change.
- [Turbo adds ceremony with one package] → accepted deliberately: uniform task names across future packages outweigh the config; workspace globs already accept them.
- [No end-to-end test through the real Workers runtime] → mitigated by the dry-run bundle check plus `wrangler dev` verification during implementation; the vitest-pool-workers upgrade path is recorded (D7) for when persistence arrives.

## Migration Plan

Greenfield — nothing to migrate or roll back; reverting the implementing commit restores the empty repository. Deployment is out of scope; the change is verified locally (`turbo run typecheck lint test build`, `wrangler dev` smoke test) and in CI.
