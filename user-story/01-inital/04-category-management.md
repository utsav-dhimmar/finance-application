## 7. Epic D — Category Management

### US-017: Create a category

**As a user,** I want to create custom categories so that I can organize income and expenses.

Acceptance criteria:

- Support income and expense category types.
- Capture category name and applicable presentation properties.
- Validate required fields and category type.
- Define duplicate-name behavior.
- Make categories available for compatible transactions only when active.
- Avoid requiring a fixed, hardcoded category list.

### US-018: View and edit categories

**As a user,** I want to view and edit categories so that my financial records remain organized.

Acceptance criteria:

- Separate active, archived, and deleted categories.
- Allow permitted fields to be updated.
- Preserve historical transaction references when a category is renamed.
- Do not silently change historical transaction amounts.
- Define safe behavior when changing category type for categories already in use.

### US-019: Archive or soft-delete a category

**As a user,** I want to archive or delete a category without losing historical transaction information.

Acceptance criteria:

- Archiving and deletion are distinct operations.
- Archived and deleted categories are unavailable for ordinary new transaction selection.
- Existing transactions retain a historical category reference or sufficient historical snapshot.
- Never cascade-delete transactions because a category was deleted.
- Restoration must validate relationships and uniqueness constraints.
- Define how transactions can be reassigned if their category cannot be restored.

## 8. Epic E — Financial Dashboard and Reporting

### US-020: View financial overview

**As a user,** I want to see a summary of my financial activity so that I can understand my finances.

Acceptance criteria:

- Display income, expenses, and net cash flow for a selected period.
- Support monthly and yearly views.
- Provide category-based expense summaries.
- Provide individual account balances and combined balance summaries.
- Keep transfers separate from income and expense totals.
- Exclude soft-deleted transactions from ordinary reporting.
- Include archived transactions in historical income and expense reports.
- Define and consistently apply account inclusion rules for combined balances.
- Handle empty data, zero totals, and negative balances correctly.

### US-021: Review historical reports

**As a user,** I want to review historical financial activity so that I can understand changes over time.

Acceptance criteria:

- Filter reports by date range and applicable account or category.
- Use consistent date boundaries and monetary arithmetic.
- Preserve historical reporting when categories or accounts are archived.
- Include archived transactions in historical income and expense totals.
- Exclude deleted transactions from ordinary reports.
- Keep transfers out of income and expense totals.
- Clearly define whether historical account balances include archived accounts.
