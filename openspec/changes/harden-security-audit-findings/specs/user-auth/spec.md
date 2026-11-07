# Spec Delta — user-auth

## REMOVED Requirements

### Requirement: Account registration

**Reason**: Registration is permanently disabled — the product is single-user and the owner's account already exists in production. The open-registration behavior (201 creation, 409 duplicate-email, input-validation errors) no longer exists at any time.

**Migration**: The owner account already exists in the production database. API tests seed users through the service/repository layer and authenticate via the login endpoint instead of `POST /api/auth/register`. The replacement requirement is "Registration disabled" below.

### Requirement: Register page

**Reason**: The `/register` page no longer offers a working registration form, so its scenarios (successful registration flow, duplicate-email display) describe behavior that no longer exists.

**Migration**: The page remains at `/register` with a registration-closed message and a link to `/login`; the replacement requirement is "Register page closed state" below.

## ADDED Requirements

### Requirement: Registration disabled

The system SHALL NOT create accounts through the API. `POST /api/auth/register` SHALL respond `403` with error code `REGISTRATION_DISABLED` for every request, and SHALL create no record, send no email, and reveal no information about existing accounts.

#### Scenario: Registration is rejected

- **WHEN** a client sends `POST /api/auth/register` with any well-formed or malformed body
- **THEN** the system responds `403` with error code `REGISTRATION_DISABLED`, creates no user, and issues no session cookies

#### Scenario: Registration reveals nothing about existing accounts

- **WHEN** a client sends `POST /api/auth/register` with an email that does exist and then with an email that does not
- **THEN** both responses are identical in status, body, and timing behavior

### Requirement: Register page closed state

The web application SHALL provide a `/register` page that displays a message that registration is closed, provides no working registration form, and links the visitor to `/login`.

#### Scenario: Register page shows closed state

- **WHEN** a visitor opens `/register`
- **THEN** the page displays a registration-closed message and a link to `/login`, and no submission is possible

## MODIFIED Requirements

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

### Requirement: Logout

The system SHALL revoke the presented refresh token, increment the user's token version, and clear both session cookies at `POST /api/auth/logout`, responding `204` regardless of whether the token was valid. After a logout that carried a valid refresh token, the access token that accompanied that session SHALL be rejected immediately, not merely when it expires.

#### Scenario: Logout with a session

- **WHEN** a client sends `POST /api/auth/logout` with refresh and access cookies
- **THEN** the system responds `204`, the refresh token row is revoked, the user's token version is incremented, both cookies are cleared, and a subsequent request with the just-presented access token is rejected with `401 UNAUTHENTICATED`

#### Scenario: Logout without a session

- **WHEN** a client sends `POST /api/auth/logout` with no cookies
- **THEN** the system responds `204` and clears any residual cookies, and no token version changes

## ADDED Requirements

### Requirement: Single-use rotation under concurrency

The refresh endpoint SHALL be single-use under concurrent access: when two or more requests present the same valid refresh token, exactly one SHALL succeed with a fresh session and every other request SHALL be rejected with `401 INVALID_REFRESH_TOKEN`. A presented token that has already been rotated SHALL never yield a second valid session.

#### Scenario: Concurrent refresh of the same token

- **WHEN** two requests present the same valid refresh token cookie at the same time
- **THEN** exactly one responds `200` with fresh session cookies and the other responds `401` with error code `INVALID_REFRESH_TOKEN`, and the refresh_tokens table holds exactly one unrevoked replacement

### Requirement: Auth endpoint rate limiting

The system SHALL limit unauthenticated request volume to the auth endpoints using a fixed-window rate limiter keyed by client IP (register, refresh) and by client IP plus email (login). When the limit is exceeded the system SHALL respond `429` with error code `RATE_LIMITED` before performing any password hashing or account lookup. The limiter SHALL apply before credential verification so that rejected requests perform no expensive work.

#### Scenario: Login burst is limited

- **WHEN** a client exceeds the configured login request window for one IP and email
- **THEN** further login requests receive `429` with error code `RATE_LIMITED` and perform no Argon2id verification

#### Scenario: Register and refresh are limited per IP

- **WHEN** a client exceeds the configured window for register or refresh requests from one IP
- **THEN** further requests to that endpoint receive `429` with error code `RATE_LIMITED`

### Requirement: Uniform login work regardless of account existence

Login processing time SHALL not reveal whether an email is registered: when the email is unknown, the system SHALL perform equivalent password-hashing work against a fixed dummy value before responding with the same generic `401 AUTH_INVALID_CREDENTIALS` error used for wrong passwords.

#### Scenario: Unknown email costs the same as wrong password

- **WHEN** login requests are made with an unregistered email and with a registered email plus wrong password
- **THEN** both perform Argon2id verification and respond with the same generic error, so request cost does not distinguish them

### Requirement: Refresh token retention bound

The system SHALL bound refresh-token storage growth: expired refresh tokens and refresh tokens revoked more than the retention window ago SHALL be deleted opportunistically as part of successful login or refresh processing, so the `refresh_tokens` table does not grow without limit.

#### Scenario: Expired tokens are purged

- **WHEN** a user logs in or refreshes while that user's expired or long-revoked refresh token rows exist
- **THEN** those rows are deleted during the request, and rows that are valid or recently revoked remain
