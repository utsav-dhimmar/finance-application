# Design: add-transactions-csv-export

## Context

The Worker runs on the Cloudflare Free plan (10 ms CPU limit per request), so the server must only emit raw JSON chunks; all CSV assembly happens in the browser. The existing transaction list (`GET /api/transactions`) is offset-paginated with a `COUNT(*)` companion query and orders rows `date DESC, createdAt DESC, id DESC` (see `server/api/src/repositories/transaction-repository.ts:152-183`, `buildFilterConditions` at L73-113). Transaction ids are client-generated UUIDv7 strings. The web app renders the transactions page from the `/api/activity` feed, but export targets the `transactions` table (transfers live in a separate table and are excluded). No export/download code exists anywhere in `apps/web` or `packages` today.

See proposal.md for motivation and the `transaction-export` delta spec for the behavior contract.

## Goals / Non-Goals

**Goals:**

- Keyset pagination that never repeats or drops a row across chunk boundaries, reusing the list endpoint's filter and ordering semantics.
- Keep per-request Worker CPU trivially small: slim column select, no transforms, no count query, bounded chunk size.
- A pure, unit-testable CSV serializer and an export flow that only ever runs from a user event handler.
- UI states (idle / exporting with progress / cancel / empty / error) that match the delta spec.

**Non-Goals:**

- Server-side rate limiting (decided out of scope; none exists on data endpoints).
- Streaming/chunked transfer encodings, workers-flavored CSV streaming, or queue-based exports.
- Transfers, recurring rules, accounts, or categories in the CSV; CSV import; XLSX/PDF formats.
- Changing the existing offset-paginated list endpoint.

## Decisions

### D1: Cursor = last row's UUID; server resolves the sort key tuple

`cursor` is the id (UUIDv7 string) of the last row of the previous chunk. The server does one indexed PK lookup scoped to the user (`WHERE id = ? AND userId = ?`) to recover that row's `(date, createdAt, id)`, then applies the tuple condition:

```
...filters AND (
  date < :d OR (date = :d AND (
    createdAt < :c OR (createdAt = :c AND id < :i)
  ))
)
ORDER BY date DESC, createdAt DESC, id DESC
LIMIT :limit
```

- Why not `ORDER BY id DESC` with `id < cursor`? UUIDv7 sorts by creation time, not transaction date; the CSV would not match the on-screen order the user chose to keep (grill decision).
- Why not an opaque base64 `(date, createdAt, id)` cursor? It breaks the agreed "cursor = id of last record" contract and complicates the client for negligible gain; one PK lookup per chunk is far under the CPU budget.
- Unknown or not-owned cursor → `404` with the standard error envelope, code `NOT_FOUND` (e.g. the cursor row was permanently deleted mid-export; the user re-runs the export).

**Exhaustion protocol:** when a chunk returns fewer rows than `limit`, `nextCursor` is `null` and the client stops. When the chunk is full, `nextCursor` is the last row's id. A full-history export therefore ends with one final request returning 0 rows — accepted as the price of a trivially simple, always-correct termination check (no `LIMIT + 1` read, no count query).

### D2: Reuse the list filter machinery; one shared query schema

`exportTransactionsQuerySchema` in `packages/schemas/src/transactions.ts` composes the existing `listTransactionsQuerySchema` (omit `page`/`pageSize`) plus:

- `cursor`: `transactionIdSchema.optional()` (validates UUIDv7 format; existence is checked by the lookup).
- `limit`: `z.coerce.number().int().min(100).max(2000).default(1000)` (coerced like the list's query params, which arrive as strings).

The repository gets a `listForExport(userId, filters, limit, cursor?)` method that reuses `buildFilterConditions` unchanged and adds the D1 tuple condition. This keeps filter behavior (status default `active`, escaped literal `%`/`_` search, historical references resolvable) byte-identical between list and export, satisfying the "export matches the filtered list" scenario without new logic to test separately.

### D3: Response envelope and slim row

```jsonc
// GET /api/transactions/export?cursor=…&limit=1000
{
  "transactions": [
    {
      "id": "…", "date": "2026-11-01", "createdAt": "2026-11-01T10:00:00.000Z",
      "type": "expense", "amountMinor": 125050, "notes": "Groceries",
      "status": "active", "accountName": "HDFC Main", "categoryName": "Food"
    }
  ],
  "nextCursor": "…|null"
}
```

A dedicated `exportTransactionRowSchema` (not the existing `transactionResponseSchema`, which carries `accountId`/`categoryId`/lifecycle timestamps the CSV never uses). The route is defined with `@hono/zod-openapi` `createRoute` like its siblings, so `/api/openapi` and the existing `no-store` middleware cover it automatically. The handler passes the repository rows straight to `c.json(...)` — no mapping — per the story's CPU constraint.

### D4: Client module boundaries (transport vs. browser-only orchestration)

- `packages/api-client` — add `fetchTransactionsExportChunk(query, options)` to `src/transactions.ts` reusing `apiFetch`/`ApiError`. Extend `ApiClientOptions` with `signal?: AbortSignal` (backward compatible; `apiFetch` already forwards `RequestInit`), so the loop can abort in-flight chunks.
- `apps/web/src/lib/csv.ts` — pure serializer: `escapeCsvField` (RFC 4180: quote fields containing `,` `"` `\n` `\r`, double internal quotes; null/undefined → `""`), `toCsv(headers, rows)` returning the full string prefixed with `\uFEFF`. No DOM usage → unit-testable in any environment.
- `apps/web/src/lib/csv-export.ts` — browser-only orchestration: `exportTransactionsToCsv({ filters, currency, signal, onProgress })` runs the fetch loop, throws descriptive errors (message from `ApiError`, including status/code), serializes on completion, and calls the download trigger. Also exports `triggerCsvDownload(csv, filename)` (Blob + `URL.createObjectURL` + temporary `<a download>` click + `URL.revokeObjectURL`). It must only be imported/called from event handlers, never from route loaders/beforeLoad, so it can never execute during prerendering.
- `apps/web/src/hooks/use-transaction-export.ts` — React state machine `idle | exporting | success`, holding the `AbortController` in a ref, exposing `startExport(filters)` / `cancel()`, and firing sonner toasts: `toast.error` on failure/abort-with-error, `toast.info` ("Export cancelled") on user cancel, `toast.info` ("No transactions to export") on an empty first chunk (no download).
- Amount cell: reuse the existing `paiseToRupeeInput` from `apps/web/src/lib/money.ts` (pure integer trunc/modulo, no float math — e.g. 125050 → "1250.50"). Currency column value comes from the user's preferences (`use-preferences` → `currencyCode`, currently always `INR`), passed into the export call.

### D5: Filter snapshot frozen at click time

`startExport` captures the page's current filter state (status tab, type, account, category, from/to, search) into the loop's closure. If the user changes filters while an export runs, the running export continues with the captured snapshot, so a mid-export filter change cannot silently skip or duplicate rows. The button is disabled while exporting, and the visible filter controls remain usable for browsing.

### D6: UI placement and states

An "Export CSV" button in the transactions page header/toolbar next to the existing filter actions, using the shadcn `Button` (boxy style is the project default). States per spec: idle "Export CSV"; exporting shows disabled "Exporting… (N rows)" with a paired "Cancel" button wired to the `AbortController`; progress text updates per chunk via `onProgress`. The export date in `transactions-YYYY-MM-DD.csv` is the local date at completion (`new Date()` formatted `YYYY-MM-DD` locally, not UTC, so the filename matches the user's calendar day).

## Risks / Trade-offs

- [Full history accumulated in browser memory] → Personal-finance scale makes this tens of MB worst case; chunks are bounded (≤2000 rows). If it ever matters, the serializer can be revisited to stream per-chunk — out of scope now.
- [Cursor row permanently deleted mid-export → 404 aborts the export] → Accepted; the user re-runs the export. Permanent deletion of a row you are concurrently exporting is a rare, user-initiated edge case; silently skipping would violate "every row exactly once".
- [Sort performance on large histories] → The keyset query rides the existing `(userId, status, date)` index for filtering/ordering; `createdAt`/`id` tiebreakers only sort within equal dates. No new index is added unless profiling says otherwise.
- [Filter drift between list and export] → Mitigated structurally: both call the same `buildFilterConditions` and the same shared schema, so a future filter change to one silently surfaces in export tests.
- [Currency column vs. per-row currency] → Currency is user-level (`userPreferences.currencyCode`, only `INR` supported today); the client stamps the preference value on every row rather than the API adding a redundant field per row.

## Migration Plan

Purely additive: new route, new repository method, new schemas, new client modules, one button. No database migration, no new bindings, no infrastructure change; the same Worker serves both. Deploy web + API together from the same commit. Rollback = revert the commit; the endpoint disappears with no residual state.

## Open Questions

None.
