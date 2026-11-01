# Spec Delta

## Purpose

Persists a single user's application preferences — starting with the display-currency setting under a defined supported-currency model — strictly separate from financial records, so display configuration never rewrites or reinterprets stored money.

## ADDED Requirements

### Requirement: Supported currency configuration model

The system SHALL define display currencies through a server-side registry in which each supported currency is identified by an ISO 4217 code and carries its display symbol and minor-unit exponent. INR (symbol ₹, minor-unit exponent 2) SHALL be the only initially supported currency and the default preference. Requesting an unsupported currency SHALL be rejected with a validation error.

#### Scenario: INR is the default
- **WHEN** a user with no stored preferences reads their preferences
- **THEN** the display currency is INR with defaults applied

#### Scenario: Unsupported currency rejected
- **WHEN** the user sets a currency code that is not in the supported registry
- **THEN** the request is rejected with a validation error and the preference is unchanged

### Requirement: Persisted preferences API

The system SHALL provide an authenticated preferences API to read the user's preferences (returning defaults when none were ever saved) and to update the supported fields with validation. Preferences SHALL persist across sessions and SHALL be stored server-side so any client of the API observes the same values.

#### Scenario: Preferences persist across sessions
- **WHEN** the user changes a preference and later re-authenticates
- **THEN** the saved value is returned

#### Scenario: Unauthenticated access rejected
- **WHEN** a preferences endpoint is called without a valid session
- **THEN** the response is an authentication error and no preference data is returned

### Requirement: Display-only currency semantics

The display-currency preference SHALL affect presentation only. Stored monetary amounts SHALL remain integer minor units of their original currency and SHALL NOT be restated, converted, or modified when the preference changes. The system SHALL NOT imply that changing the display currency performs exchange-rate conversion, and SHALL NOT support currencies that would require conversion while conversion is unimplemented.

#### Scenario: Stored amounts unchanged by preference change
- **WHEN** the user changes the display-currency preference
- **THEN** every stored amount remains identical and all balances and reports keep their stored values

#### Scenario: Formatting derives from the model
- **WHEN** a monetary value is displayed
- **THEN** the symbol and fraction-digit count come from the supported-currency registry's definition for the active display currency

### Requirement: Centralized formatting

The system SHALL provide one central currency-formatting mechanism used by forms, lists, reports, and charts, driven by the active display-currency preference. Components SHALL NOT implement their own currency formatting.

#### Scenario: Consistent formatting across surfaces
- **WHEN** monetary values appear on the dashboard, accounts, transactions, and dialogs
- **THEN** they are all formatted by the same mechanism with the same symbol and grouping

### Requirement: Preferences are separate from financial records

The system SHALL keep preference changes fully separate from financial records: changing preferences SHALL NOT create, modify, or delete any account, transaction, transfer, or category, and SHALL NOT affect any balance, report total, or lifecycle state.

#### Scenario: No financial side effects
- **WHEN** any preference is read or updated
- **THEN** no financial record changes and all balances and reports remain exactly as before
