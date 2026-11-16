# Proposal

## Why

The React Native (Expo) Android client is being abandoned: `apps/android`, the React Native agent skill, and root `eas.json` are already deleted in the working tree, and the three android OpenSpec changes are archived. What remains on `main` are RN-era modifications to shared code — `ApiFetchOptions` cookie plumbing in `packages/api-client`, a Biome ignore entry, Expo dependencies in the lockfile — plus three android capability specs describing an application that no longer exists. Reverting them keeps the shared API client and the repository's documentation truthful for the web-only monorepo.

## What Changes

- **BREAKING** — Remove the React Native/Expo application `apps/android` entirely (already deleted in the working tree; recorded here so the removal is one coherent change).
- Revert the RN-motivated API surface in `packages/api-client` back to the pre-RN shape (`813023c`):
  - `src/client.ts`: remove the exported `ApiFetchOptions` interface (`onResponse` raw-response hook and extra `headers` merging added so the mobile client could capture `Set-Cookie` and send `Cookie` headers); restore `apiFetch`'s options parameter to `{ baseUrl?: string }`.
  - `src/auth.ts`: restore `ApiClientOptions` to its own `{ baseUrl?: string }` interface instead of `extends ApiFetchOptions`.
  - `tests/api-client.test.ts`: remove the three `onResponse` tests.
- Remove the `"!apps/android/assets"` entry from `biome.json` ignore lists.
- Prune `pnpm-lock.yaml` of the `apps/android` importer and all Expo/React Native dependencies by regenerating it with `pnpm install` (workspace globs are unchanged — the RN commits never touched `pnpm-workspace.yaml`, root `package.json`, `turbo.json`, or CI workflows).
- Update `AGENTS.md`: drop the "future Android application" API-consumption statement and the `apps/android` monorepo-layout entry.
- Retire the `android-ui`, `android-platform`, and `android-data` capability specs — every requirement describes the removed Expo application.
- Already removed in the working tree (verified, no further edits needed): `apps/android/` (all files), `.agents/skills/vercel-react-native-skills/`, root `eas.json`, and the `vercel-react-native-skills` entry in `skills-lock.json`.

## Capabilities

### New Capabilities

<!-- none — this change removes a client, it does not introduce behavior -->

### Modified Capabilities

- `android-ui`: retire the capability — all 17 requirements (boxy theme, shell, accounts, categories, dashboard, activity/transactions/transfers screens, native select menus) are removed together with the application.
- `android-platform`: retire the capability — all 9 requirements (Expo workspace, sign-in, cookie session handling, secure storage, refresh, sign-out, API base URL) are removed together with the application.
- `android-data`: retire the capability — all 7 requirements (query client, service layer, query hooks, mutation invalidation, Zod-validated forms, toasts, session-refresh participation) are removed together with the application.

The change's `.openspec.yaml` declares `retire_capabilities: true` so the REMOVED-only deltas delete the three capability specs at sync/archive time.

## Impact

- **Code** — `packages/api-client/src/client.ts`, `packages/api-client/src/auth.ts`, `packages/api-client/tests/api-client.test.ts`. A straight revert to the `813023c` state is safe: `git log 813023c..HEAD` shows only the RN commit `86a7805` touched these files, and no web/server code consumes `ApiFetchOptions` or `onResponse` (verified by search).
- **Config** — `biome.json` (one ignore entry).
- **Dependencies** — `pnpm-lock.yaml` regenerated via `pnpm install`; no other dependency manifests change.
- **Docs** — `AGENTS.md` (two android references) and `user-story/01-inital/main.md` (line 7 roadmap sentence promising a future Expo React Native app, updated per user decision during apply).
- **Specs** — `openspec/specs/android-ui/`, `openspec/specs/android-platform/`, `openspec/specs/android-data/` are deleted when this change's deltas are synced/archived. Archived android change history under `openspec/changes/archive/` is untouched.
- **Unaffected** — `server/`, `db/`, `apps/web/`, CI workflows, `turbo.json`, `pnpm-workspace.yaml`; no RN-era commit touched them and the reverted client surface keeps `baseUrl`, which is the only option the web app uses.
- **Git handling** — branching, committing, and PR are performed by the user; this change scopes only the working-tree edits and verification.
