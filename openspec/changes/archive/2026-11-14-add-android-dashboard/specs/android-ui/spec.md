# Spec Delta

## ADDED Requirements

### Requirement: Dashboard period selection

The application SHALL provide a dashboard screen on the Dashboard tab whose reporting period is selectable between month and year modes, defaulting to the current month derived from the device's local clock, and SHALL label the period the same way the web does (month name with year, or the year).

#### Scenario: Default period is the current month

- **WHEN** the user opens the Dashboard tab
- **THEN** the summary is requested for the current month per the device's local clock and the period label names that month and year

#### Scenario: Switching to year mode

- **WHEN** the user switches the period mode to year and selects a year
- **THEN** the summary is requested for that year and the period label shows the year

#### Scenario: Period change refetches

- **WHEN** the user selects a different month or year
- **THEN** the dashboard's data refetches for the selected period without reloading the app

### Requirement: Dashboard summary cards

The dashboard SHALL show the period's income, expenses, and net cash flow as summary cards formatted with the API-provided currency symbol and minor-unit exponent, with net cash flow distinguishable as negative when expenses exceed income.

#### Scenario: Cards show period totals

- **WHEN** the reporting summary for the selected period is loaded
- **THEN** the income, expenses, and net cash flow cards render the period's totals in the active currency

#### Scenario: Negative net cash flow is identifiable

- **WHEN** the period's expenses exceed its income
- **THEN** the net cash flow card renders the negative amount as such

### Requirement: Dashboard category breakdown

The dashboard SHALL list the period's expense categories largest total first, each with its share of the period's expenses rendered as a proportional bar without any chart library, and a category whose record was permanently deleted SHALL fall back to a generic name.

#### Scenario: Breakdown orders and sizes by share

- **WHEN** the reporting summary includes expense categories
- **THEN** the list renders largest total first with each bar's width reflecting the category's share percent of period expenses

#### Scenario: Deleted category falls back

- **WHEN** a breakdown category's record was permanently deleted from trash
- **THEN** the row renders with a generic fallback name instead of a missing value

### Requirement: Dashboard account balances

The dashboard SHALL show the user's active accounts with their current balances and the combined balance across active accounts, all formatted in the active currency.

#### Scenario: Account balances section

- **WHEN** the reporting summary includes active accounts
- **THEN** each account renders with its current balance and the combined balance across active accounts is displayed

#### Scenario: No accounts

- **WHEN** the user has no active accounts
- **THEN** the balances section renders with a combined balance of zero and no account rows
