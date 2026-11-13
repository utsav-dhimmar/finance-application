# Spec Delta

## REMOVED Requirements

### Requirement: Authenticated home screen

**Reason**: The stub home screen is replaced by the authenticated tab shell; the home screen's role (identity display and sign-out) moves into the shell's app header.
**Migration**: The signed-in user's email and the sign-out control are provided by the new "Authenticated tab shell" requirement below.

## ADDED Requirements

### Requirement: Authenticated tab shell

The authenticated application SHALL render as a persistent shell consisting of an app header and a bottom tab bar. The app header SHALL display the signed-in user's email and the sign-out control, and both SHALL remain visible across all tab screens.

#### Scenario: Core destinations are present

- **WHEN** a signed-in user views the tab bar
- **THEN** it offers the Dashboard, Transactions, Accounts, and Categories destinations, and the Dashboard tab is the initial screen

#### Scenario: Switching between tabs

- **WHEN** a signed-in user activates the Accounts tab and then the Categories tab
- **THEN** the corresponding screen renders while the app header with the user's email and sign-out control remains in place

#### Scenario: Pending screens show a notice

- **WHEN** the user opens a tab whose capability has not yet been delivered
- **THEN** a minimal notice is displayed instead of finance content

#### Scenario: Sign-out from the shell

- **WHEN** the user activates the sign-out control in the app header
- **THEN** the session ends and the sign-in screen is shown

### Requirement: Accounts screen

The application SHALL provide an Accounts screen reachable from the bottom tab bar that lists the user's accounts as cards with status tabs for Active, Archived, and Trash, provides create and edit account actions through a form validated against the shared Zod schema, and provides archive, soft-delete, and restore lifecycle actions behind confirmations.

#### Scenario: Viewing active accounts with balances

- **WHEN** the user opens the Accounts tab with active accounts
- **THEN** each account renders as a card with its name, type, and current balance formatted with the API-provided currency symbol and minor-unit exponent

#### Scenario: Empty accounts state

- **WHEN** the user opens the Accounts tab with no accounts for the selected status tab
- **THEN** an empty-state message for that tab is shown instead of cards

#### Scenario: Creating an account

- **WHEN** the user submits a valid account form with name, type, and opening balance
- **THEN** the account is created, the form dialog closes, and the list shows the new account with its balance

#### Scenario: Invalid account form blocks submission

- **WHEN** the account form is submitted with an invalid name, type, or balance
- **THEN** submission is blocked and the offending field shows the shared schema's validation message

#### Scenario: Editing an account

- **WHEN** the user edits an existing account and submits valid changes
- **THEN** the account is updated and the card reflects the new values

#### Scenario: Archive and delete with confirmation

- **WHEN** the user activates archive or delete on an account and confirms the dialog
- **THEN** the account leaves the active list and appears under the Archived or Trash tab

#### Scenario: Restoring from Archived or Trash

- **WHEN** the user restores an archived or trashed account and the name is not in conflict
- **THEN** the account returns to the Active tab

#### Scenario: Restore with name conflict

- **WHEN** the user restores an account whose name conflicts with an existing account
- **THEN** the app offers entering a new name and restores the account under it

### Requirement: Categories screen

The application SHALL provide a Categories screen reachable from the bottom tab bar that lists the user's categories as cards with status tabs for Active, Archived, and Trash, provides create and edit category actions through a form validated against the shared Zod schema, and provides archive, soft-delete, and restore lifecycle actions behind confirmations.

#### Scenario: Viewing active categories

- **WHEN** the user opens the Categories tab with active categories
- **THEN** each category renders as a card with its name, type, color, and icon

#### Scenario: Empty categories state

- **WHEN** the user opens the Categories tab with no categories for the selected status tab
- **THEN** an empty-state message for that tab is shown instead of cards

#### Scenario: Creating a category

- **WHEN** the user submits a valid category form with name, type, color, and icon
- **THEN** the category is created and the list shows the new category card

#### Scenario: Invalid category form blocks submission

- **WHEN** the category form is submitted with an invalid field
- **THEN** submission is blocked and the offending field shows the shared schema's validation message

#### Scenario: Editing a category

- **WHEN** the user edits an existing category and submits valid changes
- **THEN** the category is updated and the card reflects the new values

#### Scenario: Category lifecycle with restore

- **WHEN** the user archives, soft-deletes, or restores a category through the confirmation dialogs
- **THEN** the category moves between the Active, Archived, and Trash tabs accordingly, with a name-conflicting restore offering a new name

#### Scenario: Viewing active accounts with balances

- **WHEN** the user opens the Accounts tab with active accounts
- **THEN** each account renders as a card with its name, type, and balance formatted in the active currency

#### Scenario: Empty accounts state

- **WHEN** the user opens the Accounts tab with no accounts for the selected status tab
- **THEN** an empty-state message for that tab is shown instead of cards

#### Scenario: Creating an account

- **WHEN** the user submits a valid account form with name, type, and opening balance
- **THEN** the account is created, the form dialog closes, and the list shows the new account with its balance

#### Scenario: Invalid account form blocks submission

- **WHEN** the account form is submitted with an invalid name, type, or balance
- **THEN** submission is blocked and the offending field shows the shared schema's validation message

#### Scenario: Editing an account

- **WHEN** the user edits an existing account and submits valid changes
- **THEN** the account is updated and the card reflects the new values

#### Scenario: Archive and delete with confirmation

- **WHEN** the user activates archive or delete on an account and confirms the dialog
- **THEN** the account leaves the active list and appears under the Archived or Trash tab

#### Scenario: Restoring from Archived or Trash

- **WHEN** the user restores an archived or trashed account and the name is not in conflict
- **THEN** the account returns to the Active tab

#### Scenario: Restore with name conflict

- **WHEN** the user restores an account whose name conflicts with an existing account
- **THEN** the app offers entering a new name and restores the account under it
