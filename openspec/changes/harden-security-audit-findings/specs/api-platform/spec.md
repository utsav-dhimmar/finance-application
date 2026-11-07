# Spec Delta — api-platform

## MODIFIED Requirements

### Requirement: API self-documentation

When documentation is enabled by configuration, the system SHALL publish an OpenAPI document describing every endpoint at `GET /api/openapi`, and serve an interactive documentation viewer at `GET /api/docs`. Documentation SHALL be enabled in local development and disabled in production by default; when documentation is disabled, both paths SHALL respond `404` with the standard JSON error envelope using code `NOT_FOUND`, indistinguishable from any other unknown route.

#### Scenario: Fetch the OpenAPI document

- **WHEN** documentation is enabled and a client sends `GET /api/openapi`
- **THEN** the system responds with status `200` and a JSON OpenAPI document that lists the API paths

#### Scenario: Open the documentation viewer

- **WHEN** documentation is enabled and a client sends `GET /api/docs`
- **THEN** the system responds with status `200` and an HTML page that renders the interactive API documentation

#### Scenario: Documentation disabled in production

- **WHEN** documentation is disabled and a client sends `GET /api/openapi` or `GET /api/docs`
- **THEN** the system responds with status `404`, content type `application/json`, and a body whose `error.code` is `NOT_FOUND`, identical to an unknown route

## ADDED Requirements

### Requirement: API responses are not cacheable

Every API response SHALL include a `Cache-Control: no-store` header so that no intermediary or browser cache stores any API response, including authenticated financial data and error envelopes.

#### Scenario: Authenticated response carries no-store

- **WHEN** a client receives any response from an `/api/` endpoint
- **THEN** the response includes the `Cache-Control: no-store` header

#### Scenario: Error responses carry no-store

- **WHEN** a client receives an error response (validation, not-found, or server error) from an `/api/` endpoint
- **THEN** that response also includes the `Cache-Control: no-store` header
