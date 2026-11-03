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
