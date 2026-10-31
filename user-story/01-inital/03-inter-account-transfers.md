## 6. Epic C — Inter-Account Transfers

### US-014: Transfer money between accounts

**As a user,** I want to transfer money between my own accounts so that my recorded balances reflect movements of money.

Acceptance criteria:

- Select a source account and destination account.
- Require the source and destination to be different eligible accounts.
- Capture transfer amount, date, and optional notes.
- Validate the amount and account eligibility.
- Decrease the source account and increase the destination account consistently.
- Treat transfers as neither income nor expenses in financial summaries.
- Persist the transfer and all associated balance effects atomically.
- Prevent duplicate transfers caused by retries.
- Preserve a clear relationship between the source and destination sides of the transfer.
- Support viewing the transfer from either account's transaction history.
- Define behavior for archived or deleted transfers, including restoration.
- Do not allow an invalid transfer to update only one account.

### US-015: View and edit transfers

**As a user,** I want to inspect and correct a transfer so that I can maintain accurate account balances.

Acceptance criteria:

- Display source account, destination account, amount, date, and notes.
- Editing a transfer updates both account effects consistently.
- Reject a transfer if the source and destination accounts are identical.
- Validate account eligibility before changing the transfer.
- Avoid double-counting transfers in income and expense reports.
- Ensure changes and deletions are applied atomically to both account effects.

### US-016: Delete or archive a transfer

**As a user,** I want to archive or soft-delete a transfer so that I can correct or remove it from active workflows without corrupting account balances.

Acceptance criteria:

- Archive and deletion remain distinct lifecycle operations.
- Archiving preserves the transfer and its historical balance effects.
- Soft deletion removes the transfer's effects from current calculated balances, according to the approved balance policy.
- Restoration reinstates the transfer's effects exactly once.
- Permanent deletion requires explicit confirmation.
- Both account effects must always be treated as one logical operation.
- Transfer history must remain understandable after related accounts are archived.
