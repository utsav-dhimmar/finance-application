# Design

## Context

Login verifies passwords with pure-TypeScript Argon2id (`server/api/src/lib/password.ts`, m=19456 KiB, t=2, p=1 via `@noble/hashes`) at 0.5–1.5 s CPU per derivation, against the Workers free plan's hard 10 ms per-request CPU cap (paid plan: 30 s default). Verification is injected into the auth service as `verifyPassword` (`routes/auth.ts:34`), used at two call sites: the real user's stored hash and the fixed `DUMMY_PASSWORD_HASH` for unknown emails (uniform-login-work requirement). Registration is closed, so the production worker never hashes — it only verifies; the single owner account is the only real hash in the remote D1. `@noble/hashes` has no other importer. The Workers runtime supports only pre-compiled (statically imported) WASM; runtime WASM compilation is disallowed, which is what rules out hash-wasm specifically.

Measured reference point (local Node WebCrypto — native PBKDF2-SHA256, best of 3): 10k ≈ 2.8 ms · 25k ≈ 5.9 ms · 50k ≈ 11.1 ms · 100k ≈ 21 ms · 600k ≈ 130 ms per derivation.

## Goals / Non-Goals

**Goals:**

- Login (and the dummy-verify path) completes within the free plan's 10 ms CPU budget with real headroom.
- Existing-hash compatibility across future parameter changes: hashes carry their own parameters and verification honors them.
- Uniform login work for unknown emails is preserved.
- The Argon2id CPU cost and the `@noble/hashes` dependency leave the codebase entirely; a documented, safe one-time migration for the single production hash.

**Non-Goals:**

- No password-change/reset endpoint and no reopening of registration.
- No changes to the HTTP contract, cookies, rate limiting, WAF guidance, wrangler config, or DB schema/migrations.
- No Workers Paid upgrade in this change — the paid-plan path (raise iterations) is documented only.
- No CI wall-time assertions (machine-dependent and flaky).

## Decisions

1. **KDF: WebCrypto PBKDF2-HMAC-SHA256** (`crypto.subtle.deriveBits`). Native in workerd (BoringSSL), Node, and miniflare; zero new dependencies; works in every existing test pool.
   - *Alternatives*: (a) WASM Argon2id via static import (`argon2-wasm-edge`) — runs on Workers, keeps stronger KDF, but ~20–50 ms/derivation still exceeds 10 ms free, so it forces Workers Paid; rejected per owner's free-plan choice. (b) hash-wasm — cannot run on Workers at all (runtime WASM compilation disallowed; hash-wasm#65). (c) Keep pure-TS Argon2id and only upgrade the plan — zero code fix, login stays ~1 s; rejected. (d) Pure-TS Argon2id at minimal parameters — pure-TS floor is far above 10 ms even at trivial parameters; rejected.

2. **Default 10,000 iterations; spec cap 30,000.** The plan of record was 25,000 based on local Node measurements (25k ≈ 5.9 ms), but the binding measurement under real workerd (task 4.1, temporary miniflare scratch test, since removed) came in ~2.5× slower: 10k ≈ 6 ms, 25k ≈ 13–15 ms cold and warm. 25,000 therefore exceeded the 10 ms budget on the actual runtime and was rejected; the shipped default of 10,000 fits with headroom for routing, validation, and database work. Production Workers CPUs differ from the local miniflare hardware; if production measurements justify it, the default can be raised within the 30,000 spec cap (re-hash; verification honors recorded parameters). The measured numbers are recorded in the comment above `DEFAULT_ITERATIONS`.
   - *Trade-off (accepted by owner)*: 10k ≪ OWASP's 600k PBKDF2-SHA256 baseline — meaningfully weaker against offline GPU cracking. Bounded in practice by the fixed-window rate limiter (100 req/60 s per key, verified before any hashing), the WAF rule, single-user scope, closed registration, and the 8–128 char password floor. The paid-plan upgrade path is a documented re-hash at higher iterations; verification reads iterations from the hash, so nothing else changes.

3. **Hash format: `$pbkdf2-sha256$<iterations>$<salt>$<hash>`** — modular-crypt/PHC-style (as used by passlib and Django for PBKDF2), standard base64, 16-byte random salt, 32-byte derived key. The parser mirrors the existing strict Argon2id one: split on `$`, validate shape, reject unknown algorithm tags, malformed, or truncated strings by returning `false` with no derivation and no throw.
   - *Alternatives*: passlib "ab64" encoding (`+`→`.`) — needless extra rule; full PHC parameter syntax (`$pbkdf2-sha256$i=25000$...`) — more generic than one algorithm needs.

4. **Async verification.** `deriveBits` is promise-based, so `hashPassword`/`verifyPassword` return Promises; `AuthServiceDeps.verifyPassword` type updates and both call sites await. Internal signature change only — handlers were already async and the HTTP contract is untouched.

5. **Dummy hash regenerated.** `DUMMY_PASSWORD_HASH` becomes a fixed PBKDF2 string at the default iterations, embedded once during implementation. The "Uniform login work" requirement continues to hold: unknown-email attempts still perform one full verification. If the owner ever re-hashes the account at different iterations, the migration script prints the matching dummy constant to re-embed.

6. **Migration: offline re-hash, no dual-format verification.** New `server/api/scripts/hash-password.mts` (runs on Node ≥22, same WebCrypto) reads the password from stdin by default (never echoed or logged) and also accepts `--password` for direct invocation — added at the owner's request — warning that the value then remains in shell history and the process list; it accepts `--iterations` and `--email`, and prints the PHC string plus a ready-to-run `wrangler d1 execute finance-application --remote --command "UPDATE users SET password_hash = '…' WHERE email = '…'"`. Runbook order: save the current hash for rollback → re-hash → apply UPDATE → deploy. Deploying the new worker before the UPDATE would lock the owner out (single user), so the order is documented as re-hash first.
   - *Alternative rejected*: keep an Argon2id fallback verify branch during a transition window — it keeps the CPU bomb on the hot path (one login against an old hash re-triggers the 500/error), and a transition window is meaningless for one user.

7. **No env/config knob for iterations in the worker.** Verification is data-driven from the stored hash; the only hashing in production would come from registration, which is closed. Hashing happens in tests (constant) and the migration script (`--iterations` flag). An `AUTH_PBKDF2_ITERATIONS` env var would be dead, misleading configuration — rejected.

8. **Dependency removal via `pnpm --filter @finance-application/api remove @noble/hashes`** (never hand-editing `package.json`/lockfile). `password.ts` is its only importer.

## Risks / Trade-offs

- [Weaker KDF than Argon2id at 25k iterations] → Owner-accepted for the free plan; mitigated by rate limiting, WAF, single-user scope, closed registration; documented paid-plan path raises iterations without invalidating hashes.
- [workerd BoringSSL speed differs from the local OpenSSL measurement] → Confirmed during implementation: workerd ran ~2.5× slower, so the default was lowered from the planned 25,000 to 10,000 iterations (the exact lever task 4.1 reserved); the spec cap of 30,000 still bounds any future raise.
- [Owner locked out if deploy precedes re-hash] → Runbook orders re-hash → UPDATE → deploy, and saves the old hash first for rollback (restore saved hash + redeploy previous worker version).
- [Dummy-hash parameter drift if the account is re-hashed at non-default iterations] → Script prints the matching dummy constant; README documents the pairing requirement.
- [Async ripple missed in some test] → Full `pnpm turbo run typecheck lint test build` gate before completion.

## Migration Plan

1. Implement and verify per tasks (all suites green).
2. Owner (one-time): save current hash (`SELECT password_hash …` output kept locally), run the script locally with the chosen password at default iterations, run the printed `wrangler d1 execute --remote` UPDATE, then deploy the new worker.
3. Verify production login succeeds; rollback = redeploy the previous worker version and restore the saved hash.
