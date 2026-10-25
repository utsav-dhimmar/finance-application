# Spec Delta

## Purpose

The web platform is the browser application foundation for the personal finance app: a server-rendered TanStack Start shell with the shadcn/ui design system and routing conventions. Finance UI capabilities are added as routes and components on top of this shell.

## ADDED Requirements

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

### Requirement: Not-found behavior

The web application SHALL respond to requests for unknown routes with HTTP status `404` and render a not-found view in the application shell.

#### Scenario: Unknown route

- **WHEN** a client requests a path with no registered route
- **THEN** the application responds with status `404` and HTML containing a not-found message
