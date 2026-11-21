# Tasks

## 1. Relocate the package

- [x] 1.1 Create a feature branch (e.g. `chore/move-api-into-apps`) from `main` and verify `git status` is clean before starting
- [x] 1.2 Run `git mv server/api apps/api` and verify: `git status --short` shows the tracked files as renames (`R`), `ls server` no longer exists, the tracked inventory of `apps/api` matches the pre-move list (src, tests, scripts, migrations, configs, `.dev.vars.example`, `command-list.md`, `worker-configuration.d.ts`), and the untracked local `apps/api/.dev.vars` is still present (the filesystem rename carries it; move it manually if it was left behind — never commit it)
- [x] 1.3 Edit `apps/api/wrangler.jsonc`: change `assets.directory` from `../../apps/web/dist/client` to `../web/dist/client` and verify the file diff against the pre-move version contains only that one line change

## 2. Workspace and lockfile

- [x] 2.1 Remove the `server/*` glob from `pnpm-workspace.yaml` and verify the file lists exactly `apps/*` and `packages/*`
- [x] 2.2 Run `pnpm install` and verify it succeeds, `pnpm-lock.yaml`'s importers now reference `apps/api` (no `server/api` importers remain), and `pnpm ls -r --depth -1` still lists `@finance-application/api` as a workspace member

## 3. Docs and comments

- [x] 3.1 Update every `server/api` path reference in `README.md` (structure table, deploy instructions, migrations section, env vars, verification section) to `apps/api` and verify the documented commands read correctly against the new paths
- [x] 3.2 Update the `server/api/src/schemas` path comments in `packages/schemas/src/*.ts` (auth, transactions, categories, transfers, accounts, preferences, reports) to `apps/api/src/schemas` and verify no comment still names the old path
- [x] 3.3 Check `apps/api/command-list.md` (and any other file that names repo-relative paths) for stale self-referencing `server/api` paths, update them, and verify with `grep -rn "server/api" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=archive --exclude-dir=changes` returning only matches under `openspec/changes/archive`

## 4. Verification gate

- [x] 4.1 Run `pnpm --filter @finance-application/api types` to regenerate `worker-configuration.d.ts` and inspect the diff for stale absolute paths or unexpected changes
- [x] 4.2 Raise the web suite's test timeout in `apps/web/vitest.config.ts` to `testTimeout: 30_000` (matching both API configs) with an explanatory comment, because the recurring-expenses combobox test exceeds the 5 s default under full-pipeline CPU load (scope addition approved during apply; verify with `git diff` showing only that config block)
- [x] 4.3 Run the full gate from the repo root: `pnpm turbo run typecheck lint test build test:workers` and verify every task is green; the api `build` task's `wrangler deploy --dry-run` validates the corrected `wrangler.jsonc` (including the assets path) without a real deploy
- [x] 4.4 Spot-check the moved package's behavior: `pnpm --filter @finance-application/api test` and `pnpm --filter @finance-application/api test:workers` pass unchanged, and no test source file was modified in the diff (`git diff main --stat` shows renames plus only the files named in tasks 1.3, 2.1, 3.1–3.3, 4.1, 4.2)

## 5. Production deploy cutover (external, manual)

- [ ] 5.1 After the branch merges to `main`, update the Cloudflare Workers Builds dashboard build root directory from `server/api` to `apps/api` and verify the dashboard setting shows `apps/api` (the worker keeps serving the previous deploy until this lands, so the failure window is bounded to builds only)
- [ ] 5.2 Trigger or wait for a Workers Builds production deploy and verify it succeeds: the worker responds on `/api/*` (e.g. a health/auth endpoint returns the expected status) and the SPA fallback serves client-side routes on hard refresh, confirming the corrected assets path works in production

## Workflow follow-up

- Archive the change once the deploy cutover is verified and the project's review requirements are satisfied.
