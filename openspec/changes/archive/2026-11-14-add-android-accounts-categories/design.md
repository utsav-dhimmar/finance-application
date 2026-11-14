# Design

## Context

`add-android-data-layer` (implement first) lands TanStack Query, services, hooks, the react-hook-form + zodResolver pattern, sonner-native toasts, and the `tests/` layout. The app currently renders a stub `(app)/index.tsx` home with email + sign-out. On the web, the accounts and categories views are card lists with active/archived/deleted status tabs, unified create/edit form dialogs, and confirm-style lifecycle dialogs (see `apps/web/src/routes/accounts.tsx`, `apps/web/src/routes/categories.tsx`, `apps/web/src/components/accounts/*`).

## Goals / Non-Goals

**Goals:**

- Establish the authenticated shell (header + bottom tabs) once, so the transactions and dashboard changes only add screens.
- Port the accounts and categories views' behavior 1:1 in mobile idiom.
- Keep boxy StyleSheet styling via the shared theme tokens.

**Non-Goals:**

- Transactions, transfers/activity, and dashboard screens (later changes).
- The aggregate `/archive` and `/trash` routes.
- Any shared-package or server change.
- NativeWind/Tailwind — the StyleSheet-only requirement stands.

## Decisions

- **Expo Router `<Tabs>` with all four tab entries defined now.** `(app)/_layout.tsx` declares Dashboard (initial route), Transactions, Accounts, Categories in that order, so route names and the shell's structure never churn again. Dashboard and Transactions render a minimal placeholder screen that this change removes the need for: each later change replaces its file's content. Alternatives: adding tabs one change at a time (re-churns the initial route between changes) — rejected; hiding not-yet-implemented tabs (silent behavior changes between releases) — rejected in favor of an honest "not available yet" notice.
- **App header as a shared component.** `src/components/app-header.tsx` renders the user's email (from the session) and the sign-out button (reusing the auth service + existing sign-out mutation flow). It sits above the tab navigator content on every authenticated screen — the RN equivalent of the web's persistent header, satisfying the relocated `android-platform` sign-out requirement.
- **Status tabs mirror the web's per-page tabs.** The Accounts and Categories screens use a shared status-tabs pattern (`active | archived | deleted`) driving the service's status query parameter. This is intentionally part of the entity views here, matching web parity; the aggregate archive/trash routes stay out of scope.
- **Lifecycle actions reuse the data-layer mutations.** Archive = update-status flow, delete = soft delete, restore = restore with optional new name, exactly the web's mutation sets. Confirmation dialogs are simple alert-style components in the boxy theme (no BottomSheet library — keep dependencies minimal; RN `Alert.alert` with styled buttons is insufficient for copy-heavy confirms, so a small `ConfirmDialog` component over RN `Modal` is built once and shared by both screens and later screen changes).
- **Restore-name conflict UX.** When restore fails with the API's duplicate-name error, the app opens a small rename prompt (web's `RestoreNameDialog` equivalent) prefilled with the original name, then retries restore with the new name. Single shared component, used by both screens.
- **Currency formatting helper.** `src/lib/format.ts` implements minor-units → display string with the API-provided symbol and `minorUnitExponent`, mirroring the web's formatter semantics (no float arithmetic on money; integer math only) and using tabular numerals (`fontVariant: ['tabular-nums']`) per the web's financial-amount typography. Preferences come from the preferences query with the response schema as the source of truth.
- **Form dialogs.** Create and edit share one form dialog component per entity (unified mode switching, mirroring the web's unified dialog), presented as a centered `Modal` in the boxy theme with `Controller`-bound RN inputs and zodResolver against `accountFormSchema` / `categoryFormSchema`.

## Risks / Trade-offs

- [Tab shell churn across three changes] → The shell is defined once here with all four routes; later changes only fill screens.
- [Placeholder tabs feel unfinished if changes land independently] → The placeholder is explicit ("not available yet"); in practice the four changes are implemented in sequence on one branch.
- [Modal focus/keyboard handling on Android] → Form dialogs use `KeyboardAvoidingView` inside the Modal (the sign-in screen already proves this pattern) and are verified on the Android emulator/Expo Go during implementation; note the pipeline itself stays Node-only.
- [Currency formatting drift from web] → The formatter's unit tests assert the same outputs as the web helper for the same inputs (port the web formatter's test cases).

## Migration Plan

1. Build the shell (header + tabs + placeholders) and verify navigation.
2. Port accounts screen + components with tests; then categories.
3. Full pipeline run (`pnpm turbo run typecheck lint test build`).

Rollback: revert `apps/android`; no shared or server state is touched.

## Open Questions

None.
