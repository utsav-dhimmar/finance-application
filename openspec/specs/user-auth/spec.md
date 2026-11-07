# user-auth Specification

## Purpose

Users register an account, authenticate with email and password, remain signed in across visits through rotating refresh tokens, and sign out. Covers the `/api/auth` endpoints, the login, register, dashboard pages, and the web session handling.

## Requirements

### Requirement: Registration disabled

The system SHALL NOT create accounts through the API. `POST /api/auth/register` SHALL respond `403` with error code `REGISTRATION_DISABLED` for every request, and SHALL create no record, send no email, and reveal no information about existing accounts.

#### Scenario: Registration is rejected

- **WHEN** a client sends `POST /api/auth/register` with any well-formed or malformed body
- **THEN** the system responds `403` with error code `REGISTRATION_DISABLED`, creates no user, and issues no session cookies

#### Scenario: Registration reveals nothing about existing accounts

- **WHEN** a client sends `POST /api/auth/register` with an email that does exist and then with an email that does not
- **THEN** both responses are identical in status, body, and timing behavior

### Requirement: Login

The system SHALL verify credentials at `POST /api/auth/login` by checking the password against the stored PBKDF2-HMAC-SHA256 hash, and on success respond `200` with the user's `id` and `email`.

#### Scenario: Correct credentials

- **WHEN** a client logs in with the email and password of an existing account
- **THEN** the system responds `200` with JSON containing the account's `id` and `email`

#### Scenario: Wrong password or unknown email

- **WHEN** a client logs in with a wrong password or an unregistered email
- **THEN** the system responds `401` with error code `AUTH_INVALID_CREDENTIALS` and the same generic message in both cases

### Requirement: Password hashing CPU budget and parameter compatibility

The system SHALL hash and verify passwords with PBKDF2-HMAC-SHA256 at a default iteration count not exceeding 30,000, keeping one derivation within the Workers free plan's 10 ms CPU budget. The stored hash SHALL record its algorithm, iterations, salt, and derived key, and verification SHALL honor those recorded parameters, so hashes stay verifiable when defaults change. A malformed or unsupported stored hash SHALL be treated as invalid credentials, never a server error.

#### Scenario: Default fits the free-tier CPU budget

- **WHEN** a password hash is created with the default configuration
- **THEN** its recorded iteration count is at most 30,000

#### Scenario: Hash records its parameters

- **WHEN** a password is hashed
- **THEN** the stored string records the PBKDF2 algorithm, iteration count, salt, and derived key, and never contains the plain password

#### Scenario: Verification honors recorded parameters

- **WHEN** a stored hash records an iteration count different from the current default and the correct password is presented
- **THEN** verification succeeds, so changing the default never invalidates existing hashes

#### Scenario: Malformed stored hash fails gracefully

- **WHEN** the stored hash is truncated, corrupt, or names an unsupported algorithm and a login is attempted
- **THEN** verification rejects it without performing a derivation and the login responds with the generic `401 AUTH_INVALID_CREDENTIALS`, not a server error

### Requirement: Session tokens

On successful login or refresh the system SHALL issue an access token (JWT, HS256, 15-minute expiry, `sub` = user id, `ver` = the user's current token version) and a refresh token (random 256-bit value, 30-day expiry). The system SHALL store only a SHA-256 hash of each refresh token in the database, and each user SHALL have a monotonically increasing token version that is embedded in every access token issued to that user.

#### Scenario: Tokens are cookies

- **WHEN** a client logs in or refreshes successfully
- **THEN** the response sets the `__Host-access_token` (path `/`) and `__Secure-refresh_token` (path `/api/auth`) cookies as HttpOnly, Secure, SameSite=Lax, and no response body or JavaScript-readable surface contains either token

#### Scenario: Refresh token at rest

- **WHEN** a refresh token has been issued
- **THEN** the `refresh_tokens` table contains its SHA-256 hash and expiry, and the raw token value appears nowhere in the database

#### Scenario: Access token carries the current version

- **WHEN** an access token is issued to a user whose token version is N
- **THEN** the token's `ver` claim equals N and verification succeeds while the user's version remains N

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

### Requirement: Single-use rotation under concurrency

The refresh endpoint SHALL be single-use under concurrent access: when two or more requests present the same valid refresh token, exactly one SHALL succeed with a fresh session and every other request SHALL be rejected with `401 INVALID_REFRESH_TOKEN`. A presented token that has already been rotated SHALL never yield a second valid session.

#### Scenario: Concurrent refresh of the same token

- **WHEN** two requests present the same valid refresh token cookie at the same time
- **THEN** exactly one responds `200` with fresh session cookies and the other responds `401` with error code `INVALID_REFRESH_TOKEN`, and the refresh_tokens table holds exactly one unrevoked replacement

### Requirement: Auth endpoint rate limiting

The system SHALL limit unauthenticated request volume to the auth endpoints using a fixed-window rate limiter keyed by client IP (register, refresh) and by client IP plus email (login). When the limit is exceeded the system SHALL respond `429` with error code `RATE_LIMITED` before performing any password hashing or account lookup. The limiter SHALL apply before credential verification so that rejected requests perform no expensive work.

#### Scenario: Login burst is limited

- **WHEN** a client exceeds the configured login request window for one IP and email
- **THEN** further login requests receive `429` with error code `RATE_LIMITED` and perform no password-hash verification

#### Scenario: Register and refresh are limited per IP

- **WHEN** a client exceeds the configured window for register or refresh requests from one IP
- **THEN** further requests to that endpoint receive `429` with error code `RATE_LIMITED`

### Requirement: Uniform login work regardless of account existence

Login processing time SHALL not reveal whether an email is registered: when the email is unknown, the system SHALL perform equivalent password-hashing work against a fixed dummy value before responding with the same generic `401 AUTH_INVALID_CREDENTIALS` error used for wrong passwords.

#### Scenario: Unknown email costs the same as wrong password

- **WHEN** login requests are made with an unregistered email and with a registered email plus wrong password
- **THEN** both perform password-hash verification and respond with the same generic error, so request cost does not distinguish them

### Requirement: Refresh token retention bound

The system SHALL bound refresh-token storage growth: expired refresh tokens and refresh tokens revoked more than the retention window ago SHALL be deleted opportunistically as part of successful login or refresh processing, so the `refresh_tokens` table does not grow without limit.

#### Scenario: Expired tokens are purged

- **WHEN** a user logs in or refreshes while that user's expired or long-revoked refresh token rows exist
- **THEN** those rows are deleted during the request, and rows that are valid or recently revoked remain

### Requirement: Logout

The system SHALL revoke the presented refresh token, increment the user's token version, and clear both session cookies at `POST /api/auth/logout`, responding `204` regardless of whether the token was valid. After a logout that carried a valid refresh token, the access token that accompanied that session SHALL be rejected immediately, not merely when it expires.

#### Scenario: Logout with a session

- **WHEN** a client sends `POST /api/auth/logout` with refresh and access cookies
- **THEN** the system responds `204`, the refresh token row is revoked, the user's token version is incremented, both cookies are cleared, and a subsequent request with the just-presented access token is rejected with `401 UNAUTHENTICATED`

#### Scenario: Logout without a session

- **WHEN** a client sends `POST /api/auth/logout` with no cookies
- **THEN** the system responds `204` and clears any residual cookies, and no token version changes

### Requirement: Register page closed state

The web application SHALL provide a `/register` page that displays a message that registration is closed, provides no working registration form, and links the visitor to `/login`.

#### Scenario: Register page shows closed state

- **WHEN** a visitor opens `/register`
- **THEN** the page displays a registration-closed message and a link to `/login`, and no submission is possible

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
