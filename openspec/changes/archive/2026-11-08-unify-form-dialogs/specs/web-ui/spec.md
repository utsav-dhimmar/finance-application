# Spec Delta

## ADDED Requirements

### Requirement: Unified entity form dialog presentation and mode switching
The web user interface SHALL provide unified dialog components for creating and editing financial entities (accounts, categories, transactions, and transfers). The dialog SHALL dynamically adapt its title, default values, form submission action, and immutable field locks according to whether an entity is being created or edited, while maintaining viewport containment, clear validation feedback, and form reset on dismissal.

#### Scenario: Opening dialog in creation mode
- **WHEN** an authenticated user triggers the creation action for an account, category, transaction, or transfer
- **THEN** the dialog opens with create-specific title, default or empty form inputs, and a create submission button

#### Scenario: Opening dialog in edit mode
- **WHEN** an authenticated user triggers the edit action for an existing account, category, transaction, or transfer
- **THEN** the dialog opens pre-populated with the entity's current values, displays an edit-specific title, and provides a save submission button

#### Scenario: Locked field behavior during editing
- **WHEN** editing an entity that has restricted or locked fields (such as account type or opening balance after history exists)
- **THEN** the dialog preserves the existing field values and disables modifications to locked fields or highlights server conflict constraints inline

#### Scenario: Dialog dismissal resets form state
- **WHEN** the user closes or dismisses an entity form dialog without saving
- **THEN** form values, touched states, and root submission error alerts are reset cleanly for subsequent invocations
