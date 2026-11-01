# Design

## Context

Account management is complete and established the repo's layering pattern: `packages/schemas` (plain Zod) → `server/api/src/schemas` (OpenAPI metadata wrappers) → `routes` (`@hono/zod-openapi`) → `services` (rules) → `repositories` (Drizzle), with an error envelope and `ErrorCode` union in `src/lib/error.ts`, `requireAuth` middleware, and a full test matrix (unit + `@cloudflare/vitest-plugin` workers tests against local D1). See proposal.md for motivation.

This change precedes transactions: no `transactions` table exists yet, so "referenced by a transaction" cannot be observed at runtime. The account service already set the precedent of installing rule code with a documented seam (`hasPostedTransactions` stub returning `false`).

## Goals / Non-Goals

**Goals:**
- Categories CRUD + lifecycle with the same behavioral guarantees as accounts (uniqueness, state machine, no-cascade history preservation).
- Contracts ready for the transactions epic to consume (compatible-type selection, referencing-count seam, `ErrorCode` values).
- Zero behavior change for existing endpoints.

**Non-Goals:**
- Category usage counts or report figures (reporting epic).
- Transaction tables, migrations touching existing tables, or per-transaction category snapshots.
- Seeded/default category lists, nested/sub-categories, multi-user sharing.

## Decisions

- **Cross-type, case-insensitive uniqueness among non-deleted categories.** Category pickers and future category breakdowns show both types side by side, so duplicate names across types would be ambiguous. Alternative considered: per-type uniqueness (more flexible, but forces type labels everywhere and complicates conflict copy). Enforced at the DB level with a partial unique index `(user_id, name_normalized) WHERE status != 'deleted'` — the exact mechanism the accounts table already uses, so deleted names are automatically reusable.
- **`name_normalized` mirror column** written from a single normalization function. Extract that function into `src/lib/name-normalization.ts` and refactor the account repository to use it — one behavior-preserving change, removing duplication before a second consumer appears.
- **Presentation as nullable `color` and `icon` text columns on `categories`.** Color is stored as a validated `#RRGGBB` string; icon as a Lucide icon name string (bounded length). No lookup table, no JSON blob — two simple columns are queryable and trivially validated. Alternative (JSON presentation column) rejected: weaker typing for no benefit at this scale.
- **Type-lock guard with a referencing-count seam.** `category-service` implements `changeType` rejecting when `getReferencingTransactionCount(categoryId) > 0` (error code `CATEGORY_TYPE_LOCKED`); the repository seam returns 0 and carries a doc comment naming the transactions epic as its implementer — same pattern as `hasPostedTransactions`. The requirement is testable now via the unused-type path; the referenced-type path is exercised once transactions land.
- **References by id, no historical snapshot.** Future transactions will FK to `categories.id`; renaming a category propagates to historical displays because the reference resolves to the same row. This satisfies "historical references continue to resolve" without denormalizing names onto every transaction. Alternative (name snapshot column on transactions) rejected for MVP simplicity; revisitable if product later wants point-in-time labels.
- **REST shape mirrors accounts**: `POST /api/categories`, `GET /api/categories?status=`, `GET /api/categories/:id`, `PATCH /api/categories/:id`, `POST /api/categories/:id/archive|delete|restore` (restore takes optional `{ newName }`). Same error envelope and status-code conventions (400 validation, 404 unknown id, 409 conflict/transition), so clients get one consistent idiom.
- **Lifecycle transition table reused as-is**: `active→archived`, `active→deleted`, `archived→active`, `deleted→active`, everything else `CATEGORY_TRANSITION_INVALID`.

## Risks / Trade-offs

- [Partial unique index may not survive drizzle-kit generation verbatim] → Generate the migration, inspect the SQL for the `WHERE status != 'deleted'` clause, and hand-add the statement if missing (the accounts migration documented this exact pitfall); verify via `sqlite_master`.
- [Cross-type uniqueness may feel restrictive] → Documented explicitly in the spec scenarios; loosening later is a data-safe migration (index change only).
- [Type-lock seam means the conflict path ships untestable end-to-end until transactions exist] → Unit-test the guard function with injected counts (0 and >0) so only the wiring, not the logic, waits for the transactions epic.
- [Normalization refactor touches the accounts path] → Keep it to extracting one pure function; the existing account test suite must pass unchanged.
