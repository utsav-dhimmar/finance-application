# Spec Delta

## MODIFIED Requirements

### Requirement: Sign out

The system SHALL provide a sign-out control in the authenticated shell's app header that calls `POST /api/auth/logout`, clears the stored session, and shows the sign-in screen.

#### Scenario: Sign-out flow

- **WHEN** a signed-in user activates the sign-out control
- **THEN** the app calls the logout endpoint, clears the stored session cookies from secure storage, and shows the sign-in screen
