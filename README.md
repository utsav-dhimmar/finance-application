# finance-application

A single-user personal finance application: expense tracking, income tracking,
categories, budgets, recurring transactions, and analytics. Built
spec-first with [OpenSpec](openspec/) — approved specifications are the source
of truth for behavior.

## Stack

- **Web app**: TanStack Start (Vite, SPA mode) + TanStack Router + TanStack Query,
  shadcn/ui on Base UI primitives, Tailwind CSS v4, Lucide icons
- **Runtime & hosting**: Cloudflare Workers (Hono HTTP API), Cloudflare D1 (SQL)
- **Data access**: Drizzle ORM
- **Validation**: Zod (single source of truth for request inputs, shared with
  the generated OpenAPI document)
- **API docs**: OpenAPI 3.1 + Scalar viewer
- **Tooling**: pnpm workspaces + Turborepo, TypeScript (strict), Vitest, Biome

## Repository layout

```
apps/web       TanStack Start web application (@finance-application/web)
packages/ui    Shared shadcn/Base UI design system (@finance-application/ui)
server/api     Hono API packaged as a Cloudflare Worker (@finance-application/api)
openspec/      Specifications and change proposals
.github/       CI workflows
```

## Prerequisites

- Node.js >= 22
- pnpm 10 (`corepack enable` picks up the pinned version)

## Commands

Run from the repository root:

| Command                                                    | What it does                                                                      |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `pnpm install`                                             | Install all workspace dependencies                                                |
| `pnpm turbo run typecheck lint test build`                 | Full verification pipeline (also runs in CI)                                      |
| `pnpm lint`                                                | Lint the repository with Biome                                                    |
| `pnpm format`                                              | Format the repository with Biome (`pnpm format:check` to verify only)             |
| `pnpm --filter @finance-application/api dev`               | Start the API locally with `wrangler dev` (http://127.0.0.1:8787)                 |
| `pnpm --filter @finance-application/api types`             | Regenerate `server/api/worker-configuration.d.ts` after changing `wrangler.jsonc` |
| `pnpm --filter @finance-application/web dev`               | Start the web app with Vite (http://localhost:3000)                               |
| `pnpm --filter @finance-application/web build`             | Production build of the web app                                                   |
| `cd packages/ui && pnpm dlx shadcn@latest add <component>` | Add a shadcn component to the shared design system                                |

The API's `build` task runs `wrangler deploy --dry-run`: it bundles the Worker
and validates its configuration without deploying.

### Local development with the API

The web app proxies `/api/*` to `http://127.0.0.1:8787` in development (see
`apps/web/vite.config.ts`). Start the API first, then the web app, and the
landing page's live greeting query works end to end. Application code always
uses relative `/api/...` paths — never absolute hosts — so the same code works
in production.

To add shadcn components, run the CLI inside `packages/ui` (its
`components.json` lives there):

```sh
cd packages/ui
pnpm dlx shadcn@latest add card
```

Components land in `packages/ui/src/components/` and are imported as
`@finance-application/ui/components/<name>`.

### Serving model and deployment

One Cloudflare Worker serves everything from a single origin:

- **Static assets** — the web app builds in SPA mode (a prerendered shell is
  copied to `index.html` by `apps/web/scripts/copy-spa-shell.mjs`), and the
  worker's `assets` config serves `apps/web/dist/client` directly; asset
  requests never invoke the worker.
- **API precedence** — `/api/*` requests go to the Hono worker first
  (`run_worker_first`), so API routing and error envelopes are untouched.
- **SPA fallback** — any other path returns `index.html` with status `200`
  (`not_found_handling: "single-page-application"`), so client-side routes
  survive hard refresh; unknown app paths render the not-found view client-side.

Deploy:

```sh
pnpm build                          # builds all packages — apps/web must build
cd server/api
npx wrangler deploy                 # requires a prior web build (assets dir)
```

In CI (Cloudflare Builds), the build command is `pnpm run build` and the deploy
command is `cd server/api && npx wrangler deploy`. Note that `wrangler dev`
serves the SPA from the last `vite build`, not live edits — use `vite dev`
with the proxy for day-to-day web work.

### Database migrations

The API's schema lives in `server/api/src/db/schema.ts` (Drizzle). After
changing it:

```sh
cd server/api
pnpm exec drizzle-kit generate
pnpm exec wrangler d1 migrations apply finance-application --local
```

### Authentication

The API owns sessions with Argon2id password hashes (pure-TS implementation —
the Workers runtime disallows dynamic WASM compilation) and JWT access tokens
(15 min, HS256, carrying the user's token version) plus rotating refresh
tokens (30 days, SHA-256-hashed at rest, single-use under concurrency). Both
tokens are HttpOnly, Secure, SameSite=Lax cookies with `__Host-`/`__Secure-`
prefixes — no tokens in JavaScript-readable storage. Logout revokes the
refresh token and bumps the token version, so outstanding access tokens stop
working immediately. The secret lives in `server/api/.dev.vars`
(copy `.dev.vars.example`); in production use `wrangler secret put JWT_SECRET`.

- `POST /api/auth/register` — **closed** (single-user application); always
  responds `403 REGISTRATION_DISABLED`
- `POST /api/auth/login` — verify credentials, sets session cookies
- `GET /api/auth/me` — the authenticated user's id and email
- `POST /api/auth/refresh` — rotate the refresh token
- `POST /api/auth/logout` — revoke, bump the token version, clear cookies

The web app provides `/register` (a closed-registration notice), `/login`, and
a protected `/dashboard` (unauthenticated visitors are redirected to
`/login`).

#### Deployment checklist (security)

- **Cloudflare WAF rate-limit rule** covering `/api/auth/*`: the worker also
  enforces an in-app fixed-window limiter (Workers rate-limit binding,
  100 req/60 s per key — login keys include the submitted email); the WAF
  rule is the outer layer. Configure once in the Cloudflare dashboard.
- **`DOCS_ENABLED`**: the API self-documentation (`/api/openapi`,
  `/api/docs`) is served only when this variable is `"true"`. Local
  development sets it in `.dev.vars`; production leaves it unset, and both
  paths answer a plain `404`.
- **Remote migration state**: after each deploy, confirm the applied
  migrations match the repository with
  `wrangler d1 migrations list finance-application --remote` (optionally diff
  `sqlite_master` against `server/api/migrations/`).

## API

The worker uses a provisioned remote D1 database (`finance_application`
binding in `wrangler.jsonc`); `wrangler dev` uses a local SQLite database, so
no Cloudflare account is needed for local development.

- `GET /api/hello` — fixed hello-world response
- `GET /api/greet/{name}?greeting=Hello&times=1` — personalized greeting;
  `greeting` (text, default `Hello`) and `times` (1–10, default `1`) are
  validated; invalid input returns a `400` error envelope
- `/api/auth/*` — see Authentication above
- `GET /api/openapi` — OpenAPI 3.1 document (only when `DOCS_ENABLED=true`)
- `GET /api/docs` — interactive Scalar documentation (only when
  `DOCS_ENABLED=true`)

Errors use a shared envelope: `{"error":{"code":...,"message":...,"details":[...]}}`.

## Specifications

See [openspec/](openspec/) for capabilities and in-flight changes. Development
follows the conventions in [AGENTS.md](AGENTS.md).
