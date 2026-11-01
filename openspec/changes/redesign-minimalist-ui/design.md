# Design

## Context

The web application is built with TanStack Start, React 19, Tailwind CSS v4, and `@finance-application/ui` (shadcn components backed by `@base-ui/react` and `Geist Variable` font). The current web pages (`/`, `/dashboard`, `/accounts`, `/login`, `/register`) were built as functional proofs of concept. They suffer from sparse layouts, inconsistent navigation between authenticated and guest states, lack of visual hierarchy, and basic unstyled cards.

See `proposal.md` for the motivation and `specs/web-ui/spec.md` for observable requirements.

## Goals / Non-Goals

**Goals:**
- Establish a coherent, high-craft minimalist visual identity across all existing routes (`/`, `/login`, `/register`, `/dashboard`, `/accounts`).
- Deliver a unified application header that gracefully transitions between unauthenticated and authenticated states with active route indicators.
- Display all currency figures and balance amounts with tabular numerals (`tabular-nums`) and clean typography.
- Transform the dashboard into an informative financial overview using live account balances from TanStack Query.
- Refactor the accounts view into a responsive, balanced grid of minimalist cards with refined lifecycle dialogs.
- Polish auth forms into centered, distraction-free cards with clear validation feedback.

**Non-Goals:**
- Modifying backend APIs, database schemas, or Drizzle migrations.
- Introducing heavy external animation or styling libraries.
- Changing financial calculations or minor-unit paise representations.
- Inventing new business logic or transactions features outside current accounts/auth domain.

## Decisions

### 1. Minimalist Theme Tokens and Financial Typography in `packages/ui`
- **Choice**: Refine CSS custom properties in `packages/ui/src/styles.css` using clean slate/zinc OKLCH neutrals. Enhance card backgrounds (`bg-card`), crisp border contrasts (`border-border`), and add a dedicated utility for financial amounts (`font-mono tabular-nums tracking-tight`).
- **Rationale**: Keeps styling pure Tailwind CSS v4 without extra bundle overhead while ensuring all numbers align consistently across financial cards.
- **Alternatives Considered**: Retaining raw default tokens without monetary typography standards resulted in misaligned numbers and jarring contrast.

### 2. Universal Application Shell with Active Navigation
- **Choice**: Enhance `AppHeader` to be used universally across the app. When logged out, it provides brand identity and a Sign in button. When logged in, it shows navigation links (`Dashboard`, `Accounts`) with active route styling, user identity, and Sign out.
- **Rationale**: Removes jarring transitions where navigation appears and disappears abruptly between public and private pages.
- **Alternatives Considered**: Hiding navigation completely on public pages, which leaves visitors feeling stranded with no way back.

### 3. Metric-Driven Minimalist Dashboard
- **Choice**: The `/dashboard` page consumes `useAccounts("active")` and `useMe()` to display summary metrics: Total Net Balance, Active Accounts count, quick action to create an account, and empty-state guidance if no accounts exist yet.
- **Rationale**: Gives users immediate financial insight rather than a blank placeholder while using only existing data hooks.
- **Alternatives Considered**: Mocking charts or transaction feeds that don't yet exist in the backend.

### 4. Responsive Account Grid and Redesigned Account Cards
- **Choice**: Switch `/accounts` from a single-column layout to a responsive grid (`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`) with max width `max-w-6xl`. Account cards feature distinct type pills, prominent balance figures with tabular numerals, and clean action menus/buttons.
- **Rationale**: Better utilizes desktop screen real estate and makes scanning multiple accounts effortless.
- **Alternatives Considered**: Traditional dense table view; cards provide clearer mobile and desktop visual rhythm for account lifecycles.

### 5. Focused Minimalist Auth Pages
- **Choice**: Center login and registration forms inside minimalist cards with subtle borders, concise helper copy, and inline loading indicators.
- **Rationale**: Reduces friction and cognitive load during authentication.

## Risks / Trade-offs

- **[Risk] Session Loading Flicker**: Header could flash guest links before session resolves.
  - **Mitigation**: Handle `me.isPending` with a subtle skeleton or quiet placeholder in the header right-side slot to prevent layout shifts.
- **[Risk] Mobile Viewport Overflow**: Grid layouts and tabular numbers may wrap awkwardly on narrow screens.
  - **Mitigation**: Use fluid mobile-first Tailwind breakpoints (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`, `truncate`, responsive padding).
