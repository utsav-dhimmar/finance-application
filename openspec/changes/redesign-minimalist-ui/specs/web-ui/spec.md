# Spec Delta

## Purpose

Defines the minimalist user interface design system, application shell, navigation, financial data presentation, and core page layouts across the personal finance web application.

## ADDED Requirements

### Requirement: Universal minimalist application shell and navigation

The web application SHALL render a persistent minimalist header navigation bar across both authenticated and unauthenticated views. When unauthenticated, the header displays the brand identity and navigation links to Home and Sign in. When authenticated, the header displays the brand identity, navigation links to Dashboard and Accounts, the active user's identity, and a Sign out action.

#### Scenario: Unauthenticated header navigation
- **WHEN** an unauthenticated visitor navigates to any public page
- **THEN** the header displays the brand mark and links to the landing page and Sign in

#### Scenario: Authenticated header navigation
- **WHEN** an authenticated user views any application page
- **THEN** the header displays the brand mark, navigation links to Dashboard and Accounts, the user's email, and a Sign out button

### Requirement: Minimalist landing page presentation

The landing page at `/` SHALL present a minimalist hero layout displaying the application's core value proposition, provide direct primary action buttons directing users to sign in or access their dashboard based on authentication state, and provide an understated system readiness indicator.

#### Scenario: Unauthenticated visitor landing experience
- **WHEN** an unauthenticated user visits `/`
- **THEN** the page displays a minimalist hero with headline, value proposition, and a call-to-action button to sign in

#### Scenario: Authenticated visitor landing experience
- **WHEN** an authenticated user visits `/`
- **THEN** the page displays a primary call-to-action button linking directly to the dashboard

### Requirement: Financial dashboard overview layout

The dashboard at `/dashboard` SHALL present a clean, minimalist financial hub for authenticated users, displaying summary cards for aggregated total balance across active accounts, active account count, quick navigation links to account management, and an empty state if no accounts exist.

#### Scenario: Authenticated user visits dashboard with active accounts
- **WHEN** an authenticated user with active accounts opens `/dashboard`
- **THEN** the page displays the combined balance card, active account count, and a quick link to manage accounts

#### Scenario: Authenticated user visits dashboard with no accounts
- **WHEN** an authenticated user with no accounts opens `/dashboard`
- **THEN** the page displays an empty state with zero balance and a prominent action to create an account

### Requirement: Accounts view and responsive card grid

The accounts page at `/accounts` SHALL organize accounts into a responsive grid using minimalist card presentation. Each card SHALL display the account name, account type badge, current balance formatted with tabular numerals, and contextual management actions to edit, archive, or delete.

#### Scenario: View active accounts list
- **WHEN** a user views the active accounts tab
- **THEN** each active account is presented as a minimalist card showing its name, type badge, tabular-numeral balance, and action triggers

#### Scenario: View empty account state
- **WHEN** a user views an account tab that contains no accounts
- **THEN** the view displays a clean, minimalist empty state explaining the tab's status and offering an action to create an account when on the active tab

### Requirement: Minimalist financial tabular currency typography

The web user interface SHALL format all monetary amounts using tabular numerals and consistent currency formatting so figures align cleanly across cards, summaries, and dialogs.

#### Scenario: Financial amounts formatted with tabular numerals
- **WHEN** any currency balance or monetary value is displayed in the user interface
- **THEN** the element renders with tabular numeral styling to maintain consistent digit alignment

### Requirement: Focused minimalist authentication views

The authentication routes at `/login` and `/register` SHALL present a distraction-free, centered minimalist card containing clean input fields, clear validation states, a primary submission action, and navigational links to switch between sign in and account registration.

#### Scenario: Login view presentation
- **WHEN** a user visits `/login`
- **THEN** the interface renders a centered minimalist card containing email and password inputs, submit button, and a link to register

#### Scenario: Registration view presentation
- **WHEN** a user visits `/register`
- **THEN** the interface renders a centered minimalist card containing registration fields, submit button, and a link to sign in
