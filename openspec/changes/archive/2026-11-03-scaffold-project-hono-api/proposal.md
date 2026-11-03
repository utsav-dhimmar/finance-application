# Proposal

## Why

The repository is greenfield: the tech stack and engineering rules are fixed in AGENTS.md, but nothing exists yet — no workspace, no tooling, no runnable code. Before any finance capability can be built, we need the monorepo skeleton and a live Hono API running on Cloudflare Workers that proves the toolchain end-to-end (install, typecheck, lint, test, local dev, build) with two simple endpoints.

## What Changes

- Scaffold the pnpm + Turborepo monorepo: root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json` (TypeScript strict), `turbo.json` pipelines, shared lint/format tooling.
- Add a `server/api` workspace package: a Hono application exported as a Cloudflare Worker entry, with `wrangler` configuration and typed `Env` bindings (including the D1 binding and a Drizzle client factory — wiring only, no tables or migrations yet).
- Add two proof endpoints on the Hono app:
  - `GET /api/hello` — returns a fixed hello-world JSON response.
  - `GET /api/greet/{name}` — path parameter plus two Zod-validated query parameters, returning a personalized greeting; invalid input yields a `400` with machine-readable error details.
- Serve an OpenAPI description of the API with a Scalar UI viewer route.
- Add Vitest tests covering both endpoints, the validation error path, and the worker entry.
- Add a GitHub Actions workflow running typecheck, lint, tests, and build.

Out of scope (explicitly): `apps/web`, Android app, authentication, database schema/migrations, and any finance domain logic. Per AGENTS.md, packages are created only when needed.

## Capabilities

### New Capabilities

- `api-platform`: The HTTP API foundation — a Hono application hosted on Cloudflare Workers that serves validated JSON endpoints with standard error responses and publishes its own OpenAPI/Scalar documentation. Owns baseline API behavior (routing, input validation, error shape, docs) that future finance capabilities build on.

### Modified Capabilities

- None. No existing capabilities — this is the first spec in the project.

## Impact

- **New repo-level files**: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `turbo.json`, `tsconfig.base.json`, `.gitignore`, `.github/workflows/ci.yml`, formatting/lint config.
- **New package**: `server/api` (Hono app, Cloudflare Worker entry, wrangler config, Drizzle/D1 wiring, Vitest tests).
- **Dependencies introduced**: `hono`, `zod`, `drizzle-orm`, `@hono/zod-openapi` (or equivalent), `hono-openapi`/Scalar, `wrangler`, `vitest`, `turbo`, `typescript`, Biome (lint + format) tooling.
- **No existing code affected** — greenfield; single `first commit` history.
- **API surface created**: `GET /api/hello`, `GET /api/greet/{name}`, OpenAPI/Scalar docs route. These are additive; no breaking changes possible yet.
