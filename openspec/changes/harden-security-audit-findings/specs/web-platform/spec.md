# Spec Delta — web-platform

## ADDED Requirements

### Requirement: Security headers on served web assets

Responses served for non-API paths — static files and the SPA fallback — SHALL include the headers `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin`, so the application shell cannot be framed by third parties and cannot leak referrer data to them. These headers apply to every non-API response including SPA-fallback `200` responses for unmatched paths.

#### Scenario: SPA shell carries security headers

- **WHEN** a client requests the application root or any non-API path that resolves to the SPA shell
- **THEN** the response includes `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin`

#### Scenario: SPA fallback carries security headers

- **WHEN** a client requests a non-API path that matches no static file and no registered route
- **THEN** the SPA-fallback `200` response also includes those security headers
