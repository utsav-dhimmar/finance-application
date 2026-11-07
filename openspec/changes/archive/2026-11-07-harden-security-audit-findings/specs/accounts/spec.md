# Spec Delta — accounts

## MODIFIED Requirements

### Requirement: Create a financial account

The system SHALL allow an authenticated user to create a financial account with a name, an account type (cash, bank, or wallet), and an opening balance. The opening balance SHALL be a whole number of paise within the supported amount range: a valid monetary amount as defined by the integer-paise rule, not exceeding the defined maximum magnitude. The system SHALL support multiple bank accounts and multiple wallet accounts concurrently. A successfully created account SHALL appear in the account list and in balance summaries.

#### Scenario: Successful creation
- **WHEN** the user submits a valid name, a supported account type, and a valid opening balance
- **THEN** the account is created with that data and returned with its generated identifier, and it appears in the account list with a current balance equal to the opening balance

#### Scenario: Opening balance is optional
- **WHEN** the user submits a valid name and type with no opening balance
- **THEN** the account is created with an opening balance of zero

#### Scenario: Unknown account type rejected
- **WHEN** the user submits an account type other than cash, bank, or wallet
- **THEN** creation is rejected with a validation error and no account is created

#### Scenario: Opening balance above the supported maximum rejected
- **WHEN** the user submits an opening balance whose magnitude exceeds the defined maximum amount
- **THEN** creation is rejected with a validation error and no account is created

### Requirement: Opening balance and type lock after history exists

Once an account has at least one posted transaction or transfer side — that is, any non-deleted transaction or non-deleted transfer referencing the account — the system SHALL reject requests that change the account's opening balance or account type, so that recorded history is never silently reinterpreted. Posted means any referencing ledger record in the active or archived lifecycle state; only when every referencing transaction and transfer is soft-deleted does the lock disengage, matching the approved trash-unlocks behavior.

#### Scenario: Opening balance locked after transactions
- **WHEN** the user attempts to change the opening balance of an account that has posted transactions
- **THEN** the request is rejected with a conflict error explaining the adjustment policy

#### Scenario: Type locked after transactions
- **WHEN** the user attempts to change the type of an account that has posted transactions
- **THEN** the request is rejected with a conflict error

#### Scenario: Type locked after transfers only
- **WHEN** the user attempts to change the type of an account whose only ledger history is one or more non-deleted transfers and no transactions
- **THEN** the request is rejected with a conflict error

#### Scenario: Trash unlocks the lock
- **WHEN** every transaction and transfer referencing the account is soft-deleted and the user changes the opening balance or type
- **THEN** the request succeeds, consistent with the trash-unlocks behavior
