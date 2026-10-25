# Tasks

## 1. Scaffold the app and shared UI package

- [x] 1.1 Create `apps/web` with the TanStack CLI (`pnpm dlx @tanstack/cli@latest create`; TypeScript, Tailwind CSS, recommended defaults) per design D1, rename the package to `@finance-application/web`, and run `pnpm install`; verify the workspace resolves the new package and `pnpm --filter @finance-application/web exec tsc --noEmit` passes on the generated code
- [x] 1.2 Remove any scaffold ESLint/Prettier config and add the standard scripts (`dev`, `build`, `typecheck`, `test`, `lint`) mirroring `server/api` per design D7; verify `pnpm lint` from the root covers `apps/web` and reports no errors after `biome check --write` normalizes the generated code
- [x] 1.3 Extend the base tsconfig in `apps/web` (DOM libs, JSX, Vite client types, `@/*` paths) per design D7, keeping strict mode; verify `pnpm --filter @finance-application/web typecheck` passes with imports resolving through the alias
- [x] 1.4 Initialize shadcn in monorepo mode with the Base UI base per design D2 so components and Tailwind tokens are generated into `packages/ui`; rename it to `@finance-application/ui` as a source-export package (workspace dependency from `apps/web`, `typecheck` and `lint` scripts, no build step); add the `button` component and `lucide-react` via `pnpm add`; verify `pnpm install` resolves both packages and `apps/web` imports the button from `@finance-application/ui`

## 2. App shell with TanStack Query

- [x] 2.1 Build the landing route at `/`: application heading, shadcn Button with a Lucide icon, document title "Finance Application" via the root route's head content, per design D3; verify a render test in `tests/` asserts the heading and button are present
- [x] 2.2 Add the not-found view for unmatched routes (404 status) per design D3; verify a render test in `tests/` asserts the not-found message renders
- [x] 2.3 Set up Vitest for the app (`jsdom`, `@testing-library/react`, `@` alias, `tests/**` include) via `pnpm add -D` per design D6; verify `pnpm --filter @finance-application/web test` runs green from the `tests/` folder
- [x] 2.4 Wire TanStack Query per design D4: a per-request `QueryClient` in the router context and `QueryClientProvider` in the root route; verify a render test mounts a trivial query through the provider without errors
- [x] 2.5 Add the greet query to the landing page per design D5: `useQuery` fetching the relative path `/api/greet/utsav?greeting=Hello&times=1`, rendering a loading state, the returned message, or an error fallback; verify tests with `fetch` stubbed assert the success message and the error fallback
- [x] 2.6 Configure the Vite dev proxy (`/api` → `http://127.0.0.1:8787`) per design D5; verify the proxy entry is present in the Vite config and the app still builds

## 3. Integration verification

- [x] 3.1 Run the full pipeline with `pnpm turbo run typecheck lint test build`; verify every task exits 0 with `server/api`, `packages/ui`, and `apps/web` included
- [x] 3.2 Start both dev servers (`wrangler dev` for the API, Vite dev for the web app) and smoke-test: `/` returns HTML containing the heading and button before hydration and then displays `Hello, utsav!` once the query resolves through the proxy, an unknown path returns HTTP 404 with the not-found view, and `/api/hello` through the Vite proxy returns the hello JSON; stop both servers
- [x] 3.3 Update `README.md` with the web and UI-package commands and the updated repository layout; verify each documented command runs as written
- [ ] 3.4 After the implementing commits are pushed, verify the GitHub Actions workflow runs green with `apps/web` and `packages/ui` included

## Workflow follow-up

- Archive the change once review and CI are satisfied (`/openspec-archive-change`).
- After archive, confirm `openspec list --specs` shows `web-platform` alongside `api-platform`.
