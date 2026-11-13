# Proposal

## Why

AGENTS.md fixes the product direction: one authoritative backend API consumed by both the web application and a future Android application. The backend API, shared Zod schemas, and typed `@finance-application/api-client` package exist and the web app is in active use, but the mobile application does not exist yet. Scaffolding the Expo app now establishes the mobile foundation — workspace integration, strict TypeScript tooling, Expo Router navigation, the boxy StyleSheet design language, and authenticated session handling against the real API — so finance capabilities can be ported to mobile on a proven shell.

## What Changes

- Add an `apps/android` workspace: an Expo SDK application with Expo Router (file-based routes), TypeScript strict mode, wired into the existing pnpm workspace and Turborepo pipelines (`typecheck`, `lint`, `test`, `build`), with no native toolchain required in CI.
- Establish pure native styling: React Native `StyleSheet` API only — no NativeWind/Tailwind, no styled-components, no CSS-in-JS libraries. Introduce boxy theme tokens (zero border radius, sharp corners, geometric edges and spacing) consistent with AGENTS.md's style preference and the web design language.
- Wire authentication against the real API through `@finance-application/api-client` with an environment-configurable base URL:
  - A sign-in screen calling `POST /api/auth/login`.
  - Explicit cookie-session management for React Native: capture `Set-Cookie` values from login/refresh responses, persist them in `expo-secure-store`, and attach them as a `Cookie` header on API requests. The API's existing HttpOnly-cookie session contract is consumed unchanged — no server or `user-auth` behavior changes. The `api-client` gains a small backwards-compatible hook that exposes response headers for cookie capture.
  - Boot-time session restore (`GET /api/auth/me`, falling back to the refresh flow on `401`), a protected route group that redirects unauthenticated users to sign-in, and a sign-out control calling `POST /api/auth/logout`.
- An authenticated home (dashboard shell) screen showing the signed-in user's email, built with the boxy StyleSheet theme.
- Vitest coverage for platform-independent session/cookie logic; `typecheck`, `lint`, `test`, `build` scripts compatible with the existing CI pipeline.

Out of scope (explicitly): finance data screens (accounts, transactions, categories, transfers, budgets, reports), EAS or local native builds and store distribution, iOS-specific tuning beyond Expo cross-platform defaults, offline caching, push notifications, and any API or database changes.

## Capabilities

### New Capabilities

- `android-platform`: The Expo application foundation — the `apps/android` workspace shell, Expo Router navigation and protected-route conventions, cookie-session authentication wiring to the authoritative API, secure token storage, and environment configuration. The mobile counterpart of `web-platform`.
- `android-ui`: The mobile design system — the boxy StyleSheet theme tokens and styling conventions, and the scaffold screens (sign-in, authenticated home). The mobile counterpart of `web-ui`.

### Modified Capabilities

- None. The `api-client` header-capture hook is a backwards-compatible implementation detail, and no server, `user-auth`, or `api-platform` requirement changes.

## Impact

- **New workspace**: `apps/android` with `package.json`, Expo app config, TypeScript config, route group structure, and tests.
- **Modified packages**: `packages/api-client` gains an optional response-header capture hook on `apiFetch` (no behavior change for existing callers: the web app).
- **Dependencies introduced**: `expo`, `expo-router`, `react-native`, `expo-secure-store`, `expo-status-bar`, `react-native-safe-area-context`, `react-native-gesture-handler` (Expo Router requirement), plus dev tooling (`vitest`, TypeScript, Biome) matching the repo.
- **CI/CD**: no workflow changes — the existing `pnpm turbo run typecheck lint test build` pipeline picks up the new workspace; the app's `build` task uses `expo export` so CI needs no Android SDK.
- **No changes** to `server/api`, `db`, or any finance domain package.
- **Risks**: React Native does not reliably auto-persist HTTP cookies (especially on Android), so the session layer manages cookies explicitly; local development requires a network-reachable API base URL (device/emulator cannot use `localhost`), handled via environment configuration.
