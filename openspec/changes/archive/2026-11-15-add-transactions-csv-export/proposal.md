# Proposal: add-transactions-csv-export

## Why

Users need to take their transaction history out of the app for tax preparation, accounting tools, and personal backups, and no export path exists today (CSV export was explicitly deferred when dashboard reporting shipped). The Cloudflare Workers Free plan enforces a 10 ms CPU time limit per request, so server-side CSV serialization of a full history is not safe; the export must be assembled in the browser from a lightweight paginated JSON endpoint.

## What Changes

- Add `GET /api/transactions/export`: an authenticated, keyset-paginated JSON endpoint that streams one chunk of raw transaction rows per request.
  - Cursor-based pagination: `cursor` is the id (UUIDv7 string) of the last row received; rows are ordered `date DESC, createdAt DESC, id DESC` — the same deterministic ordering as the transaction list.
  - Honors the same filters as the transaction list (status, type, account, category, date range, search text), so the export matches what the user sees.
  - Returns only the columns needed for CSV export (no `SELECT *`), via `c.json(...)` with no server-side formatting, to stay well under the Worker CPU budget.
  - Bounded `limit` (100–2000, default 1000) per chunk.
- Add a browser-only export utility in the web app:
  - Paginated fetch loop that accumulates all chunks until the cursor is exhausted, with live progress and `AbortController` cancellation; descriptive errors on any failed chunk.
  - RFC 4180-compliant CSV serializer (quote escaping, null → `""`, UTF-8 BOM for Excel/Sheets currency rendering) with a human-readable header row; amounts formatted from integer paise to decimal major-unit strings.
  - `triggerCsvDownload` producing `transactions-YYYY-MM-DD.csv` via a Blob object URL.
- Add an "Export CSV" button to the transactions page with idle / exporting (progress text, disabled, cancellable) / empty-data (toast, no download) / error (toast) states.
- Explicitly out of scope: server-side rate limiting (none exists on data endpoints today; none is added), transfers (a transfer's two legs are not transaction rows and are not exported), and import.

## Capabilities

### New Capabilities

- `transaction-export`: Exporting the user's transaction history to a CSV file — the keyset-paginated export endpoint contract and the browser-side fetch/serialize/download flow.

### Modified Capabilities

- None. The export endpoint reuses the transaction list's filter and ordering semantics but introduces no change to any existing requirement.

## Impact

- **`server/api`**: new export route in `src/routes/transactions.ts` (Zod OpenAPI `createRoute`, existing `requireAuth` middleware), a keyset-paginated repository query in `src/repositories/transaction-repository.ts`, export query schema in `src/schemas/transactions.ts`. Route appears in `/api/openapi` automatically; the global `Cache-Control: no-store` middleware already covers it.
- **`packages/schemas`**: new shared export query/response schemas (single source of truth for `cursor`/`limit` validation).
- **`packages/api-client`**: new single-chunk fetcher alongside the existing transaction functions, reusing `apiFetch`/`ApiError`.
- **`apps/web`**: new CSV serializer + export orchestration modules under `src/lib`, a hook wiring progress/abort/error state, and an "Export CSV" button in `src/routes/transactions.tsx` using the existing sonner toasts and shadcn button.
- **Tests**: API tests in the workers pool (`server/api/tests/transactions/`), unit tests for the serializer and export loop in `apps/web/tests`.
- **No database migration, no infrastructure change**: the same Worker serves the SPA and the API; no new bindings.
