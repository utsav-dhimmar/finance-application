# Spec Delta

## REMOVED Requirements

### Requirement: Expo application workspace

**Reason**: The `apps/android` Expo workspace has been deleted from the monorepo, so the Turborepo pipeline no longer contains a mobile application task.
**Migration**: None — the workspace layout entry is removed from `AGENTS.md` as part of this change.

### Requirement: Unauthenticated launch shows sign-in

**Reason**: The mobile launch flow this requirement governed no longer exists.
**Migration**: None — web authentication behavior remains specified under `user-auth` and `web-ui`.

### Requirement: Sign-in against the authoritative API

**Reason**: The mobile sign-in flow that posted credentials to the API has been removed together with the application.
**Migration**: None — the API's `POST /api/auth/login` contract itself is unchanged and remains specified under `user-auth`.

### Requirement: Explicit cookie session handling

**Reason**: This requirement existed for the mobile client, whose HTTP stack could not rely on automatic cookie management; the package additions that supported it (`onResponse`, extra `headers` in `packages/api-client`) are reverted by this change.
**Migration**: None — browser clients continue to use same-origin cookie handling specified under `user-auth`.

### Requirement: Session stored in secure storage

**Reason**: The mobile secure-storage (keystore/keychain) session persistence no longer exists.
**Migration**: None — web session persistence remains specified under `user-auth`.

### Requirement: Session persistence across app restarts

**Reason**: The mobile relaunch/restore flow has been removed together with the application.
**Migration**: None — web session behavior remains specified under `user-auth`.

### Requirement: Refresh on expired access token

**Reason**: The mobile shared-refresh flow for `401 UNAUTHENTICATED` responses has been removed together with the application.
**Migration**: None — the API's `POST /api/auth/refresh` contract is unchanged and remains specified under `user-auth`.

### Requirement: Sign out

**Reason**: The mobile sign-out control in the shell's app header has been removed together with the application.
**Migration**: None — the API's `POST /api/auth/logout` contract is unchanged and remains specified under `user-auth`.

### Requirement: Configured API base URL

**Reason**: The mobile build-time API base-URL configuration existed only for the removed application.
**Migration**: None — the web client targets same-origin relative paths and the API deployment contract remains under `api-platform`.
