# Spec Delta

## Purpose

Users register an account, authenticate with email and password, remain signed in across visits through rotating refresh tokens, and sign out. Covers the `/api/auth` endpoints, the login, register, dashboard pages, and the web session handling.

## ADDED Requirements

### Requirement: Account registration

The system SHALL create an account at `POST /api/auth/register` from a valid `email` and `password` (8–128 characters), storing the password only as an Argon2id hash, and respond `201` with the user's `id` and `email`.

#### Scenario: Successful registration

- **WHEN** a client sends `POST /api/auth/register` with a well-formed email and an 8-character password
- **THEN** the system responds `201` with JSON containing that email and an `id`, and the stored `password_hash` is an Argon2id PHC string, never the plain password

#### Scenario: Duplicate email

- **WHEN** a client registers an email that already exists (case-insensitively)
- **THEN** the system responds `409` with error code `EMAIL_TAKEN` and creates no second account

#### Scenario: Invalid input

- **WHEN** a client registers with a malformed email or a password shorter than 8 characters
- **THEN** the system responds `400` with error code `VALIDATION_ERROR` and details naming the invalid field

### Requirement: Login

The system SHALL verify credentials at `POST /api/auth/login` by checking the Argon2id hash, and on success respond `200` with the user's `id` and `email`.

#### Scenario: Correct credentials

- **WHEN** a client logs in with the email and password of an existing account
- **THEN** the system responds `200` with JSON containing the account's `id` and `email`

#### Scenario: Wrong password or unknown email

- **WHEN** a client logs in with a wrong password or an unregistered email
- **THEN** the system responds `401` with error code `AUTH_INVALID_CREDENTIALS` and the same generic message in both cases

### Requirement: Session tokens

On successful registration or login the system SHALL issue an access token (JWT, HS256, 15-minute expiry, `sub` = user id) and a refresh token (random 256-bit value, 30-day expiry), both delivered as HttpOnly, Secure, SameSite=Lax cookies, and SHALL store only a SHA-256 hash of each refresh token in the database.

#### Scenario: Tokens are cookies

- **WHEN** a client registers or logs in successfully
- **THEN** the response sets HttpOnly, Secure, SameSite=Lax cookies for the access and refresh tokens, and no response body or JavaScript-readable surface contains either token

#### Scenario: Refresh token at rest

- **WHEN** a refresh token has been issued
- **THEN** the `refresh_tokens` table contains its SHA-256 hash and expiry, and the raw token value appears nowhere in the database

### Requirement: Authenticated user lookup

The system SHALL return the authenticated user's `id` and `email` at `GET /api/auth/me` when the access token is valid, and SHALL respond `401` with code `UNAUTHENTICATED` when it is missing, invalid, or expired.

#### Scenario: Valid access token

- **WHEN** a client sends `GET /api/auth/me` with a valid, unexpired access token
- **THEN** the system responds `200` with the `id` and current `email` of the token's user

#### Scenario: Missing or expired access token

- **WHEN** a client sends `GET /api/auth/me` with no access token or an expired one
- **THEN** the system responds `401` with error code `UNAUTHENTICATED` and no user data

### Requirement: Refresh token rotation

The system SHALL issue a new session at `POST /api/auth/refresh` when presented a valid, unexpired, unrevoked refresh token cookie, revoking the presented token and issuing a fresh refresh token in its place, and SHALL respond `401` with code `INVALID_REFRESH_TOKEN` when the cookie is absent, unknown, expired, or revoked.

#### Scenario: Valid refresh

- **WHEN** a client sends `POST /api/auth/refresh` with a valid refresh token cookie
- **THEN** the system responds `200` with fresh access and refresh token cookies, and the presented token's row is marked revoked

#### Scenario: Reused or invalid refresh token

- **WHEN** a client sends `POST /api/auth/refresh` with a token that is expired, revoked, or unknown
- **THEN** the system responds `401` with error code `INVALID_REFRESH_TOKEN` and sets no new session cookies

### Requirement: Logout

The system SHALL revoke the presented refresh token and clear both session cookies at `POST /api/auth/logout`, responding `204` regardless of whether the token was valid.

#### Scenario: Logout with a session

- **WHEN** a client sends `POST /api/auth/logout` with refresh and access cookies
- **THEN** the system responds `204`, the refresh token row is revoked, and both cookies are cleared

#### Scenario: Logout without a session

- **WHEN** a client sends `POST /api/auth/logout` with no cookies
- **THEN** the system responds `204` and clears any residual cookies

### Requirement: Register page

The web application SHALL provide a `/register` page with email and password fields that validates input client-side, displays server error messages (including the duplicate-email error), and on success navigates the user to `/dashboard`.

#### Scenario: Successful registration flow

- **WHEN** a visitor submits valid credentials on `/register` and the API responds `201`
- **THEN** the page navigates to `/dashboard`, which displays the new account's email

#### Scenario: Duplicate email on the register page

- **WHEN** a visitor registers an email that already exists
- **THEN** the page shows the duplicate-email error without navigating away

### Requirement: Login page

The web application SHALL provide a `/login` page with email and password fields that displays a generic invalid-credentials message on failure and navigates to `/dashboard` on success.

#### Scenario: Successful login flow

- **WHEN** a visitor submits correct credentials on `/login`
- **THEN** the page navigates to `/dashboard`, which displays the account's email

#### Scenario: Invalid login attempt

- **WHEN** a visitor submits a wrong password on `/login`
- **THEN** the page shows a generic invalid-credentials message and does not reveal whether the email exists

### Requirement: Dashboard and route protection

The web application SHALL provide a `/dashboard` page that displays the authenticated user's email, redirect unauthenticated visitors to `/login`, and redirect authenticated visitors away from `/login` and `/register`.

#### Scenario: Unauthenticated visitor

- **WHEN** a visitor with no session opens `/dashboard`
- **THEN** the app redirects to `/login` without rendering dashboard content

#### Scenario: Authenticated user opens dashboard

- **WHEN** a signed-in user opens `/dashboard`
- **THEN** the page displays their email

#### Scenario: Authenticated user visits login

- **WHEN** a signed-in user opens `/login`
- **THEN** the app redirects to `/dashboard`

### Requirement: Sign out

The web application SHALL show the signed-in user's email and a Sign out control in the app shell; activating it calls the logout endpoint and navigates to `/login`.

#### Scenario: Sign out flow

- **WHEN** a signed-in user activates Sign out
- **THEN** the app calls `POST /api/auth/logout`, clears the session state, and navigates to `/login`, after which `/dashboard` redirects back to `/login`

### Requirement: Session persistence across reloads

The web application SHALL restore the signed-in state on page load: when a valid refresh cookie exists, the app refreshes the session and the user remains authenticated without re-entering credentials.

#### Scenario: Reload while signed in

- **WHEN** a signed-in user reloads the page after their access token has expired
- **THEN** the app obtains a fresh session via the refresh endpoint and the user remains signed in
