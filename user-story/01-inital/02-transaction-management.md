## 5. Epic B — Transaction Management

### US-006: Create an income transaction

**As a user,** I want to record income received into an account so that my financial records reflect incoming money.

Acceptance criteria:

- Capture amount, date, destination account, category, and optional notes.
- Validate the amount and all required fields.
- Require an eligible active destination account.
- Require a compatible active income category.
- Increase the destination account's balance by the recorded income amount.
- Include the transaction in income reporting.
- Prevent duplicate creation caused by retries.

### US-007: Create an expense transaction

**As a user,** I want to record an expense paid from an account so that I can track my spending.

Acceptance criteria:

- Capture amount, date, source account, category, and optional notes.
- Validate the amount and required fields.
- Require an eligible active source account.
- Require a compatible active expense category.
- Decrease the source account's balance by the recorded expense amount.
- Include the transaction in expense reporting.
- Define how negative account balances are handled.
- Prevent duplicate creation caused by retries.

### US-008: View and filter transactions

**As a user,** I want to view and filter my transactions so that I can find financial records quickly.

Acceptance criteria:

- Display date, transaction type, amount, account, category, and notes where available.
- Support filters for date range, type, account, and category.
- Support searching appropriate textual fields.
- Support pagination or an equivalent scalable loading strategy.
- Combine multiple filters consistently.
- Exclude archived and deleted transactions from the ordinary active list.
- Provide appropriate loading, empty, and error states.

### US-009: Edit a transaction

**As a user,** I want to edit a transaction so that I can correct mistakes.

Acceptance criteria:

- Allow permitted fields of active transactions to be edited.
- Validate updates before persistence.
- Recalculate affected account balances and financial summaries atomically.
- Handle account or category changes without double-counting amounts.
- Reject invalid updates without partially modifying records.
- Archived and deleted transactions cannot be edited through the normal active workflow.

### US-010: View transaction details

**As a user,** I want to inspect a transaction so that I can verify its details and financial impact.

Acceptance criteria:

- Display all applicable transaction details.
- Identify the transaction type and associated account or accounts.
- Display category, amount, date, and notes where applicable.
- Show lifecycle state in Archive and Trash management views.
- Handle archived or deleted related records without losing historical context.

### US-011: Soft-delete a transaction

**As a user,** I want to move a transaction to Trash so that I can remove it from active financial records without immediately losing recoverable history.

Acceptance criteria:

- Mark the transaction as deleted rather than physically removing it.
- Exclude it from ordinary income and expense reports.
- Recalculate account balances consistently after deletion.
- Preserve the record in Trash.
- Permit restoration when business constraints allow it.
- Prevent accidental cascading deletion of related records.

### US-012: Archive a transaction

**As a user,** I want to archive a transaction so that I can remove it from my active workflow while retaining historical records.

Acceptance criteria:

- Mark the transaction as archived, not deleted.
- Exclude it from the ordinary active transaction list.
- Retain it in the Archive view.
- Continue including it in historical income and expense reports.
- Preserve its effect on account balances.
- Allow restoration to active status when eligible.

### US-013: Restore or permanently delete a transaction

**As a user,** I want to restore transactions from Trash or permanently remove them when necessary.

Acceptance criteria:

- Display deleted transactions in Trash.
- Allow inspection before restoration or permanent deletion.
- Validate related accounts, categories, and uniqueness constraints during restoration.
- Recalculate affected balances after restoration.
- Require explicit confirmation for permanent deletion.
- Define the effect of permanent deletion on auditability and historical references.
- Do not permanently delete records automatically without an approved policy.
