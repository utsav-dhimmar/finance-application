# Proposal

## Why

The data layer change gives the mobile app web-parity access to accounts and categories data, but the app still renders only a stub authenticated home screen — the user cannot actually see or manage their accounts and categories on the device yet.

## What Changes

- Replace the stub authenticated home screen with a persistent authenticated shell: an app header showing the signed-in user's identity and a sign-out control (parity with the web header), above a bottom tab bar.
- Introduce the bottom tab bar with the four core destinations — Dashboard, Transactions, Accounts, Categories — so the route structure is stable across the remaining changes. Until their own changes land, the Dashboard and Transactions tabs render a minimal "not available yet" notice; this placeholder is temporary and removed by those changes.
- Add the **Accounts screen** as web parity: account cards (name, type, current balance), status tabs (Active / Archived / Trash), create/edit via a Zod-validated form dialog, and archive / soft-delete / restore lifecycle actions behind confirmation dialogs, including restore-with-new-name when the name conflicts.
- Add the **Categories screen** with the same pattern and category-specific fields (name, type, color, icon).
- Amounts render in the active currency from the API's preferences (symbol + minor-unit exponent resolved server-side), mirroring the web's formatting rule.
- Scope note: the per-entity lifecycle tabs ship here because they are part of the web's accounts and categories views; the aggregate `/archive` and `/trash` routes (all record types) remain deferred to a later change.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `android-ui`: the stub authenticated home screen requirement is removed and replaced by the authenticated tab shell; accounts and categories screen requirements are added.
- `android-platform`: the sign-out requirement's control location moves from the authenticated home screen to the authenticated shell's app header.

## Impact

- `apps/android`: new dependencies for bottom-tab navigation are already covered by `expo-router`; new `src/app/(app)/` tab screens and layout, shared screen components under `src/components/{accounts,categories}/`, a currency-format helper under `src/lib/`; component and hook tests under `tests/`.
- `packages/*`, `server/*`, `apps/web` unaffected; the existing accounts/categories/preferences API contracts are consumed unchanged.
- Depends on `add-android-data-layer` (services, hooks, form pattern, test setup).
