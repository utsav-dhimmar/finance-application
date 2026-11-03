# Tasks

## 1. Design Tokens and Financial Typography

- [x] 1.1 Refine design tokens in `packages/ui/src/styles.css` with clean slate/zinc neutrals, crisp border contrasts, and tabular numeral typography (`tabular-nums`), verifying with `pnpm --filter @finance-application/ui typecheck`.
- [x] 1.2 Polish shared UI primitives (`packages/ui/src/components/card.tsx`, `button.tsx`, `badge.tsx`, `tabs.tsx`) with minimalist border radii, subtle focus rings, and tactile hover states, verifying with component type checks.

## 2. Universal Application Shell and Header

- [x] 2.1 Enhance `AppHeader` in `apps/web/src/components/app-header.tsx` to support both unauthenticated state (brand + Home link + Sign in button) and authenticated state (brand + active navigation links + email + Sign out), verifying link rendering across auth states.
- [x] 2.2 Update root shell in `apps/web/src/routes/__root.tsx` to provide consistent background canvas, smooth layout transitions, and clean toaster styling, verifying with `pnpm --filter @finance-application/web typecheck`.

## 3. Minimalist Landing Page

- [x] 3.1 Redesign `apps/web/src/routes/index.tsx` into a refined minimalist landing experience with high-craft typography, concise value proposition, and dynamic action buttons (Dashboard vs. Sign in), verifying server-rendered heading and navigation links.

## 4. Minimalist Financial Dashboard

- [x] 4.1 Redesign `apps/web/src/routes/dashboard.tsx` with minimalist summary cards displaying total net balance with tabular numerals, active account count, and quick links to account management, verifying with `useAccounts` and `useMe` hooks.
- [x] 4.2 Provide clean minimalist empty-state guidance on the dashboard when a user has zero accounts, verifying the prompt navigates to account creation.

## 5. Responsive Accounts Grid and Dialogs

- [x] 5.1 Redesign `apps/web/src/components/accounts/account-card.tsx` with minimalist card styling, clean account type badges, tabular-numeral balances, and streamlined action triggers, verifying with unit tests and type checks.
- [x] 5.2 Refactor `apps/web/src/routes/accounts.tsx` into a responsive multi-column grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`) with refined tabs and empty states, verifying with `pnpm --filter @finance-application/web test`.
- [x] 5.3 Polish account lifecycle dialogs (`create-account-dialog.tsx`, `edit-account-dialog.tsx`, `confirm-lifecycle-dialog.tsx`, `restore-name-dialog.tsx`) with clean form spacing and subtle input focus states, verifying form interaction.

## 6. Auth Views and Full Verification

- [x] 6.1 Redesign `apps/web/src/routes/login.tsx` and `register.tsx` into centered minimalist cards with clean input fields and clear validation error states, verifying form submission and navigation.
- [x] 6.2 Execute full workspace checks (`pnpm turbo typecheck lint test`) to verify all apps and packages build and pass tests cleanly.
