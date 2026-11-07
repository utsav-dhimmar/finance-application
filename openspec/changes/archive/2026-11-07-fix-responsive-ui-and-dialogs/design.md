# Design

## Context

The application is built with TanStack Start, Base UI primitives (`@base-ui/react`), and Tailwind CSS v4. UI components are centralized in `@finance-application/ui` (`packages/ui/src/components`) and consumed by the web app (`apps/web`).

Currently, modal dialogs use Base UI Popup with fixed viewport centering and no height constraint (`max-w-[calc(100%-2rem)] sm:max-w-sm`), causing dialogs to clip vertically on small screens and laptops. Header navigation renders seven navigation links inline unconditionally, wrapping or overflowing horizontally on screens narrower than 768px. Tables on the Transactions and Archive pages are wrapped in `overflow-hidden` rather than horizontal scrolling containers.

See `proposal.md` for background motivation and `specs/web-ui/spec.md` for behavioral requirements.

## Goals / Non-Goals

**Goals:**
- Guarantee that all modal and alert dialogs fit within the viewport on both desktop and mobile, with internal vertical scrolling so that headers, form fields, and action buttons remain fully visible and operable.
- Implement an accessible mobile navigation solution in `AppHeader` that hides inline nav links on small viewports (`< md`) in favor of a collapsible mobile menu or drawer, eliminating horizontal page overflow and header wrapping.
- Ensure all data tables and filter bars adapt to mobile screen widths with smooth horizontal scrolling for tabular data and wrapped/stacked filter controls.
- Maintain strict TypeScript type safety, design token consistency, and zero extraneous dependencies.

**Non-Goals:**
- Native Android app implementation (which will be a separate Expo project consuming the same backend API).
- Altering any domain logic, database schemas, or backend endpoints.
- Introducing heavy third-party bottom-sheet or drawer libraries.

## Decisions

### Decision 1: Viewport-constrained scrollable dialog primitive in `@finance-application/ui`
- **Choice**: Update `DialogContent` in `packages/ui/src/components/dialog.tsx` to include `max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden` or `max-h-[min(90dvh,calc(100%-2rem))] overflow-y-auto`. Provide configurable `size` options (defaulting to standard width `max-w-lg sm:max-w-lg` or `sm:max-w-md` instead of the cramped `sm:max-w-sm`). Ensure dialog bodies scroll while headers and footers remain accessible.
- **Alternatives considered**:
  - *Mobile bottom-sheet drawer (Vaul)*: Would require adding external dependencies and distinct mobile vs desktop dialog primitives. Responsive viewport capping with standard modal primitives works seamlessly across all devices with zero extra bundle weight.
  - *Full-screen dialogs on mobile*: Adds unnecessary transition complexity for short confirmations and simple forms.

### Decision 2: Responsive mobile navigation in `AppHeader`
- **Choice**: On `md:` (768px+) viewports, display the current minimalist horizontal nav bar and user badge. On viewports below `md`, hide the inline links and display a mobile hamburger/menu button that toggles an accessible overlay/drawer with links to Dashboard, Accounts, Categories, Transactions, Archive, Trash, Settings, and Sign out.
- **Alternatives considered**:
  - *Bottom tab bar*: Can only cleanly accommodate 4–5 navigation items; our application has 7 destinations plus user actions, requiring a "More" drawer anyway.
  - *Horizontal scrolling ribbon*: Poor discoverability on mobile; items off-screen are easily missed.

### Decision 3: Touch-friendly horizontal table containment and stacked filter layouts
- **Choice**: Ensure all data tables in `transactions.tsx`, `archive-trash/*.tsx`, etc., are enclosed in containers with `w-full overflow-x-auto` and minimum table column widths. Revise filter bars from rigid 7-column grids to responsive layouts (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7`) so date inputs and selects maintain touch-friendly targets.
- **Alternatives considered**:
  - *Converting all tables to card lists on mobile*: Significantly increases code duplication and maintenance burden across transactions, transfers, archive, and trash tabs. Touch-scrollable table containers preserve column alignment, sorting, and tabular numerals while preventing viewport blowout.

## Risks / Trade-offs

- **[Virtual keyboard on mobile devices]** → Using dynamic viewport units (`dvh` e.g. `max-h-[calc(100dvh-2rem)]`) ensures that when on-screen virtual keyboards appear on iOS Safari and Android Chrome, the dialog bounds automatically recalculate rather than extending beyond the visible area.
- **[Base UI portal and backdrop interaction]** → Ensure z-index stacking (`z-50`) and portal rendering remain consistent so mobile menus and modal dialog overlays do not conflict with sticky headers (`z-40`).
- **[Routing state on mobile menu close]** → Ensure the mobile menu closes automatically when a navigation link is clicked or route change occurs.
