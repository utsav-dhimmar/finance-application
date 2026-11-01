# Proposal

## Why

Epic G of the approved backlog (`user-story/01-inital/06-currency-and-preferences.md`, US-024–US-025) is the final epic of the 01-inital story. INR formatting already exists but is implicit (hardcoded symbol, no configuration surface), and the application has no persisted preference mechanism. This change defines the currency configuration model, persists preferences server-side so the future Android client inherits them, and centralizes display formatting — completing the initial user story.

## What Changes

- **New `user_preferences` table** (D1 + Drizzle migration): one row per user (`user_id` PK/FK), `currency_code` defaulting to `INR`, audit timestamps; created lazily on first read with defaults.
- **Preferences API** (authenticated, OpenAPI-documented): `GET /api/preferences` (defaults if never set) and `PATCH /api/preferences` (validated, unknown fields rejected).
- **Supported-currency configuration model** (confirmed with the product owner):
  - A server-side registry of supported display currencies, each defined by code, display symbol, and minor-unit exponent (INR: `"INR"`, `₹`, exponent 2). Initially only INR is supported.
  - The preference is display-only: changing it never rewrites stored amounts, never performs exchange-rate conversion, and never implies conversion. Multi-currency transactions and conversion remain a separate future feature.
  - Amounts remain integer minor units end to end; the formatter derives the fraction-digit count from the exponent rather than assuming 2.
- **Centralized display formatting**: the existing `formatPaise`/`paiseToRupeeInput` helpers in `apps/web/src/lib/money.ts` become currency-aware via the registry, with the active preference provided through a hook so every form, list, report, and chart formats identically.
- **Web UI** (`apps/web`): a Settings page with the currency display preference (select over supported currencies), persisting via the API, with loading / error / success states and a navigation entry.
- **Explicitly deferred**: additional supported currencies, exchange-rate conversion, multi-currency transaction records, locale/region preferences, theme and other non-financial preferences, and per-record currency overrides.

## Capabilities

### New Capabilities

- `preferences`: Persisted single-user application preferences — the supported-currency configuration model and display-currency setting, kept strictly separate from stored financial records.

### Modified Capabilities

(none — existing pages' behavior is unchanged with INR as the only supported currency; they gain the plumbing, not new visible behavior)

## Impact

- **`server/api`** — new `user_preferences` Drizzle table + migration; new `routes/preferences.ts`, `services/preference-service.ts` (lazy default row, registry validation), `repositories/preference-repository.ts`, `schemas/preferences.ts`, and a supported-currency registry module; new `ErrorCode` value `UNSUPPORTED_CURRENCY`; OpenAPI document extended; unit + workers integration tests.
- **`packages/schemas`** — new `preferences.ts` (supported currency constants, `currencyCodeSchema`, `preferencesResponseSchema`, `updatePreferencesBodySchema`); exported from the package index.
- **`packages/api-client`** — new `src/preferences.ts` typed functions; no new dependencies.
- **`apps/web`** — new `/settings` route with the currency preference form; `src/lib/money.ts` refactored to currency-aware formatting driven by the registry and a `usePreferences` hook; Settings navigation entry.
- **`packages/ui`** — primitives reused; no new dependencies expected anywhere (`pnpm add` for any addition).
- **Database** — one additive migration creating the `user_preferences` table; no changes to existing tables.
