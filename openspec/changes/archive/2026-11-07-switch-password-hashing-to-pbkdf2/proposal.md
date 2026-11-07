# Proposal

## Why

Production logins fail with `Worker exceeded CPU time limit` (`POST /api/auth/login`, Workers Logs trace on `finance-application`). The Workers **free** plan enforces a hard **10 ms CPU** cap per request, but login verifies passwords with pure-TypeScript Argon2id (m=19 MiB, t=2, p=1), which costs **0.5–1.5 s of CPU per derivation** — two orders of magnitude over the budget, so every login attempt dies. No memory-hard Argon2id parameters (pure-TS or WASM) can fit 10 ms; the owner chose the free-plan-compatible fix: native WebCrypto PBKDF2-SHA256 with an iteration count tuned to the measured CPU budget.

## What Changes

- Replace the password KDF: pure-TS `@noble/hashes` Argon2id → **WebCrypto PBKDF2-HMAC-SHA256** (`crypto.subtle.deriveBits` — native in workerd, Node, and miniflare; no WASM involved).
- Default iterations **10,000** (measured under workerd during implementation: 10k ≈ 6 ms fits the 10 ms cap, 25k ≈ 13–15 ms and was rejected).
- **BREAKING** — stored `password_hash` format changes from an Argon2id PHC string to a PBKDF2 PHC string. The single owner account in production is migrated by a documented one-time re-hash runbook (local hashing script + `wrangler d1 execute --remote`) run **before** the new worker is deployed; no dual-format verification is kept, so the pure-TS Argon2id CPU cost leaves the codebase entirely.
- Hash strings record their own parameters (algorithm, iterations, salt, derived key) and verification honors the recorded values, so the default iteration count can be raised later (e.g., after moving to Workers Paid) without invalidating existing hashes.
- Login-time uniformity is preserved: the fixed dummy hash used for unknown emails is regenerated with the same default PBKDF2 parameters, so unknown-email attempts still cost the same as wrong-password attempts.
- `verifyPassword`/`hashPassword` become asynchronous (WebCrypto is promise-based) — an internal signature change only; the HTTP contract (`POST /api/auth/login` request/response, cookies, error envelopes) is unchanged.
- Remove the now-unused `@noble/hashes` dependency from `server/api`.
- README: password-hashing section rewritten for PBKDF2, plus a deployment runbook covering the re-hash migration, the free-plan CPU budget, and the paid-plan path to raise iterations.

## Capabilities

### New Capabilities

None — this change modifies an existing capability only.

### Modified Capabilities

- `user-auth`: the **Login** requirement's verification wording changes from Argon2id to PBKDF2-HMAC-SHA256 (scenarios unchanged), and a new **Password hashing CPU budget and parameter compatibility** requirement pins the free-tier fit and the self-describing hash format.

## Impact

- **Code**: `server/api/src/lib/password.ts` (rewritten), `server/api/src/services/auth-service.ts` + `server/api/src/routes/auth.ts` (async verification wiring), new `server/api/scripts/hash-password.mts` migration script.
- **Tests**: `tests/lib/password.test.ts`, `tests/services/auth-service.test.ts`, `tests/helpers.ts`, and the user-seeding in `tests/transfers/transfers-api.test.ts` / `tests/transactions/transactions-api.test.ts` (await the now-async hash helper).
- **Dependencies**: `@noble/hashes` removed from `server/api` via `pnpm remove`; no new dependencies.
- **Data**: `users.password_hash` values change format (owner re-hashed via script); no schema change, no D1 migration.
- **API/web clients**: no contract change — same endpoints, envelopes, cookies, and pages.
