# Proposal

## Why

The CI verification pipeline takes ~80s wall clock on every push/PR, and instrumentation from the 2026-11-15 run shows most of it is avoidable overhead: `@finance-application/web`'s test task creates a fresh jsdom environment for each of 26 test files (33.99s, 37% of tracked time), the API test script runs two Vitest configurations strictly serially inside one Turborepo task (~55s combined), and Turborepo caching is disabled so every run re-executes all 16 tasks even when only one workspace changed. Developer feedback latency grows with every added test file, so this compounds.

## What Changes

- Configure `apps/web` Vitest to reuse the jsdom environment across files via `pool: 'vmThreads'` (environment created once per worker instead of once per file), preserving per-file isolation by default.
- Split the `@finance-application/api` `test` script's serial `vitest run && vitest run -c vitest.workers.config.mts` chain into two independent Turborepo tasks (`test` and `test:workers`) so Turborepo can execute them concurrently.
- Enable Turborepo local task caching in the GitHub Actions workflow by persisting the turbo cache directory across runs (actions/cache), so unchanged packages report cached instead of re-running.
- Optionally (measured, low-risk follow-up within the same change): adopt `isolate: false` for the cheap node-environment test tasks (`packages/schemas`, `packages/api-client`) where Vitest already reports double-digit-percent savings.
- No change to test content, coverage, CI gate semantics (typecheck/lint/test/build all still run), runner image, action pinning, or security posture.

## Capabilities

### New Capabilities

- `ci`: The CI verification pipeline: what the pipeline verifies (typecheck, lint, test, build) and its execution behavior — test environment reuse, concurrent test-suite execution, and task caching across runs.

### Modified Capabilities

<!-- None: no existing capability's requirements change. Domain specs
     (accounts, transactions, web-platform, ...) are unaffected; the CI
     pipeline is a new capability boundary. -->

## Impact

- **Code**: `apps/web/vitest.config.ts`, `server/api/package.json` (test scripts), `server/api/vitest.config.ts` / `vitest.workers.config.mts` (unchanged configs, now invoked as separate turbo tasks), `packages/schemas` and `packages/api-client` vitest configs (optional isolate change), `.github/workflows/ci.yml`, `turbo.json` (new `test:workers` task entry).
- **Behavior**: No application behavior change. CI still runs the same four gates and must still pass. Expected effect based on the 2026-11-15 run: web test task drops from ~34s to roughly 12–15s (environment cost of 34s collapses to per-worker cost), api test wall time drops ~11s from parallelization, and unchanged-package tasks become cache hits.
- **Risks**: vmThreads runs test code in a VM realm — cross-realm `instanceof` failures against externalized packages are a known edge case; mitigated by keeping per-file window isolation and validating via full test run. Node 24 + Vitest 5 supports vmThreads; no dependency changes required.
