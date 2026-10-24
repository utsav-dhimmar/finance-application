# Spec Delta

## Purpose

The API platform provides the HTTP foundation for the personal finance application: JSON endpoint routing, validated request inputs, structured error responses, and self-published interactive API documentation. Future finance capabilities build on this baseline.

## ADDED Requirements

### Requirement: Hello endpoint

The system SHALL serve a hello endpoint at `GET /api/hello` that returns a `200` response with a fixed JSON body.

#### Scenario: Request the hello endpoint

- **WHEN** a client sends `GET /api/hello`
- **THEN** the system responds with status `200`, content type `application/json`, and body `{"message":"Hello, World!"}`

### Requirement: Parameterized greeting endpoint

The system SHALL serve a greeting endpoint at `GET /api/greet/{name}` that accepts the query parameters `greeting` (text, optional, default `"Hello"`) and `times` (whole number, optional, default `1`), and returns a `200` JSON body containing one greeting message per `times`, each of the form `"{greeting}, {name}!"`. The `name` path value SHALL be trimmed before use.

#### Scenario: Defaults are applied

- **WHEN** a client sends `GET /api/greet/Utsav` with no query parameters
- **THEN** the system responds with status `200` and body `{"messages":["Hello, Utsav!"]}`

#### Scenario: Both query parameters supplied

- **WHEN** a client sends `GET /api/greet/Utsav?greeting=Namaste&times=3`
- **THEN** the system responds with status `200` and body `{"messages":["Namaste, Utsav!","Namaste, Utsav!","Namaste, Utsav!"]}`

#### Scenario: Name is trimmed

- **WHEN** a client sends `GET /api/greet/%20Utsav%20`
- **THEN** the system responds with status `200` and body `{"messages":["Hello, Utsav!"]}`

### Requirement: Greeting input validation

The system SHALL reject a greeting request whose `name` is empty or longer than 100 characters after trimming, whose `greeting` is empty or longer than 100 characters after trimming, or whose `times` is not a whole number between 1 and 10, by responding with status `400` and no greeting messages.

#### Scenario: times is not a whole number

- **WHEN** a client sends `GET /api/greet/Utsav?times=abc`
- **THEN** the system responds with status `400`

#### Scenario: times is out of range

- **WHEN** a client sends `GET /api/greet/Utsav?times=11`
- **THEN** the system responds with status `400`

#### Scenario: greeting is blank

- **WHEN** a client sends `GET /api/greet/Utsav?greeting=%20`
- **THEN** the system responds with status `400`

#### Scenario: name is blank

- **WHEN** a client sends `GET /api/greet/%20%20`
- **THEN** the system responds with status `400`

### Requirement: Validation error response format

The system SHALL return validation errors as a JSON body with an `error` object containing a machine-readable `code`, a human-readable `message`, and a `details` array that identifies every invalid parameter by name.

#### Scenario: Error identifies the invalid parameter

- **WHEN** a client sends `GET /api/greet/Utsav?times=abc`
- **THEN** the system responds with status `400`, content type `application/json`, and a body whose `error.code` is `VALIDATION_ERROR` and whose `error.details` contains an entry naming `times`

### Requirement: Structured not-found responses

The system SHALL respond to requests for unknown paths with status `404` and a JSON error body using the same `error` shape as validation errors, with code `NOT_FOUND`.

#### Scenario: Unknown route

- **WHEN** a client sends `GET /api/does-not-exist`
- **THEN** the system responds with status `404`, content type `application/json`, and a body whose `error.code` is `NOT_FOUND`

### Requirement: API self-documentation

The system SHALL publish an OpenAPI document describing every endpoint at `GET /api/openapi`, and serve an interactive documentation viewer at `GET /api/docs`.

#### Scenario: Fetch the OpenAPI document

- **WHEN** a client sends `GET /api/openapi`
- **THEN** the system responds with status `200` and a JSON OpenAPI document that lists the paths `/api/hello` and `/api/greet/{name}`

#### Scenario: Open the documentation viewer

- **WHEN** a client sends `GET /api/docs`
- **THEN** the system responds with status `200` and an HTML page that renders the interactive API documentation
