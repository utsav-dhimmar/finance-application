# Proposal

## Why

The current web interface lacks visual polish, navigational cohesion, and aesthetic intentionality. The landing page consists of an unlinked placeholder greeting, the app header appears only when signed in, the dashboard is a bare placeholder paragraph, and account management views feel like raw scaffolding rather than a thoughtful personal finance tool. 

A refined, minimalist redesign provides a clear visual hierarchy, elegant typography (with tabular numbers for financial figures), cohesive navigation across all authenticated and public views, and calming, high-craft aesthetics inspired by modern minimalist design.

## What Changes

- **Design System & Theme Refinement**: Update `packages/ui` styling tokens, typography scales, card layouts, dialogs, and button states to embody a clean, minimalist design language (crisp borders, subtle neutrals, intentional whitespace, and tabular numbers for financial amounts).
- **Universal Minimalist Shell & Header**: Provide a consistent top navigation shell across public and authenticated states, including persistent brand identity, active route indicators, and clear auth controls.
- **Minimalist Landing Page (`/`)**: Replace the raw greeting placeholder with an elegant minimalist landing experience featuring the application's value proposition, quick access links to Dashboard / Login / Accounts, and an optional subtle system status indicator.
- **Enhanced Dashboard Overview (`/dashboard`)**: Transform the bare dashboard into a clean, minimalist financial hub displaying aggregate balance metrics, active account count, quick navigation to account management, and empty-state guidance.
- **Polished Account Management UI (`/accounts`)**: Upgrade the account cards, category/type badges, lifecycle dialogs (create, edit, archive, restore), and status tabs (Active, Archived, Trash) into a sleek, responsive grid with clear tabular balance formatting and tactile interaction states.
- **Streamlined Auth Experience (`/login`, `/register`)**: Refine authentication pages with minimalist centered card framing, refined typography, and clear validation feedback.

## Capabilities

### New Capabilities
- `web-ui`: Covers the visual design language, responsive application shell, navigation structures, financial data presentation (including tabular number formatting), and layout experiences across the web application (Landing, Auth, Dashboard, and Accounts).

### Modified Capabilities
<!-- None: existing backend domain and API contracts remain unchanged. -->

## Impact

- **Affected Code**: `apps/web/src/routes/*`, `apps/web/src/components/*`, `packages/ui/src/styles.css`, and shared UI primitives in `packages/ui/src/components/*`.
- **APIs & Dependencies**: No breaking API or backend contract changes. Uses existing TanStack Router, TanStack Query, and Lucide icons.
- **Security & Data Integrity**: Preserves all existing authentication guards, input validation, and exact minor-unit (paise) financial calculations.
