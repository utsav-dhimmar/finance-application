# @finance-application/android

The Expo (React Native) client for the personal finance application. It
consumes the same authoritative Hono API as the web app through
`@finance-application/api-client`, with sessions managed explicitly via a
secure cookie jar (see the `scaffold-android-expo-app` change for the design).

## Prerequisites

- Node.js and pnpm (repo-managed)
- The API dev server, which listens on port 8787 by default. On localhost it
  binds `127.0.0.1` only; when testing from a physical device, start it so
  the LAN can reach it: `pnpm --filter @finance-application/api exec
  wrangler dev --ip 0.0.0.0`
- An Android device on the same network with the Expo Go app, or an Android
  emulator

## Required environment variable

`EXPO_PUBLIC_API_URL` — the API base URL, inlined into the bundle at build
time. The app fails fast at startup with an actionable error when it is
unset.

| Target                | Value                              |
| --------------------- | ---------------------------------- |
| Android emulator      | `http://10.0.2.2:8787`             |
| Device on the same LAN | `http://<your-machine-LAN-IP>:8787` |

Set it per shell session (`EXPO_PUBLIC_API_URL=... pnpm start`) or in a
git-ignored `.env.local` file in this directory.

## Commands

| Command               | What it does                                        |
| --------------------- | --------------------------------------------------- |
| `pnpm start`          | Start the Expo dev server (press `a` for Android)   |
| `pnpm android`        | Start the dev server and open on Android            |
| `pnpm typecheck`      | `tsc --noEmit`                                      |
| `pnpm lint`           | Biome lint (root config; assets are excluded)       |
| `pnpm test`           | Vitest unit tests (session layer)                   |
| `pnpm build`          | `expo export --platform android` (no native toolchain needed) |

All tasks run through the repo pipeline as well:
`pnpm turbo run typecheck lint test build --filter=@finance-application/android`.

## Project layout

- `src/app/` — Expo Router routes. `src/app/_layout.tsx` holds the session
  gate; `src/app/(auth)/sign-in.tsx` is public; `src/app/(app)/index.tsx` is
  the protected home screen.
- `src/session/` — platform-independent session layer: Set-Cookie parsing,
  the secure cookie jar, environment validation, the auth wiring over
  `@finance-application/api-client`, and the single-flight-refresh session
  state machine. Unit-tested with Vitest; the only platform-specific module
  is `secure-store-adapter.ts` (expo-secure-store).
- `src/theme.ts` — the boxy design tokens (zero corner radius, 1px
  structural borders). All screens style exclusively through these tokens
  with React Native StyleSheet — no styling frameworks.

## Native development

This scaffold never requires the Android SDK: CI and the `build` script use
`expo export`. For native builds (APK/AAB) use EAS Build or `expo
prebuild`; see the Expo documentation.
