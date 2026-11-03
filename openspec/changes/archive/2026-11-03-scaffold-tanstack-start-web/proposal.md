# Proposal

## Why

The API foundation runs (change `scaffold-project-hono-api`), but the repository has no web client yet. AGENTS.md mandates TanStack Start (Vite) for the web application with shadcn/ui on Base UI primitives, and the monorepo workspace globs already accept `apps/*`. A scaffolded app shell now proves the front-end toolchain — SSR, routing, Tailwind, design system, aliases, tests, build — before any finance UI is built on it.

## What Changes

- Add an `apps/web` workspace package: a TanStack Start application (Vite, SSR by default, file-based TanStack Router), created with the TanStack CLI.
- Add a shared `packages/ui` workspace package (`@finance-application/ui`): shadcn/ui initialized in monorepo mode with the **Base UI** primitives base on Tailwind CSS. Components (starting with `button`) and design tokens live here; `apps/web` consumes them via a `workspace:*` dependency. `lucide-react` provides icons.
- Keep the `@/*` path alias to `src/*` (TanStack CLI default) — consistent with the `server/api` convention from the previous change.
- Wire **TanStack Query** at the app root: a `QueryClient` created per request in the router context and a `QueryClientProvider` in the root route, ready for real queries.
- Build a minimal app shell: root route with document title, landing route at `/` rendering the application heading plus a design-system button with a Lucide icon, and a not-found route returning HTTP 404.
- The landing page issues the first live query: it requests the **relative** path `/api/greet/utsav?greeting=Hello&times=1` and displays the returned greeting, with loading and error states. Absolute URLs such as `http://localhost:8787` are never hardcoded in app code — production requires relative paths.
- Configure a Vite dev proxy (`/api` → `http://127.0.0.1:8787`) so the relative API calls reach the Hono worker in local development without CORS.
- Add Vitest + Testing Library tests in a dedicated `tests/` folder mirroring `src/` (matching the `server/api` convention) with network calls mocked, and wire `apps/web` and `packages/ui` into the Turborepo pipelines; the root Biome configuration covers both packages.

Out of scope: the typed `api-client` package (the demo query uses a plain fetch), any real finance pages or features, authentication, and deployment. Dependencies are installed with the TanStack/shadcn CLIs and `pnpm add` — no hand-written dependency manifests.

## Capabilities

### New Capabilities

- `web-platform`: The web application foundation — a server-rendered TanStack Start app serving the finance UI shell with the shadcn/ui design system and routing conventions that future finance capabilities build on.

### Modified Capabilities

- None. `api-platform` (from `scaffold-project-hono-api`, not yet archived) is untouched — this change adds a client that will consume it later.

## Impact

- **New packages**: `apps/web` (TanStack Start app) and `packages/ui` (shared shadcn/Base UI design system).
- **Dependencies introduced**: `@tanstack/react-start`, `@tanstack/react-router`, `@tanstack/react-query`, `vite`, `tailwindcss` (v4), shadcn-generated component dependencies (Base UI, `class-variance-authority`, `clsx`, `tailwind-merge`), `lucide-react`, `vitest`, `@testing-library/react`, `jsdom`.
- **Existing files touched**: `README.md` (web commands); `pnpm-lock.yaml`. No changes to `server/api`, turbo pipelines, or CI — `apps/*` and `packages/*` are already workspace globs and turbo discovers the new packages' tasks automatically.
- **API surface created**: `GET /` (landing page HTML), 404 view for unknown routes. The landing page consumes the existing `GET /api/greet/{name}` endpoint (read-only; `api-platform` behavior is unchanged).
