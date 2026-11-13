# android-platform Specification

## Purpose

The Android platform is the Expo application foundation for the personal finance app: the `apps/android` workspace shell with Expo Router navigation, cookie-session authentication wiring to the authoritative API, secure session storage, and environment configuration. Finance UI capabilities are added on top of this shell.

## Requirements

### Requirement: Expo application workspace

The system SHALL provide the mobile application as an Expo workspace at `apps/android` using Expo Router for navigation, integrated into the pnpm monorepo so that its `typecheck`, `lint`, `test`, and `build` tasks run in the existing Turborepo pipeline in a Node-only environment (no Android SDK, emulator, or native toolchain required).

#### Scenario: Workspace pipeline picks up the app

- **WHEN** `pnpm turbo run typecheck lint test build` runs from the repository root
- **THEN** the `apps/android` workspace executes all four tasks successfully, with `build` producing a JavaScript export without native compilation

### Requirement: Unauthenticated launch shows sign-in

The system SHALL show the sign-in screen to a user launching the app with no stored session and SHALL NOT render any authenticated screen content before a session is established.

#### Scenario: First launch with no session

- **WHEN** the app launches and no session is stored on the device
- **THEN** the sign-in screen is displayed and no authenticated screen content is rendered

### Requirement: Sign-in against the authoritative API

The system SHALL authenticate by sending the entered email and password to `POST /api/auth/login` on the configured API base URL, establish the session from the response's session cookies, and navigate to the authenticated home screen on success.

#### Scenario: Successful sign-in

- **WHEN** the user submits the email and password of an existing account
- **THEN** the app sends the credentials to `POST /api/auth/login` on the configured API, stores the returned session cookies, and navigates to the authenticated home screen

#### Scenario: Invalid credentials

- **WHEN** the user submits a wrong password or an unregistered email
- **THEN** the app displays a generic invalid-credentials message and does not reveal whether the email exists

#### Scenario: Network failure

- **WHEN** the sign-in request fails due to an unreachable API
- **THEN** the app displays an on-screen error and the entered credentials remain editable

### Requirement: Explicit cookie session handling

The system SHALL manage the API session explicitly: capture the session cookie values from sign-in and refresh responses, attach them as a `Cookie` header to every API request, and rely on them for re-authentication. The API's session contract SHALL be consumed unchanged — no server behavior is modified for the mobile client.

#### Scenario: Authenticated request carries the session

- **WHEN** the app sends any API request after sign-in
- **THEN** the request includes the stored session cookies in its `Cookie` header

### Requirement: Session stored in secure storage

The system SHALL store session cookie values only in the platform's secure storage (device keystore/keychain) and SHALL NOT persist them in plain device storage or include their values in logs.

#### Scenario: Session is persisted in secure storage

- **WHEN** a session is established
- **THEN** its cookie values are retrievable from the platform secure storage and absent from any general-purpose plain storage and from application logs

### Requirement: Session persistence across app restarts

The system SHALL restore the signed-in state on app launch when a stored session exists: the app verifies the session against `GET /api/auth/me`, obtains a fresh session via the refresh flow when needed, and shows the authenticated home screen without re-entering credentials.

#### Scenario: Relaunch while signed in

- **WHEN** a signed-in user closes and reopens the app
- **THEN** the authenticated home screen is shown without prompting for credentials

#### Scenario: Expired session on relaunch

- **WHEN** the stored access token has expired but a valid refresh token remains stored
- **THEN** the app refreshes the session and shows the authenticated home screen without prompting for credentials

### Requirement: Refresh on expired access token

The system SHALL, when an API request is rejected with `401 UNAUTHENTICATED` while a refresh cookie is stored, attempt a single session refresh via `POST /api/auth/refresh` and continue the original operation or retry it with the fresh session. Concurrent requests SHALL share one refresh attempt rather than triggering parallel refreshes.

#### Scenario: Concurrent 401 responses share one refresh

- **WHEN** multiple API requests receive `401 UNAUTHENTICATED` at the same time
- **THEN** the app performs a single refresh request and the waiting requests continue with its result

#### Scenario: Refresh failure clears the session

- **WHEN** the refresh attempt is rejected with `401 INVALID_REFRESH_TOKEN`
- **THEN** the app clears the stored session and shows the sign-in screen

### Requirement: Sign out

The system SHALL provide a sign-out control on the authenticated home screen that calls `POST /api/auth/logout`, clears the stored session, and shows the sign-in screen.

#### Scenario: Sign-out flow

- **WHEN** a signed-in user activates the sign-out control
- **THEN** the app calls the logout endpoint, clears the stored session cookies from secure storage, and shows the sign-in screen

### Requirement: Configured API base URL

The system SHALL obtain the API base URL from build-time environment configuration and target it for every API request. When the configuration is absent, the app SHALL fail startup with an actionable error instead of sending requests to a default host.

#### Scenario: Requests target the configured API

- **WHEN** the app is built with an API base URL configured
- **THEN** every sign-in, session, and authenticated request is sent to that base URL

#### Scenario: Missing configuration fails fast

- **WHEN** the app starts without an API base URL configured
- **THEN** it reports a clear startup error and sends no API requests
