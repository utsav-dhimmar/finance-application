# Tasks

## 1. Expo workspace scaffold

- [x] 1.1 Create the `apps/android` Expo TypeScript app (Expo Router template) and install runtime dependencies with `pnpm add` (`expo`, `expo-router`, `react-native`, `expo-secure-store`, `expo-status-bar`, `react-native-safe-area-context`, `react-native-gesture-handler`); verify `pnpm install` resolves the new workspace without lockfile conflicts
- [x] 1.2 Configure `tsconfig.json` extending `tsconfig.base.json` with Expo's base config and strict mode, add `typecheck` (`tsc --noEmit`), `lint` (Biome, ignoring `.expo/`, `android/`, `ios/`, export output), `test` (Vitest), and `build` (`expo export --platform android`) scripts, and verify `pnpm turbo run typecheck lint test build` runs all four tasks for the workspace with the build producing a JS export without native tooling
- [x] 1.3 Configure Metro for the monorepo (package exports enabled, repo-root `watchFolders`, dual `nodeModulesPaths`), add a smoke module importing `@finance-application/api-client` and `@finance-application/schemas`, and verify the `expo export` build succeeds with both workspace packages resolved into the bundle

## 2. api-client response hook

- [x] 2.1 Add the optional `onResponse?: (res: Response) => void` hook to `apiFetch` options in `packages/api-client/src/client.ts`, called with the raw response before error decoding, and verify existing Vitest coverage still passes plus a new test asserting the hook receives the response and default behavior is unchanged for callers that omit it
- [x] 2.2 Run `pnpm turbo run typecheck lint test` filtered to `packages/api-client` and `apps/web` and verify both report no regressions from the signature extension

## 3. Boxy theme foundation

- [x] 3.1 Create `apps/android/src/theme.ts` exporting color, spacing, typography tokens and a zero corner-radius constant with typed StyleSheet helpers, and verify a unit test asserts every radius-related token is 0 and the module imports cleanly under Vitest
- [x] 3.2 Verify Biome lint and `tsc --noEmit` pass for the theme module

## 4. Session layer

- [x] 4.1 Implement the `Set-Cookie` parser handling both separate and comma-joined multi-cookie headers (the Android RN format) and verify Vitest tests cover extracting `__Host-access_token` and `__Secure-refresh_token` from joined and separate header forms, including attribute stripping
- [x] 4.2 Implement the secure cookie jar (persist via `expo-secure-store`, load at startup, clear on sign-out) with the store interface mocked in Vitest, and verify tests cover save/load/clear round-trips and storage-failure handling (surfaced as an error state, not a crash)
- [x] 4.3 Implement startup environment validation reading `EXPO_PUBLIC_API_URL` that fails with an actionable error when unset, and verify a Vitest test covers both the configured and missing-configuration paths
- [x] 4.4 Implement the auth session module wiring `login`/`me`/`refresh`/`logout` from `@finance-application/api-client` with `baseUrl` and `onResponse` cookie capture, attaching the stored `Cookie` header to every request, and verify Vitest tests cover: cookies sent on requests, session established from login response cookies, and no cookie values appearing in error messages or logs
- [x] 4.5 Implement the session state machine (`restoring`/`signed-out`/`signed-in`) with boot-time restore via `me` falling back to refresh, and single-flight refresh on `401 UNAUTHENTICATED`, and verify Vitest tests cover: restore with expired access token but valid refresh, concurrent 401s producing exactly one refresh call, and `INVALID_REFRESH_TOKEN` clearing the session to `signed-out`

## 5. Routing and screens

- [x] 5.1 Build the root `app/_layout.tsx` session gate rendering the loading view while restoring and switching between the `(auth)` and `(app)` route groups, and verify the unauthenticated-launch behavior from the spec by a smoke import build (`expo export`) and `tsc --noEmit`
- [x] 5.2 Build the `(auth)/sign-in.tsx` screen — email/password fields, submit disabled while empty or in flight, in-flight indication, on-screen failure message keeping entered values, navigation to the `(app)` group on success — styled exclusively with the theme tokens, and verify `tsc --noEmit` and Biome lint pass
- [x] 5.3 Build the `(app)/index.tsx` home screen showing the signed-in user's email and the sign-out control calling the logout endpoint, clearing the cookie jar, and returning to the `(auth)` group, styled exclusively with the theme tokens, and verify `tsc --noEmit` and Biome lint pass
- [x] 5.4 Run the app with `expo start` against a locally running API with a device or emulator, and verify end-to-end: sign-in lands on home showing the email, restart restores the session without re-entering credentials, sign-out returns to sign-in, and invalid credentials show the generic message (record results in the change notes)
- [x] 5.5 Follow the device color scheme: add the dark palette to the theme, a `useThemeColors` hook selecting it from `useColorScheme`, scheme-driven styles in the session gate and both screens, a scheme-aware status bar, and a dark splash background; verify unit tests cover the dark palette and the android typecheck/lint/test pipeline passes

## 6. Integration verification

- [x] 6.1 Document mobile development in `apps/android/README.md`: required `EXPO_PUBLIC_API_URL` (LAN address of the API dev server), start command, and script list, and verify the documented commands run as written
- [x] 6.2 Run `pnpm turbo run typecheck lint test build` from the repository root and verify all workspaces — including `apps/android` — pass together

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
