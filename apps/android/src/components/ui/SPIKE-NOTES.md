# @expo/ui migration spike findings (tasks.md 1.1)

Probed with `tests/components/ui/spike.test.tsx` (5/5 passing) against the real
`@expo/ui@58.0.28` Jetpack Compose components under the vitest-native engine.

## Test engine integration

1. **`ExpoUI` native-module stub required** — `tests/setup.ts` registers a
   stub answering `getMaterialColors` (full Material 3 role palette, scheme
   aware), `isDynamicColorAvailable`, and the Switch/ToggleButton size
   constants. Two layers are patched because expo-modules-core's
   `requireOptionalNativeModule` consults `globalThis.expo.modules` FIRST and
   never reaches the `mockNativeModule()` TurboModuleRegistry layer while a
   stub exists: `mockNativeModule("ExpoUI", …)` AND a direct patch onto
   `globalThis.expo.modules.ExpoUI`. The direct patch is needed because the
   installed SDK 58 module table's `ExpoUI` entry is stale (it lists only
   `completeRefresh`/`withAnimation`).
2. Real components mount as `ViewManagerAdapter_ExpoUI_*` host views
   (`HostView`, `Button`, `TextView`, `TextFieldView`, `ModalBottomSheetView`,
   `LazyColumnView`, `DropdownMenuView`, …) and React children nest correctly
   through the adapters.

## What RNTL can and cannot reach

- **Cannot**: content queries and interactions. `@expo/ui` serializes content
  into native-view props (TextView carries `text`/`spans`, TextFieldView
  carries `placeholder`), so `getByText`, `getByPlaceholderText`, `getByRole`,
  and `fireEvent.press` on text never reach Compose content. Raw string
  children throw the RN "Text strings must be rendered within a <Text>"
  invariant even on device — always wrap label strings in `@expo/ui`'s `Text`.
- **Can**: structural assertions — traverse the instance tree manually
  (RNTL 14 instances expose `props`/`children` but no `findAll`); props arrive
  verbatim (assert array props by reference identity, not literals).
  RNTL 14 has no `UNSAFE_getByProps`.

## Test strategy adopted (design.md D9 amendment)

- **Smoke tests over real components** stay in `tests/components/ui/spike.test.tsx`
  so a broken `@expo/ui` upgrade surfaces there first.
- **Interaction tests use typed test doubles** of `@expo/ui/jetpack-compose`
  (see `tests/helpers/ui.tsx`) that mirror each primitive's contract
  (`onClick`, `enabled`, `onValueChange`, `expanded`, `onDismissRequest`,
  `selected`, observable `value`). Wrappers and screens are tested against
  doubles — the wrapper boundary carries the contract.
- **Real rendering, gestures, TalkBack behavior** are device-verified in Expo
  Go (tasks.md 4.3). Accessibility labels passed to wrappers exist only in the
  doubles; the real Compose components have no `accessibilityLabel` prop —
  TalkBack reads Compose content semantics natively.

## Component API notes (verified against the installed package)

- `Button`/variants: `onClick`, `enabled`, `colors`, `shape` (JSX element),
  `modifiers`. No accessibility props.
- `Shape.Rectangle` gives the zero-radius boxy shape (`cornerRounding`
  defaults 0.0); `DropdownMenu` also takes a direct `cornerRadius` number.
- `TextField`/`OutlinedTextField`: `value` is an `ObservableState<string>`
  (`useNativeState`), `onValueChange(value)` callback, `enabled`, `readOnly`,
  `isError`, `keyboardOptions.keyboardType` (`email`/`number`/`password`/…),
  `visualTransformation: 'password'`, decoration via slot children
  (`TextField.Label`, `TextField.Placeholder`, …), `shape`, `colors`.
- `DropdownMenu`: `children` wrapped in a pressable trigger, controlled
  `expanded`, `onDismissRequest`, `cornerRadius`; items via
  `<DropdownMenu.Items>` + `DropdownMenuItem` (`onClick`, `enabled`, text via
  `<DropdownMenuItem.Text>`).
- `AlertDialog`: renders when mounted (no `visible` prop — conditional mount
  is the idiom), `onDismissRequest`, slots `AlertDialog.Title`, `.Text`,
  `.ConfirmButton`, `.DismissButton`.
- `ModalBottomSheet`: presents on mount (`{open ? <ModalBottomSheet> : null}`
  conditional mounting is the open/close idiom), `children`,
  `onDismissRequest`, `skipPartiallyExpanded`, `containerColor`, imperative
  `ref`. (Passing an unknown `visible` prop spreads verbatim to the adapter
  but does nothing.)
- `NavigationBar` + `NavigationBarItem`: `selected`, `onClick`, `containerColor`.
- `SegmentedButton` inside `SingleChoiceSegmentedButtonRow`: `selected`,
  `onClick`, `enabled`.
- `DatePicker`: `initialDate` (`YYYY-MM-DD` string), `onDateSelected(Date|null)`,
  `variant`, `showVariantToggle`.
- `LazyColumn`: `items` array verbatim to the native view + renderer child.
- `LoadingIndicator`: progress-state based; indeterminate spinner available.
