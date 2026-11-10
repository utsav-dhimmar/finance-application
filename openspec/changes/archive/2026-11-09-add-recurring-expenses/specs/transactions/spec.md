# Spec Delta

## ADDED Requirements

### Requirement: Record expense with immediate recurrence schedule
The system SHALL allow an authenticated user to record an expense transaction while simultaneously configuring an active recurring expense schedule. When recurrence is specified, the system SHALL atomically create the expense transaction in the ledger for immediate payment, create the linked recurring rule with the specified interval in months, and set the rule's next due date to the transaction date advanced by the interval.

#### Scenario: Successful transaction and recurring schedule creation
- **WHEN** the user creates an expense transaction with recurrence enabled (e.g. 1 month, 2 months, 3 months)
- **THEN** an immediate expense transaction is recorded in the ledger and an active recurring expense rule is registered with its next due date scheduled for one interval after the transaction date

#### Scenario: Atomic validation failure
- **WHEN** the recurrence parameters are invalid (e.g. non-positive interval) during transaction creation
- **THEN** the request is rejected with a validation error and neither the transaction nor the recurring rule is created

### Requirement: Link transaction to recurring expense rule
The system SHALL support an optional reference linking an expense transaction to the recurring expense rule from which it originated. Transactions posted from a recurring schedule or created with recurrence enabled SHALL store this reference. Lifecycle operations on the transaction SHALL NOT cascade to the recurring rule.

#### Scenario: View recurring link on transaction
- **WHEN** the user views details for a transaction generated from a recurring rule
- **THEN** the transaction displays its association with the originating recurring expense rule

#### Scenario: Deleting linked transaction preserves recurring rule
- **WHEN** a transaction linked to a recurring rule is soft-deleted
- **THEN** only the transaction is moved to trash while the recurring rule continues to operate normally
