# android-data Specification

## Purpose

Defines the mobile client data layer: how the Expo app loads, caches, validates, and submits finance data against the authoritative API — server state management, the service and hook layers, Zod-validated forms, mutation consistency, and mutation feedback — so finance screens can be built on one consistent architecture shared with the web app.

## Requirements

### Requirement: Single query client for server state

The application SHALL manage all server state through one shared query client configured once for the whole app, and cached server data SHALL be considered fresh for 30 seconds — matching the web app — so screens re-render cached data instead of refetching on every focus within that window.

#### Scenario: Recent data is served from cache

- **WHEN** a screen requests server data that was fetched less than 30 seconds ago
- **THEN** the data is rendered from the shared cache without a new network request

#### Scenario: Stale data is refetched

- **WHEN** a screen mounts for data that is older than the freshness window
- **THEN** the cached data is rendered while a fresh copy is fetched in the background

### Requirement: Services as the only API access path

The application SHALL access every API endpoint through per-domain service modules that wrap the shared typed API client, expose the domain's query-key constants, and translate API errors into user-readable messages. Screens and hooks SHALL NOT issue network requests or build request payloads outside these services.

#### Scenario: Requests flow through the service layer

- **WHEN** any screen or hook loads or writes finance data
- **THEN** the request is issued by the domain's service module with its declared query key, and no component constructs its own fetch call

#### Scenario: API errors become user-readable messages

- **WHEN** a service call fails with an API error
- **THEN** the service maps it to a user-readable message consistent with the web app's wording and never exposes raw error objects, session cookies, or tokens

### Requirement: Query hooks expose loading and error states

The application SHALL expose each domain's data through query hooks that surface in-flight, success, and error states, so screens render loading indicators, cached data, and error messages from one hook without custom fetching logic.

#### Scenario: Loading state during fetch

- **WHEN** a query hook's request is in flight with no cached data
- **THEN** the hook reports an in-flight state that a screen can render as a loading indicator

#### Scenario: Error state on failure

- **WHEN** a query hook's request fails
- **THEN** the hook reports the failure with the service's user-readable message while keeping any previously fetched data available

### Requirement: Mutations refresh affected data

After a successful create, update, or delete, the application SHALL invalidate every query affected by that change — including the entity's own lists, related entities, and report data — so subsequently rendered screens reflect the change without a manual reload.

#### Scenario: Creating a transaction refreshes related data

- **WHEN** a transaction is created successfully
- **THEN** the cached transaction lists, account and category data, and dashboard report data are all invalidated, and the next render of any of them shows the new transaction

#### Scenario: Mutating an account refreshes reports

- **WHEN** an account is renamed successfully
- **THEN** the accounts list and the dashboard report data are invalidated so balances and account names stay consistent

### Requirement: Zod-validated forms

Every create and update form SHALL validate its input against the shared Zod schemas before submission, SHALL block submission while fields are invalid, SHALL show per-field validation messages, and SHALL submit the schema's parsed output values (for example, an amount string submitted as integer minor units).

#### Scenario: Invalid input blocks submission

- **WHEN** a form is submitted with an invalid field, such as an empty amount or a malformed date
- **THEN** submission is blocked and the offending field shows its validation message from the shared schema

#### Scenario: Valid input submits parsed values

- **WHEN** a form is submitted with valid input
- **THEN** the request payload contains the schema's parsed output values, with amounts expressed as integer minor units

### Requirement: Toast feedback for mutations

The application SHALL show toast feedback for mutation outcomes: a confirmation toast on success and an error toast with the service's user-readable message on failure. Toast content SHALL NOT include credentials, session cookies, or tokens.

#### Scenario: Successful mutation shows confirmation

- **WHEN** a create, update, or delete mutation completes successfully
- **THEN** a confirmation toast is displayed

#### Scenario: Failed mutation shows readable error

- **WHEN** a mutation is rejected by the API or the network
- **THEN** an error toast describes the failure in user-readable language derived from the error, and the toast contains no sensitive values

### Requirement: Data requests participate in session refresh

All data-layer requests SHALL run through the established session-refresh flow: when a request is rejected with an expired access token while a refresh cookie is stored, a single shared refresh is attempted and the operation continues or retries with the fresh session, preserving the mobile platform's existing refresh behavior for every screen.

#### Scenario: Expired token during a query

- **WHEN** a data request is rejected as unauthenticated because the access token expired
- **THEN** one shared refresh is attempted and the same request is continued or retried with the fresh session without user action

#### Scenario: Failed refresh ends the session

- **WHEN** the refresh attempt itself is rejected with an invalid refresh token
- **THEN** the stored session is cleared and the app shows the sign-in screen
