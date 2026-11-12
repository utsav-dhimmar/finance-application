# Proposal

## Why

The Android app's interactive surfaces are built on React Native core/community primitives — `Pressable`-based buttons and cards, RN `Modal` dialogs, a hand-rolled `SelectField` modal sheet, `@react-native-community/datetimepicker`, `FlatList`/`ScrollView`, and expo-router's JS `Tabs`. Every tap, sheet, and list scroll runs through the JS thread, so the UI cannot reach native-level performance. `@expo/ui` (already installed at ~58.0.28, currently unused) exposes Jetpack Compose primitives directly to React, moving rendering, layout, and interaction of these controls onto the native thread.

## What Changes

- **BREAKING** Migrate all interactive components from RN core/community primitives to their `@expo/ui` Jetpack Compose equivalents, with no backward compatibility shims:
  - Buttons/pressables → `Button`/`IconButton`; dialogs (`ConfirmDialog`, `RestoreNameDialog`, form dialogs) → `AlertDialog`/`ModalBottomSheet`; `SelectField`'s hand-rolled modal sheet → `DropdownMenu` (or `ExposedDropdownMenuBox`); date fields → Compose `DatePicker`; text inputs → `TextField`/`BasicTextField`; status tabs → `SegmentedButton`; bottom tab bar → Compose `NavigationBar`; activity feed `FlatList` → `LazyColumn`; spinners → `LoadingIndicator`.
  - Remove the `@react-native-community/datetimepicker` dependency once Compose `DatePicker` covers the date fields.
  - Replace RN `Modal`-based shared dialogs with Compose-native surfaces; the conditional-mount pattern and web-verbatim copy are preserved.
- Re-theme `@expo/ui` so its Material theme matches the boxy design system: zero corner radius shapes, the shared color palette (light/dark) fed to the Compose theme, typography mapped from the theme tokens.
- Rework the affected component tests: accessibility roles/labels/query strategy is re-validated against what the Compose-backed components expose to `@testing-library/react-native` under the vitest-native engine; any component whose Compose counterpart cannot preserve the tested behavior keeps a documented RN implementation (recorded divergence, no fake claims).
- RN core `View`/`Text`/`StyleSheet` remain for static layout and text styling; `@expo/ui` replaces interactive and list components. `expo-router` routing, session/data layers, hooks, services, and formatting utilities are untouched.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `android-ui`: the styling convention changes — styling is no longer "StyleSheet-only": Compose-backed `@expo/ui` components are themed through a native Compose theme fed from the same shared theme source, while RN `StyleSheet` remains the styling mechanism for RN-rendered surfaces; the boxy zero-radius rule and single theme source still hold and are re-expressed for the native layer. Component-level requirements (sign-in fields, dialogs, selects, tabs, lists) are re-stated in terms of native-backed controls.

## Impact

- `apps/android` only: `src/app/(app)/_layout.tsx` (tab bar), all screen files, all `src/components/**`, shared primitives (`select-field.tsx`, `confirm-dialog.tsx`, `restore-name-dialog.tsx`, `entity-card-parts.tsx`), theme module (gains a Compose theme mapping), and the corresponding test suites (~37 files, 189 tests — interaction queries rewritten).
- Dependencies: `@expo/ui` moves from installed-but-unused to the primary UI layer; `@react-native-community/datetimepicker` is removed via `pnpm remove` when fully replaced.
- Specs: `android-ui` delta spec is the contract; `android-data`/`android-platform` requirements (session, API, storage) are unaffected.
- Risks recorded in design.md: Compose-in-test rendering behavior, Compose theme token coverage for the boxy style, and the `Host` bridging constraint (no flexbox/Yoga inside native context).
