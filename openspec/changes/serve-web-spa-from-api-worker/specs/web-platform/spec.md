# Spec Delta

## Purpose

Serve the finance web application and its HTTP API from a single Cloudflare Worker origin: the app as prebuilt static assets rendered client-side (SPA), the API under `/api/`, with API routing taking precedence over the SPA fallback.

## ADDED Requirements

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
