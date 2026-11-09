# recurring-expenses Specification

## Purpose

Allows the user to define, schedule, track, and adjust recurring expense rules with flexible duration cadences, view due and upcoming expenses, and review and record them into the ledger.

## Requirements

### Requirement: Create a recurring expense rule
The system SHALL allow an authenticated user to create a recurring expense rule capturing an expected amount in integer paise, an interval count in months (such as 1, 2, 3, 6, or 12), a start date, a source account, an expense category, optional notes, and an optional end date. The expected amount SHALL be used as the pre-filled default when posting each occurrence; the actual posted amount may differ every cycle. The rule SHALL be created in active status with its next due date initialized. The source account and category SHALL be active.

#### Scenario: Successful recurring rule creation
- **WHEN** the user submits a valid amount, month interval, start date, active source account, and active expense category
- **THEN** the recurring expense rule is created in active status and its next due date is scheduled

#### Scenario: Inactive account or category rejected
- **WHEN** the user submits an archived or deleted account or category
- **THEN** the request is rejected with a conflict error and no recurring rule is created

#### Scenario: Invalid recurrence interval rejected
- **WHEN** the interval in months is missing, zero, negative, or not a whole number
- **THEN** the request is rejected with a validation error

### Requirement: View and filter recurring expense rules
The system SHALL allow an authenticated user to list all recurring expense rules owned by that user. The system SHALL support filtering by lifecycle status (active, paused, completed, cancelled), source account, and expense category. The response SHALL include amount, month interval, source account, category, start date, next due date, last posted date, and status.

#### Scenario: List owned recurring rules
- **WHEN** the user requests the list of recurring expense rules
- **THEN** only recurring rules owned by the authenticated user are returned

#### Scenario: Filter by lifecycle status
- **WHEN** the user filters rules by active status
- **THEN** only active recurring expense rules are returned

### Requirement: Due and upcoming recurring expenses query
The system SHALL provide an endpoint to list active recurring expense rules whose next due date is on or before a specified cutoff date (defaulting to the current date). Paused, completed, or cancelled rules SHALL NOT be returned as due.

#### Scenario: Due rules identified
- **WHEN** an active recurring rule has a next due date on or before today
- **THEN** the rule appears in the due review list with its due date and expected amount as the pre-filled default

#### Scenario: Future rules beyond cutoff excluded
- **WHEN** a recurring rule has a next due date after the specified cutoff date
- **THEN** the rule does not appear in the due list

### Requirement: Post a due recurring expense occurrence
The system SHALL allow an authenticated user to post a due recurring expense occurrence. Posting SHALL pre-fill the rule's expected amount, due date, and notes as defaults, and SHALL accept adjusted values because the actual expense may differ every cycle. Posting SHALL atomically create an active expense ledger transaction linked to the recurring expense identifier, decrease the source account balance by the posted transaction amount, advance the rule's next due date by its month interval, and record the last posted date. The rule's expected amount and account and category references SHALL remain unchanged by posting.

#### Scenario: Successful posting of due occurrence
- **WHEN** the user confirms posting a due recurring expense occurrence
- **THEN** an expense transaction is created in the ledger with the confirmed values, the account balance updates, and the rule's next due date advances by its interval

#### Scenario: Posting with adjusted amount, date, or notes
- **WHEN** the user provides an adjusted amount, payment date, or notes during posting
- **THEN** the ledger transaction is created with the adjusted values, the rule's stored expected amount stays unchanged, and the recurring rule advances to its next scheduled cycle

#### Scenario: Completion upon reaching end date
- **WHEN** a posted occurrence causes the advanced next due date to exceed the rule's defined end date
- **THEN** the transaction is posted and the recurring rule status transitions to completed

### Requirement: Skip a recurring expense occurrence
The system SHALL allow an authenticated user to skip a due recurring expense occurrence. Skipping SHALL advance the next due date by the cadence interval without creating a ledger transaction or altering account balances.

#### Scenario: Occurrence skipped successfully
- **WHEN** the user chooses to skip a due recurring occurrence
- **THEN** the rule's next due date advances by its month interval and no ledger transaction is created

### Requirement: Edit recurring expense duration and parameters
The system SHALL allow an authenticated user to update an active or paused recurring expense rule's expected amount, interval in months, source account, category, notes, and end date. Changing the duration or parameters SHALL update future scheduled occurrences (including the pre-filled expected amount) and recalculate the next due date without modifying previously posted ledger transactions.

#### Scenario: Change recurrence duration
- **WHEN** the user updates the interval from 1 month to 3 months
- **THEN** the interval is saved, the next due date is recalculated from the last posted date or effective date, and past ledger transactions remain unchanged

#### Scenario: Past transactions remain intact
- **WHEN** an existing recurring rule's expected amount or category is edited
- **THEN** previously generated transactions retain their original amounts, dates, and category references

### Requirement: Recurring expense lifecycle management
The system SHALL support pausing, resuming, and cancelling a recurring expense rule. Paused rules SHALL stop appearing in the due queue until resumed. Cancelling a rule SHALL prevent any further occurrences while preserving historical associations with past transactions.

#### Scenario: Pause an active rule
- **WHEN** the user pauses an active recurring rule
- **THEN** the rule status becomes paused and it does not appear in the due queue

#### Scenario: Resume a paused rule
- **WHEN** the user resumes a paused rule
- **THEN** the rule status becomes active and its due status is re-evaluated

#### Scenario: Cancel a recurring rule
- **WHEN** the user cancels a recurring rule
- **THEN** the rule status becomes cancelled and no future transactions can be posted from it
