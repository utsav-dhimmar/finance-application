# Spec Delta

## MODIFIED Requirements

### Requirement: Universal minimalist application shell and navigation

The web application SHALL render a persistent minimalist header navigation bar across both authenticated and unauthenticated views. When unauthenticated, the header displays the brand identity and navigation links to Home and Sign in. When authenticated on desktop viewports, the header displays the brand identity, navigation links to Dashboard and Accounts, the active user's identity, and a Sign out action. On compact and mobile viewports (< 768px), the header SHALL collapse navigation links into an accessible mobile menu control to prevent horizontal scrolling and layout wrapping.

#### Scenario: Unauthenticated header navigation
- **WHEN** an unauthenticated visitor navigates to any public page
- **THEN** the header displays the brand mark and links to the landing page and Sign in

#### Scenario: Authenticated header navigation
- **WHEN** an authenticated user views any application page
- **THEN** the header displays the brand mark, navigation links to Dashboard and Accounts, the user's email, and a Sign out button

#### Scenario: Compact and mobile viewport navigation
- **WHEN** an authenticated user views the application on a viewport narrower than 768px
- **THEN** the navigation links are accessible via a mobile menu control without causing header horizontal scrolling or layout wrapping

## ADDED Requirements

### Requirement: Responsive modal dialog viewport containment and scrolling

Modal dialogs and confirmation alert dialogs SHALL remain constrained within the visible viewport bounds across mobile devices and desktop display scaling. When dialog content or interactive forms exceed the available vertical space, the dialog container SHALL scroll vertically internally so that dialog titles, form inputs, and action buttons remain reachable and operable.

#### Scenario: Dialog opened on small screen or height-constrained viewport
- **WHEN** a user opens any form or detail dialog (including transaction, transfer, account, or category dialogs) on a mobile device or a height-constrained browser window
- **THEN** the dialog fits within the viewport with safe margins, does not clip off-screen, and enables internal vertical scrolling to access all fields and submission buttons

#### Scenario: Confirmation alert dialog on mobile viewport
- **WHEN** a user triggers a lifecycle confirmation alert dialog on a mobile device
- **THEN** the alert dialog is constrained to the screen width with appropriate padding and displays both cancel and confirm actions fully within the viewport

### Requirement: Responsive data table horizontal containment

Data tables displaying transactions, activities, and trash or archive records SHALL render inside dedicated horizontal scrolling containers that prevent wide multi-column tables from breaking the page width or causing whole-document horizontal scroll on mobile devices.

#### Scenario: Viewing data tables on mobile viewport
- **WHEN** a user views the transactions, archive, or trash table on a mobile viewport
- **THEN** the table scrolls horizontally within its card container while page layout, header, and filter controls remain stably aligned
