# Spec Delta

## ADDED Requirements

### Requirement: Route-level data prefetch

The web application SHALL prefetch each route's primary data during navigation, warming the same query cache the page renders from, so data requests start before the route component mounts and independent requests run in parallel. Link hover or focus SHALL trigger the same prefetch. Prefetch SHALL be best-effort: a failed prefetch leaves the route's existing loading, error, and retry states authoritative.

#### Scenario: Data loads during navigation

- **WHEN** a signed-in user navigates to a data-backed route such as `/dashboard` or `/transactions`
- **THEN** the route's data requests begin during navigation, in parallel, before the route content mounts, instead of starting serially after the auth check resolves

#### Scenario: Intent preload fetches data

- **WHEN** the user hovers or focuses a link to a prefetched route
- **THEN** the target route's data prefetch begins before the click

#### Scenario: Fresh cache avoids duplicate requests

- **WHEN** navigation or intent prefetch targets a route whose cached data is still fresh
- **THEN** no duplicate network request is made for that data

#### Scenario: Prefetch failure does not block the page

- **WHEN** a prefetched request fails during navigation
- **THEN** the route still renders, and the page shows its existing error and retry affordances for the failed slice

### Requirement: Router-level authentication redirect

The web application SHALL enforce authentication at the routing layer for protected routes: when a visitor without a session attempts to open one, the app redirects to `/login` before any protected content renders and before any protected data request is made. A visitor holding a valid session who hard-reloads or deep-links into a protected route SHALL remain on that route with their session restored.

#### Scenario: Unauthenticated deep link to a protected route

- **WHEN** a visitor with no session requests a protected route directly (deep link or reload)
- **THEN** the app redirects to `/login` before rendering any protected content, and no protected data request is issued

#### Scenario: Valid session survives a protected-route reload

- **WHEN** a signed-in user hard-reloads a protected route while holding a valid refresh cookie
- **THEN** the session is restored and the protected route renders without leaving the page

#### Scenario: Guard applies across all protected routes

- **WHEN** an unauthenticated visitor attempts any protected route (dashboard, transactions, accounts, categories, archive, trash, settings, recurring expenses)
- **THEN** the redirect happens through the single routing-layer guard rather than per-page logic, and no page renders a protected shell first

### Requirement: Deferred chart bundle loading

The dashboard SHALL render its non-chart sections without requiring the chart library bundle; chart components SHALL load on demand after the dashboard shell is interactive. Chart slots SHALL show a loading placeholder while the bundle loads and a recoverable retry affordance when it fails, leaving the rest of the dashboard usable.

#### Scenario: Dashboard paints without the chart library

- **WHEN** a signed-in user first opens `/dashboard`
- **THEN** the dashboard shell and non-chart sections render without waiting for the chart library bundle to download

#### Scenario: Chart slots show loading placeholders

- **WHEN** the dashboard's data has arrived but the chart bundle is still loading
- **THEN** each chart slot shows a loading placeholder, not blank space

#### Scenario: Chart bundle failure is contained

- **WHEN** the chart bundle fails to load
- **THEN** the affected chart slots show a retry affordance and the summary cards, accounts, and activity feed continue to work
