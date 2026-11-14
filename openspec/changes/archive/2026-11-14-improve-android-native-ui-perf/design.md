# Design

## Context

`apps/android` is an Expo SDK 58 / RN 0.88 app with React Compiler enabled, Expo Router, TanStack Query, and a Node-only CI pipeline (`typecheck`, `lint`, `test` via vitest-native, `build` via `expo export`). The audit (see proposal) found three JS-rendered primitives the platform provides natively — JS bottom tabs, a Modal-based select field, a legacy `FlatList` — plus per-render `StyleSheet.create` calls in 21 files. The repo's app-level AGENTS.md requires checking versioned Expo docs at implementation time (SDK APIs churn), which shapes how precisely this design pins library APIs.

The Node-only pipeline cannot execute native modules, so this change's verification splits: automated checks (typecheck, rewritten component tests, lint, JS export) here, and a written manual QA checklist for device verification by the user.

## Goals / Non-Goals

**Goals:**

- Native tab bar, native select menus, recycled feed list — one focused migration per primitive, each independently revertible.
- Zero changes to the data layer, services, session, or API contract; zero changes to the web app.
- Preserve the `SelectField` component API so consumers (dashboard, filters, five form dialogs) do not change.
- Component tests that survive where behavior is unchanged and get rewritten only where the surface goes native.

**Non-Goals:**

- Removing the eight zero-import dependencies (explicit audit decision: keep).
- Aligning React versions across web/native or exact-pinning android deps (documented decision).
- Keystroke-level re-render fixes (search input placement, sign-in `watch`, `form.watch("type")` in the type map) — deferred; React Compiler covers them.
- iOS-specific refinements (content-inset safe-area behavior) — the app targets Android; iOS parity is follow-up work.
- Introducing animations or Reanimated usage.

## Decisions

### D1: Native tabs via Expo Router's `NativeTabs` (revised at implementation)

The original ruling picked `react-native-bottom-tabs` behind `withLayoutContext(createNativeBottomTabNavigator().Navigator)`. Device testing showed that integration is structurally incompatible with SDK 58: expo-router 58 replaced React Navigation with its own `standard-navigation` runtime, so nothing provides `@react-navigation/core`'s `ThemeContext` and the react-navigation-built navigator crashes (`Couldn't find a theme`). A `ThemeProvider` wrap would only defer the failure — the navigator's state and linking architecture assume React Navigation routing that no longer exists. The implementation therefore switched to Expo Router's first-class native tabs: `import { NativeTabs } from "expo-router/native-tabs"` (a stable export path in SDK 58), with `NativeTabs.Trigger` declarations carrying the same four destinations, Material Symbols icons (`md` prop), and `tintColor` bound to the theme's primary color. The dependency pair `react-native-bottom-tabs` / `@bottom-tabs/react-navigation` and its config plugin were removed again. The user approved this switch at runtime-failure triage.

- *Alternatives*: keeping `react-native-bottom-tabs` behind a compat theme provider — rejected: structural incompatibility, not a missing context. Reverting to JS `Tabs` — rejected: abandons the native-navigator requirement.
- *Icons*: Material Symbols names (`dashboard`, `receipt_long`, `account_balance`, `category`); the bar's system styling stays exempt from the boxy theme, with only the active tint following the app palette.
- *Biome note*: `NativeTabs.Trigger.Label`'s raw-text children are the documented native-label usage; the `noReactNativeRawText` rule is suppressed per site with `biome-ignore` comments (the rule's `skip` option is not supported by the installed Biome 2.6 schema).

### D2: Native menus behind the existing `SelectField` API

`select-field.tsx` keeps its exact prop surface (`label`, `options`, `value`, `placeholder`, `onValueChange`). Internally the `Modal` + ScrollView option list is replaced by `zeego`'s dropdown menu: the Pressable trigger stays boxy StyleSheet-styled and shows label/selection/placeholder as today; pressing it opens the platform menu, which marks the current option (checkbox-item semantics) and closes on selection. Dismissal without selection changes nothing.

Why this shape: all ten-plus call sites (dashboard, filter row, transaction/transfer/account/category dialogs) keep working without edits, the diff concentrates in one file, and component tests mock the menu layer at one boundary instead of ten.

- *Alternatives*: `@expo/ui` menu primitives — rejected: package is unused today, thinner docs, same native result. Inline custom native-menu binding — rejected: zeego is the skill's recommended wrapper and is JS-only to install.
- *Peer/native wiring*: zeego's Android menu support requires the native menu module; the exact additional package set is resolved from zeego's docs and verified with `expo-doctor` during implementation.
- *Long option lists*: the only pathological case was the year select (101 options), eliminated by D3. Material menus scroll for the remaining realistic lists (categories/accounts), which is acceptable native UX.

### D3: Rolling year window in `period.ts`

`yearOptions()` returns `[currentYear − 10 … currentYear + 10]` (21 options, current year included and defaulted). `currentMonthValue`/month options and the dashboard's `periodLabel` are untouched. This is a picker-side change only: the reporting endpoint keeps accepting 2000–2100, so an older client or web user is unaffected, and no server test or schema changes.

- *Alternatives*: keeping 2000–2100 and exempting only the year select from native menus — rejected by audit ruling (uniform native menus preferred); narrowing to ±3 — rejected: too tight for historical reporting entry.

### D4: `FlashList` for the activity feed

`transactions.tsx` swaps `FlatList` → `FlashList` with the same `data`, `keyExtractor`, `renderItem`, `ListHeaderComponent`/`ListEmptyComponent`/`ListFooterComponent`, and `RefreshControl`. FlashList v2 (the SDK-installed major) dropped the `estimatedItemSize` prop — it measures item sizes automatically, so the v1-era estimation task resolves to using the component's defaults. The page size (20) and infinite-query wiring are unchanged — only the rendering layer moves.

- *Alternatives*: LegendList — rejected: FlashList is the skill's reference choice with the larger Android track record. Keeping FlatList — rejected by audit ruling.
- Accounts/categories screens keep `ScrollView` + `.map()`: they are bounded card collections with pull-to-refresh semantics, and virtualizing them adds recycling complexity without a measured payoff. Revisit if entity counts grow.

### D5: `useMemo` style memoization pattern

Each of the 21 files changes `const styles = createStyles(c)` to `const styles = useMemo(() => createStyles(c), [c])`. `useThemeColors()` returns one of two stable module-level palette objects, so the memo key is stable across renders and styles are built once per palette per component instance. No style definitions change; no module-scope cache is introduced (chose per-file `useMemo` over a shared memoize helper: zero new abstractions, mechanical diff, React Compiler-friendly).

### D6: Verification split and QA checklist deliverable

Automated: `pnpm typecheck`, `pnpm test` (rewritten tests), `pnpm lint`, `pnpm build` (`expo export`) — all in the existing Turborepo pipeline, plus `expo-doctor` for native-dep wiring. Manual: a committed `apps/android/QA-CHECKLIST.md` enumerating device checks (tab bar renders and switches tabs, menus open/select/dismiss on every select surface, feed scrolls and loads more pages, pull-to-refresh, dark/light scheme). The checklist is the acceptance record for the native parts that CI cannot see.

### D7: Dependency installation mechanics

Native-code deps (`@shopify/flash-list`, `react-native-bottom-tabs`) install via `npx expo install` so SDK-compatible versions are selected; JS-only `zeego` installs via `pnpm add`. Both routes write through the workspace package manager, satisfying the repo's pnpm rule while following the app AGENTS.md's expo-install mandate for native modules. No dependency is removed (audit decision).

## Risks / Trade-offs

- [Three new native modules force a dev-build rebuild before any device run] → CI tasks remain green without native tooling; QA checklist is the explicit handoff; `expo-doctor` catches wiring mistakes at implementation time.
- [Native tab bar icon supply may need asset work discovered late] → design defers exact icon mechanics to the documented integration; fallback ships library-default icons; the tab titles and navigation behavior (the specified behavior) do not depend on icons.
- [zeego menus render as system UI — visible departure from the boxy theme inside forms/filters] → accepted and codified: the spec delta exempts platform-rendered surfaces explicitly; triggers stay boxy so screens keep their structure.
- [FlashList size misestimation causes scroll jank or blank rows] → `estimatedItemSize` measured from the row layout during implementation; row content is text-only (no images), keeping estimates stable.
- [Component tests around menus/tab bar need mocking of native modules] → the `SelectField` API is preserved so mocks concentrate in one file's tests; vitest-native's native-module mock layer covers tab navigator rendering; test rewrites map each change to an existing android-ui scenario.
- [`withLayoutContext` integration drifts across expo-router versions] → implementation follows the library's current Expo Router docs per repo AGENTS.md; the integration is isolated in one layout file, bounding any fix.

## Migration Plan

Phased, each phase a separate commit and independently revertible:

1. Dependencies + config (install three libs, `expo-doctor`).
2. Year window (`period.ts` + its test) — no native involvement, shippable alone.
3. Style memoization sweep (21 files) — zero behavior change, shippable alone.
4. FlashList feed swap.
5. Native select menus (`select-field.tsx` internals + test rewrites).
6. Native tabs (`(app)/_layout.tsx` + shell tests).
7. QA checklist file + full automated verification pass.

Rollback: revert the offending phase's commit; phases 2–3 carry no native deps and revert cleanly without dev-build consequences.

## Open Questions

None material. Icon asset choice (D1) and zeego's exact peer module set (D2) are deliberately resolved at implementation time against versioned docs, per the repo's own AGENTS.md rule; neither changes the specs, the approach, or the task breakdown.
