# Design

## Context

`apps/web/src/lib/money.ts` already implements exact integer-paise → `₹` formatting (pure integer arithmetic) and its inverse, used everywhere by convention. No preferences storage or API exists. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- A preferences foundation the future Android client inherits through the one API.
- A currency registry that makes adding a future supported currency a data change, not formatter changes.
- Formatting consistency enforced by a single mechanism.

**Non-Goals:**
- Exchange-rate conversion, multi-currency records, additional currencies' actual enablement.
- Non-financial preferences (theme, locale, week start) — deferred until requested.
- Server-side formatting (responses stay raw integer paise; only clients format).

## Decisions

- **Server-side registry as the single currency truth.** A `server/api/src/lib/currency-registry.ts` constant maps code → `{ symbol, minorUnitExponent }` (INR only initially); `packages/schemas` exports the supported-code union so client and server share one list. Alternative (client-side-only constant) rejected: the API must validate and the mobile client must not duplicate the registry (one authoritative API rule).
- **`user_preferences` row per user, lazily defaulted.** `GET /api/preferences` creates the default row if absent (read-repair) so callers never see an empty state; `PATCH` validates via the shared schema and writes. `user_id` is the primary key (one row per user, no id column needed).
- **API returns amounts as raw integer paise plus the resolved currency definition** (`currencyCode`, symbol, exponent) — clients format locally. Server-side formatting rejected deliberately: keeps responses lean and locale decisions with the client, while the registry still constrains symbol/exponent.
- **`formatPaise` becomes `formatMinorUnits(minor, currency)`** with `formatPaise(minor)` kept as a thin INR-defaulted wrapper so the ~dozen existing call sites change nothing initially. Fraction digits derive from the exponent (integer arithmetic preserved — no floats, per AGENTS.md). `paiseToRupeeInput` similarly generalizes to `minorToMajorInput` with an INR wrapper.
- **Preference consumption via a `usePreferences` hook** (TanStack Query, key `["preferences"]`); the Settings page mutates it and invalidates the key. With only INR supported the visible output is unchanged — this change's deliverable is the plumbing, model, and settings surface, which is exactly what US-024's "define the model" and US-025's "persist and default" demand.
- **Settings page** (`/settings`): a card with the currency select (options from the shared supported-code union), pending/disabled states, success/error toasts, and a Settings link in `app-header.tsx`. Form built with react-hook-form + `zodResolver` on `updatePreferencesBodySchema`, matching every other dialog.
- **New error code**: `UNSUPPORTED_CURRENCY` (400-family validation) in the `ErrorCode` union.

## Risks / Trade-offs

- [Preference appears inert while only INR is supported] → Intentional and documented: enabling more currencies without conversion would misdisplay amounts, so the registry gates it; the spec explicitly forbids implying conversion.
- [Lazy row creation on GET] → Idempotent and conflict-safe (insert-or-ignore on the PK); a concurrent double-create is harmless since defaults are identical.
- [Formatting refactor touching every display path] → The wrapper keeps call sites unchanged; the existing money unit tests must pass unmodified, plus new tests for exponent-derived fraction digits.
- [Registry duplication risk between schema package and server] → The server imports the supported-code union from `packages/schemas` and attaches symbol/exponent; codes come from one place, metadata from one place.
