# Spec Delta — transactions

## MODIFIED Requirements

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
