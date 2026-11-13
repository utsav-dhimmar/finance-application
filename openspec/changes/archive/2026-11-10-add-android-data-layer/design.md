# Design

## Context

`apps/android` is an Expo SDK 58 / Expo Router app with a working session layer (`SessionMachine`, secure cookie storage, single-flight refresh on 401) and a boxy StyleSheet theme. It has no server-state library, no form library, and no toast mechanism, and its tests are colocated next to sources in `node`-environment Vitest. The web app (`apps/web`) already implements the target architecture: services over `@finance-application/api-client` with query-key constants, hooks that invalidate related keys, react-hook-form + zodResolver against `@finance-application/schemas`, sonner toasts, and tests under `tests/` mirroring `src/`. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**

- Mirror the web's data architecture in the mobile app so both clients behave identically against the same API.
- Preserve the existing session layer's refresh semantics for every data operation.
- Establish the `tests/` layout and React Native testing setup that all later screen changes rely on.
- Keep the change deployable: no screen changes yet, pipeline stays green.

**Non-Goals:**

- Any finance screen or navigation change (later changes).
- Changes to `packages/*`, `server/*`, or `apps/web`.
- Register, archive, trash, or settings capabilities.
- Charts or any dashboard UI.

## Decisions

- **TanStack Query v5 for server state** (matches the web's stack and AGENTS.md's TanStack Query mandate). One `QueryClient` created in `src/lib/query-client.ts` with `staleTime: 30_000` (web parity), provided in `src/app/_layout.tsx` alongside the existing providers. Alternative considered: extending the custom `useSyncExternalStore` pattern — rejected because it would fork the codebase into two state architectures and duplicate invalidation logic per screen.

- **Services mirror the web's service layer.** `src/services/<entity>-service.ts` wraps `@finance-application/api-client` functions, exports `<ENTITY>_QUERY_KEY` constants, and maps `ApiError` codes to user copy exactly as `apps/web/src/services` does. Query options factories (`*QueryOptions`) are exported so hooks and future screens share one staleness configuration. The service functions receive the session-bound fetch context so all calls flow through `SessionMachine.run()` — this is the integration point that keeps the single-flight refresh working (web has no equivalent because the browser sends cookies automatically).

- **Hooks mirror the web's hook layer.** `src/hooks/use-<entity>.ts` exports `use<Entity>` queries and `useCreate<Entity>`/`useUpdate<Entity>`/… mutations, each invalidating all related keys on success (transactions invalidate transactions, accounts, categories, activity, reports — same set as `useInvalidateTransactionRelated` on web). Key duplication risk is mitigated by importing key constants from services only.

- **react-hook-form + @hookform/resolvers (zodResolver) for forms.** Same `useForm<Input, unknown, Output>` typing as the web so form state is `z.input` and submitted values are `z.output` (amount string → `amountMinor`). react-hook-form works unmanaged in React Native with `Controller` for RN inputs. The forms themselves arrive with the screen changes; this change establishes the pattern with a reference form hookup (sign-in screen) so later screens copy it. Alternative considered: manual state + `schema.parse()` at submit — rejected: loses per-field error placement and diverges from the web pattern the user asked to match.

- **sonner-native for toasts.** React Native port of the sonner library the web uses, driven from mutation hooks' `onSuccess`/`onError` handlers. Requires `react-native-reanimated` (already a dependency). Install with `npx expo install` (per apps/android AGENTS.md) to resolve SDK-compatible versions; pure-JS packages (`@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`) install with `pnpm add` per root AGENTS.md. Toast root mounts in `src/app/_layout.tsx` inside the safe-area provider.

- **Tests move to `tests/` and gain a component-test setup.** Existing colocated tests move verbatim: `src/session/*.test.ts` → `tests/session/`, `src/theme.test.ts` → `tests/theme.test.ts` (imports updated for the new relative depth). `vitest.config.mts` switches to `include: ["tests/**/*.test.{ts,tsx}"]`. Component and hook tests use `@testing-library/react-native` v13 (React 19 compatible), which ships a documented Vitest integration; its setup (matchers, mock native modules, environment for `renderHook` with a `QueryClientProvider` wrapper) is proven with one smoke test before any later screen tests are written. `passWithNoTests: true` is dropped once the move is done — the tree always has tests. Node-environment unit tests (services, session, theme) stay in plain `node` env; only component/hook tests opt into the RN test environment.

- **Error-copy parity is enforced by tests.** Each service's message-mapping function gets unit tests asserting the same strings the web services produce for the same API error codes.

## Risks / Trade-offs

- [@testing-library/react-native + Vitest is a less-traveled path than Jest] → Spike first: one smoke component test proves the environment before any screen change depends on it. If RNTL's Vitest integration fails on SDK 58, fall back to Jest for component tests only, keeping Vitest for unit tests (documented in this change's tasks before screens start). Consult the Expo SDK 58 and RNTL versioned docs during implementation per apps/android AGENTS.md.
- [Session-bound fetch inside TanStack Query] → A `QueryClient` without the session wrapper would bypass single-flight refresh. The service layer closes over the session machine's `run()`; a test asserts a 401-then-refresh-then-retry sequence through a query hook.
- [sonner-native native-module compatibility on SDK 58] → Verify with `npx expo-doctor` after install; if incompatible, fall back to the existing inline-message pattern for change 1 and keep toasts in a follow-up (spec's toast requirement would be implemented by the screen changes that first ship mutations).
- [pnpm + Metro package exports] → New deps must resolve through Metro's `unstable_enablePackageExports`; verify the app still bundles with `npx expo export --platform android` (the existing `build` task).

## Migration Plan

1. Add dependencies; verify `expo-doctor` and typecheck.
2. Wire `QueryClientProvider` + toast root in `_layout.tsx`.
3. Add services + hooks for the four core entities (transactions, accounts, categories, preferences/reports) with unit tests under `tests/`.
4. Move existing tests into `tests/`, update the Vitest config, add the RNTL smoke test.
5. Run `pnpm turbo run typecheck lint test build` from the root; all four tasks must pass for `apps/android`.

Rollback: the change touches only `apps/android`; reverting the workspace directory restores the previous scaffold. No data or server migration exists.

## Open Questions

None — dependency compatibility unknowns are handled by the documented spike-and-fallback plan inside implementation.
