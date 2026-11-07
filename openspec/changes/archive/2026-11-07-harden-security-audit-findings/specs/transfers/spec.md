# Spec Delta — transfers

## MODIFIED Requirements

### Requirement: Transfer creation is idempotent

The system SHALL accept a client-generated transfer identifier on creation. When a creation request repeats with an identifier that already exists for the user, the system SHALL return the existing transfer without creating a duplicate and without re-applying any balance effect. When a creation request presents an identifier that already exists for a different user, the system SHALL respond `409` with error code `ID_CONFLICT` and create nothing, without disclosing whether the identifier exists. Creation SHALL NOT create any record other than the transfer.

#### Scenario: Retry with the same identifier
- **WHEN** the same creation request is submitted twice with the same client-generated identifier
- **THEN** only one transfer exists and both responses describe that same transfer

#### Scenario: Identifier colliding with another user's transfer
- **WHEN** a creation request presents a client-generated identifier that already exists on another user's transfer
- **THEN** the response is `409` with error code `ID_CONFLICT`, no transfer is created, and the response is identical to any other identifier conflict

### Requirement: Transfer input validation

The system SHALL reject transfer creation or editing when the amount is missing, zero, negative, not a whole number of paise, or exceeds the defined maximum amount; the date is missing or not a valid calendar date; either account reference is missing or malformed; or notes exceed the defined length limit — without creating or modifying any record.

#### Scenario: Invalid amount rejected
- **WHEN** the amount is zero, negative, fractional in paise, absent, or above the defined maximum
- **THEN** the response is a validation error naming the field and no record changes

#### Scenario: Invalid date rejected
- **WHEN** the date is not a valid calendar date in YYYY-MM-DD form
- **THEN** the response is a validation error naming the field and no record changes

### Requirement: List and filter transfers

The system SHALL support listing transfers with date-range, account, and text-search filters, combined with pagination. Search SHALL be case-insensitive across transfer notes and the related account names, and the characters `%` and `_` SHALL be treated as literal characters in search text, not as wildcards. Pagination SHALL use a deterministic ordering whose final component is unique, so no transfer repeats or disappears across page boundaries.

#### Scenario: Transfer filters combine
- **WHEN** the user applies a date range and an account filter to the transfer list
- **THEN** only transfers matching all filters are returned

#### Scenario: Search wildcard characters are literal
- **WHEN** the user searches transfers for text containing `%` or `_`
- **THEN** only transfers containing those literal characters match
