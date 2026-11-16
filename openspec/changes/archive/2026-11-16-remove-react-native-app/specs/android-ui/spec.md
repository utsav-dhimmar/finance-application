# Spec Delta

## REMOVED Requirements

### Requirement: Boxy visual style

**Reason**: The Expo mobile application that rendered this design system has been removed from the repository.
**Migration**: None — the web application continues to own its own visual style under `web-ui`.

### Requirement: Device color scheme

**Reason**: The mobile application that followed the device color scheme no longer exists.
**Migration**: None — the web application handles theming under `web-ui`.

### Requirement: StyleSheet-only styling

**Reason**: The mobile application whose dependencies this styling constraint governed has been removed.
**Migration**: None — the React Native dependency audit no longer applies to any workspace package.

### Requirement: Single theme source

**Reason**: The mobile application that consumed the shared theme tokens has been removed.
**Migration**: None — the web application owns its own theme source under `web-ui`.

### Requirement: Sign-in screen

**Reason**: The mobile sign-in screen no longer exists; authentication UI for the web client is specified under `web-ui`.
**Migration**: None — the API sign-in contract itself is unchanged and remains specified under `user-auth`.

### Requirement: Authenticated tab shell

**Reason**: The mobile tab shell, app header, and bottom tab bar were removed together with the application.
**Migration**: None — the archived `add-android-accounts-categories` change previously introduced this shell; its history stays under `openspec/changes/archive/`.

### Requirement: Accounts screen

**Reason**: The mobile Accounts screen no longer exists.
**Migration**: None — account management behavior for the web client remains specified under `accounts` and `web-ui`.

### Requirement: Categories screen

**Reason**: The mobile Categories screen no longer exists.
**Migration**: None — category management behavior for the web client remains specified under `categories` and `web-ui`.

### Requirement: Dashboard period selection

**Reason**: The mobile dashboard and its period picker were removed together with the application.
**Migration**: None — dashboard period behavior for the web client remains specified under `reporting` and `web-ui`.

### Requirement: Dashboard summary cards

**Reason**: The mobile dashboard summary cards were removed together with the application.
**Migration**: None — reporting totals remain specified under `reporting` for the API and `web-ui` for the web client.

### Requirement: Dashboard category breakdown

**Reason**: The mobile category breakdown view was removed together with the application.
**Migration**: None — reporting breakdown behavior remains specified under `reporting` and `web-ui`.

### Requirement: Dashboard account balances

**Reason**: The mobile account-balances view was removed together with the application.
**Migration**: None — account balances remain specified under `accounts` and `reporting`.

### Requirement: Dashboard year selection window

**Reason**: The mobile year-select window (rolling ±10 years) existed only in the removed mobile picker; the reporting API's accepted year range was never affected.
**Migration**: None — the reporting API contract under `reporting` is unchanged.

### Requirement: Activity list screen

**Reason**: The mobile activity feed screen was removed together with the application.
**Migration**: None — the unified activity feed for the web client remains specified under `web-ui`, backed by `transactions` and `transfers`.

### Requirement: Transaction management

**Reason**: The mobile transaction create/edit and lifecycle actions were removed together with the application.
**Migration**: None — transaction behavior remains specified under `transactions` and `web-ui`.

### Requirement: Transfer management

**Reason**: The mobile transfer create/edit and lifecycle actions were removed together with the application.
**Migration**: None — transfer behavior remains specified under `transfers` and `web-ui`.

### Requirement: Native select menus

**Reason**: The platform native dropdown menus (and the boxy-theme exemption they motivated) existed only in the removed mobile application.
**Migration**: None — web select styling remains specified under `web-ui`.
