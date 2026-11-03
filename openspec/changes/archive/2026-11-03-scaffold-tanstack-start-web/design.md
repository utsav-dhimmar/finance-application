# Design

## Context

The monorepo foundation exists (change `scaffold-project-hono-api`): pnpm workspace with `apps/*` and `packages/*` globs, `tsconfig.base.json` (strict), Turborepo `build`/`typecheck`/`lint`/`test` pipelines, root Biome config, CI running `pnpm turbo run typecheck lint test build`, and a working `server/api` on Cloudflare Workers (dev on `127.0.0.1:8787`) including the `GET /api/greet/{name}` endpoint. The `server/api` package established conventions this change follows: `@/*` path alias to `src/*`, dedicated `tests/` folder mirroring `src/`, deps installed via CLI/`pnpm add` (not hand-written manifests), Biome for lint and format. AGENTS.md also mandates TanStack Query for server state and shadcn/ui on Base UI primitives. See proposal.md for motivation; specs/web-platform/spec.md for the behavioral contract.

## Goals / Non-Goals

**Goals:**

- A runnable TanStack Start (Vite, SSR) app in `apps/web` created by the official TanStack CLI, not hand-rolled.
- A shared `packages/ui` design-system package (`@finance-application/ui`) holding shadcn/Base UI components and Tailwind tokens, consumed by `apps/web`.
- TanStack Query wired once, correctly (per-request client, provider at the root), proven by a live query against the greet endpoint.
- Same conventions as `server/api`: `@/*` alias, `tests/` folder, Biome, turbo task names.
- The full pipeline (typecheck, lint, test, build) green with all three packages included.

**Non-Goals:**

- No typed `api-client` package — the demo query uses a plain `fetch`; the typed client arrives with the first real feature.
- No real pages or features, no auth, no deployment target for the web app.

## Decisions

### D1. Scaffold via the official CLIs

Create the app with `pnpm dlx @tanstack/cli@latest create` (TypeScript, Tailwind CSS, recommended defaults) into `apps/web`; the CLI pre-configures Vite, file-based routing, Tailwind, and the `@/*` alias. Then initialize shadcn in **monorepo mode** so component generation targets the shared UI package (D2), selecting **Base UI** as the primitives base (mandated by AGENTS.md), and add the `button` component. Rename generated packages to `@finance-application/web` and `@finance-application/ui` so filter commands match `server/api`'s naming. _Alternatives rejected_: shadcn's full `-t start --monorepo` preset (scaffolds more than needed); fully manual Vite setup (high drift risk against a fast-moving framework).

### D2. Shared `packages/ui` from day one

shadcn components and Tailwind design tokens live in `packages/ui`, exported as a **source package**: `exports` point at TypeScript source (no build step), Vite compiles it as part of `apps/web`, and turbo `typecheck`/`lint` cover it. `apps/web` depends on it via `"@finance-application/ui": "workspace:*"` and imports components from its alias (e.g. `@finance-application/ui/components/button`) plus its Tailwind token stylesheet. This gives every future consumer (additional apps, Android web views) one design-system home. _Alternative rejected_: keeping components inside `apps/web/src/components/ui` — fine for one app, but a second consumer is already foreseeable and the shadcn monorepo tooling is first-class.

### D3. App shell routes

- Root route (`src/routes/__root.tsx` from the CLI): `<HeadContent>` with document title "Finance Application", global styles including the `packages/ui` token stylesheet, and the `QueryClientProvider` (D4).
- Index route (`/`): application heading, one shadcn `Button` containing a Lucide icon, and the live greeting line (D5) — the minimum proving design system, icons, query wiring, and SSR together.
- Not-found: a not-found component on the root route returning HTTP 404 for unmatched paths (TanStack Router's `notFoundComponent`).

### D4. TanStack Query — per-request client in the router context

The `QueryClient` is created per request inside the router context (`createContext` + `beforeLoad`/context wiring per TanStack Start docs) and passed to a `QueryClientProvider` in the root route. Creating the client in module scope would leak cache and in-flight state across requests on the SSR server; per-request construction is the documented pattern. Query defaults stay conservative (no `refetchOnWindowFocus` surprises); devtools are not added.

### D5. Greet query — relative paths only, absolute hosts only in the dev proxy

The landing page runs a `useQuery` whose `queryFn` fetches the **relative** path `/api/greet/utsav?greeting=Hello&times=1` and reads `messages[0]`. Relative paths are required for the code to work in production, where the frontend and API hosts differ from local dev. The absolute host exists in exactly one place: the Vite dev proxy config maps `/api` → `http://127.0.0.1:8787`, so the same relative fetch reaches `wrangler dev` locally with no CORS. SSR renders the loading state; the query resolves client-side after hydration (a server-side fetch would need a configured absolute base URL — deferred until a real feature needs SSR data).

### D6. Tests mirror the `server/api` convention, network mocked

Vitest with `jsdom` + `@testing-library/react` (added via `pnpm add -D`), configured in `apps/web/vitest.config.ts` with the same `@` alias mapping and `include: ["tests/**/*.test.tsx"]`. Route components render in isolation with a fresh `QueryClient` per test (no router-level SSR harness). The greet query tests stub `fetch` (`vi.stubGlobal`) with a resolved greeting for the success path and a rejected promise for the fallback path — no network, no API dependency. The HTTP-404 status, SSR-before-hydration, and live-proxy behaviors are verified against running dev servers in the integration tasks.

### D7. Toolchain integration

- `apps/web/tsconfig.json` extends the base config (strict, `noEmit`) and adds `DOM` libs, JSX settings, and Vite client types; `packages/ui` extends the base with JSX settings.
- Scripts mirror `server/api`: `dev`, `build` (Vite build), `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `lint` (`biome lint .`); `packages/ui` carries `typecheck` and `lint` (no build — source package).
- Any ESLint/Prettier config shipped by the scaffolds is removed; root Biome is the single linter/formatter, and `biome check --write` normalizes scaffold formatting once after generation.
- Turbo and CI need no changes: both workspace globs exist and the task names match the existing pipelines.

## Risks / Trade-offs

- [CLI scaffolds change fast; generated config may conflict with repo conventions] → adapt after generation (package renames, tsconfig extension, script names, lint config removal) and verify via the full turbo pipeline; all adaptions are mechanical.
- [`shadcn init` and the TanStack CLI are prompt-driven] → run with explicit flags where supported; where interactive-only, the task records the exact prompt answers (TypeScript, Tailwind yes, monorepo yes, Base UI base, neutral style defaults).
- [Source-export workspace packages under Vite] → Vite must compile `packages/ui` TS as part of the app; verified by both dev-server and production-build smoke tests in the integration tasks.
- [Query runs client-side only in the scaffold] → SSR shows the loading state; acceptable for a proof-of-usage demo, and D5 documents the SSR base-URL decision for the first real feature.
- [Biome reformatting generated code creates a large diff] → accepted; done once immediately after scaffolding so later diffs stay clean.
- [Vite dev proxy depends on the API running] → proxy is verified in the integration smoke task with both dev servers up; day-to-day front-end work shows the error fallback without the API.

## Migration Plan

Purely additive: two new workspace packages plus lockfile/README updates. Rollback is deleting `apps/web` and `packages/ui` and re-running `pnpm install`. No existing behavior changes; `server/api` is untouched.
