# finance-application

A single-user personal finance application: expense tracking, income tracking,
categories, budgets, recurring transactions, and analytics. Built
spec-first with [OpenSpec](openspec/) — approved specifications are the source
of truth for behavior.

## Stack

- **Runtime & hosting**: Cloudflare Workers (Hono HTTP API), Cloudflare D1 (SQL)
- **Data access**: Drizzle ORM
- **Validation**: Zod (single source of truth for request inputs, shared with
  the generated OpenAPI document)
- **API docs**: OpenAPI 3.1 + Scalar viewer
- **Tooling**: pnpm workspaces + Turborepo, TypeScript (strict), Vitest, Biome

## Repository layout

```
server/api    Hono API packaged as a Cloudflare Worker (the only package today)
openspec/     Specifications and change proposals
.github/      CI workflows
```

## Prerequisites

- Node.js >= 22
- pnpm 10 (`corepack enable` picks up the pinned version)

## Commands

Run from the repository root:

| Command                                        | What it does                                                                      |
| ---------------------------------------------- | --------------------------------------------------------------------------------- |
| `pnpm install`                                 | Install all workspace dependencies                                                |
| `pnpm turbo run typecheck lint test build`     | Full verification pipeline (also runs in CI)                                      |
| `pnpm lint`                                    | Lint the repository with Biome                                                    |
| `pnpm format`                                  | Format the repository with Biome (`pnpm format:check` to verify only)             |
| `pnpm --filter @finance-application/api dev`   | Start the API locally with `wrangler dev` (http://127.0.0.1:8787)                 |
| `pnpm --filter @finance-application/api types` | Regenerate `server/api/worker-configuration.d.ts` after changing `wrangler.jsonc` |

The `build` task runs `wrangler deploy --dry-run`: it bundles the Worker and
validates its configuration without deploying.

## API

The D1 binding in `wrangler.jsonc` is local-only for now; `wrangler dev`
provisions a local SQLite database, so no Cloudflare account is needed.

- `GET /api/hello` — fixed hello-world response
- `GET /api/greet/{name}?greeting=Hello&times=1` — personalized greeting;
  `greeting` (text, default `Hello`) and `times` (1–10, default `1`) are
  validated; invalid input returns a `400` error envelope
- `GET /api/openapi` — OpenAPI 3.1 document
- `GET /api/docs` — interactive Scalar documentation

Errors use a shared envelope: `{"error":{"code":...,"message":...,"details":[...]}}`.

## Specifications

See [openspec/](openspec/) for capabilities and in-flight changes. Development
follows the conventions in [AGENTS.md](AGENTS.md).
