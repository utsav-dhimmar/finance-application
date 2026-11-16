# Design

## Context

Measured from the 2026-11-15 CI run (`ci.logs`): the turbo pipeline takes **59.8s** (16 tasks, 0 cached) inside an ~80s job. Breakdown of the three hotspots:

| Hotspot | Measured | Cause in code |
|---|---|---|
| `@finance-application/web:test` | 33.68s — "Environment jsdom was created 26 times · 33.99s total, 37% of tracked time" | `apps/web/vitest.config.ts` uses default pool with per-file isolation → jsdom rebuilt for every one of the 26 test files |
| `@finance-application/api:test` | 55.18s serial — 11.13s node suite + 44.05s workers suite (31.12s of it setup) | `server/api` script chains `vitest run && vitest run -c vitest.workers.config.mts` inside one turbo task, so the two independent suites can never overlap |
| Whole pipeline | "Remote caching disabled", 0 cached | No turbo cache persistence in CI; all 16 tasks re-run on every push/PR even when only one workspace changed |

Constraints: GitHub-hosted `ubuntu-latest` (4 vCPU), Node 24, Vitest 5.0.5 (web) / 4.1.12 (api), Turborepo 2.11.10. The workers suite legitimately pays per-file D1 migration setup (isolation by design) — we do not touch it.

## Goals / Non-Goals

**Goals:**
- Collapse the per-file jsdom cost in web tests while keeping per-file window isolation.
- Let the two API test suites run concurrently instead of strictly serially.
- Persist Turborepo's local task cache across CI runs so unchanged-package tasks become cache hits.
- Cheap additional win: disable per-file isolation for the pure-node `schemas`/`api-client` suites where Vitest's own CI hint reports ~0.8–1.15s savings.

**Non-Goals:**
- No remote cache service (Vercel remote cache / self-hosted) — requires external account/token; GH Actions cache achieves the branch-level benefit.
- No change to the workers-runtime suite's per-file D1 migration setup (isolation is a deliberate correctness property).
- No switch to `happy-dom` — it would reduce per-import cost further but changes observable DOM behavior; orthogonal risk not needed once environment reuse lands.
- No splitting CI into multiple GitHub jobs (multiplies install/checkout overhead; turbo already parallelizes within the single job).
- No Vitest major-version alignment (api on 4.x, web on 5.x) — no established perf benefit.
- No changes to any test source file.

## Decisions

### D1: Web tests adopt `pool: 'vmThreads'`
`apps/web/vitest.config.ts` → `test.pool: 'vmThreads'` (environment + window construction once per worker; fresh VM window per file). This is the exact remedy Vitest's CI hint names for "jsdom was created 26 times" while *keeping per-file isolation* — the guide's table marks default `isolate: true` as "safest, slowest" and `vmThreads` as the option that keeps a fresh window per file.

Alternatives considered:
- **`isolate: false`**: slightly faster per docs, but files share one window and module registry — route tests exercising TanStack Router/Query singletons and DOM globals would risk cross-file leakage. Rejected as the default.
- **`happy-dom`**: cuts per-import cost but changes DOM behavior; rejected to keep scope tight (see Non-Goals).
- If a package misbehaves under vmThreads (cross-realm `instanceof` against externalized deps), the mitigation is `server.deps.inline` for the offending package rather than abandoning the pool.

### D2: Split the API test script into two turbo tasks
`server/api/package.json`: `"test": "vitest run"`, `"test:workers": "vitest run -c vitest.workers.config.mts"`. `turbo.json` gains `"test:workers": {}` (no `dependsOn` — the suites are independent). CI invokes the task explicitly:

- `.github/workflows/ci.yml` → `pnpm turbo run typecheck lint test build test:workers`
- root `package.json` `"test"` → `turbo run test test:workers` (local parity)

Alternatives considered: backgrounding the two vitest runs with `&`/`wait` inside one npm script — turbo can't cache or attribute them separately, and turbo's own scheduler parallelizes better across the 4 vCPU runner. Note the existing 30s argon2 `testTimeout` already absorbs CPU saturation, which is why parallelization is safe here.

### D3: `isolate: false` for the schemas and api-client suites
Both packages run on Vitest defaults with no config file, so add a minimal `vitest.config.ts` per package with `test.isolate: false` (node environment, default pool = threads semantics per package; no DOM). Vitest's own CI instrumentation reports ~771ms (api-client) and ~1.15s (schemas) savings. Gate: full local suite run must pass before adoption; per the spec, any suite found depending on per-file module state keeps isolation (drop the config change for it).

### D4: Persist the turbo cache via GitHub Actions cache
- Set `TURBO_CACHE_DIR: .turbo` for the turbo step and add `actions/cache` with:
  - `path: .turbo`
  - `key: turbo-${{ runner.os }}-${{ github.ref_name }}-${{ github.sha }}`
  - `restore-keys: turbo-${{ runner.os }}-${{ github.ref_name }}-` (loose restore keys are safe: turbo only replays entries whose computed input hash matches, so stale/foreign-branch entries can never feed wrong results)
- Pushes to `main` refresh the baseline that PR runs restore from.
- Also set `TURBO_TELEMETRY_DISABLED: 1` (removes the per-run telemetry notice; zero risk).
- Task outputs stay as-is: test/lint/typecheck tasks cache logs (execution skipped on hit), `build` caches `dist/**`.

Alternatives considered: remote cache (out of scope, Non-Goals); caching `node_modules/.cache` blindly (version-default-dependent path; explicit `TURBO_CACHE_DIR` is deterministic).

## Risks / Trade-offs

- [vmThreads cross-realm `instanceof` failures against externalized packages] → run the full web suite locally in the new pool before pushing; mitigate via `server.deps.inline` for offending packages; if unresolvable, stop and revise the change (do not silently fall back to sharing a window).
- [Two API suites running concurrently saturate the 4 vCPU runner] → existing 30s argon2 timeouts were added for exactly this contention profile; verify no new flakes on the first CI run, tune `--concurrency` only if observed.
- [GitHub Actions cache pressure/eviction (10 GB repo limit)] → turbo entries are small (logs for test/lint/typecheck; dist for build); eviction only degrades to uncached runs, never wrong results.
- [PR cache key by branch means first PR run is always uncached] → accepted; restore-keys still let PRs reuse their own branch's earlier runs, and `main` pushes prime the baseline.
- [Isolation-disabled schemas/api-client suites share module state across files] → suites are pure zod-validation/domain tests with self-contained per-test data; verified by full local run before adoption; revert that one config per suite if any test leaks state.

## Migration Plan

Config-only change, single commit on a branch; revert the commit to roll back. No database, API, or dependency changes. Verification order (see tasks.md): local suite runs per package → one full `pnpm turbo run typecheck lint test build test:workers` → push and compare the new CI run's task table against the 2026-11-15 baseline.

## Open Questions

None — all decisions are resolvable from the measured baseline and Vitest's documented behavior.
