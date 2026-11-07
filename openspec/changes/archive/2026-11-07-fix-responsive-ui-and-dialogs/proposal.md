# Proposal

## Why

The current web application is degraded on mobile viewports and small screens: the header navigation spills across multiple lines or overflows horizontally without a mobile menu, data tables and filter bars cause horizontal layout breaks, and several key modal dialogs (including create/edit transaction, transfer, account, and category dialogs) clip off-screen vertically on mobile devices and compact desktop viewports, making headers and action buttons unreachable. Standardizing responsive layout patterns, responsive viewport containment, and scrollable dialog wrappers will deliver a consistent, accessible experience across mobile, tablet, and desktop screens.

## What Changes

- **Responsive Application Shell & Header**: Add mobile-responsive navigation to `AppHeader` (e.g. mobile drawer/sheet or collapsible menu) for small viewports so navigation links and user actions do not overflow or break page headers.
- **Dialog Viewport Containment & Scrollability**: Update dialog and alert dialog primitives in `@finance-application/ui` to enforce maximum viewport bounds (`max-h-[min(90dvh,calc(100%-2rem))]` and `max-w-[calc(100%-2rem)]`) with smooth internal vertical scroll (`overflow-y-auto`) and sticky/contained headers and footers, ensuring all dialog content and submission buttons are visible and interactive across mobile devices and zoomed desktop viewports.
- **Responsive Data Tables & Filter Bars**: Ensure data tables on Transactions, Archive, and Trash views scroll horizontally inside dedicated touch-friendly containers without blowing out page width, and ensure filter toolbars wrap cleanly on narrow screens.
- **Responsive Dashboard & Management Views**: Adjust grid and flex layouts across Dashboard, Accounts, Categories, and Settings to ensure card grids, period pickers, and metric widgets scale seamlessly down to 320px mobile viewports.

## Capabilities

### New Capabilities

*(None)*

### Modified Capabilities

- `web-ui`: Update application shell and navigation requirements to require responsive mobile navigation, and add requirements for responsive viewport containment and internal scrollability for modal dialogs and data tables.

## Impact

- `packages/ui`: `dialog.tsx`, `alert-dialog.tsx`, `table.tsx`, and supporting layout utilities.
- `apps/web`: `app-header.tsx`, route views (`dashboard.tsx`, `transactions.tsx`, `accounts.tsx`, `categories.tsx`, `archive.tsx`, `trash.tsx`, `settings.tsx`), and dialog consumers.
- No backend API or schema modifications required.
