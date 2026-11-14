# Proposal

## Why

An audit of `apps/android` against the Vercel React Native performance rules found the mobile app using JS-rendered primitives where the platform offers native ones — JS bottom tabs, a custom Modal-based select field, and a legacy `FlatList` — plus `StyleSheet.create` calls re-running during render in 21 component files. Native navigators, native menus, and recycled lists are the highest-impact levers for scroll and interaction performance on Android, and the render-work cleanup removes avoidable per-frame allocations. Making this move now, while the app has four screens and a single list surface, keeps the migration small.

## What Changes

- **BREAKING (visual)**: The bottom tab bar and all select-field option pickers render as platform native UI (Material tab bar and dropdown menus on Android) and follow system styling, not the boxy theme. The boxy visual-style spec gains an explicit exemption for platform-rendered native UI.
- Replace expo-router's JS `Tabs` with Expo Router's native tab bar (`NativeTabs` from `expo-router/native-tabs` — the platform tab bar for the SDK 58 navigation runtime), keeping the app header above the tab bar and the same four destinations.
- Replace the custom `SelectField` option modal with `zeego` native dropdown menus: the labeled trigger stays boxy StyleSheet-styled; opening it presents the platform menu.
- Narrow the dashboard's year select from the 2000–2100 window to a rolling window around the device's current year so the native menu stays usable (server-side reporting validation is unchanged).
- Migrate the activity feed from `FlatList` to `@shopify/flash-list` for cell recycling.
- Memoize per-component `StyleSheet.create` results with `useMemo` across the 21 affected files (no visual or behavioral change).
- Documented, no-action decisions from the audit: eight zero-import dependencies stay (pre-approved for near-term features); React version skew between web (^19.2.0) and android (19.3.0, RN-pinned) is intentional; keystroke-level re-render micro-fixes (search input state placement, sign-in `watch`, `form.watch("type")` in the type-option map) are deferred — React Compiler already covers them.
- Deliver a manual QA checklist for the native surfaces (tab bar, menus, feed scrolling) since native behavior cannot be exercised in the Node-only CI pipeline.

## Capabilities

### New Capabilities

(none — new requirements join the existing `android-ui` capability)

### Modified Capabilities

- `android-ui`: The Boxy visual style requirement is amended to exempt platform-rendered native UI (native tab bar, native dropdown menus) from the zero-radius rule; a new requirement specifies that select fields open native dropdown menus behind boxy StyleSheet-styled triggers, and a new requirement bounds the dashboard year select's option range to a rolling window around the current year.

## Impact

- **Code**: `apps/android` only — `(app)/_layout.tsx` (tab navigator), `select-field.tsx` (menu-backed select), `transactions.tsx` (FlashList), `components/dashboard/period.ts` (year options), 21 component files (style memoization), their tests in `tests/`.
- **Dependencies**: adds `zeego` (+ its native menu peers `@react-native-menu/menu`, `react-native-ios-context-menu`, `react-native-ios-utilities`) and `@shopify/flash-list`; no removals from the pre-change dependency set (audit decision keeps all zero-import packages).
- **Native builds**: three new native modules — a dev build (`expo run:android` / EAS) is required before device testing; the Node-only pipeline tasks (`typecheck`, `lint`, `test`, `build` via `expo export`) remain valid and unchanged.
- **Tests**: component tests around the select fields, tab shell, and feed require rewrites where the rendered surface goes native; the android-ui spec scenarios remain the acceptance contract.
- **Server/API**: none — endpoints, validation, and the 2000–2100 server-side year range are untouched; only the mobile picker's option list narrows.
- **Web app**: none.
