# android-ui Specification

## Purpose

Defines the mobile design system for the Expo application: the boxy StyleSheet theme tokens, styling conventions, and the scaffold screens (sign-in, authenticated home) that future finance screens build on.

## Requirements

### Requirement: Boxy visual style

The application SHALL render all screens in the boxy style: every surface — buttons, inputs, cards, containers, and overlays — SHALL have zero corner radius with sharp geometric edges, and layouts SHALL use a flat, structured composition of bordered blocks rather than rounded or floating elements. UI that the platform itself renders — native tab bars, native dropdown menus, and other system-presented surfaces — SHALL follow the platform's own styling and is exempt from the zero-radius rule; every surface the application draws itself SHALL remain boxy.

#### Scenario: No rounded surfaces

- **WHEN** any screen of the application is rendered
- **THEN** every visible button, input, card, and container has zero corner radius

#### Scenario: Platform-rendered native surfaces follow system styling

- **WHEN** the user opens a native dropdown menu or views the native bottom tab bar
- **THEN** those surfaces are presented with the platform's own styling rather than the application's boxy theme, while every trigger, field, card, and screen surface the application renders stays boxy

### Requirement: Device color scheme

The application SHALL follow the device's current color scheme: screens SHALL render with the dark theme palette when the device is in dark mode and the light theme palette when in light mode, and a change of the device scheme SHALL update the rendered theme without restarting the app.

#### Scenario: Dark-mode device renders the dark theme

- **WHEN** the device is set to dark mode and the user opens the app
- **THEN** screens render with the dark theme palette (dark background, light foreground)

#### Scenario: Scheme change updates the theme live

- **WHEN** the user changes the device color scheme while the app is open
- **THEN** the rendered theme switches to match the new scheme without restarting the app

### Requirement: StyleSheet-only styling

The application SHALL define all screen styling through React Native StyleSheet declarations. Third-party styling frameworks that substitute or layer CSS-like systems (utility-class frameworks, styled-components, CSS-in-JS libraries) SHALL NOT be introduced as application dependencies.

#### Scenario: Dependency audit finds no styling frameworks

- **WHEN** the `apps/android` package dependencies are inspected
- **THEN** no utility-CSS, styled-components, or CSS-in-JS styling framework is present, and all component styles are declared as React Native StyleSheet objects

### Requirement: Single theme source

The application SHALL define its visual theme (colors, spacing, typography) as a single shared source consumed by all screens, and screens SHALL NOT hardcode color or spacing values outside that theme.

#### Scenario: Screens consume shared tokens

- **WHEN** any screen renders colors, spacing, or typography
- **THEN** the values come from the shared theme source, and no screen defines its own color or spacing literals

### Requirement: Sign-in screen

The application SHALL provide a sign-in screen with email and password fields and a submit action. The submit action SHALL be disabled while the fields are empty or a sign-in request is in flight, SHALL show an in-flight indication while requesting, and SHALL surface failures as an on-screen message without clearing the entered values.

#### Scenario: Submit disabled for empty fields

- **WHEN** the email or password field is empty
- **THEN** the submit action is not triggerable

#### Scenario: Successful sign-in navigates home

- **WHEN** the user submits valid credentials
- **THEN** the app shows an in-flight indication during the request and then navigates to the authenticated home screen

#### Scenario: Failure keeps entered values

- **WHEN** the sign-in request fails
- **THEN** an on-screen message describes the failure and the email and password fields keep their entered values

### Requirement: Authenticated tab shell

The authenticated application SHALL render as a persistent shell consisting of an app header and a bottom tab bar. The app header SHALL display the signed-in user's email and the sign-out control, and both SHALL remain visible across all tab screens.

#### Scenario: Core destinations are present

- **WHEN** a signed-in user views the tab bar
- **THEN** it offers the Dashboard, Transactions, Accounts, and Categories destinations, and the Dashboard tab is the initial screen

#### Scenario: Switching between tabs

- **WHEN** a signed-in user activates the Accounts tab and then the Categories tab
- **THEN** the corresponding screen renders while the app header with the user's email and sign-out control remains in place

#### Scenario: Pending screens show a notice

- **WHEN** the user opens a tab whose capability has not yet been delivered
- **THEN** a minimal notice is displayed instead of finance content

#### Scenario: Sign-out from the shell

- **WHEN** the user activates the sign-out control in the app header
- **THEN** the session ends and the sign-in screen is shown

### Requirement: Accounts screen

The application SHALL provide an Accounts screen reachable from the bottom tab bar that lists the user's accounts as cards with status tabs for Active, Archived, and Trash, provides create and edit account actions through a form validated against the shared Zod schema, and provides archive, soft-delete, and restore lifecycle actions behind confirmations.

#### Scenario: Viewing active accounts with balances

- **WHEN** the user opens the Accounts tab with active accounts
- **THEN** each account renders as a card with its name, type, and current balance formatted with the API-provided currency symbol and minor-unit exponent

#### Scenario: Empty accounts state

- **WHEN** the user opens the Accounts tab with no accounts for the selected status tab
- **THEN** an empty-state message for that tab is shown instead of cards

#### Scenario: Creating an account

- **WHEN** the user submits a valid account form with name, type, and opening balance
- **THEN** the account is created, the form dialog closes, and the list shows the new account with its balance

#### Scenario: Invalid account form blocks submission

- **WHEN** the account form is submitted with an invalid name, type, or balance
- **THEN** submission is blocked and the offending field shows the shared schema's validation message

#### Scenario: Editing an account

- **WHEN** the user edits an existing account and submits valid changes
- **THEN** the account is updated and the card reflects the new values

#### Scenario: Archive and delete with confirmation

- **WHEN** the user activates archive or delete on an account and confirms the dialog
- **THEN** the account leaves the active list and appears under the Archived or Trash tab

#### Scenario: Restoring from Archived or Trash

- **WHEN** the user restores an archived or trashed account and the name is not in conflict
- **THEN** the account returns to the Active tab

#### Scenario: Restore with name conflict

- **WHEN** the user restores an account whose name conflicts with an existing account
- **THEN** the app offers entering a new name and restores the account under it

### Requirement: Categories screen

The application SHALL provide a Categories screen reachable from the bottom tab bar that lists the user's categories as cards with status tabs for Active, Archived, and Trash, provides create and edit category actions through a form validated against the shared Zod schema, and provides archive, soft-delete, and restore lifecycle actions behind confirmations.

#### Scenario: Viewing active categories

- **WHEN** the user opens the Categories tab with active categories
- **THEN** each category renders as a card with its name, type, color, and icon

#### Scenario: Empty categories state

- **WHEN** the user opens the Categories tab with no categories for the selected status tab
- **THEN** an empty-state message for that tab is shown instead of cards

#### Scenario: Creating a category

- **WHEN** the user submits a valid category form with name, type, color, and icon
- **THEN** the category is created and the list shows the new category card

#### Scenario: Invalid category form blocks submission

- **WHEN** the category form is submitted with an invalid field
- **THEN** submission is blocked and the offending field shows the shared schema's validation message

#### Scenario: Editing a category

- **WHEN** the user edits an existing category and submits valid changes
- **THEN** the category is updated and the card reflects the new values

#### Scenario: Category lifecycle with restore

- **WHEN** the user archives, soft-deletes, or restores a category through the confirmation dialogs
- **THEN** the category moves between the Active, Archived, and Trash tabs accordingly, with a name-conflicting restore offering a new name

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

### Requirement: Dashboard year selection window

The dashboard's year select SHALL offer the calendar years from ten years before through ten years after the device's current year, always including the current year as the default selection. The reporting API's accepted year range is unaffected; this bounds only the options the mobile picker presents.

#### Scenario: Year options span a rolling window

- **WHEN** the dashboard's period mode is set to year and the user opens the year select
- **THEN** the offered options run from ten years before the device's current year through ten years after it, and the device's current year is preselected

#### Scenario: Default period remains the current year

- **WHEN** the user switches the dashboard's period mode to year
- **THEN** the current year is selected and the report refetches for it without reloading the app

### Requirement: Activity list screen

The application SHALL provide an activity screen on the Transactions tab that renders the unified activity feed — transactions and transfers combined from one account-perspective list — as a scrolling list, with status tabs for Active, Archived, and Trash, filters, and progressive loading of further pages.

#### Scenario: Viewing the active feed

- **WHEN** the user opens the Transactions tab
- **THEN** activity rows render newest first with date, kind, category or counterparty account, and signed amounts, where incomes credit, expenses debit, and a transfer shows its effect for the row's account side, all formatted in the active currency

#### Scenario: Status tabs scope the feed

- **WHEN** the user switches between the Active, Archived, and Trash tabs
- **THEN** the feed lists only entries with that status

#### Scenario: Filters shape the feed

- **WHEN** the user applies any combination of type, account, category, date-range, or search filters
- **THEN** the feed shows only matching entries and further page loading restarts from the first page

#### Scenario: Category filter excludes transfers

- **WHEN** the user filters by a category
- **THEN** no transfer rows appear, because transfers carry no category

#### Scenario: Loading more pages

- **WHEN** the user activates the load-more control with further pages available
- **THEN** the next page of the feed appends below the loaded rows with the current filters preserved

#### Scenario: Empty feed state

- **WHEN** the feed for the selected tab and filters contains no entries
- **THEN** an empty-state message is shown instead of rows

### Requirement: Transaction management

The application SHALL provide transaction create and edit actions on the activity screen through a form validated against the shared Zod schema (type, amount, date, account, category, notes), and archive, soft-delete, and restore actions behind confirmation dialogs, with archived and trashed transactions restorable from their tabs.

#### Scenario: Creating a transaction

- **WHEN** the user submits a valid transaction form with type, amount, date, account, category, and optional notes
- **THEN** the transaction is created, the form dialog closes, and the amount converts to integer minor units in the request

#### Scenario: Invalid transaction form blocks submission

- **WHEN** the form is submitted with a non-positive amount, a malformed date, a missing account, or a missing category
- **THEN** submission is blocked and each offending field shows the shared schema's validation message

#### Scenario: Editing a transaction

- **WHEN** the user edits an existing transaction and submits valid changes
- **THEN** the transaction is updated and the feed row reflects the new values

#### Scenario: Transaction lifecycle

- **WHEN** the user archives, soft-deletes, or restores a transaction through the confirmation dialogs
- **THEN** the transaction moves between the Active, Archived, and Trash lists accordingly

### Requirement: Transfer management

The application SHALL provide transfer create and edit actions on the activity screen through a form validated against the shared Zod schema (amount, date, source account, destination account, notes), and archive, soft-delete, and restore actions behind confirmation dialogs. A transfer SHALL appear once per involved account side in the feed, and creating or editing a transfer SHALL require two different accounts.

#### Scenario: Creating a transfer

- **WHEN** the user submits a valid transfer form with amount, date, source, and destination accounts
- **THEN** the transfer is created and the feed shows its debit on the source side and credit on the destination side

#### Scenario: Same source and destination blocked

- **WHEN** the transfer form is submitted with the same account selected as source and destination
- **THEN** submission is blocked with the shared schema's accounts-must-differ message

#### Scenario: Invalid transfer form blocks submission

- **WHEN** the form is submitted with a non-positive amount, a malformed date, or a missing account
- **THEN** submission is blocked and each offending field shows the shared schema's validation message

#### Scenario: Editing a transfer

- **WHEN** the user edits an existing transfer and submits valid changes
- **THEN** the transfer is updated and both feed sides reflect the new values

#### Scenario: Transfer lifecycle

- **WHEN** the user archives, soft-deletes, or restores a transfer through the confirmation dialogs
- **THEN** the transfer's feed sides move between the Active, Archived, and Trash lists accordingly

### Requirement: Native select menus

The application SHALL open each select field's option list as a platform native dropdown menu when the field is pressed. The select trigger SHALL remain an application-rendered, StyleSheet-styled surface that shows the field's label, its current selection, or its placeholder, and the native menu SHALL mark the currently selected option. Choosing an option SHALL update the field's value and dismiss the menu; dismissing the menu without choosing SHALL leave the value unchanged.

#### Scenario: Select opens a native menu

- **WHEN** the user presses any select field (dashboard period selects, activity filters, form dialog account and category selects)
- **THEN** a platform native dropdown menu opens listing the field's options with the current selection marked

#### Scenario: Choosing an option updates the field

- **WHEN** the user selects an option in the native menu
- **THEN** the menu closes and the trigger displays the chosen option's label

#### Scenario: Dismissing without choosing keeps the value

- **WHEN** the user dismisses the native menu without selecting an option
- **THEN** the field keeps its previous value

#### Scenario: Trigger stays application-styled

- **WHEN** a select field renders on any screen
- **THEN** the trigger surface uses the application's boxy StyleSheet theme
