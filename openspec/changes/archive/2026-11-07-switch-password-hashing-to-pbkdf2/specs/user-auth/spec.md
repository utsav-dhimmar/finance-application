# Spec Delta — user-auth

## MODIFIED Requirements

### Requirement: Login

The system SHALL verify credentials at `POST /api/auth/login` by checking the password against the stored PBKDF2-HMAC-SHA256 hash, and on success respond `200` with the user's `id` and `email`.

#### Scenario: Correct credentials

- **WHEN** a client logs in with the email and password of an existing account
- **THEN** the system responds `200` with JSON containing the account's `id` and `email`

#### Scenario: Wrong password or unknown email

- **WHEN** a client logs in with a wrong password or an unregistered email
- **THEN** the system responds `401` with error code `AUTH_INVALID_CREDENTIALS` and the same generic message in both cases

## ADDED Requirements

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
