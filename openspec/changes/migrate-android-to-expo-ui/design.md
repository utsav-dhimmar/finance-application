# Design

## Context

The Android app currently builds every interactive control from RN core primitives: `Pressable`-based buttons/cards/tab bar, RN `Modal` dialogs, a hand-rolled `SelectField` modal sheet (`select-field.tsx`), `@react-native-community/datetimepicker` for dates, `FlatList` for the activity feed, and expo-router's JS-rendered `Tabs` for bottom navigation. All of these render and handle input on the JS thread. `@expo/ui@58.0.28` is installed but never imported; its `jetpack-compose` surface provides the replacements: `Button`/`IconButton`, `AlertDialog`/`BasicAlertDialog`/`ModalBottomSheet`, `DropdownMenu`/`ExposedDropdownMenuBox`, `DatePicker`, `TextField`/`BasicTextField`, `SingleChoiceSegmentedButtonRow`, `NavigationBar`, `LazyColumn`, `LoadingIndicator`, `Snackbar`. Compose components require a `Host` ancestor, take `colors`/`shape` props per component, expose `cornerRadius(n)` and `clip` modifiers, and run Material 3 under the hood. Expo 58 is on the New Architecture (required by `@expo/ui`). The boxy design system lives in a single shared theme module (`src/theme.ts`) consumed via `useThemeColors()`; 189 tests across 37 files exercise the current components through `@testing-library/react-native` under vitest-native.

## Goals / Non-Goals

**Goals:**
- Move interactive controls and lists onto native-backed `@expo/ui` components so rendering, gestures, and list recycling run on the native thread.
- Keep the boxy visual style, the shared theme source, and the device color-scheme behavior intact across the native layer.
- Preserve all externally observable behavior: web-verbatim copy, form validation semantics, pagination, toasts, lifecycle (archive/restore/delete) flows.
- Remove `@react-native-community/datetimepicker` once Compose `DatePicker` covers date fields.

**Non-Goals:**
- No migration of static layout: RN `View`/`Text`/`StyleSheet` remain the layout and text-styling mechanism; `Column`/`Row`/`Surface` are not adopted wholesale (churn without measurable interaction-performance benefit).
- No change to routing structure, session/data layers, hooks, services, or the formatting utilities.
- No replacement of `sonner-native` toasts with Compose `Snackbar`: toast copy and failure behavior are already specified and tested; swapping the toast runtime would re-litigate settled behavior for zero native-thread benefit (toasts are transient overlays).
- No iOS/web parity work: the target is the Android build (`expo export --platform android`).

## Decisions

### D1: Scope — interactive + lists migrate; static layout stays RN
Buttons, text inputs, dialogs/sheets, dropdown selects, date fields, segmented tabs, the bottom tab bar, spinners, and the activity feed move to `@expo/ui`. Static containers and text keep `View`/`Text`/`StyleSheet`.
*Alternative considered*: full-tree migration to Compose `Column`/`Row`/`Surface` — rejected: the shared theme is StyleSheet-token based, screens are already stable, and layout components are not interaction hot paths.

### D2: A shared boxy primitive module wraps `@expo/ui` components
Create `src/components/ui/` that re-exports the migrated primitives (button, text-field, alert-dialog, bottom-sheet, dropdown, date-field, segmented-row, lazy-list, loading-indicator) with boxy defaults applied once: `shape` set to the zero-radius rectangle shape and `colors` mapped from the shared theme tokens via `useThemeColors()`. Screens never import `@expo/ui` directly, so the zero-radius rule and single theme source stay enforceable in one place.
*Alternative considered*: `useMaterialColors({ seedColor })` Material palette generation — rejected: the app owns an explicit token palette (light/dark) and single-theme-source rule; deriving Material tones from a seed would fork the palette.
*Alternative considered*: app-wide Compose theme override — no stable app-level theme provider is exposed by `@expo/ui@58.0.28`; per-component props via the wrapper is the supported surface.

### D3: `Host` placement — one per migrated region, not per screen
Compose content must sit inside a `Host`; RN children inside a `Host` are auto-bridged. Each migrated region (a dialog, the select's menu, the tab bar, the feed) wraps its `@expo/ui` tree in a `Host` with flexbox applied only on the `Host` itself. Mixed layouts (RN card shell + native control inside) keep working at the interop boundary.
*Alternative considered*: a single screen-level `Host` per screen — rejected: it forces whole screens into Compose layout rules and rewrites every screen at once, defeating incremental migration and test updates.

### D4: Bottom navigation — expo-router `Stack` + Compose `NavigationBar`
Replace `<Tabs>` with a `Stack` layout plus a persistent bottom bar built on Compose `NavigationBar` that drives `expo-router` navigation (`router.navigate`/`usePathname` for the active item). expo-router keeps owning screen mounting, deep linking, and the authenticated/unauthenticated split; only the tab bar rendering moves to native.
*Alternative considered*: keep expo-router `Tabs` (its JS tab bar) — rejected: the tab bar is on-screen on every authenticated screen; it is exactly the always-interactive surface the migration targets.

### D5: Date fields — Compose `DatePicker` inside a `ModalBottomSheet`
`@expo/ui` exposes `DatePicker` (embedded control) rather than a pre-built dialog; the shared date field opens a `ModalBottomSheet` hosting the `DatePicker`, replaces the `PressableDate` + `@react-native-community/datetimepicker` pair in filters and form dialogs, and keeps writing the same local-calendar `YYYY-MM-DD` strings (`calendarDateString`/`calendarDateValue` untouched).
*Dependency note*: remove `@react-native-community/datetimepicker` with `pnpm remove` only after every usage is replaced.

### D6: Select fields — `DropdownMenu` over the modal sheet
`SelectField` keeps its external contract (label, options, value, placeholder, `onValueChange`, `accessibilityLabel={label}`) but opens a native `DropdownMenu` anchored to the field instead of a full-screen RN `Modal` with a `ScrollView` of `Pressable` options. The 101-year list scrolls natively.
*Alternative considered*: `ExposedDropdownMenuBox` — rejected for now: stricter internal state coupling; `DropdownMenu` matches the existing pressable-opens-menu shape. If long-list behavior disappoints on device, switching is contained inside the shared component.

### D7: Dialogs — conditional-mount Compose surfaces
`ConfirmDialog` and `RestoreNameDialog` move to `AlertDialog` (or `BasicAlertDialog` for the name form); form dialogs host their content in `ModalBottomSheet` or `AlertDialog` per the web's dialog idiom. The `{open ? <Dialog/> : null}` conditional-mount pattern is preserved (it also sidesteps the RN-Modal-mock closed-state pitfall in tests). All copy stays verbatim-web.

### D8: Activity feed — `LazyColumn` with the existing pagination contract
Replace the `FlatList` with `LazyColumn`, driven by the same `useActivityFeed` infinite query (`loaded < total` page math unchanged). `LazyColumn`'s end-of-list signal triggers "Load more" the same way `onEndReached` did; the load-more control remains visible so the tested behavior ("Load more" appears while more pages exist) is preserved exactly.
*Alternative considered*: `LazyItems` — its declarative loading hook is convenient, but the pagination contract already lives in the query; re-expressing it inside a second abstraction risks duplicating page math.

### D9: Testing — spike first, then migrate suites component-by-component
Compose-backed components render through the native engine, and their accessibility surface under `@testing-library/react-native` is not yet proven in this repo. Task 1 is a spike: render `Host` + the wrapped button/field/menu/list under vitest-native and record what queries work (`getByRole`, `getByLabelText`, `testID` passthrough). Findings set the query strategy for the ~189 tests. If a component's Compose counterpart cannot preserve a tested behavior (query name, disabled state, conditional mount), that behavior is re-verified at the nearest wrapper boundary; if it truly cannot be tested, the component keeps its RN implementation and the divergence is documented in the change summary — no checkbox is marked on an unverified claim.
*Fallback stance*: the wrapper module (D2) contains every swap point; a reverted component only reverts inside `src/components/ui/` and its direct consumers.

**Spike outcome (recorded during apply, see `apps/android/src/components/ui/SPIKE-NOTES.md`)**: the real components mount under the engine as `ViewManagerAdapter_ExpoUI_*` hosts, but Compose content is serialized into native-view props — RNTL content queries and interactions cannot reach it, and the components expose no accessibility props. The strategy is therefore: (a) structural smoke tests keep the real components mounted (regression guard on upgrades); (b) interaction tests target wrappers and screens through **typed test doubles** of `@expo/ui/jetpack-compose` mirroring each primitive's contract — the wrapper-boundary verification D9 anticipated; (c) real rendering, gestures, and TalkBack behavior are device-verified in Expo Go (task 4.3), and the missing-native-module stub lives in `tests/setup.ts`. No component needed an RN fallback under this strategy.

## Risks / Trade-offs

- [Compose components may not expose the same accessibility roles/labels to RNTL] → D9's spike runs before any screen migration; the wrapper keeps components swappable; tests are updated per-component, not en masse.
- [Material defaults (ripples, heights, typography) drift from the boxy look] → the wrapper applies `shape` and `colors` in one place; a device pass over every migrated surface is an explicit task; boxy review (grep for non-zero radii) repeats at the end.
- [`Host` interop boundaries (no flexbox inside native context; re-entering needs a new `Host`) can produce layout regressions] → each migrated region wraps only its native subtree (D3); RN shells keep their StyleSheet layout.
- [`LazyColumn` pagination edge cases (footer during loading, end-of-list detection)] → the page math (`loaded < total`) stays in the query layer; tests for feed pagination are re-run against the native list.
- [Performance gain is unmeasurable without a device] → the migration targets architectural placement (native thread) rather than claiming numbers; Expo Go device-verification clauses are left unmarked if no emulator is available, consistent with prior changes.
- [`@expo/ui` is young (~58.0.28) and pinned to Expo 58] → the wrapper isolates the library surface; version bumps stay inside `src/components/ui/`.

## Migration Plan

1. Spike: prove `Host` + wrapped primitives render and respond under vitest-native (D9).
2. Build the boxy primitive wrapper module over the shared theme (D2), with its own tests.
3. Migrate shared primitives and their consumers bottom-up: select field → dialogs → form dialogs → entity cards/actions → sign-in → app shell/tab bar → activity feed → dashboard.
4. `pnpm remove @react-native-community/datetimepicker` after D5 coverage is complete.
5. Full pipeline (`pnpm turbo run typecheck lint test build`), boxy re-review, and a summary listing any documented divergences.
Rollback: each migration step is a self-contained commit; the wrapper module means a reverted primitive does not ripple into screens' data logic.

## Open Questions

None — the D9 spike is scheduled as the first implementation task rather than a pre-implementation unknown; it changes test strategy details, not the spec, approach, or task breakdown.
