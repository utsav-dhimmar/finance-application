# Spec Delta

## ADDED Requirements

### Requirement: Searchable combobox selection for user-driven option lists

The web UI SHALL provide a searchable combobox for selection fields whose options are user-driven entity lists (accounts and categories): transaction form account and category, transfer form from/to account, recurring expense form account and category, and transaction list account and category filters. The combobox popup SHALL contain a text input that filters options as the user types. Fixed small option lists (transaction type, recurrence interval, currency) SHALL remain plain selects.

#### Scenario: Typing filters the option list

- **WHEN** the user types text into a combobox input
- **THEN** the option list narrows to options whose label matches the typed text case-insensitively

#### Scenario: Selecting an option from the combobox

- **WHEN** the user picks an option from the combobox popup
- **THEN** the field holds that single selection, the control displays the selected option's label, and the popup closes

#### Scenario: Combobox used for transaction form account and category

- **WHEN** the user opens the account or category field in the transaction form dialog
- **THEN** the popup contains a search input that filters the account or category options

#### Scenario: Combobox used for transfer form account fields

- **WHEN** the user opens the from-account or to-account field in the transfer form dialog
- **THEN** the popup contains a search input that filters the account options

#### Scenario: Combobox used for recurring expense account and category fields

- **WHEN** the user opens the account or category field in the recurring expense form
- **THEN** the popup contains a search input that filters the account or category options

#### Scenario: Transaction filters keep all-entries reset options

- **WHEN** the user opens the account or category filter combobox on the transaction list
- **THEN** "All accounts" or "All categories" remains selectable as the first option, and selecting it restores the unfiltered list

#### Scenario: Archived accounts remain selectable with a marker

- **WHEN** an account selection list includes archived accounts
- **THEN** archived accounts remain selectable and display an archived marker on their label

#### Scenario: Fixed small option lists stay plain selects

- **WHEN** the user opens the transaction type, recurrence interval, or currency preference control
- **THEN** a plain select without a search input is shown

#### Scenario: Keyboard operability

- **WHEN** the user focuses a combobox input and navigates with the keyboard
- **THEN** arrow keys move the highlight, Enter selects the highlighted option, and Escape closes the popup without changing the field value
