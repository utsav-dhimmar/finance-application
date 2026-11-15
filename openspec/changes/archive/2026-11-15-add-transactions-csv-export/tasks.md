# Tasks

## 1. Shared schemas and API client

- [x] 1.1 Add `exportTransactionsQuerySchema` (list filters minus `page`/`pageSize`, plus optional `cursor` as UUIDv7 and `limit` coerced int 100–2000 default 1000), `exportTransactionRowSchema` (id, date, createdAt, type, amountMinor, notes, status, accountName, categoryName), and `exportTransactionsResponseSchema` (`transactions` array + `nextCursor: string | null`) to `packages/schemas/src/transactions.ts` with inferred types, and export them from the package index. Verify: new cases in `packages/schemas/tests/transactions.test.ts` covering limit bounds (99 rejected, 2001 rejected, 1000 default), cursor format rejection, and response shape parse.
- [x] 1.2 Add `fetchTransactionsExportChunk(query, options)` to `packages/api-client/src/transactions.ts` (URLSearchParams building matching the schema, GET `/api/transactions/export`) and extend `ApiClientOptions` with `signal?: AbortSignal` forwarded through `apiFetch`. Verify: new cases in `packages/api-client/tests/transactions.test.ts` (mocked fetch) for query-string building, abort signal forwarding, and `ApiError` propagation on non-2xx.

## 2. API keyset repository query

- [x] 2.1 Add `listForExport(userId, filters, limit, cursor?)` to `server/api/src/repositories/transaction-repository.ts`: reuse `buildFilterConditions`, add the `(date, createdAt, id)` tuple condition after resolving the cursor row via a user-scoped PK lookup, select only the export columns (left joins for names), order `date DESC, createdAt DESC, id DESC`, no count query. Verify: new test in `server/api/tests/repositories/` (workers pool) seeding tied dates/createdAt proving a full keyset walk returns every row exactly once in order and stops cleanly.

## 3. Export API route

- [x] 3.1 Register `GET /api/transactions/export` in `server/api/src/routes/transactions.ts` with `@hono/zod-openapi` `createRoute` (query: export schema; responses: 200 envelope, 400 validation, 401, 404 unknown cursor), behind the existing `requireAuth` middleware, handler passing repository rows straight to `c.json(...)` with `nextCursor` = last row id when the chunk is full else `null`. Verify: new tests in `server/api/tests/transactions/` (workers pool) covering unauthenticated 401, invalid limit/cursor-format 400 naming the field, unknown/not-owned cursor 404, filters matching the list endpoint's results for the same filters, user scoping, slim row shape, and full-walk exhaustion (`nextCursor` null on the final empty chunk).
- [x] 3.2 Assert the new route appears in the OpenAPI document with its query parameters. Verify: extend the existing docs test (`server/api/tests` docs suite) to include `/api/transactions/export`.

## 4. Web CSV serializer and download trigger

- [x] 4.1 Implement `apps/web/src/lib/csv.ts`: `escapeCsvField` (quote fields containing comma, double quote, newline, or carriage return; double internal quotes; null/undefined → `""`), `toCsv(headers, rows)` producing the full file content prefixed with `\uFEFF` and a human-readable header row. Verify: new unit test `apps/web/tests/lib/csv.test.ts` covering each escaping rule, empty-value handling, BOM prefix, and header rendering.
- [x] 4.2 Implement the field mapping (transaction row → CSV row: `date`→Date, `notes`→Description, `categoryName`→Category, `accountName`→Account, `type`→Type, `amountMinor`→Amount via the existing integer-only `paiseToRupeeInput`, currency code→Currency, `status`→Status) and `triggerCsvDownload(csv, filename)` (Blob `text/csv;charset=utf-8;`, object URL, temporary `<a download>` click, `URL.revokeObjectURL`). Verify: unit tests `apps/web/tests/lib/csv-export.test.ts` with a mocked `URL.createObjectURL`/`revokeObjectURL` asserting filename `transactions-YYYY-MM-DD.csv`, MIME type, click, and revoke; amount cases 125050→"1250.50" and 5→"0.05".

## 5. Web export orchestration and hook

- [x] 5.1 Implement `exportTransactionsToCsv` in `apps/web/src/lib/csv-export.ts`: sequential chunk loop accumulating rows until `nextCursor` is exhausted, `onProgress(fetchedRows)` after each chunk, `AbortSignal` support (abort surfaces as a distinct cancellation outcome, no download), descriptive thrown errors carrying status/code/message from `ApiError`, and empty-first-chunk reported without downloading. Verify: unit tests with a mocked chunk fetcher covering multi-chunk accumulation order, progress callbacks, abort mid-loop, chunk failure stopping with the server's error message, and the empty case.
- [x] 5.2 Implement `apps/web/src/hooks/use-transaction-export.ts`: `idle | exporting | done` state machine holding the `AbortController` in a ref, `startExport(filterSnapshot, currency)` freezing the filter snapshot at call time, `cancel()`, and sonner toasts — "No transactions to export" (info, no download) on empty, "Export cancelled" on user abort, descriptive error toast on failure. Verify: hook tests with Testing Library + mocked module covering each transition and toast, and that no download is triggered in empty/cancel/error paths.

## 6. Transactions page UI

- [x] 6.1 Add the "Export CSV" button to the transactions page header actions in `apps/web/src/routes/transactions.tsx`: idle label, disabled with "Exporting… (N rows)" progress text plus a paired "Cancel" button while exporting, wired to the hook with the page's current filter state and the preferences currency code; export invoked only from the click handler (never in a loader/beforeLoad). Verify: extend `apps/web/tests/routes/transactions.test.tsx` (mocked api-client) for button presence, transition to exporting with progress text, cancel affordance, and toast on empty result.
- [x] 6.2 Verify the end-to-end download in a real browser against the dev server: start `pnpm dev`, log in, export a filtered set, confirm the file `transactions-YYYY-MM-DD.csv` downloads, opens in Excel/Google Sheets with correct header, order, amount formatting, and ₹/special-character rendering. Record the result.

## 7. Final verification

- [x] 7.1 Run the repo's typecheck, lint, and full Vitest suites (API node + workers pools, packages, web) and the production build; fix any fallout. Verify: all commands exit 0 with output recorded.
- [x] 7.2 Review the change against the `transaction-export` delta spec scenario-by-scenario (auth, filters, keyset walk, raw fields, browser assembly, empty, CSV format/escaping/filename) and confirm every scenario has a passing automated test or the recorded manual check from 6.2.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied (openspec archive).
- Verify the archived result.
