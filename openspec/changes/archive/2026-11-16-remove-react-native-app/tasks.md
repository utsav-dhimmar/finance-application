# Tasks

## 1. Revert `packages/api-client` to the pre-mobile surface

- [x] 1.1 Restore `packages/api-client/src/client.ts` to its `813023c` state: remove the exported `ApiFetchOptions` interface (`onResponse` hook, extra `headers` merging), restore `apiFetch`'s options parameter to `{ baseUrl?: string }` and the original doc comment. Verify: `git diff 813023c -- packages/api-client/src/client.ts` prints nothing.
- [x] 1.2 Restore `packages/api-client/src/auth.ts` to its `813023c` state: `ApiClientOptions` becomes its own `{ baseUrl?: string }` interface and the `ApiFetchOptions` import is dropped. Verify: `git diff 813023c -- packages/api-client/src/auth.ts` prints nothing.
- [x] 1.3 Restore `packages/api-client/tests/api-client.test.ts` to its `813023c` state: delete the three `onResponse` tests (`calls onResponse with the raw response before decoding`, `calls onResponse even when the response is an error`, `works unchanged when onResponse is omitted`). Verify: `git diff 813023c -- packages/api-client/tests/api-client.test.ts` prints nothing, and `pnpm turbo run test --filter=@finance-application/api-client` passes.

## 2. Clean configuration and docs

- [x] 2.1 Remove the `"!apps/android/assets"` entry from `biome.json` ignore lists, restoring the pre-RN file. Verify: `git diff 813023c -- biome.json` prints nothing, and the repo lint task (`pnpm turbo run lint`) passes.
- [x] 2.2 Update `AGENTS.md`: drop the "future Android application" clause from the one-authoritative-API rule and remove the `apps/android/ # Future Expo application` line from the monorepo layout sketch. Verify: `grep -ni android AGENTS.md` returns no matches.
- [x] 2.3 Update `user-story/01-inital/main.md`: replace the line-7 roadmap sentence promising a future Expo React Native app with a web-only statement (approved during apply). Verify: `grep -niE "react-native|(^|[^a-zA-Z])expo([^a-zA-Z]|$)" user-story/01-inital/main.md` returns no matches.

## 3. Regenerate dependencies

- [x] 3.1 Run `pnpm install` from the repository root so `pnpm-lock.yaml` drops the `apps/android` importer and every Expo/React Native dependency. Verify: `pnpm install` exits 0 and `grep -niE "apps/android|expo|react-native" pnpm-lock.yaml` returns no matches.

## 4. Verify the repository is mobile-free

- [x] 4.1 Confirm the already-deleted artifacts remain absent: `apps/android/`, `.agents/skills/vercel-react-native-skills/`, and root `eas.json` do not exist on disk, and `skills-lock.json` contains no `vercel-react-native-skills` entry. Verify: `test ! -e apps/android && test ! -e .agents/skills/vercel-react-native-skills && test ! -e eas.json && ! grep -q vercel-react-native-skills skills-lock.json` succeeds, and `git status` lists them as deletions.
- [x] 4.2 Scan for leftover mobile references outside archived history: `grep -rniE "react-native|expo|apps/android" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.yaml" --include="*.yml" --include="*.md" .` excluding `node_modules`, `openspec/changes/archive/`, `.agents/`, and `openspec/changes/remove-react-native-app/` returns only `openspec/specs/android-*` matches (deleted when this change is archived).
- [x] 4.3 Run the full repo checks per the Definition of Done: `pnpm turbo run typecheck lint test build` all pass, proving the web-only workspace graph is intact after the revert and lockfile prune.

## Workflow follow-up

These steps live outside tracked task progress (the user owns git; spec sync happens at archive):

- The user creates the branch/commit and opens the PR for the combined working-tree removal.
- When archiving this change (`/openspec-archive-change remove-react-native-app`), sync the REMOVED-only deltas: `openspec/specs/android-ui/`, `openspec/specs/android-platform/`, and `openspec/specs/android-data/` are deleted because `.openspec.yaml` declares `retire_capabilities: true`.
