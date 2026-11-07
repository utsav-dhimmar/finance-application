# transactions Specification

## Purpose

Lets a single user record income into and expenses out of their accounts with categories, keeps every account's current balance exactly consistent with its recorded history, and provides filtering, pagination, editing, and the active/archived/deleted lifecycle including restore and explicit permanent deletion.

## Requirements

### Requirement: Create an income transaction

The system SHALL allow an authenticated user to create an income transaction capturing an amount, a transaction date, a destination account, an income category, and optional notes. The destination account SHALL be an active account; the category SHALL be an active income category. A successfully created income transaction SHALL increase the destination account's current balance by the amount and SHALL be included in income reporting once reporting exists.

#### Scenario: Successful income creation
- **WHEN** the user submits a valid positive amount, date, active destination account, and active income category
- **THEN** the transaction is created and the destination account's current balance increases by the amount

#### Scenario: Inactive account rejected
- **WHEN** the user submits an archived or deleted account as the destination
- **THEN** the request is rejected with a conflict error and no transaction is created

#### Scenario: Incompatible category rejected
- **WHEN** the user submits an expense-type category, or an archived or deleted category
- **THEN** the request is rejected with a conflict error and no transaction is created

### Requirement: Create an expense transaction

The system SHALL allow an authenticated user to create an expense transaction capturing an amount, a transaction date, a source account, an expense category, and optional notes. The source account SHALL be an active account; the category SHALL be an active expense category. A successfully created expense transaction SHALL decrease the source account's current balance by the amount. The system SHALL NOT reject a transaction because it would make the account balance negative.

#### Scenario: Successful expense creation
- **WHEN** the user submits a valid positive amount, date, active source account, and active expense category
- **THEN** the transaction is created and the source account's current balance decreases by the amount

#### Scenario: Negative resulting balance allowed
- **WHEN** the expense amount exceeds the source account's current balance
- **THEN** the transaction is created and the account's balance is displayed as negative

### Requirement: Transaction creation is idempotent

The system SHALL accept a client-generated transaction identifier on creation. When a creation request repeats with an identifier that already exists for the user, the system SHALL return the existing transaction without creating a duplicate and without re-applying any balance effect. When a creation request presents an identifier that already exists for a different user, the system SHALL respond `409` with error code `ID_CONFLICT` and create nothing, without disclosing whether the identifier exists. Creation requests SHALL NOT create any record other than the transaction.

#### Scenario: Retry with the same identifier
- **WHEN** the same creation request is submitted twice with the same client-generated identifier
- **THEN** only one transaction exists and both responses describe that same transaction

#### Scenario: Identifier colliding with another user's transaction
- **WHEN** a creation request presents a client-generated identifier that already exists on another user's transaction
- **THEN** the response is `409` with error code `ID_CONFLICT`, no transaction is created, and the response is identical to any other identifier conflict

#### Scenario: No synthetic records
- **WHEN** a transaction is created
- **THEN** no category, account, or other financial record is created as a side effect

### Requirement: Transaction input validation

The system SHALL reject transaction creation or editing when the amount is missing, zero, negative, not a whole number of paise, or exceeds the defined maximum amount; the date is missing or not a valid calendar date; the account or category references are missing or malformed; or notes exceed the defined length limit — without creating or modifying any record.

#### Scenario: Invalid amount rejected
- **WHEN** the amount is zero, negative, fractional in paise, absent, or above the defined maximum
- **THEN** the response is a validation error naming the field and no record changes

#### Scenario: Invalid date rejected
- **WHEN** the date is not a valid calendar date in YYYY-MM-DD form
- **THEN** the response is a validation error naming the field and no record changes

### Requirement: Authenticated and scoped transaction access

All transaction endpoints SHALL require authentication, and each request SHALL only operate on transactions owned by the authenticated user. Unauthenticated requests SHALL be rejected.

#### Scenario: Unauthenticated access rejected
- **WHEN** a transaction endpoint is called without a valid session
- **THEN** the response is an authentication error and no transaction data is returned

#### Scenario: Only owned transactions are visible
- **WHEN** the authenticated user lists or reads transactions
- **THEN** only transactions owned by that user are returned

### Requirement: View transactions

The system SHALL display transactions with date, transaction type, amount, account, category, and notes where available.

#### Scenario: List shows transaction fields
- **WHEN** the user views the transaction list
- **THEN** each row shows its date, type, amount, account, category, and notes where available

### Requirement: Filter and search transactions

The system SHALL support filtering the transaction list by date range, transaction type, account, and category, combined freely, and SHALL support case-insensitive text search across transaction notes and the related category and account names. The characters `%` and `_` SHALL be treated as literal characters in search text, not as wildcards. Filtering by an archived or deleted account or category SHALL still return historical transactions referencing it.

#### Scenario: Filters combine
- **WHEN** the user applies a date range, a type, an account, and a category filter together
- **THEN** only transactions matching all filters are returned

#### Scenario: Search matches textual fields
- **WHEN** the user searches for text appearing in a transaction's notes or its category or account name
- **THEN** the matching transactions are returned case-insensitively

#### Scenario: Wildcard characters are literal
- **WHEN** the user searches for text containing `%` or `_`
- **THEN** only records containing those literal characters match, and the characters do not act as wildcard patterns

#### Scenario: Historical filter by hidden record
- **WHEN** the user filters transactions by an account or category that has since been archived or deleted
- **THEN** historical transactions referencing it are returned

### Requirement: Paginate the transaction list

The system SHALL paginate the filtered transaction list by page and page size, with the page size capped at the defined maximum and the page number capped at the defined maximum. Rows SHALL be ordered by a deterministic key whose final component is unique, so that no row repeats or disappears across page boundaries.

#### Scenario: Pagination
- **WHEN** the user requests a page of the filtered list
- **THEN** the response contains at most the requested page size, the total matching count, and the requested page

#### Scenario: Page number is capped
- **WHEN** the user requests a page number above the defined maximum
- **THEN** the response is a validation error naming the field

#### Scenario: Pagination is stable for tied rows
- **WHEN** multiple transactions share the same date and creation timestamp and the user walks consecutive pages
- **THEN** every row appears exactly once across the pages

### Requirement: Ordinary list excludes lifecycle-hidden records

The ordinary transaction list SHALL include only active transactions by default.

#### Scenario: Ordinary list excludes lifecycle-hidden records
- **WHEN** the user views the ordinary transaction list
- **THEN** archived and deleted transactions are not shown

### Requirement: Edit a transaction

The system SHALL allow an active transaction's amount, date, account, category, and notes to be edited with the same validation as creation. Editing SHALL recompute all affected account balances atomically so each amount affects exactly the correct account exactly once. Archived and deleted transactions SHALL NOT be editable through the ordinary workflow.

#### Scenario: Move a transaction between accounts
- **WHEN** the user changes an active transaction's account from A to B
- **THEN** A's balance no longer reflects the amount and B's balance reflects it, with no double-counting

#### Scenario: Edit archived transaction rejected
- **WHEN** the user attempts to edit an archived or deleted transaction
- **THEN** the request is rejected with a conflict error and no record changes

### Requirement: View transaction details

The system SHALL provide an individual transaction view showing all captured details, the transaction type, the associated account(s), the category, and the lifecycle state. When a related account or category has been archived or deleted, the view SHALL still resolve and display the reference by identifier.

#### Scenario: Details display
- **WHEN** the user opens a transaction's details
- **THEN** type, amount, date, notes, account, category, and lifecycle state are displayed

#### Scenario: Reference to a deleted record still resolves
- **WHEN** a transaction's category was deleted after the transaction was recorded
- **THEN** the transaction detail still identifies that category

### Requirement: Archive a transaction

The system SHALL allow an authenticated user to archive an active transaction. Archived transactions are excluded from the ordinary list, remain in a dedicated archive view, and SHALL continue to affect their account's current balance and to count in historical income and expense reporting once reporting exists. Archived transactions SHALL be restorable.

#### Scenario: Archive preserves balance effect
- **WHEN** an active transaction is archived
- **THEN** the account's current balance is unchanged and the transaction leaves the ordinary list

#### Scenario: Restore an archived transaction
- **WHEN** the user restores an archived transaction
- **THEN** the transaction becomes active again, re-enters the ordinary list, and its balance effect is unchanged (it was never removed)

### Requirement: Soft-delete a transaction

The system SHALL allow an authenticated user to soft-delete an active transaction after explicit confirmation. Deleted transactions are excluded from the ordinary list and from income/expense reporting once reporting exists, remain in a dedicated trash view, and SHALL stop affecting their account's current balance while deleted. Deletion SHALL be reversible and SHALL NOT physically remove the record nor cascade to any other record.

#### Scenario: Delete removes balance effect
- **WHEN** an active transaction is soft-deleted
- **THEN** the account's current balance changes by exactly the reversal of the transaction's effect and the record appears in trash

#### Scenario: Restore re-applies exactly once
- **WHEN** a soft-deleted transaction is restored
- **THEN** the account's current balance changes by exactly the transaction's effect once and the record re-enters the ordinary list

### Requirement: Restore validation and reassignment

The system SHALL reject restoring a transaction whose referenced account or category has been deleted, unless the restore request explicitly reassigns the transaction to an eligible replacement account or compatible active category. Restoring onto an archived account or category SHALL be allowed. Uniqueness and validation rules SHALL apply to the restored state.

#### Scenario: Restore blocked by deleted account
- **WHEN** the user restores a transaction whose account has been deleted and provides no replacement
- **THEN** the restore is rejected with a conflict error and the transaction remains deleted

#### Scenario: Restore with reassignment
- **WHEN** the user restores a transaction and provides an eligible replacement account
- **THEN** the transaction is restored referencing the replacement account and the balance effect applies to it

### Requirement: Permanently delete a transaction

The system SHALL allow an authenticated user to permanently delete a single transaction from trash after explicit confirmation. Permanent deletion SHALL physically remove the record, SHALL be irreversible, SHALL never run automatically, and SHALL not affect other records.

#### Scenario: Permanent deletion with confirmation
- **WHEN** the user confirms permanent deletion of a trashed transaction
- **THEN** the record is physically removed and no longer appears anywhere

#### Scenario: Permanent deletion is never automatic
- **WHEN** transactions remain in trash regardless of age
- **THEN** the system does not purge them without an explicit user request

### Requirement: Lifecycle state machine

The system SHALL enforce the transaction lifecycle states active, archived, and deleted with exactly these transitions: active to archived, active to deleted, archived to active, and deleted to active. Any other transition request SHALL be rejected with a conflict error.

#### Scenario: Invalid transition rejected
- **WHEN** the user attempts to delete an already-archived transaction
- **THEN** the request is rejected with a conflict error and the status is unchanged

### Requirement: Balance effects are exact and consistent

The system SHALL ensure every active or archived transaction affects its account's current balance exactly once and every soft-deleted transaction affects it zero times, across creation, editing, lifecycle changes, restoration, and reassignment. The account's current balance SHALL equal its opening balance plus the sum of its non-deleted transactions' signed effects. Monetary amounts SHALL be integers in paise of INR end to end.

#### Scenario: Balance identity holds after mixed operations
- **WHEN** an account undergoes creates, edits, archive, delete, restore, and reassignment of transactions
- **THEN** its current balance always equals opening balance plus the signed sum of its non-deleted transactions
