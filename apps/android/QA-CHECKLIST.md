# QA Checklist — device verification

The automated pipeline (typecheck, tests, lint, JS export) runs Node-only and
cannot exercise native modules. This checklist covers the surfaces this
change moved to platform-native rendering; run it on a device or emulator
after a development build. Each item names the spec scenario or design
decision it verifies.

Building the dev client (the zeego menu module `@react-native-menu/menu` is
not bundled in Expo Go, so Expo Go cannot run the app):

```bash
# Cloud build via EAS (no local toolchain; needs an Expo account):
npx eas-cli@latest login
npx eas-cli@latest build --profile development --platform android
# …then install the produced APK on the device/emulator and:
npx expo start --dev-client

# Or a local build (needs Android Studio + SDK + JDK):
npx expo run:android
```

## Native bottom tab bar (Expo Router NativeTabs)

- [ ] The authenticated shell shows the app header (brand, email, sign out) above the native Material tab bar — design D1.
- [ ] The bar renders with platform styling (it is exempt from the boxy zero-radius theme) — spec "Platform-rendered native surfaces follow system styling".
- [ ] All four tabs appear with their titles (Dashboard, Transactions, Accounts, Categories) and Material Symbols icons (dashboard, receipt_long, account_balance, category), and switch screens without reload — spec "Expo application workspace" tab behavior.
- [ ] The active tab takes the theme's primary color tint (`tintColor`).

## Native select menus (zeego)

Open each of these selects and confirm the same four behaviors — the menu opens as platform UI with the current option marked, choosing an option updates the trigger and closes the menu, dismissing without choosing keeps the value, and the trigger itself stays boxy (spec "Native select menus", four scenarios):

- [ ] Dashboard: Month select (month mode) and Year select (year mode).
- [ ] Dashboard year select: options span a rolling window of current year ± 10 (21 options), with the current year preselected — spec "Dashboard year selection window", both scenarios.
- [ ] Transactions filters: Type filter, Account filter, Category filter.
- [ ] Record transaction dialog: Account and Category selects.
- [ ] New transfer dialog: Source and Destination account selects.
- [ ] Add/Edit account dialog: Type select.
- [ ] Add/Edit category dialog: Type select.

## FlashList activity feed

- [ ] The Transactions tab renders rows while scrolling smoothly through more than one page of data (recycling has no visible artifacts) — design D4.
- [ ] "Load more" appends the next page beneath loaded rows and the footer disappears on the last page — covered in automation; verify on-device feel.
- [ ] Pull-to-refresh refetches the feed — the physical gesture (device-verified here; its handler is exercised in automation through retry).

## Regression sweep

- [ ] Sign-in, sign out, and session restore still work (native tabs changed the shell only).
- [ ] Dark/light scheme switch updates application-rendered surfaces live (spec "Device color scheme").
- [ ] Create/edit/archive/delete/restore flows still complete with toasts on all four screens.
