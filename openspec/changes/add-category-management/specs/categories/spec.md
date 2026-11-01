# Spec Delta

## Purpose

Lets a single user organize income and expenses with reusable categories (income and expense types, optional color/icon presentation) and manage their active/archived/deleted lifecycle without ever corrupting historical transaction references.

## ADDED Requirements

### Requirement: Create a category

The system SHALL allow an authenticated user to create a category with a name, a category type (income or expense), and optional presentation properties (color and icon). A successfully created category SHALL appear in the category list of its type.

#### Scenario: Successful creation
- **WHEN** the user submits a valid name and a supported category type
- **THEN** the category is created with that data and returned with its generated identifier, and it appears in the category list

#### Scenario: Presentation properties are optional
- **WHEN** the user submits a valid name and type with no color or icon
- **THEN** the category is created successfully with no presentation values

### Requirement: Category creation rejects invalid input

The system SHALL reject category creation when required fields are missing, the name is empty or exceeds the defined length limit, the type is not income or expense, or presentation values are malformed, without creating any record.

#### Scenario: Missing name
- **WHEN** creation is submitted with a blank or absent name
- **THEN** the response is a validation error naming the field, and no category is created

#### Scenario: Unknown category type rejected
- **WHEN** creation is submitted with a type other than income or expense
- **THEN** the response is a validation error naming the field, and no category is created

#### Scenario: Malformed presentation value rejected
- **WHEN** creation is submitted with a color that is not a valid hex color or an icon name exceeding the defined limit
- **THEN** the response is a validation error naming the field, and no category is created

### Requirement: Category name uniqueness

The system SHALL enforce case-insensitive uniqueness of category names among the user's categories that are not deleted, regardless of category type. Two non-deleted categories SHALL NOT share the same name even if one is income and one is expense. A deleted category's name SHALL be reusable by a new category.

#### Scenario: Cross-type duplicate rejected
- **WHEN** the user creates an expense category whose name matches an existing non-deleted income category's name ignoring case
- **THEN** the request is rejected with a conflict error identifying the duplicate name

#### Scenario: Deleted category name is reusable
- **WHEN** a category named "Food" is soft-deleted and the user creates a new category named "food"
- **THEN** the new category is created successfully

#### Scenario: Restore conflicts with a reused name
- **WHEN** restoring a non-active category would violate uniqueness because another non-deleted category now uses its name, and no alternative name is provided
- **THEN** the restore is rejected with a conflict error, and the category can be restored by explicitly providing a new name as part of the restore request

### Requirement: Authenticated and scoped category access

All category endpoints SHALL require authentication, and each request SHALL only operate on categories owned by the authenticated user. Unauthenticated requests SHALL be rejected.

#### Scenario: Unauthenticated access rejected
- **WHEN** a category endpoint is called without a valid session
- **THEN** the response is an authentication error and no category data is returned

#### Scenario: Only owned categories are visible
- **WHEN** the authenticated user lists or reads categories
- **THEN** only categories owned by that user are returned

### Requirement: View categories

The system SHALL display each category's name, type, and presentation properties. Ordinary category lists SHALL include only active categories by default. The system SHALL provide dedicated views listing archived categories and deleted (trashed) categories.

#### Scenario: Default list is active only
- **WHEN** the user views the ordinary category list
- **THEN** archived and deleted categories are not shown

#### Scenario: Archive and trash views
- **WHEN** the user opens the archived or trash view for categories
- **THEN** archived or respectively deleted categories are listed there with their details

### Requirement: Edit category details

The system SHALL allow an active category's name and presentation properties to be edited with validation before persistence. Renaming SHALL NOT change any historical transaction's reference to the category.

#### Scenario: Rename a category
- **WHEN** the user renames an active category to a valid, non-conflicting name
- **THEN** the category is updated and any historical references to the category continue to resolve to it

#### Scenario: Rename conflict rejected
- **WHEN** the user renames a category to a name that matches another non-deleted category ignoring case
- **THEN** the update is rejected with a conflict error and the name is unchanged

### Requirement: Category type locked while referenced

The system SHALL reject requests that change a category's type while any non-deleted transaction references that category, so recorded history is never silently reinterpreted. While no transaction references the category, its type SHALL remain editable.

#### Scenario: Type change succeeds when unused
- **WHEN** the user changes the type of a category that no non-deleted transaction references
- **THEN** the category's type is updated

#### Scenario: Type change rejected when referenced
- **WHEN** the user changes the type of a category that at least one non-deleted transaction references
- **THEN** the request is rejected with a conflict error and the type is unchanged

### Requirement: Archive a category

The system SHALL allow an authenticated user to archive an active category. Archived categories are excluded from ordinary lists and from selection for new transactions, remain in a dedicated archive view, and can be restored. Archiving SHALL preserve the category's data and all transaction references unchanged.

#### Scenario: Archive a category
- **WHEN** the user archives an active category after confirming the action
- **THEN** the category's status becomes archived, it disappears from ordinary lists, and it appears in the archive view

#### Scenario: Restore an archived category
- **WHEN** the user restores an archived category
- **THEN** the category becomes active again with its name, type, and presentation intact, and re-enters lists and selection

### Requirement: Soft-delete a category

The system SHALL allow an authenticated user to soft-delete an active category after explicit confirmation. Deleted categories are excluded from ordinary lists and selection, remain in a dedicated trash view, and can be restored. Deletion SHALL be reversible and SHALL NOT physically remove the category.

#### Scenario: Soft-delete a category
- **WHEN** the user deletes an active category after confirming the action
- **THEN** the category's status becomes deleted, it disappears from ordinary lists and selection, and it appears in the trash view

#### Scenario: Restore a deleted category
- **WHEN** the user restores a deleted category from the trash view
- **THEN** the category becomes active again with its prior data intact

### Requirement: Lifecycle state machine

The system SHALL enforce the category lifecycle states active, archived, and deleted with exactly these transitions: active to archived, active to deleted, archived to active, and deleted to active. Any other transition request SHALL be rejected with a conflict error. Archived and deleted categories SHALL NOT be editable through the ordinary edit workflow.

#### Scenario: Invalid transition rejected
- **WHEN** the user attempts to archive an already-deleted category
- **THEN** the request is rejected with a conflict error and the status is unchanged

#### Scenario: Non-active categories not editable
- **WHEN** the user attempts to rename an archived or deleted category
- **THEN** the request is rejected with a conflict error

### Requirement: Lifecycle changes preserve transaction history

Archiving, deleting, or restoring a category SHALL NOT modify, delete, or create any transaction that references it. Historical transactions SHALL continue to resolve to the category by reference, and renaming SHALL NOT rewrite recorded transaction data.

#### Scenario: No cascade changes to transactions
- **WHEN** a category with referenced transactions is archived, deleted, or restored
- **THEN** every transaction referencing the category remains unchanged and still resolves to it

### Requirement: Only active categories are selectable for new transactions

The system SHALL make only active categories available for selection when creating new transactions, restricted to the category type compatible with the transaction type. Archived and deleted categories SHALL NOT appear in selection workflows for new transactions.

#### Scenario: Inactive categories unavailable for selection
- **WHEN** the user opens category selection for a new transaction
- **THEN** only active categories of the compatible type are offered
