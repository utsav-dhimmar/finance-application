# transaction-export Specification

## Purpose

Lets a single user take their transaction history out of the application as a CSV file that spreadsheets open correctly, by fetching keyset-paginated raw rows from the API and assembling the file in the browser so the Worker stays within its CPU-time budget.

## Requirements

### Requirement: Authenticated and user-scoped export

The export endpoint SHALL require authentication and SHALL return only transactions owned by the authenticated user.

#### Scenario: Unauthenticated access rejected

- **WHEN** the export endpoint is called without a valid session
- **THEN** the response is an authentication error and no transaction data is returned

#### Scenario: Only owned transactions are exported

- **WHEN** the authenticated user requests an export chunk
- **THEN** only transactions owned by that user are returned

### Requirement: Export honors transaction list filters

The export endpoint SHALL accept the same filters as the transaction list — lifecycle status, transaction type, account, category, date range, and case-insensitive search across notes and related category and account names — and SHALL return only the matching transactions. Invalid filter values SHALL be rejected with a validation error naming the field.

#### Scenario: Filtered export matches the filtered list

- **WHEN** the user exports while a date range, type, account, or category filter is active
- **THEN** the exported rows are exactly the transactions that match all active filters

#### Scenario: Invalid filter rejected

- **WHEN** the export request carries a filter value that fails validation
- **THEN** the response is a validation error naming the field and no rows are returned

### Requirement: Keyset-paginated export

The export endpoint SHALL paginate responses by a `cursor` holding the id of the last row of the previous chunk. Rows SHALL be ordered by transaction date descending, then creation timestamp descending, then id, so that walking every chunk yields each matching transaction exactly once in that order. Each response SHALL contain at most `limit` rows and the cursor to resume from, which SHALL indicate exhaustion when no further rows remain; an absent cursor SHALL start a new export.

#### Scenario: Full walk yields every row exactly once in order

- **WHEN** the client repeatedly requests chunks, feeding back each returned cursor until exhaustion
- **THEN** the accumulated rows contain every matching transaction exactly once, ordered newest transaction date first

#### Scenario: Tied rows are stable across chunks

- **WHEN** multiple transactions share the same transaction date and creation timestamp
- **THEN** each appears exactly once across the chunk boundary

#### Scenario: Exhausted export has no resume cursor

- **WHEN** a chunk returns the final rows of the export
- **THEN** the response's resume cursor indicates exhaustion and the client stops fetching

### Requirement: Export chunk bounds and cursor validation

The export endpoint SHALL cap the chunk size with a `limit` parameter (an integer between 100 and 2000, defaulting to 1000) and SHALL reject out-of-bounds values with a validation error naming the field. A cursor that does not identify one of the user's transactions SHALL be rejected with a not-found error.

#### Scenario: Chunk size is bounded

- **WHEN** the client requests a limit below 100 or above 2000
- **THEN** the response is a validation error naming the field

#### Scenario: Unknown cursor rejected

- **WHEN** the client presents a cursor id that does not identify one of the user's transactions
- **THEN** the response is a not-found error and no rows are returned

### Requirement: Export response carries raw export fields

Each exported row SHALL include the transaction id, transaction date, creation timestamp, type, amount as an integer number of paise, lifecycle status, notes (empty when absent), the account name, and the category name. The endpoint SHALL NOT perform currency formatting or CSV serialization; it returns raw row data for the client to format.

#### Scenario: Row fields are export-ready raw values

- **WHEN** an export chunk is returned
- **THEN** every row includes id, date, creation timestamp, type, amount in paise, status, notes, account name, and category name

### Requirement: Client assembles the export in the browser

The web app SHALL fetch export chunks through the export endpoint, accumulate the rows, and show live progress including the number of rows fetched so far while exporting. The export SHALL run only in response to an explicit user action. The user SHALL be able to cancel an in-progress export, which stops fetching and produces no file. If any chunk request fails, the export SHALL stop and surface a descriptive error message, and no file SHALL be produced.

#### Scenario: Progress is visible while exporting

- **WHEN** the user starts an export and chunks are being fetched
- **THEN** the UI shows that an export is in progress along with the rows fetched so far

#### Scenario: Cancel aborts without a file

- **WHEN** the user cancels an in-progress export
- **THEN** fetching stops, a cancellation message is shown, and no file is downloaded

#### Scenario: Failed chunk stops the export

- **WHEN** a chunk request returns an error status
- **THEN** an error message describing the failure is shown and no file is downloaded

#### Scenario: Export runs only on user action

- **WHEN** the transactions page is loaded or prerendered
- **THEN** no export request is made until the user triggers the export

### Requirement: Empty export produces no file

When the filtered export contains zero transactions, the web app SHALL show a "no transactions to export" notice and SHALL NOT download a file.

#### Scenario: Empty result

- **WHEN** the user starts an export and the first chunk contains zero rows
- **THEN** a "no transactions to export" notice is shown and no file is downloaded

### Requirement: CSV header and row layout

The downloaded file SHALL begin with a header row — Date, Description, Category, Account, Type, Amount, Currency, Status — followed by one row per transaction in the export ordering, newest transaction date first. Description SHALL be the transaction's notes (empty when absent), Account SHALL be the account name, Category SHALL be the category name, Type SHALL be the transaction type, and Status SHALL be the lifecycle status.

#### Scenario: Header and columns

- **WHEN** the CSV file is opened
- **THEN** its first line is the header row and each subsequent row carries date, notes, category, account, type, amount, currency, and status of one transaction

#### Scenario: Rows ordered like the on-screen list

- **WHEN** the CSV is compared with the filtered transaction list
- **THEN** rows appear in the same newest-first order

#### Scenario: Absent notes render empty

- **WHEN** a transaction has no notes
- **THEN** its Description cell is empty

### Requirement: Amount and currency formatting in CSV

Amount SHALL be rendered as a decimal major-unit string derived from the integer paise value (for example 125050 becomes "1250.50"), positive for both income and expense rows with the Type column distinguishing them, without currency symbols or scientific notation. Currency SHALL be the user's currency preference.

#### Scenario: Amount formatting from paise

- **WHEN** a transaction has amount 125050 paise
- **THEN** its Amount cell reads "1250.50" with no currency symbol and no scientific notation

#### Scenario: Currency column reflects the user's preference

- **WHEN** the user's currency preference is INR
- **THEN** every row's Currency cell reads "INR"

### Requirement: RFC 4180 escaping and encoding

The CSV serializer SHALL quote any field containing a comma, double quote, or newline, doubling internal double quotes, and SHALL render null or absent fields as empty values. The file SHALL be encoded as UTF-8 with a leading UTF-8 BOM so spreadsheet applications render non-ASCII characters such as the rupee sign correctly. The downloaded file SHALL be named `transactions-YYYY-MM-DD.csv` using the local export date.

#### Scenario: Field with special characters is quoted

- **WHEN** a note contains a comma, double quote, or newline
- **THEN** that field is wrapped in double quotes with internal quotes doubled, and spreadsheet applications parse it as a single field

#### Scenario: Non-ASCII characters survive in spreadsheets

- **WHEN** a field contains a character outside ASCII, such as ₹
- **THEN** the file's UTF-8 BOM makes Excel and Google Sheets render it without encoding corruption

#### Scenario: Filename carries the export date

- **WHEN** the user exports on 2026-11-15
- **THEN** the downloaded file is named transactions-2026-11-15.csv
