# Tasks

## 1. Dependencies

- [x] 1.1 Install `@shopify/flash-list` and `react-native-bottom-tabs` with `npx expo install` and `zeego` with `pnpm add` (per design D7); run `npx expo-doctor` and resolve any reported peer/native wiring; verify `pnpm install` completes and `apps/android/package.json` carries the three new dependencies

## 2. Dashboard year window

- [x] 2.1 Change `yearOptions()` in `src/components/dashboard/period.ts` to return the rolling window (current year − 10 … current year + 10, current year included) and update `tests/components/dashboard/period.test.ts` to assert the window bounds and that the current year is among the options; verify `pnpm test -- period` passes

## 3. StyleSheet memoization sweep

- [x] 3.1 In the 21 files that call `createStyles(c)` during render, wrap each call as `useMemo(() => createStyles(c), [c])` (import `useMemo` from react); verify no `createStyles(` call site remains outside a `useMemo` (grep) and `pnpm typecheck` passes
- [x] 3.2 Run the full component test suite and confirm all existing tests pass unchanged (zero-behavior refactor); verify `pnpm test` reports the same pass count as the pre-change baseline (189)

## 4. FlashList activity feed

- [x] 4.1 Swap `FlatList` → `FlashList` in `src/app/(app)/transactions.tsx`, keeping `data`, `keyExtractor`, `renderItem`, the header/empty/footer components, and `RefreshControl`, and set `estimatedItemSize` from the `ActivityRow` layout; verify `pnpm typecheck` passes and the transactions screen test still passes (or rewrite only imports/render-wrapping assertions it cannot survive)
- [x] 4.2 Verify feed behavior in tests: infinite "Load more" pagination, pull-to-refresh handler, and empty/error states render under FlashList; add/adjust assertions in `tests/components/transactions/lifecycle.test.tsx` coverage as needed; verify `pnpm test -- transactions` passes

## 5. Native select menus

- [x] 5.1 Rewrite `src/components/shared/select-field.tsx` internals to open a zeego native dropdown menu behind the unchanged Pressable trigger, marking the current option and leaving the value untouched on plain dismissal (spec scenarios: menu opens with selection marked, choosing updates field, dismissal keeps value, trigger stays boxy); verify `pnpm typecheck` passes
- [x] 5.2 Update the select-field tests to mock the native menu layer at the component boundary and cover the four spec scenarios; verify `pnpm test -- select-field` passes
- [x] 5.3 Run the dialogs, dashboard, and activity-filters tests that exercise `SelectField` consumers; rewrite only assertions that observed the old modal internals; verify `pnpm test` passes in full

## 6. Native bottom tabs

- [x] 6.1 Convert `src/app/(app)/_layout.tsx` to the native bottom tab navigator via `withLayoutContext(createNativeBottomTabNavigator().Navigator)` following the library's current Expo Router docs (icon supply resolved per design D1, library-default icons acceptable), keeping `AppHeader` mounted above the navigator and the four screen declarations with their titles; verify `pnpm typecheck` passes
- [x] 6.2 Rewrite the app-shell/layout tests for the native navigator (tab titles, header presence) and confirm sign-in/session-gate tests are unaffected; verify `pnpm test` passes in full

## 7. Verification and QA handoff

- [x] 7.1 Write `apps/android/QA-CHECKLIST.md` covering the native surfaces: tab bar renders and switches all four tabs, every select surface opens/selects/dismisses (dashboard month/year, filter type/account/category, all four form dialogs), feed scrolls with recycling and "Load more" works, pull-to-refresh, dark/light scheme switch; verify the file exists and each item maps to a spec scenario or design decision
- [x] 7.2 Run the full automated gate from the repo root: `pnpm turbo run typecheck lint test build` (android workspace green, build = `expo export --platform android`) plus `npx expo-doctor`; verify all four tasks exit successfully and record the QA checklist as the outstanding device-verification step

## 8. Runtime fix: native tab runtime incompatibility (device-testing triage)

- [x] 8.1 Replace the `react-native-bottom-tabs` integration with Expo Router's `NativeTabs` (stable `expo-router/native-tabs` export in SDK 58) after device testing showed `@bottom-tabs/react-navigation` crashes under the SDK 58 `standard-navigation` runtime (`useTheme` throws — no `@react-navigation/core` ThemeContext exists in the tree); remove the two packages and their config plugin, switch icons to Material Symbols, bind `tintColor` to the theme, update the shell test's mock boundary, and re-run the full gate green; verify `pnpm turbo run typecheck lint test build` reports 20/20 and `npx expo-doctor` passes
- [x] 8.2 Fix the pre-existing root-layout route declaration that warned at startup (`No route named "(auth)"`): rename the guarded `Stack.Screen` to `(auth)/sign-in` to match the actual child route (the auth group has no layout file); verify the warning no longer appears at app start
