# Tasks

## 1. Spike and shared primitives

- [x] 1.1 Spike: render `Host` + the wrapped Compose primitives (Button, TextField, DropdownMenu, ModalBottomSheet, LazyColumn) under vitest-native and record which RNTL queries (getByRole/getByLabelText/testID) work; deliver findings as a note in `src/components/ui/` and adjust test strategy before any screen migration. Verify: a passing probe test file exercising each primitive, then folded into the wrapper suite.
- [x] 1.2 Create the boxy primitive wrapper module `src/components/ui/` (button, text-field, alert-dialog, bottom-sheet, dropdown, date-field, segmented-row, lazy-list, loading-indicator) applying zero-radius shapes and shared-theme colors per design D2. Verify: wrapper unit tests assert zero-radius shape props and theme-derived colors; `pnpm vitest run tests/components/ui` passes.
- [x] 1.3 Extend `src/theme.ts` with the shape/typography mapping consumed by the wrapper (single theme source feeds the native layer). Verify: typecheck passes and a test asserts the mapping derives from existing tokens, not new literals.

## 2. Shared component migration

- [x] 2.1 Migrate `SelectField` to a native `DropdownMenu` (design D6) keeping the label/options/value/placeholder/onValueChange contract and `accessibilityLabel={label}`. Verify: updated `select-field` tests pass (open, pick, long year list) via `pnpm vitest run tests/components`.
- [x] 2.2 Migrate `ConfirmDialog` and `RestoreNameDialog` to Compose `AlertDialog` surfaces, preserving conditional mount, verbatim copy, pending state, and stable confirm/submit accessibility names (design D7). Verify: updated shared-dialog tests pass.
- [x] 2.3 Migrate form dialogs (account, category, transaction, transfer) to native surfaces, keeping react-hook-form + zodResolver wiring, field semantics, and submit behavior. Verify: updated form-dialog test suites (transaction, transfer, and the accounts/categories equivalents) pass.

## 3. Screens and shell migration

- [x] 3.1 Migrate entity cards/actions (`entity-card-parts.tsx`, account/category cards, activity rows) to native buttons. Verify: updated card and activity-row tests pass.
- [x] 3.2 Migrate the sign-in screen to native text fields and button, preserving disabled-while-empty/in-flight behavior and on-screen failure message. Verify: updated sign-in tests pass.
- [x] 3.3 Replace expo-router `<Tabs>` with a `Stack` layout plus a Compose `NavigationBar` bottom bar driving router navigation (design D4), and migrate the app header's pressables. Verify: updated app-header test passes; typecheck confirms no `Tabs` usage remains.
- [x] 3.4 Migrate the transactions screen: activity `FlatList` → `LazyColumn` with the same infinite-pagination contract and "Load more" behavior (design D8), status tabs → `SingleChoiceSegmentedButtonRow`, filters' date fields → native date field (design D5), search field → native text field. Verify: updated filter-state, lifecycle, and activity tests pass, including pagination math.
- [x] 3.5 Migrate the dashboard screen (mode switch → segmented row, selects → dropdowns, no interactive-list change needed) and verify summary/breakdown/balances rendering is unchanged. Verify: updated dashboard-screen, period, and category-breakdown tests pass.
- [x] 3.6 Remove the `@react-native-community/datetimepicker` dependency with `pnpm remove @react-native-community/datetimepicker` once every date field is migrated (design D5). Verify: the dependency is absent from `apps/android/package.json` and the full test suite passes.

## 4. Verification

- [x] 4.1 Run the full pipeline `pnpm turbo run typecheck lint test build` at the repo root and confirm all tasks succeed; report the android suite count. Verify: "Tasks: 20 successful, 20 total" (or the current repo task count) with android tests green.
- [x] 4.2 Boxy re-review: grep migrated surfaces and wrapper for non-zero corner radii and non-theme color literals; confirm zero-radius rule and single theme source hold across the native layer. Verify: grep output shows no violations, and any exception is justified in code.
- [ ] 4.3 Device pass in Expo Go over the migrated surfaces (buttons, dialogs, dropdowns, date pickers, tab bar, activity scroll) confirming native rendering and the dark/light scheme behavior. Verify: manual notes recorded; any clause that cannot be exercised is left unmarked and reported honestly.
