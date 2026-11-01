# Spec Delta

## Purpose

Gives a single user one place to manage everything they have archived or deleted — accounts, categories, transactions, and transfers — with inspection, validated restoration, and explicitly confirmed permanent deletion that can never corrupt balances or financial history.

## ADDED Requirements

### Requirement: Dedicated Archive view

The system SHALL provide a dedicated Archive view listing the user's archived records across all supported record types — accounts, categories, transactions, and transfers — clearly separated from active and deleted records. Each entry SHALL be inspectable with its details, and eligible records SHALL be restorable through their established restore flows.

#### Scenario: Archived records of every type listed
- **WHEN** the user opens the Archive view
- **THEN** archived accounts, categories, transactions, and transfers are each listed under their record type

#### Scenario: Inspection before restoration
- **WHEN** the user inspects an archived record
- **THEN** its details are displayed, including references to other records resolved by identifier

### Requirement: Dedicated Trash view

The system SHALL provide a dedicated Trash view, separate from the Archive view, listing the user's soft-deleted records across all supported record types. Each entry SHALL be inspectable, restorable when eligible, and permanently deletable when eligible.

#### Scenario: Trash separate from archive
- **WHEN** a record is soft-deleted
- **THEN** it appears in the Trash view and never in the Archive view

#### Scenario: Deleted records of every type listed
- **WHEN** the user opens the Trash view
- **THEN** soft-deleted accounts, categories, transactions, and transfers are each listed under their record type

### Requirement: Restoration validates relationships

Restoration from the Archive or Trash view SHALL apply the same validation as each record type's own restore: name conflicts reject with the option to rename, deleted referenced records block restoration with the option to reassign, and all validation rules apply to the restored state. Restoration SHALL never double-apply a financial effect.

#### Scenario: Name-conflict restore from the unified view
- **WHEN** the user restores a deleted account whose name another account now uses
- **THEN** the restore is rejected with a conflict error unless a new name is provided

#### Scenario: Reassignment restore from the unified view
- **WHEN** the user restores a transaction whose account has been deleted and provides a replacement account
- **THEN** the transaction is restored referencing the replacement

### Requirement: Permanent deletion eligibility

The system SHALL allow permanent deletion per record, only after explicit confirmation, and only for eligible records: transactions and transfers in trash are always eligible; an account or category in trash is eligible only when no non-deleted record references it. Ineligible requests SHALL be rejected with a conflict error explaining the history-preservation policy. Permanent deletion SHALL physically remove the record, SHALL be irreversible, and SHALL never run automatically.

#### Scenario: Unreferenced account permanently deleted
- **WHEN** the user permanently deletes a trashed account that no non-deleted transaction or transfer references
- **THEN** the account row is physically removed and no longer appears anywhere

#### Scenario: Referenced account blocked
- **WHEN** the user permanently deletes a trashed account that at least one non-deleted transaction references
- **THEN** the request is rejected with a conflict error and the record remains in trash

#### Scenario: Referenced category blocked
- **WHEN** the user permanently deletes a trashed category that at least one non-deleted transaction references
- **THEN** the request is rejected with a conflict error and the record remains in trash

#### Scenario: Confirmation required
- **WHEN** any permanent deletion is performed
- **THEN** it happens only after the user explicitly confirms the specific record's deletion

### Requirement: Permanent deletion preserves balance integrity

Permanent deletion SHALL only ever remove records whose lifecycle state already excludes them from balances and ordinary reporting (that is, soft-deleted records), so no balance, report, or history can change as a result of a permanent deletion of another user-visible record.

#### Scenario: Balances unaffected by permanent deletion
- **WHEN** the user permanently deletes any trashed record
- **THEN** every account's current balance and every report total is unchanged

#### Scenario: Historical references remain resolvable
- **WHEN** a permanently deleted category had been referenced only by deleted transactions
- **THEN** those transactions still exist in trash and the system handles their dangling reference without error, displaying the reference as unavailable

### Requirement: Ordinary queries exclude hidden records

Ordinary lists, selection workflows, dashboards, and reports SHALL exclude archived and deleted records by default, consistently across all record types — the unified views are the only places where they appear.

#### Scenario: Hidden records absent everywhere else
- **WHEN** the user browses ordinary lists, the dashboard, or reports after archiving or deleting records
- **THEN** no archived or deleted record appears in them

### Requirement: Authenticated and scoped lifecycle management

All Archive and Trash endpoints and views SHALL require authentication, and each request SHALL only operate on records owned by the authenticated user. Unauthenticated requests SHALL be rejected.

#### Scenario: Unauthenticated access rejected
- **WHEN** an archive, trash, restore, or permanent-delete endpoint is called without a valid session
- **THEN** the response is an authentication error and no data is returned
