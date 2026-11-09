# Design

## Context

The monorepo already has the authoritative Hono/Workers API, shared Zod schemas, and the typed `@finance-application/api-client` consumed by the web app. Sessions are HttpOnly cookies (`__Host-access_token`, `__Secure-refresh_token`) per the `user-auth` spec; registration is closed; refresh is single-use rotation. `pnpm-workspace.yaml` already globs `apps/*`, and CI runs `pnpm turbo run typecheck lint test build` on every workspace in a Node-only environment. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**

- A runnable Expo + Expo Router app in `apps/android` that passes the existing turbo pipeline (typecheck, lint, test, build) without native tooling.
- A session layer that consumes the existing cookie-based auth contract unchanged, with secure storage, boot-time restore, single-flight refresh, and sign-out.
- The boxy StyleSheet theme as the single styling source for future finance screens.
- Monorepo integration that lets the app import `@finance-application/api-client` and `@finance-application/schemas` from source.

**Non-Goals:**

- No native builds (EAS/device builds), store distribution, or Android SDK in CI — `expo export` covers the `build` task.
- No TanStack Query, offline caching, or data screens — session state uses plain React context; query tooling arrives with the first data capability.
- No API, database, or `user-auth` requirement changes.

## Decisions

### D1: Expo Router over bare React Navigation

File-based routing (`app/` directory) is the Expo standard, gives typed routes and deep-link support, and wraps React Navigation internally. Bare React Navigation was rejected (more boilerplate, no file convention) as was "no navigation yet" (protected-route behavior is a spec requirement, so routing must exist).

### D2: Manual cookie jar instead of bearer tokens or platform cookie stores

React Native networking does not reliably persist cookies across requests (notably on Android, where the cookie jar is disabled), and relying on iOS's implicit cookie store would be platform-inconsistent. The app therefore implements an explicit cookie jar:

- Capture `Set-Cookie` values from login/refresh responses via a response-header hook (D3).
- Persist cookie values in `expo-secure-store` (Keychain/Keystore).
- Attach `Cookie: __Host-access_token=…; __Secure-refresh_token=…` on every API request.

Alternatives rejected:

- **Bearer tokens / new auth endpoints** — would change the `user-auth` spec and server behavior, expanding scope far beyond a scaffold.
- **Platform cookie stores only** — inconsistent between iOS and Android; hard to inspect or clear deterministically.

Spec interpretation recorded here: `user-auth`'s "no JavaScript-readable surface" requirement targets the browser XSS/XHR surface. A first-party native client that reads `Set-Cookie` response headers does not alter server behavior and does not weaken the server-side contract; this is why no `user-auth` delta is included.

### D3: Extend `apiFetch` with an optional `onResponse` hook

`packages/api-client/src/client.ts` gains an optional `onResponse?: (res: Response) => void` in its options object. The cookie jar subscribes on login/refresh to capture headers. Backwards-compatible: existing callers pass no options change, and endpoint logic stays single-sourced in the api-client (per AGENTS.md "do not duplicate business logic across clients"). Rejected: duplicating the four auth calls inside the app with raw `fetch`.

### D4: `EXPO_PUBLIC_API_URL` for the API base URL

Expo inlines `EXPO_PUBLIC_*` environment variables at bundle time — the natural build-time config the spec requires. The app asserts it is set at startup and fails with an actionable error when missing. For local development the value is the LAN URL of the Workers dev server (device/emulators cannot reach `localhost`). A runtime-configurable server address field is deferred until needed.

### D5: Metro monorepo setup

Metro must resolve the workspace's source-exported packages (`exports: "./src/index.ts"`). Configure Metro with package exports enabled plus `watchFolders` rooted at the repo and `nodeModulesPaths` covering both the app and root `node_modules`. This is verified by the `expo export` build task in CI, which exercises module resolution headlessly.

### D6: StyleSheet theme module

A single `theme.ts` exports light and dark color palettes, spacing, typography, and a `radius: 0` constant; the dark palette mirrors the web `.dark` block (packages/ui/src/styles.css) converted from oklch to hex. A `useThemeColors()` hook selects the palette from the device color scheme (`useColorScheme`), and screens build their StyleSheet from the selected palette, so scheme changes re-render live. No NativeWind/styled-components (explicit user requirement and AGENTS.md style preference). This mirrors how `packages/ui` centralizes web styling, but stays inside the app since RN primitives differ from web DOM components.

### D7: Route groups and session gate

- `app/_layout.tsx` — root layout with the session provider.
- `app/(auth)/sign-in.tsx` — public route.
- `app/(app)/index.tsx` — protected home route.

The root layout gates rendering on session state: `restoring` → minimal loading view, `signed-out` → `(auth)` group, `signed-in` → `(app)` group. Conditional rendering at the root avoids redirect flashing and keeps route guards in one place.

### D8: Testing scope

Vitest covers platform-independent modules: the `Set-Cookie` parser (including Android's comma-joined multi-cookie header format), the cookie jar (secure store mocked), and the single-flight refresh logic (concurrent 401s produce one refresh call). React component rendering is not tested in this scaffold — React Native Testing Library is Jest-oriented and would add tooling disproportionate to two screens; noted as a limitation.

## Risks / Trade-offs

- [RN may merge multiple `Set-Cookie` headers into one comma-joined value] → The parser handles both separate and joined forms, with unit tests covering the joined `__Host-access_token` + `__Secure-refresh_token` case.
- [Metro/workspace resolution regressions break CI] → The `expo export` build task runs in CI and catches resolution failures headlessly; Metro config kept minimal.
- [Manual cookie handling reimplements what browsers do for free] → Accepted trade-off to keep the server contract unchanged; the jar is a small, fully unit-tested module rather than implicit platform behavior.
- [Secure-store unavailability (e.g., emulator without keystore)] → Session store surfaces storage errors as sign-out-with-message rather than crashing.
- [React version skew between web (React 19) and Expo] → The app pins its own React version from the Expo template; no shared React dependency across apps.
- [Biome linting Expo-generated directories] → Lint config ignores `.expo/`, `android/`, `ios/`, and export output; only authored source is linted.

## Migration Plan

Purely additive: new workspace, one optional parameter added to `apiFetch`. No data migration. Rollback is removing `apps/android` and the `onResponse` option. The web app's behavior is unaffected (it never passes `onResponse`).

## Open Questions

None blocking. The exact Expo SDK version is picked at implementation time from the current stable template (does not affect specs or task order); the sign-in route path (`sign-in`) follows the existing web convention and can be renamed trivially during implementation if desired.
