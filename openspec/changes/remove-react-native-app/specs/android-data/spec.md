# Spec Delta

## REMOVED Requirements

### Requirement: Single query client for server state

**Reason**: The mobile application whose shared query client this requirement specified has been removed from the repository.
**Migration**: None — the web application's server-state management remains specified under `web-ui`.

### Requirement: Services as the only API access path

**Reason**: The mobile service layer that wrapped the shared API client has been deleted together with the application.
**Migration**: None — the shared `@finance-application/api-client` package remains, reverted to its pre-mobile surface (see this change's proposal); web data access remains specified under `web-ui`.

### Requirement: Query hooks expose loading and error states

**Reason**: The mobile query hooks no longer exist.
**Migration**: None — the web application's loading/error surfacing remains specified under `web-ui`.

### Requirement: Mutations refresh affected data

**Reason**: The mobile cache-invalidation behavior has been removed together with the application.
**Migration**: None — web mutation behavior remains specified under `web-ui`.

### Requirement: Zod-validated forms

**Reason**: The mobile form validation flow no longer exists; the shared Zod schemas themselves remain in use by the API and web app.
**Migration**: None — `@finance-application/schemas` is unchanged, and web form behavior remains specified under `web-ui`.

### Requirement: Toast feedback for mutations

**Reason**: The mobile toast feedback has been removed together with the application.
**Migration**: None — web mutation feedback remains specified under `web-ui`.

### Requirement: Data requests participate in session refresh

**Reason**: The mobile data layer's participation in the shared session-refresh flow has been removed together with the application.
**Migration**: None — the API session-refresh contract remains specified under `user-auth`.
