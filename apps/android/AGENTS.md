This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Testing

All tests live in `tests/`, mirroring `src/` (`tests/session/`, `tests/services/`, `tests/hooks/`, `tests/components/`). Test files are `*.test.ts` for Node-logic units and `*.test.tsx` for component/hook tests. Run them with `npx vitest run` (or `pnpm test`).

- **Runner**: Vitest with the `vitest-native` plugin (`reactNative()` in `vitest.config.mts`) — it runs a real React Native under the native engine with native-module mocks, so component and hook tests use `@testing-library/react-native` without Jest. RNTL matchers are typed via the `/// <reference types="vitest-native/rntl-matchers" />` directive in `tests/vitest-matchers.d.ts`.
- **Shared setup**: `tests/setup.ts` registers RNTL matchers on vitest's `expect` and runs `cleanup()` after each test. `tests/helpers.tsx` provides `createTestQueryClient` (retry disabled), `renderWithProviders`, and `makeHookWrapper` (a `QueryClientProvider` wrapper for `renderHook`).
- **Network is always stubbed**: never hit a real API. Use `vi.stubGlobal("fetch", stubFetchRouter(handlers))` with the helpers from `src/session/fetch-mock.ts`, and build a real `SessionMachine` over it with `makeRegisteredMachine` (`tests/services/helpers.ts`) so service and hook tests exercise the exact production path (cookies in, 401 refresh, retry).
- **RNTL 14 is async**: always `await render(...)`, `await renderHook(...)`, and `await fireEvent.*(...)`. Give `waitFor` an explicit `{ timeout }` — the native engine's first render in a file can exceed the default 1s.
- **Queries/mutations under test** need fresh clients per test (`createTestQueryClient`); spy on `queryClient.invalidateQueries` to assert invalidation sets.
- **Screens that use the session context** mock `@/session/session-context` (`vi.mock` + `vi.hoisted`) instead of mounting the real provider, so no secure store or network is involved.
- **Forms** use react-hook-form + `zodResolver` against `@finance-application/schemas`, typed `useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>`. In tests, derive expected messages by running the same schema's `safeParse` — never hardcode copies that the schema owns.

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
