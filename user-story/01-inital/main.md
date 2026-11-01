# Personal Finance Application — Product Requirements & User Stories

## 1. Project Objective

Build a single-user personal finance application for tracking income, expenses, accounts, transfers, budgets, and financial history.

The initial target is a web application. An Android application built with Expo React Native will follow after the web application is complete.

Development follows spec-driven development using OpenSpec, `AGENTS.md`, and coding agents.

Authentication and the initial frontend setup are already complete. The focus is the application's core financial functionality.

## 2. Technical and Product Constraints

- Monorepo and TypeScript throughout the application.
- Existing frontend and authentication must be reused rather than rebuilt.
- Backend: Hono on Cloudflare Workers.
- Database: Cloudflare D1.
- ORM and migrations: Drizzle ORM.
- Validation: Zod.
- Frontend conventions and existing dependencies should be inspected before introducing new ones.
- Single-user application with no sharing or multi-user organization features.
- INR (₹) is the default currency.
- Use integer minor units (paise for INR) for monetary calculations.
- Design business logic and validation for reuse by the future Android application.
- Maintain API contracts suitable for future mobile consumption.
- Prepare specifications and implementation tasks before implementation.
- Do not implement the Android application during the initial web MVP.

## 3. Global Data Lifecycle Rules

Apply these rules to applicable records, including transactions, categories, accounts, and budgets.

### 3.1 Soft deletion

- Deletion marks a record as deleted rather than physically removing it.
- Deleted records are excluded from ordinary lists, selections, dashboards, and financial calculations.
- Provide a dedicated Trash view.
- Allow eligible deleted records to be restored.
- Permanent deletion is a separate, explicitly confirmed operation.
- Do not introduce automatic permanent deletion without an approved retention policy.
- Preserve financial history and referential integrity when records are deleted.

### 3.2 Archiving

- Archiving is distinct from deletion.
- Archived records retain their historical information.
- Archived records are excluded from ordinary active-record lists and selection workflows.
- Provide a dedicated Archive view.
- Allow eligible records to be restored.
- Archived transactions continue contributing to historical income and expense reports.
- Archiving an account or category must not silently delete associated transactions or financial history.

### 3.3 Lifecycle consistency

- A record must not simultaneously be active, archived, and deleted.
- Define valid state transitions and enforce them consistently.
- Deleted records must not reappear in active queries when restored from an archived state incorrectly.
- Related-record behavior must be explicitly defined.
- Preserve historical category and account references where required for financial reporting.
- Ensure lifecycle changes behave consistently across API responses, database queries, dashboard calculations, and future synchronization.

## 11. Cross-Cutting Requirements

### Financial correctness

- Use integer minor units for monetary amounts.
- Apply balance-affecting changes atomically.
- Prevent transfers from being counted as income or expenses.
- Define opening-balance and balance-adjustment semantics.
- Ensure every transaction affects the correct account balance exactly once.
- Define how deleted transactions and transfers affect current balances and historical reports.
- Ensure restoration does not double-apply a financial effect.

### Database integrity

- Use appropriate constraints, indexes, and transactions.
- Preserve relationships and historical references.
- Use stable identifiers for records and transfers.
- Define lifecycle fields and state transitions consistently.
- Create migrations for schema changes.
- Avoid destructive migrations without explicit approval.

### API and security

- Enforce authentication and authorization on every protected endpoint.
- Validate request payloads with Zod.
- Use consistent error response schemas.
- Prevent duplicate mutations from retries.
- Keep business logic reusable by the future mobile client.
- Do not expose secrets or privileged operations in frontend code.

### User experience

- Provide loading, empty, error, and success states.
- Clearly distinguish active, archived, and deleted records.
- Require confirmation for destructive operations.
- Keep account balances and reports consistent after all mutations.
- Display transaction types and transfer directions clearly.

### Testing

- Test financial calculations, opening balances, and account balance changes.
- Test transfer creation, editing, deletion, and restoration.
- Test category and account lifecycle transitions.
- Test reporting rules for active, archived, and deleted transactions.
- Test invalid input, duplicate requests, and failed atomic operations.
- Run type checking, linting, and applicable tests before completing a task.

### Future offline compatibility

- Keep domain rules independent of the web UI.
- Use stable record IDs and predictable mutation semantics.
- Document API contracts.
- Design for future offline synchronization without implementing a full sync engine during the initial MVP.
- Avoid assumptions that require a permanent network connection for all future client-side operations.

## 12. Coding Agent Instructions

Treat this document as a product-level backlog. It is not authorization to implement every story immediately.

Before writing feature code:

1. Inspect the existing repository, `AGENTS.md`, frontend, authentication integration, API structure, database schema, and dependencies.
2. Identify existing functionality and avoid duplicating completed work.
3. Review this backlog for ambiguity, missing requirements, dependencies, and architectural conflicts.
4. Prepare detailed OpenSpec proposals or feature specifications using the project's established workflow.
5. Break approved specifications into small, testable implementation tasks.
6. Identify required schema changes, migrations, endpoints, validation rules, UI states, and tests.
7. Surface unresolved business decisions explicitly instead of silently choosing behavior.
8. Implement only approved, scoped tasks.
9. Update the specifications and tests when requirements change.

Recommended implementation order:

1. Resolve the financial data model and lifecycle rules.
2. Implement account management and opening balances.
3. Implement categories and transaction relationships.
4. Implement income and expense transaction CRUD.
5. Implement inter-account transfers.
6. Implement filtering, search, and pagination.
7. Implement the dashboard and financial reporting.
8. Complete Archive and Trash workflows.
9. Implement currency and personal preferences.
10. Perform integration testing, security review, and deployment validation.

Review dependencies before finalizing this order. Authentication and initial frontend setup are already complete and must not be rebuilt.

Before implementation, explicitly resolve any remaining ambiguities in account balance calculation, opening-balance adjustments, transfer deletion and restoration, category restoration, archived-account reporting, and currency configuration.
