# Spec Delta

## ADDED Requirements

### Requirement: Activity list screen

The application SHALL provide an activity screen on the Transactions tab that renders the unified activity feed — transactions and transfers combined from one account-perspective list — as a scrolling list, with status tabs for Active, Archived, and Trash, filters, and progressive loading of further pages.

#### Scenario: Viewing the active feed

- **WHEN** the user opens the Transactions tab
- **THEN** activity rows render newest first with date, kind, category or counterparty account, and signed amounts, where incomes credit, expenses debit, and a transfer shows its effect for the row's account side, all formatted in the active currency

#### Scenario: Viewing the active feed

- **WHEN** the user opens the Transactions tab
- **THEN** activity rows render newest first with date, kind, category or counterparty account, and signed amounts, where incomes credit, expenses debit, and a transfer shows its effect for the row's account side

#### Scenario: Status tabs scope the feed

- **WHEN** the user switches between the Active, Archived, and Trash tabs
- **THEN** the feed lists only entries with that status

#### Scenario: Filters shape the feed

- **WHEN** the user applies any combination of type, account, category, date-range, or search filters
- **THEN** the feed shows only matching entries and further page loading restarts from the first page

#### Scenario: Category filter excludes transfers

- **WHEN** the user filters by a category
- **THEN** no transfer rows appear, because transfers carry no category

#### Scenario: Loading more pages

- **WHEN** the user activates the load-more control with further pages available
- **THEN** the next page of the feed appends below the loaded rows with the current filters preserved

#### Scenario: Empty feed state

- **WHEN** the feed for the selected tab and filters contains no entries
- **THEN** an empty-state message is shown instead of rows

### Requirement: Transaction management

The application SHALL provide transaction create and edit actions on the activity screen through a form validated against the shared Zod schema (type, amount, date, account, category, notes), and archive, soft-delete, and restore actions behind confirmation dialogs, with archived and trashed transactions restorable from their tabs.

#### Scenario: Creating a transaction

- **WHEN** the user submits a valid transaction form with type, amount, date, account, category, and optional notes
- **THEN** the transaction is created, the form dialog closes, and the amount converts to integer minor units in the request

#### Scenario: Invalid transaction form blocks submission

- **WHEN** the form is submitted with a non-positive amount, a malformed date, a missing account, or a missing category
- **THEN** submission is blocked and each offending field shows the shared schema's validation message

#### Scenario: Editing a transaction

- **WHEN** the user edits an existing transaction and submits valid changes
- **THEN** the transaction is updated and the feed row reflects the new values

#### Scenario: Transaction lifecycle

- **WHEN** the user archives, soft-deletes, or restores a transaction through the confirmation dialogs
- **THEN** the transaction moves between the Active, Archived, and Trash lists accordingly

### Requirement: Transfer management

The application SHALL provide transfer create and edit actions on the activity screen through a form validated against the shared Zod schema (amount, date, source account, destination account, notes), and archive, soft-delete, and restore actions behind confirmation dialogs. A transfer SHALL appear once per involved account side in the feed, and creating or editing a transfer SHALL require two different accounts.

#### Scenario: Creating a transfer

- **WHEN** the user submits a valid transfer form with amount, date, source, and destination accounts
- **THEN** the transfer is created and the feed shows its debit on the source side and credit on the destination side

#### Scenario: Same source and destination blocked

- **WHEN** the transfer form is submitted with the same account selected as source and destination
- **THEN** submission is blocked with the shared schema's accounts-must-differ message

#### Scenario: Invalid transfer form blocks submission

- **WHEN** the form is submitted with a non-positive amount, a malformed date, or a missing account
- **THEN** submission is blocked and each offending field shows the shared schema's validation message

#### Scenario: Editing a transfer

- **WHEN** the user edits an existing transfer and submits valid changes
- **THEN** the transfer is updated and both feed sides reflect the new values

#### Scenario: Transfer lifecycle

- **WHEN** the user archives, soft-deletes, or restores a transfer through the confirmation dialogs
- **THEN** the transfer's feed sides move between the Active, Archived, and Trash lists accordingly
