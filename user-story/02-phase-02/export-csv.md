# Client-Side Paginated CSV Export

- Hard Constraint: Cloudflare Workers Free Plan enforces a 10ms CPU time limit per HTTP request.

- Architectural Decision: The Worker must not perform string serialization, CSV formatting, or full-table queries. Instead, the Worker will expose a lightweight, keyset-paginated JSON endpoint, and the TanStack Start SPA client will fetch chunks sequentially, serialize the CSV in browser memory, and trigger a local file download.

## API Endpoint Contract

- Method & Path: GET /api/transactions/export
- Authentication: Apply the existing auth middleware used by other protected routes.
- Query Parameters (fully validate with Zod validator):
  - cursor (optional, positive integer): The id of the last record received from the previous page. Defaults to 0 (or undefined for the first page).
  - limit (optional, integer, min 100, max 2000, default 1000): Number of rows per chunk.

## Query

- Select only the columns required for the CSV export (avoid SELECT * if large metadata/blob columns exist).
- Order strictly by new record first
- Apply `.limit(limit)`.
- Do not transform, format dates, or map strings inside the Hono handler. Return the raw Drizzle result objects directly via c.json(...) to keep Worker CPU time under 5ms per call.

## Client-Side Export Utility

- Create a pureclient-side utility module (must only execute in browser event handlers, never in route loaders that might execute during build prerendering):

1. Paginated Fetch Loop
   - keep fetching row until cursor exhasuted and append those data into array that we will export as csv
   - Throws a descriptive error if any chunk request fails (non-2xx status).
   - Handle Rate limit gracefully
2. RFC 4180 Compliant CSV Serializer
   - Accepts the accumulated array of transaction objects and an explicit column-header mapping (so CSV headers are human-readable, e.g., Date,Description,Category,Type,Amount).
   - Escapes every field safely:
     - Convert null / undefined to "".
     - Wrap fields containing commas (,), double quotes ("), or newlines (\n, \r) in double quotes, escaping internal quotes as "".
     - Prepend UTF-8 BOM (\uFEFF) so Excel and Google Sheets render currency symbols (e.g., ₹, $, €) without encoding corruption.
3. Browser Download Trigger (triggerCsvDownload):
   - Create a Blob([csvContent], { type: "text/csv;charset=utf-8;" }).
   - Create an object URL via URL.createObjectURL(blob), programmatically click a temporary <a> element with download="transactions-YYYY-MM-DD.csv", and immediately call URL.revokeObjectURL(url) to free memory.

## UI Component Requirements

- Add an "Export CSV" button in the transactions
- UI States:
  - Idle: Displays "Export CSV".
  - Exporting: Disabled button (or paired with a "Cancel" button using AbortController) showing live progress text: e.g., "Exporting... (3,000 rows)".
  - Empty Data: If 0 rows are returned, show a toast/notification ("No transactions to export") and do not download an empty file.
  - Error: Display an error toast/message if a request fails or is aborted.
