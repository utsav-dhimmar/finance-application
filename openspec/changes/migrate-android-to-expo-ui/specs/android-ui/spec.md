# Spec Delta

## ADDED Requirements

### Requirement: Native-backed interactive components

The application SHALL render its interactive controls — buttons, text inputs, dialogs and bottom sheets, dropdown selects, date fields, segmented status tabs, the bottom tab bar, spinners, and scrolling/long lists — using platform-native backed components (components whose rendering and interaction run on the native toolkit rather than emulated React Native primitives). Long lists SHALL use native lazy-list components so scrolling and item recycling run on the native thread.

#### Scenario: Controls are native-backed

- **WHEN** any interactive control on a screen is rendered
- **THEN** it is backed by a platform-native component rather than a hand-rolled React Native `Pressable`/`Modal`/`FlatList` emulation of that control

#### Scenario: Activity feed scrolls natively

- **WHEN** the user scrolls the transactions activity feed
- **THEN** the list is rendered by a native lazy-list component with paged loading preserved

#### Scenario: Date field uses the native picker

- **WHEN** the user opens a date field in a form or filter
- **THEN** a platform-native date picker surface is shown, and the separate community date-picker dependency is absent from the app's dependencies

## MODIFIED Requirements

### Requirement: Boxy visual style

The application SHALL render all screens in the boxy style: every surface — buttons, inputs, cards, containers, and overlays, including controls rendered by the platform-native component layer — SHALL have zero corner radius with sharp geometric edges, and layouts SHALL use a flat, structured composition of bordered blocks rather than rounded or floating elements.

#### Scenario: No rounded surfaces

- **WHEN** any screen of the application is rendered
- **THEN** every visible button, input, card, and container has zero corner radius

#### Scenario: Native-backed controls are boxy

- **WHEN** a native-backed button, input, dialog, dropdown, or tab bar renders
- **THEN** it carries zero corner radius from the shared native theme mapping, not the platform default shape

### Requirement: Device color scheme

The application SHALL follow the device's current color scheme: screens SHALL render with the dark theme palette when the device is in dark mode and the light theme palette when in light mode, and a change of the device scheme SHALL update the rendered theme without restarting the app.

#### Scenario: Dark-mode device renders the dark theme

- **WHEN** the device is set to dark mode and the user opens the app
- **THEN** screens render with the dark theme palette (dark background, light foreground)

#### Scenario: Scheme change updates the theme live

- **WHEN** the user changes the device color scheme while the app is open
- **THEN** the rendered theme switches to match the new scheme without restarting the app

#### Scenario: Native-backed controls follow the palette

- **WHEN** the rendered theme switches between dark and light
- **THEN** native-backed controls (buttons, dialogs, dropdowns, lists, tab bar) re-theme to the same palette as the StyleSheet-styled surfaces

### Requirement: Single theme source

The application SHALL define its visual theme (colors, spacing, typography) as a single shared source consumed by all screens, and screens SHALL NOT hardcode color or spacing values outside that theme. The shared source SHALL also feed the platform-native component layer's theme mapping, so native-backed controls resolve their colors and shapes from the same theme as StyleSheet-styled surfaces.

#### Scenario: Screens consume shared tokens

- **WHEN** any screen renders colors, spacing, or typography
- **THEN** the values come from the shared theme source, and no screen defines its own color or spacing literals

#### Scenario: Native theme maps from the shared source

- **WHEN** the native component layer's theme is configured
- **THEN** its color and shape values are derived from the shared theme source rather than declared independently

## REMOVED Requirements

### Requirement: StyleSheet-only styling

**Reason**: Superseded by the migration to platform-native backed components: interactive controls are now styled through the shared theme's native mapping, while React Native StyleSheet remains the styling mechanism for React Native-rendered static layout. No CSS-like styling frameworks are introduced by this change.

**Migration**: The styling convention is restated by the ADDED "Native-backed interactive components" requirement and the MODIFIED "Boxy visual style" and "Single theme source" requirements; the original prohibition on utility-class/styled-components/CSS-in-JS dependencies remains in force and is covered by those requirements' shared-theme scenarios.
