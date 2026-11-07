# transfers Specification

## Purpose

Lets a single user move money between their own accounts with one operation that atomically decreases the source and increases the destination, never counts as income or expense, and follows the same idempotent, lifecycle-managed rules as transactions.

## Requirements

### Requirement: Create a transfer

The system SHALL allow an authenticated user to create a transfer between two of their own distinct active accounts, capturing an amount, a transfer date, and optional notes. The source account's current balance SHALL decrease and the destination account's current balance SHALL increase by the amount, atomically — an invalid transfer SHALL NOT update only one account. The system SHALL NOT reject a transfer because it would make either balance negative.

#### Scenario: Successful transfer
- **WHEN** the user submits a valid positive amount, date, and two distinct active accounts
- **THEN** the transfer is created, the source balance decreases by the amount, and the destination balance increases by the amount

#### Scenario: Same account rejected
- **WHEN** the user submits identical source and destination accounts
- **THEN** the request is rejected with a conflict error and neither balance changes

#### Scenario: Ineligible account rejected
- **WHEN** the source or destination is an archived or deleted account
- **THEN** the request is rejected with a conflict error and no transfer is created

#### Scenario: Negative resulting balances allowed
- **WHEN** the transfer amount exceeds either account's current balance
- **THEN** the transfer is created and the affected balance is displayed as negative

### Requirement: Transfer creation is idempotent

The system SHALL accept a client-generated transfer identifier on creation. When a creation request repeats with an identifier that already exists for the user, the system SHALL return the existing transfer without creating a duplicate and without re-applying any balance effect. When a creation request presents an identifier that already exists for a different user, the system SHALL respond `409` with error code `ID_CONFLICT` and create nothing, without disclosing whether the identifier exists. Creation SHALL NOT create any record other than the transfer.

#### Scenario: Retry with the same identifier
- **WHEN** the same creation request is submitted twice with the same client-generated identifier
- **THEN** only one transfer exists and both responses describe that same transfer

#### Scenario: Identifier colliding with another user's transfer
- **WHEN** a creation request presents a client-generated identifier that already exists on another user's transfer
- **THEN** the response is `409` with error code `ID_CONFLICT`, no transfer is created, and the response is identical to any other identifier conflict

### Requirement: Transfers are never income or expense

The system SHALL keep transfers out of income and expense reporting and out of category-based summaries permanently. A transfer SHALL NOT require a category and SHALL NOT create any transaction record.

#### Scenario: No income or expense effect
- **WHEN** transfers are created, edited, or moved through their lifecycle
- **THEN** no income or expense transaction is created and income/expense totals are unchanged

### Requirement: Transfer input validation

The system SHALL reject transfer creation or editing when the amount is missing, zero, negative, not a whole number of paise, or exceeds the defined maximum amount; the date is missing or not a valid calendar date; either account reference is missing or malformed; or notes exceed the defined length limit — without creating or modifying any record.

#### Scenario: Invalid amount rejected
- **WHEN** the amount is zero, negative, fractional in paise, absent, or above the defined maximum
- **THEN** the response is a validation error naming the field and no record changes

### Requirement: Authenticated and scoped transfer access

All transfer endpoints SHALL require authentication, and each request SHALL only operate on transfers owned by the authenticated user. Unauthenticated requests SHALL be rejected.

#### Scenario: Unauthenticated access rejected
- **WHEN** a transfer endpoint is called without a valid session
- **THEN** the response is an authentication error and no transfer data is returned

### Requirement: View transfers

The system SHALL display transfers with source account, destination account, amount, date, notes, and lifecycle state.

#### Scenario: Transfer details display
- **WHEN** the user views a transfer
- **THEN** its source account, destination account, amount, date, notes, and lifecycle state are shown

### Requirement: List and filter transfers

The system SHALL support listing transfers with date-range, account, and text-search filters, combined with pagination. Search SHALL be case-insensitive across transfer notes and the related account names, and the characters `%` and `_` SHALL be treated as literal characters in search text, not as wildcards. Pagination SHALL use a deterministic ordering whose final component is unique, so no transfer repeats or disappears across page boundaries.

#### Scenario: Transfer filters combine
- **WHEN** the user applies a date range and an account filter to the transfer list
- **THEN** only transfers matching all filters are returned

#### Scenario: Search wildcard characters are literal
- **WHEN** the user searches transfers for text containing `%` or `_`
- **THEN** only transfers containing those literal characters match

### Requirement: Transfers appear in account history

Each account's history view SHALL show transfers involving that account interleaved with its transactions, with the transfer direction (money in or money out) clearly distinguishable.

#### Scenario: Transfer visible from both sides
- **WHEN** the user opens either the source or the destination account's history
- **THEN** the transfer appears there with the correct direction and amount

### Requirement: Transfer references resolve regardless of lifecycle state

Transfer references to accounts SHALL resolve by identifier and display names regardless of the account's current lifecycle state.

#### Scenario: Archived account history stays understandable
- **WHEN** an account involved in a transfer is later archived
- **THEN** the transfer still displays both account references with names resolved

### Requirement: Edit a transfer

The system SHALL allow an active transfer's amount, date, source, destination, and notes to be edited with the same validation as creation, including the distinct-accounts rule. Editing SHALL recompute both account balances atomically so each amount affects the correct account exactly once. Archived and deleted transfers SHALL NOT be editable through the ordinary workflow.

#### Scenario: Move both sides
- **WHEN** the user changes a transfer's source and destination to two other accounts
- **THEN** the old accounts' balances no longer reflect the transfer and the new accounts' balances reflect it once each

#### Scenario: Edit to identical accounts rejected
- **WHEN** the user edits a transfer so that source and destination match
- **THEN** the request is rejected with a conflict error and no balances change

### Requirement: Archive a transfer

The system SHALL allow an authenticated user to archive an active transfer. Archived transfers are excluded from ordinary lists, remain in a dedicated archive view, and SHALL continue to affect both accounts' current balances exactly as before. Archived transfers SHALL be restorable.

#### Scenario: Archive preserves both effects
- **WHEN** an active transfer is archived
- **THEN** neither account's balance changes and the transfer leaves the ordinary list

#### Scenario: Restore an archived transfer
- **WHEN** the user restores an archived transfer
- **THEN** it becomes active again and neither balance changes (its effects were never removed)

### Requirement: Soft-delete a transfer

The system SHALL allow an authenticated user to soft-delete an active transfer after explicit confirmation. Deleted transfers are excluded from ordinary lists, remain in a dedicated trash view, and SHALL stop affecting both accounts' current balances while deleted. Deletion SHALL be reversible, SHALL NOT physically remove the record, and SHALL NOT cascade to any other record.

#### Scenario: Delete removes both effects
- **WHEN** an active transfer is soft-deleted
- **THEN** the source balance increases and the destination balance decreases by the amount — both reversals applied atomically

#### Scenario: Restore re-applies both effects exactly once
- **WHEN** a soft-deleted transfer is restored
- **THEN** the source balance decreases and the destination balance increases by the amount, each applied exactly once

### Requirement: Restore validation and reassignment

The system SHALL reject restoring a transfer whose source or destination account has been deleted, unless the restore request explicitly reassigns that side to an eligible active replacement account. Restoring onto an archived account SHALL be allowed.

#### Scenario: Restore blocked by deleted account
- **WHEN** the user restores a transfer whose destination account has been deleted and provides no replacement
- **THEN** the restore is rejected with a conflict error and the transfer remains deleted

#### Scenario: Restore with reassignment
- **WHEN** the user restores a transfer and provides an eligible replacement destination account
- **THEN** the transfer is restored referencing the replacement and its effects apply to the new pair

### Requirement: Permanently delete a transfer

The system SHALL allow an authenticated user to permanently delete a single transfer from trash after explicit confirmation. Permanent deletion SHALL physically remove the record, SHALL be irreversible, SHALL never run automatically, and SHALL not affect other records.

#### Scenario: Permanent deletion with confirmation
- **WHEN** the user confirms permanent deletion of a trashed transfer
- **THEN** the record is physically removed and no longer appears anywhere

### Requirement: Lifecycle state machine

The system SHALL enforce the transfer lifecycle states active, archived, and deleted with exactly these transitions: active to archived, active to deleted, archived to active, and deleted to active. Any other transition request SHALL be rejected with a conflict error.

#### Scenario: Invalid transition rejected
- **WHEN** the user attempts to archive an already-deleted transfer
- **THEN** the request is rejected with a conflict error and the status is unchanged

### Requirement: Paired balance effects are exact and atomic

The system SHALL treat a transfer's two account effects as one logical operation across creation, editing, lifecycle changes, restoration, and reassignment: while active or archived, the amount is subtracted from the source exactly once and added to the destination exactly once; while deleted, it affects neither. Monetary amounts SHALL be integers in paise of INR end to end.

#### Scenario: Balance identity holds after mixed operations
- **WHEN** accounts undergo transfer creates, edits, archive, delete, restore, and reassignment
- **THEN** each account's current balance always equals opening balance plus the signed sum of its non-deleted transactions and transfer sides
