# Design

## Context

`main` currently contains the RN-era commits (`86a7805` → `85ce439`, all merged). The working tree already holds the bulk of the removal as uncommitted deletions (`apps/android/`, `.agents/skills/vercel-react-native-skills/`, root `eas.json`) plus a hand-applied `skills-lock.json` cleanup. Verified facts that shape the approach:

- `git log 813023c..HEAD -- <the four shared files>` shows exactly one commit (`86a7805`) touched `packages/api-client/src/{client,auth}.ts`, `packages/api-client/tests/api-client.test.ts`, and `biome.json` — so restoring their `813023c` state loses no other work.
- A repo-wide search finds no consumers of `ApiFetchOptions` or `onResponse` outside `packages/api-client` itself.
- The RN commits never touched `pnpm-workspace.yaml`, root `package.json`, `turbo.json`, or `.github/` — all Expo dependencies live under the deleted `apps/android` importer in `pnpm-lock.yaml`.
- See proposal.md — Why for motivation.

## Goals / Non-Goals

**Goals:**

- Restore `packages/api-client` to its pre-mobile public surface (`baseUrl`-only options) with its tests matching.
- Leave the repo with zero Expo/React Native traces in code, config, dependencies, and docs.
- Retire the three android capability specs so `openspec/specs/` describes only software that exists.

**Non-Goals:**

- No server, database, web app, or API behavior changes.
- No history rewrites: archived android changes under `openspec/changes/archive/` stay as-is.
- No git operations (branch/commit/PR) — the user performs those; this change scopes working-tree edits and verification only.
- No replacement mobile strategy — any future mobile client is a new change with new specs.

## Decisions

- **Revert api-client files to the exact `813023c` state** (via `git checkout 813023c -- <paths>` or equivalent manual restoration) rather than keeping `ApiFetchOptions` as a generic-client feature. Rationale: the `onResponse`/`headers` surface was added solely for the mobile client's manual cookie handling, has no remaining consumers, and dead generality in a security-sensitive package (cookies/tokens) is worse than none. Alternative considered — keep the hook for future clients — rejected: reintroduce it deliberately when a client actually needs it.
- **Regenerate `pnpm-lock.yaml` with `pnpm install`** rather than hand-editing it. Rationale: AGENTS.md forbids manually writing the lockfile; `pnpm install` prunes the deleted `apps/android` importer and all Expo/RN packages deterministically from the remaining workspace manifests.
- **Retire specs via REMOVED-only deltas plus `retire_capabilities: true`** in this change's `.openspec.yaml`. Rationale: the OpenSpec archive workflow deletes a capability's main spec only when a REMOVED-only delta is marked as a retirement; unmarked REMOVED-only deltas are refused. Each removed requirement carries a Reason (app deleted) and Migration (where the surviving behavior lives — `user-auth`, `web-ui`, `reporting`, `accounts`, `categories`, `transactions`, `transfers`, `api-platform`).
- **Minimal `AGENTS.md` edits**: drop the "future Android application" clause from the one-authoritative-API rule and the `apps/android` line from the layout sketch; leave the rest of the document untouched.
- **Verify-only treatment for already-deleted files**: `apps/android/`, the RN skill directory, `eas.json`, and the `skills-lock.json` entry are confirmed absent and never re-created by this change.

## Risks / Trade-offs

- [A hidden compile-time consumer of the widened options exists] → Mitigation: repo-wide search already came back clean; `turbo run typecheck lint test` after the revert is the gate that catches any miss before the work is committed.
- [`pnpm install` pulls unrelated lockfile drift] → Mitigation: run it with no other manifest changes pending; review the lockfile diff expecting only `apps/android` and Expo/RN removals.
- [Lockfile loses a package the web app still needs] → Mitigation: `apps/web` and `server` manifests are untouched; a successful full install plus build proves the graph is intact.
- [Spec retirement makes archived change history reference non-existent specs] → Accepted: archives are historical records; `openspec` treats archived changes as completed history, and the archived deltas remain self-contained.
- [The user commits on `main` directly without a branch] → Accepted: the user owns git handling; the working-tree edits are branch-agnostic.

## Migration Plan

1. Apply the file reverts, config/doc edits, and lockfile regeneration (tasks.md).
2. Verify with typecheck, lint, tests, and a production build; confirm `git status` shows no remaining `apps/android` or Expo references outside `openspec/changes/archive/`.
3. The user commits/merges. At archive time, syncing this change's deltas deletes the three android main specs (`retire_capabilities: true`).
4. Rollback: `git checkout -- <paths>` / `git revert` restores RN code; the three main specs are restorable from the archived android change deltas if the mobile client ever returns.

## Open Questions

None — scope was clarified with the user (specs removed, AGENTS.md updated, git handled by the user).
