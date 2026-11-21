# web-platform Specification

## Purpose

The web platform is the browser application foundation for the personal finance app: a server-rendered TanStack Start shell with the shadcn/ui design system and routing conventions. Finance UI capabilities are added as routes and components on top of this shell.

## Requirements

### Requirement: Landing page

The web application SHALL serve a landing page at `/` whose server-rendered HTML contains the application heading, a design-system button rendered from the shadcn/ui component library, and a Lucide icon, without requiring client-side script execution.

#### Scenario: Request the landing page

- **WHEN** a client requests `/`
- **THEN** the application responds with status `200`, content type `text/html`, and markup containing the application heading and a `button` element

#### Scenario: Markup is present before hydration

- **WHEN** the initial HTML document for `/` is inspected
- **THEN** the heading text and the button markup are already present in the server response, before any client script runs

### Requirement: Greeting from the API

The landing page SHALL request the greeting endpoint `/api/greet/utsav?greeting=Hello&times=1` using a relative path, display the returned message once loaded, show a loading state while the request is in flight, and show an error fallback when the request fails.

#### Scenario: Greeting loads

- **WHEN** the API responds with `{"messages":["Hello, utsav!"]}`
- **THEN** the landing page displays `Hello, utsav!`

#### Scenario: API is unreachable

- **WHEN** the greeting request fails
- **THEN** the landing page shows an error fallback and the rest of the app shell remains usable

### Requirement: Single-origin static serving

The system SHALL serve the built web application as static files from the API worker, with API paths taking precedence: requests under `/api/` SHALL be handled by the worker's API, and all other requests SHALL be served from the built web assets or the SPA fallback.

#### Scenario: Static asset request

- **WHEN** a client requests a built asset path such as `/assets/index-abc123.js`
- **THEN** the system responds with status `200` and the asset content

#### Scenario: API precedence over the SPA

- **WHEN** a client requests `GET /api/hello`
- **THEN** the system responds with the API's JSON response, never the SPA shell

### Requirement: SPA fallback for client-side routes

The system SHALL respond to requests for non-API paths that match no static file with the prerendered SPA shell — status `200`, content type `text/html` — so client-side routing resolves the route.

#### Scenario: Application root

- **WHEN** a client requests `GET /`
- **THEN** the system responds with status `200`, content type `text/html`, and the SPA shell document

#### Scenario: Hard refresh on a client-side route

- **WHEN** a client requests `GET /transactions` directly
- **THEN** the system responds with status `200` and the SPA shell, and the transactions view renders after the application loads

### Requirement: Client-side not-found handling

For non-API paths with no registered route, the system SHALL return the SPA shell with status `200` and render the not-found view in the browser after the application loads.

#### Scenario: Unknown application path

- **WHEN** a client requests `GET /does-not-exist`
- **THEN** the system responds with status `200` and the SPA shell, and the not-found view renders after the application loads

### Requirement: API error semantics preserved

Requests under `/api/` for unknown resources SHALL return the JSON error envelope with status `404` from the API, independent of the SPA fallback behavior.

#### Scenario: Unknown API path

- **WHEN** a client requests `GET /api/does-not-exist`
- **THEN** the system responds with status `404`, content type `application/json`, and a body whose `error.code` is `NOT_FOUND`

### Requirement: Security headers on served web assets

Responses served for non-API paths — static files and the SPA fallback — SHALL include the headers `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin`, so the application shell cannot be framed by third parties and cannot leak referrer data to them. These headers apply to every non-API response including SPA-fallback `200` responses for unmatched paths.

#### Scenario: SPA shell carries security headers

- **WHEN** a client requests the application root or any non-API path that resolves to the SPA shell
- **THEN** the response includes `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin`

#### Scenario: SPA fallback carries security headers

- **WHEN** a client requests a non-API path that matches no static file and no registered route
- **THEN** the SPA-fallback `200` response also includes those security headers

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
