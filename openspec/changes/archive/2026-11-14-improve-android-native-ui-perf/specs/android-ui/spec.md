# Spec Delta

## MODIFIED Requirements

### Requirement: Boxy visual style

The application SHALL render all screens in the boxy style: every surface — buttons, inputs, cards, containers, and overlays — SHALL have zero corner radius with sharp geometric edges, and layouts SHALL use a flat, structured composition of bordered blocks rather than rounded or floating elements. UI that the platform itself renders — native tab bars, native dropdown menus, and other system-presented surfaces — SHALL follow the platform's own styling and is exempt from the zero-radius rule; every surface the application draws itself SHALL remain boxy.

#### Scenario: No rounded surfaces

- **WHEN** any screen of the application is rendered
- **THEN** every visible button, input, card, and container has zero corner radius

#### Scenario: Platform-rendered native surfaces follow system styling

- **WHEN** the user opens a native dropdown menu or views the native bottom tab bar
- **THEN** those surfaces are presented with the platform's own styling rather than the application's boxy theme, while every trigger, field, card, and screen surface the application renders stays boxy

## ADDED Requirements

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

### Requirement: Dashboard year selection window

The dashboard's year select SHALL offer the calendar years from ten years before through ten years after the device's current year, always including the current year as the default selection. The reporting API's accepted year range is unaffected; this bounds only the options the mobile picker presents.

#### Scenario: Year options span a rolling window

- **WHEN** the dashboard's period mode is set to year and the user opens the year select
- **THEN** the offered options run from ten years before the device's current year through ten years after it, and the device's current year is preselected

#### Scenario: Default period remains the current year

- **WHEN** the user switches the dashboard's period mode to year
- **THEN** the current year is selected and the report refetches for it without reloading the app
