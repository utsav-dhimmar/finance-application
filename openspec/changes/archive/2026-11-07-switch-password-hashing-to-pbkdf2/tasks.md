# Tasks

## 1. PBKDF2 hashing core

- [x] 1.1 Rewrite `server/api/src/lib/password.ts` to WebCrypto PBKDF2-HMAC-SHA256: async `hashPassword`/`verifyPassword`, `$pbkdf2-sha256$<iterations>$<salt>$<hash>` format (standard base64, 16-byte salt, 32-byte key), `DEFAULT_ITERATIONS = 25_000`, strict parser that returns `false` (no throw, no derivation) on malformed, truncated, or foreign-algorithm hashes. Verify: `pnpm --filter @finance-application/api exec vitest run --project node tests/lib/password.test.ts` after 1.2 (or `typecheck` alone at this point).
- [x] 1.2 Rewrite `tests/lib/password.test.ts` for PBKDF2: hash→verify round-trip, wrong password false, hash records algorithm/iterations/salt/key and never the plain password, default iteration count ≤ 30,000, recorded parameters honored (verify a hand-built 1,000-iteration hash of the right password succeeds), malformed/truncated/`$argon2id$`-tagged hashes return `false`, and the embedded `DUMMY_PASSWORD_HASH` is well-formed, uses the default iterations, and never verifies `true`. Verify: the node-pool run of this file passes.
- [x] 1.3 Generate the new `DUMMY_PASSWORD_HASH` once at the default iterations (throwaway password, local node one-liner reusing the new module) and embed it in `password.ts`. Verify: the dummy assertions from 1.2 pass.

## 2. Service wiring and auth tests

- [x] 2.1 Make verification async end to end: update `AuthServiceDeps.verifyPassword` type and await both call sites (dummy path and real path) in `server/api/src/services/auth-service.ts`; confirm `routes/auth.ts` wiring still typechecks with the lib function reference. Verify: `pnpm --filter @finance-application/api typecheck`.
- [x] 2.2 Update `tests/services/auth-service.test.ts`: async `verifyPassword` fake, await seeded `hashPassword` calls, unknown-email login still performs the dummy verification (uniform work), wrong-password and success paths unchanged. Verify: `pnpm --filter @finance-application/api exec vitest run --project node tests/services/auth-service.test.ts`.
- [x] 2.3 Update user-seeding helpers to await the now-async `hashPassword`: `tests/helpers.ts` (`seedUserAndLogin`) and the direct `passwordHash: hashPassword(...)` usages in `tests/transfers/transfers-api.test.ts` and `tests/transactions/transactions-api.test.ts`. Verify: `pnpm --filter @finance-application/api exec vitest run` passes for the transfers and transactions suites (both pools).

## 3. Migration runbook and docs

- [x] 3.1 Create `server/api/scripts/hash-password.mts`: reads the password from stdin (never argv/env/logs), optional `--iterations` (default `DEFAULT_ITERATIONS`) and `--email`, prints the PHC string and a ready-to-run `wrangler d1 execute finance-application --remote --command "UPDATE users SET password_hash = '…' WHERE email = '…'"`. Verify: run it locally with a throwaway password and confirm `verifyPassword` accepts its output (node one-liner); confirm no password or hash of it appears in the command output beyond the intended UPDATE statement.
- [x] 3.2 Update `README.md`: Authentication section (PBKDF2-HMAC-SHA256, WebCrypto, why Argon2id pure-TS was replaced), a "Password hash migration (one-time)" runbook with the save-old-hash → re-hash → remote UPDATE → deploy order, the free-plan CPU budget note, and the Workers Paid path (re-hash at higher iterations; recorded parameters keep old hashes verifiable). Verify: documented commands and flags match the script as implemented.
- [x] 3.3 Add a `--password` flag to `scripts/hash-password.mts` (owner request): the password can be passed directly on the command line instead of the stdin prompt; the script warns that the value lands in shell history and the process list, and stdin remains the default. Verify: run with `--password` and confirm `verifyPassword` accepts the output (and rejects a wrong password), and the stdin path still works.

## 4. Cleanup and full verification

- [x] 4.1 Confirm the final default iteration count under workerd: temporary workers-pool scratch test timing `deriveBits` at 25,000 in miniflare, then delete the scratch file; adjust `DEFAULT_ITERATIONS` (within the ≤30,000 cap) only if materially over budget, recording the measurement in a comment above the constant. Verify: scratch removed (`git status` clean of it) and the chosen value documented in the comment.
- [x] 4.2 Remove the unused dependency: `pnpm --filter @finance-application/api remove @noble/hashes`. Verify: `rg -n "@noble/hashes" server/api` returns nothing and package.json/lockfile were modified only by pnpm.
- [x] 4.3 Full pipeline green: `pnpm turbo run typecheck lint test build`. Verify: all tasks successful, no failures.

## Workflow follow-up

- Owner deploy (after archive): save current production hash → run the migration script locally → apply the printed UPDATE with `wrangler d1 execute --remote` → deploy the worker → verify login succeeds.
- Archive the change after the project's review requirements are satisfied.
