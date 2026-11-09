# android-ui Specification

## Purpose

Defines the mobile design system for the Expo application: the boxy StyleSheet theme tokens, styling conventions, and the scaffold screens (sign-in, authenticated home) that future finance screens build on.

## Requirements

### Requirement: Boxy visual style

The application SHALL render all screens in the boxy style: every surface — buttons, inputs, cards, containers, and overlays — SHALL have zero corner radius with sharp geometric edges, and layouts SHALL use a flat, structured composition of bordered blocks rather than rounded or floating elements.

#### Scenario: No rounded surfaces

- **WHEN** any screen of the application is rendered
- **THEN** every visible button, input, card, and container has zero corner radius

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

### Requirement: Authenticated home screen

The application SHALL provide an authenticated home screen that displays the signed-in user's email and the sign-out control, laid out with the shared boxy theme.

#### Scenario: Home shows account identity

- **WHEN** a signed-in user views the home screen
- **THEN** the user's email is visible together with the sign-out control
