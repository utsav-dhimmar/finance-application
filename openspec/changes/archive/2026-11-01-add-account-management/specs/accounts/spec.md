# Spec Delta

## Purpose

Lets a single user own financial accounts (cash, bank, wallet), see where their money is held, maintain account details, and retire accounts without losing financial history. This capability owns account records, their current balances, and their active/archived/deleted lifecycle.

## ADDED Requirements

### Requirement: Create a financial account

The system SHALL allow an authenticated user to create a financial account with a name, an account type (cash, bank, or wallet), and an opening balance. The system SHALL support multiple bank accounts and multiple wallet accounts concurrently. A successfully created account SHALL appear in the account list and in balance summaries.

#### Scenario: Successful creation
- **WHEN** the user submits a valid name, a supported account type, and a valid opening balance
- **THEN** the account is created with that data and returned with its generated identifier, and it appears in the account list with a current balance equal to the opening balance

#### Scenario: Opening balance is optional
- **WHEN** the user submits a valid name and type with no opening balance
- **THEN** the account is created with an opening balance of zero

#### Scenario: Unknown account type rejected
- **WHEN** the user submits an account type other than cash, bank, or wallet
- **THEN** creation is rejected with a validation error and no account is created

### Requirement: Account creation rejects invalid input

The system SHALL reject account creation when required fields are missing, the name is empty or exceeds the defined length limit, or the opening balance is not a valid monetary amount, without creating any record.

#### Scenario: Missing name
- **WHEN** creation is submitted with a blank or absent name
- **THEN** the response is a validation error naming the field, and no account is created

#### Scenario: Invalid monetary value
- **WHEN** the opening balance is not a whole number of paise (for example a fractional amount)
- **THEN** the response is a validation error naming the field, and no account is created

### Requirement: Account name uniqueness

The system SHALL enforce case-insensitive uniqueness of account names among the user's accounts that are not deleted. Two active or archived accounts SHALL NOT share the same name regardless of letter casing. A deleted account's name SHALL be reusable by a new account.

#### Scenario: Duplicate name rejected
- **WHEN** the user creates an account whose name matches an existing non-deleted account's name ignoring case
- **THEN** the request is rejected with a conflict error identifying the duplicate name

#### Scenario: Deleted account name is reusable
- **WHEN** an account named "HDFC" is soft-deleted and the user creates a new account named "hdfc"
- **THEN** the new account is created successfully

#### Scenario: Restore conflicts with a reused name
- **WHEN** restoring a non-active account would violate uniqueness because another non-deleted account now uses its name, and no alternative name is provided
- **THEN** the restore is rejected with a conflict error, and the account can be restored by explicitly providing a new name as part of the restore request

### Requirement: Account creation has no transaction side effects

Creating an account with an opening balance SHALL NOT create any income or expense transaction, category, or other financial record. If validation or persistence fails, the system SHALL leave no partial account data behind.

#### Scenario: No synthetic transactions
- **WHEN** an account is created with a nonzero opening balance
- **THEN** no income or expense transaction exists as a result of the creation, and the account's current balance equals the opening balance

#### Scenario: No partial records on failure
- **WHEN** an account creation fails validation or persistence
- **THEN** no account row and no related record is created

### Requirement: Authenticated and scoped account access

All account endpoints SHALL require authentication, and each request SHALL only operate on accounts owned by the authenticated user. Unauthenticated requests SHALL be rejected.

#### Scenario: Unauthenticated access rejected
- **WHEN** an account endpoint is called without a valid session
- **THEN** the response is an authentication error and no account data is returned

#### Scenario: Only owned accounts are visible
- **WHEN** the authenticated user lists or reads accounts
- **THEN** only accounts owned by that user are returned

### Requirement: View accounts and balances

The system SHALL display each account's name, type, and current balance. The current balance SHALL equal the opening balance plus the sum of balance-affecting posted transactions for that account. Zero and negative balances SHALL be displayed as-is. The system SHALL also provide an individual account view showing one account's details and current balance.

#### Scenario: List shows balances
- **WHEN** the user views the accounts page
- **THEN** each account is listed with its name, type, and current balance

#### Scenario: New account reflects opening balance
- **WHEN** an account was created with an opening balance of ₹1,250.50 and no transactions have been posted
- **THEN** its displayed current balance equals that opening balance

#### Scenario: Negative balance displayed
- **WHEN** an account's computed balance is negative
- **THEN** the balance is displayed as a negative amount rather than being hidden or clamped to zero

### Requirement: Combined balance across active accounts

The system SHALL provide a combined balance equal to the sum of current balances of the user's active accounts. Archived and deleted accounts SHALL NOT contribute to the combined balance.

#### Scenario: Combined balance sums active accounts only
- **WHEN** the user has active accounts of ₹100 and ₹200 and an archived account of ₹500
- **THEN** the combined balance is ₹300

### Requirement: Lifecycle visibility of accounts

The system SHALL clearly distinguish active, archived, and deleted accounts. Ordinary account lists, selection workflows, and balance summaries SHALL include only active accounts by default. The system SHALL provide dedicated views listing archived accounts and deleted (trashed) accounts.

#### Scenario: Default list is active only
- **WHEN** the user views the ordinary account list
- **THEN** archived and deleted accounts are not shown

#### Scenario: Archive and trash views
- **WHEN** the user opens the archived or trash view
- **THEN** archived or respectively deleted accounts are listed there with their details

### Requirement: Edit account details

The system SHALL allow the account name to be edited with validation before persistence. Editing an account's name SHALL NOT change any historical transaction's account reference. Account type and opening balance SHALL remain editable only while the account has no posted transactions.

#### Scenario: Rename an account
- **WHEN** the user renames an active account to a valid, non-conflicting name
- **THEN** the account is updated and any historical references to the account continue to resolve to it

#### Scenario: Rename conflict rejected
- **WHEN** the user renames an account to a name that matches another non-deleted account ignoring case
- **THEN** the update is rejected with a conflict error and the name is unchanged

### Requirement: Opening balance and type lock after history exists

Once an account has at least one posted transaction, the system SHALL reject requests that change the account's opening balance or account type, so that recorded history is never silently reinterpreted.

#### Scenario: Opening balance locked after transactions
- **WHEN** the user attempts to change the opening balance of an account that has posted transactions
- **THEN** the request is rejected with a conflict error explaining the adjustment policy

#### Scenario: Type locked after transactions
- **WHEN** the user attempts to change the type of an account that has posted transactions
- **THEN** the request is rejected with a conflict error

### Requirement: Archive an account

The system SHALL allow an authenticated user to archive an active account regardless of its balance. Archived accounts are excluded from ordinary lists, selection workflows, and balance summaries, remain in a dedicated archive view, and can be restored. Archiving SHALL preserve the account's data and financial history unchanged.

#### Scenario: Archive an account with nonzero balance
- **WHEN** the user archives an active account with a nonzero balance after confirming the action
- **THEN** the account's status becomes archived, it disappears from ordinary lists and the combined balance, and it appears in the archive view

#### Scenario: Restore an archived account
- **WHEN** the user restores an archived account
- **THEN** the account becomes active again with its name, type, and opening balance intact, and re-enters lists and balance summaries

### Requirement: Soft-delete an account

The system SHALL allow an authenticated user to soft-delete an active account regardless of its balance, after explicit confirmation. Deleted accounts are excluded from ordinary lists and current-balance summaries, remain in a dedicated trash view, and can be restored. Deletion SHALL be reversible and SHALL NOT physically remove the account.

#### Scenario: Soft-delete an account
- **WHEN** the user deletes an active account after confirming the action
- **THEN** the account's status becomes deleted, it disappears from ordinary lists, balance summaries, and the combined balance, and it appears in the trash view

#### Scenario: Restore a deleted account
- **WHEN** the user restores a deleted account from the trash view
- **THEN** the account becomes active again with its prior data intact

### Requirement: Lifecycle state machine

The system SHALL enforce the account lifecycle states active, archived, and deleted with exactly these transitions: active to archived, active to deleted, archived to active, and deleted to active. Any other transition request SHALL be rejected with a conflict error. Archived and deleted accounts SHALL NOT be editable through the ordinary edit workflow.

#### Scenario: Invalid transition rejected
- **WHEN** the user attempts to archive an already-deleted account
- **THEN** the request is rejected with a conflict error and the status is unchanged

#### Scenario: Non-active accounts not editable
- **WHEN** the user attempts to rename an archived or deleted account
- **THEN** the request is rejected with a conflict error

### Requirement: Lifecycle changes preserve financial history

Archiving, deleting, or restoring an account SHALL NOT modify, delete, or create any transaction, transfer, or other financial record that references the account. Historical references to the account SHALL remain resolvable.

#### Scenario: No cascade changes to transactions
- **WHEN** an account with recorded transactions is archived, deleted, or restored
- **THEN** every transaction that references the account remains unchanged and still resolves to that account

### Requirement: Monetary amounts are integer paise in INR

Account monetary amounts (opening balance, current balance, combined balance) SHALL be represented and exchanged as integers in minor units (paise) of INR. Requests carrying amounts that are not expressible as an integer number of paise SHALL be rejected.

#### Scenario: Amounts returned in paise
- **WHEN** any account response is read
- **THEN** every monetary value it carries is an integer number of paise

#### Scenario: Fractional amount rejected
- **WHEN** an opening balance is submitted with more precision than paise
- **THEN** the response is a validation error naming the field
