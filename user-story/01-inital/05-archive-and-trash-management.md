## 9. Epic F — Archive and Trash Management

### US-022: Manage archived records

**As a user,** I want to inspect and restore archived records so that I can manage historical data without losing it.

Acceptance criteria:

- Display archived records separately from active and deleted records.
- Support applicable record types, including transactions, categories, and accounts.
- Permit inspection and eligible restoration.
- Validate dependencies before restoration.
- Preserve financial history and account relationships.
- Keep archived transactions in historical income and expense reports.

### US-023: Manage deleted records

**As a user,** I want to recover accidentally deleted records so that I can correct mistakes.

Acceptance criteria:

- Display soft-deleted records in Trash.
- Separate Trash from Archive.
- Support inspection and eligible restoration.
- Validate relationships and uniqueness constraints before restoration.
- Require confirmation for permanent deletion.
- Ensure ordinary application queries exclude deleted records.
- Prevent deletion or restoration from silently corrupting balances.
