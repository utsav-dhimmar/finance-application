# Proposal

## Why

The mobile app can only authenticate today: after sign-in it renders a stub home screen with no access to any finance data. Before finance screens can be built on the Android app, it needs the same client data architecture the web app uses — TanStack Query for server state, services over the shared typed API client, react-hook-form + Zod validation against `@finance-application/schemas`, and toast feedback for mutations — plus its tests consolidated under a `tests/` directory following the web pattern.

## What Changes

- Add TanStack Query to the Expo app: `QueryClientProvider` in the root layout, web-parity `staleTime: 30_000`, and query-key conventions shared with the web services.
- Add a services layer (`src/services/*-service.ts`) wrapping `@finance-application/api-client` domain functions with exported query-key constants and `ApiError` → user-message mapping, mirroring `apps/web/src/services`.
- Add a hooks layer (`src/hooks/use-*.ts`) with `useQuery`/`useMutation` wrappers that invalidate all related query keys on success, mirroring `apps/web/src/hooks`.
- Add react-hook-form + `@hookform/resolvers` (zodResolver) for form validation against the shared Zod schemas, with forms typed `useForm<Input, unknown, Output>` like the web.
- Add sonner-native toasts for mutation success/error feedback (web uses sonner; sonner-native is its React Native port).
- Route all data-layer API calls through the existing `SessionMachine.run()` so the single-flight refresh on `401 UNAUTHENTICATED` keeps working for every screen.
- Tooling: reorganize tests into `tests/` mirroring `src/` (moving the existing colocated session/theme tests into it), update `vitest.config.mts` to include `tests/**/*.test.{ts,tsx}`, and add `@testing-library/react-native` so component and hook tests follow the web test pattern.
- Out of scope (later changes): the finance screens themselves, bottom-tab navigation, archive/trash/settings/register screens.

## Capabilities

### New Capabilities

- `android-data`: the mobile client data layer — server state via TanStack Query, services and hooks over the shared API client, Zod-validated forms, mutation invalidation, and toast feedback for mutations.

### Modified Capabilities

- (none — `android-platform`'s session and refresh requirements are preserved unchanged; the test-file reorganization is repository tooling, not system behavior)

## Impact

- `apps/android`: new dependencies (`@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`, `sonner-native`, `@testing-library/react-native`); new `src/services/`, `src/hooks/`, `tests/` trees; root layout gains `QueryClientProvider` and the toast root; moved test files.
- Shared packages, server API, and web app are unaffected: contracts are consumed unchanged through the existing platform-independent `api-client`.
- Pipeline: `apps/android` must keep passing `typecheck`, `lint`, `test`, `build` in the Node-only Turborepo pipeline.
