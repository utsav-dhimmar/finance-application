# Spec Delta

## Purpose

Provides a single user's aggregated financial overview — period income, expenses, net cash flow, category breakdowns, and account balance summaries — under explicit, consistent inclusion rules for archived and deleted records, with transfers permanently excluded from income and expense semantics.

## ADDED Requirements

### Requirement: Period financial overview

The system SHALL provide a financial overview for a selected period (a month or a year) showing total income, total expenses, and net cash flow, where net cash flow equals income minus expenses. The period SHALL be selected by the user with month and year views.

#### Scenario: Monthly overview
- **WHEN** the user selects a month
- **THEN** the overview shows income, expenses, and net cash flow for that calendar month

#### Scenario: Yearly overview
- **WHEN** the user selects a year
- **THEN** the overview shows income, expenses, and net cash flow for that calendar year

#### Scenario: Net cash flow can be negative
- **WHEN** expenses exceed income in the selected period
- **THEN** net cash flow is displayed as a negative amount

### Requirement: Reporting inclusion rules

The system SHALL include active and archived transactions in income, expense, and category reporting, SHALL exclude soft-deleted transactions from ordinary reporting, and SHALL permanently exclude transfers from income, expense, and category totals. These rules SHALL apply identically to the overview, category breakdowns, and any filtered historical report.

#### Scenario: Archived transactions remain in reports
- **WHEN** a transaction is archived
- **THEN** the period totals and category breakdowns still include it

#### Scenario: Deleted transactions leave reports
- **WHEN** a transaction is soft-deleted
- **THEN** the period totals and category breakdowns no longer include it

#### Scenario: Transfers never counted
- **WHEN** transfers exist between accounts in the period
- **THEN** income and expense totals are unchanged by them

### Requirement: Category-based expense breakdown

The system SHALL provide an expense breakdown by category for the selected period, listing each category's total and its share of expenses. Breakdowns SHALL resolve category names by reference regardless of the category's current lifecycle state, and SHALL include expenses recorded against categories that were later archived or deleted.

#### Scenario: Breakdown includes archived categories
- **WHEN** expenses in the period reference a category that has since been archived or deleted
- **THEN** those expenses still appear in the breakdown under that category's name

#### Scenario: Income categories excluded from expense breakdown
- **WHEN** the expense breakdown is displayed
- **THEN** only expense-type amounts appear in it

### Requirement: Account balance summary

The overview SHALL display each active account's current balance and the combined balance across active accounts, following the account balance rules. Archived and deleted accounts SHALL NOT contribute to the combined balance, while their transactions SHALL continue to count in period income and expense totals.

#### Scenario: Combined balance over active accounts
- **WHEN** the user has active and archived accounts
- **THEN** the combined balance sums only the active accounts' current balances

#### Scenario: Archived account activity stays in reports
- **WHEN** an account is archived after recording transactions in the period
- **THEN** those transactions still count in the period's income and expense totals while the account contributes nothing to the combined balance

### Requirement: Historical reporting by date range

The system SHALL allow income and expense reporting to be filtered by an arbitrary date range and, through the transaction list filters, by account and category, using consistent date boundaries and monetary arithmetic. Archived accounts and categories SHALL remain reportable through these filters.

#### Scenario: Filter report by account
- **WHEN** the user filters transactions by an archived account
- **THEN** that account's historical transactions are returned

#### Scenario: Consistent boundaries
- **WHEN** a report covers a date range
- **THEN** transactions on the first and last date of the range are included exactly once

### Requirement: Income-versus-expense comparison chart

The overview SHALL include an income-versus-expense comparison across the natural sub-periods of the selected period — calendar months within a year view and calendar days within a month view — rendered as a chart, with zero-value sub-periods shown as zero.

#### Scenario: Yearly comparison
- **WHEN** the user views a year
- **THEN** the chart compares income and expenses for each month of that year

#### Scenario: Monthly comparison
- **WHEN** the user views a month
- **THEN** the chart compares income and expenses for each day of that month

### Requirement: Empty and zero states

The overview SHALL display correct results for empty data: zero totals, zero-value charts, and an empty category breakdown, without errors. The dashboard SHALL present a distinct empty state when the user has no accounts or no activity at all.

#### Scenario: New user with no data
- **WHEN** the user has no accounts or no transactions in the period
- **THEN** the overview shows zero totals and an explicit empty state rather than an error

### Requirement: Authenticated and scoped reporting access

All reporting endpoints SHALL require authentication, and every aggregation SHALL only include records owned by the authenticated user. Unauthenticated requests SHALL be rejected.

#### Scenario: Unauthenticated access rejected
- **WHEN** a reporting endpoint is called without a valid session
- **THEN** the response is an authentication error and no report data is returned

#### Scenario: Reports only include owned records
- **WHEN** an authenticated user requests an overview
- **THEN** every total, breakdown, and balance reflects only that user's records
