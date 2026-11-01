## 4. Epic A — Account Management

### US-001: Create a financial account

**As a user,** I want to create financial accounts so that I can track money held in different places.

Acceptance criteria:

- Support these account types:
  - Cash
  - Bank
  - Wallet
- Support multiple bank accounts and multiple wallet accounts.
- Each account has a name, type, and opening balance.
- Opening balance represents the amount held in that account at the starting point of its history.
- Validate required fields and monetary values.
- Account names and uniqueness rules must be defined explicitly.
- New accounts appear in the account list and balance summaries.
- Account creation must not create income or expense transactions merely because an opening balance was entered.
- The account's currency follows the application's initial currency policy.
- Failed validation or persistence must not create partial records.

### US-002: View accounts and balances

**As a user,** I want to view all my accounts and their balances so that I can understand where my money is held.

Acceptance criteria:

- Display account name, type, and current balance.
- Support individual account balance views.
- Provide a combined balance across eligible accounts.
- Clearly distinguish active, archived, and deleted accounts in their respective management views.
- Exclude archived and deleted accounts from ordinary account selection.
- Define whether archived accounts appear in historical combined-balance reports.
- Exclude deleted accounts from ordinary current-balance summaries.
- Calculate balances consistently using opening balances and eligible posted transactions.
- Handle zero balances and accounts with negative balances according to the defined product policy.

### US-003: Edit an account

**As a user,** I want to edit an account's details so that my financial records remain accurate.

Acceptance criteria:

- Allow permitted fields such as account name and display preferences to be updated.
- Validate updates before persistence.
- Editing an account name must not break historical transaction references.
- Changing an account type must not silently alter financial history.
- Changing an opening balance after transactions exist must follow an explicit adjustment policy.
- Archived and deleted accounts cannot be edited through the ordinary active-account workflow.

### US-004: Archive or soft-delete an account

**As a user,** I want to archive or soft-delete an account so that I can stop using it without losing historical financial data.

Acceptance criteria:

- Archiving and deletion are separate operations.
- Archived accounts are excluded from ordinary active account selection.
- Deleted accounts are excluded from ordinary lists and current-balance summaries.
- Existing transactions and transfers retain their historical account references.
- Archiving or deleting an account must not cascade-delete its transactions.
- Define constraints for accounts with nonzero balances or pending transfers.
- Restoring an account must preserve its historical information.
- Account lifecycle changes must not silently change previously recorded amounts.

### US-005: View account transaction history

**As a user,** I want to inspect transactions associated with an account so that I can understand changes in its balance.

Acceptance criteria:

- Display applicable income, expenses, transfers, and opening-balance information.
- Support date filtering and chronological ordering.
- Display transaction amounts and their effect on the account balance.
- Exclude deleted transactions from ordinary history views.
- Keep archived transactions available for historical inspection.
- Clearly distinguish incoming and outgoing transfers.
- Historical views must remain meaningful when related categories or accounts have been archived.
