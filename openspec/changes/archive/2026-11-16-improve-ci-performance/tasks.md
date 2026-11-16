# Tasks

## 1. Web test environment reuse (vmThreads)

- [x] 1.1 Add `pool: 'vmThreads'` to the `test` block of `apps/web/vitest.config.ts` and run `pnpm vitest run` (or `pnpm turbo run test --filter=@finance-application/web`) locally — all 26 web test files must pass with zero test-source changes, and the summary must no longer report "jsdom was created 26 times" (expect one environment per worker)
- [x] 1.2 If any test fails from cross-realm `instanceof` against an externalized package, add that package to `server.deps.inline` in `apps/web/vitest.config.ts` and re-run the web suite until green; if it cannot be made green this way, stop and revise the change instead of falling back to shared-window isolation
- [x] 1.3 Run `pnpm turbo run typecheck lint test --filter=@finance-application/web` and confirm typecheck, lint, and tests all pass with the modified config

## 2. API suites as independent turbo tasks

- [x] 2.1 In `server/api/package.json`, change `"test"` to `vitest run` and add `"test:workers": "vitest run -c vitest.workers.config.mts"`; verify `pnpm --filter @finance-application/api run test` runs only the node suite and `pnpm --filter @finance-application/api run test:workers` runs only the workers suite
- [x] 2.2 Add `"test:workers": {}` to the `tasks` map in `turbo.json` and confirm `pnpm turbo run test:workers --filter=@finance-application/api` resolves the task (turbo prints it as one of the packages' tasks)
- [x] 2.3 Update root `package.json` `"test"` script to `turbo run test test:workers`; run `pnpm test` locally and confirm both API suites execute (and are scheduled in parallel where runner capacity allows) with both summaries green

## 3. Isolation-disabled node suites (schemas, api-client)

- [x] 3.1 Add `packages/schemas/vitest.config.ts` with `test.isolate: false` (node environment, default pool) and run the schemas suite locally — all 219 tests must pass with no test-source changes
- [x] 3.2 Add `packages/api-client/vitest.config.ts` with `test.isolate: false` and run the api-client suite locally — all 63 tests must pass with no test-source changes
- [x] 3.3 If either suite fails from shared module state, revert that package's config change only (keep per-file isolation for it) and record the finding in the apply summary

## 4. Turbo cache persistence in CI

- [x] 4.1 In `.github/workflows/ci.yml`, add a `TURBO_TELEMETRY_DISABLED: 1` env on the turbo step and change the command to `pnpm turbo run typecheck lint test build test:workers`; verify the YAML parses (e.g., via `actionlint` if available, or careful review) and the command lists all five task names
- [x] 4.2 Set `TURBO_CACHE_DIR: .turbo` for the turbo step and add an `actions/cache` step (pinned to a full commit SHA like the other actions) with `path: .turbo`, key `turbo-${{ runner.os }}-${{ github.ref_name }}-${{ github.sha }}`, and restore-keys `turbo-${{ runner.os }}-${{ github.ref_name }}-`; verify the workflow file shows the cache step before the turbo step
- [x] 4.3 Run `pnpm turbo run typecheck lint test build test:workers` twice locally and confirm the second run reports cache hits for tasks whose inputs did not change (`X cached, Y total`)

## 5. Full pipeline verification

- [x] 5.1 Run the complete pipeline locally: `pnpm turbo run typecheck lint test build test:workers` — all tasks green, and the turbo summary shows 17 successful tasks (16 baseline + new `test:workers`)
- [x] 5.2 Push the branch, open a PR, and compare the new CI run against the 2026-11-15 baseline in `ci.logs`: web test task no longer reports per-file environment creation, the two API suites appear as separate tasks, and turbo reports cache behavior; record measured wall-clock before/after in the PR description

## Workflow follow-up

- Archive the change via `/openspec-archive-change` after the PR merges and the measured CI improvement is confirmed.
