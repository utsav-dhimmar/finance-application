# Proposal

## Why

Personal finance tracking requires managing predictable, periodic obligations such as monthly subscriptions, rent, bi-monthly utility bills, or quarterly memberships. Users often pay an initial payment immediately while recording an expense and need the system to track subsequent payments according to a flexible recurring duration (such as 1, 2, 3, 6, or 12 months).

Without recurring expense management, users must manually re-enter identical expenses each cycle or risk omitting recurring commitments from their financial planning. Adding duration-driven recurring expenses with an integrated "pay now and repeat" workflow, an upcoming/due review queue, and cadence editing ensures financial integrity and minimal operational friction.

## What Changes

- **Recurring Expense Schedules**: Introduce first-class recurring expense rules supporting flexible month-based duration cadences (e.g., 1 month, 2 months, 3 months, 6 months, 12 months) with start date, next due date, optional end date/occurrence limit, and lifecycle states (`active`, `paused`, `completed`, `cancelled`). A rule's amount is an **expected amount**: it pre-fills each occurrence's posting form, while the actual expense may differ every cycle.
- **Pay Now & Repeat from Transaction Modal**: Add an optional "Repeat this expense" toggle in the existing "Record Transaction" modal. When selected, the transaction is recorded immediately in the ledger and the recurring rule is registered with its next due date scheduled accordingly.
- **Due & Upcoming Review Queue**: Provide an interactive queue displaying recurring expenses that are due or upcoming. Because recurring obligations are not always identical every cycle, users can review each occurrence and adjust the actual amount, payment date, or notes before posting the transaction to the ledger, preventing duplicate posts for the same cycle. Account and category remain fixed to the rule.
- **Cadence & Duration Editing**: Allow users to adjust the recurring interval (e.g., changing from 1 month to 3 months) or modify the expected amount, payment notes, and end date. In accordance with data integrity principles, modifying a recurring rule adjusts only future scheduled occurrences (the pre-filled estimate and recalculated next due date), keeping past ledger transactions strictly unchanged.
- **Dedicated Management View**: Add a dedicated "Recurring Expenses" management screen to list, filter, edit, pause, resume, or cancel recurring expense rules.
- **Transaction Traceability**: Link generated ledger transactions back to their originating recurring rule via an optional `recurringExpenseId` attribute.

## Capabilities

### New Capabilities
- `recurring-expenses`: Defines recurring expense rules, cadence intervals in months, next due date computation, lifecycle states (active, paused, completed, cancelled), upcoming/due review queues, one-click posting of due occurrences, and schedule adjustments.

### Modified Capabilities
- `transactions`: Extends transaction creation to support creating a linked recurring schedule alongside an immediate expense payment, and links posted transactions to their parent recurring rule identifier.

## Impact

- **Database**: Adds a new `recurring_expenses` table in Cloudflare D1 with Drizzle ORM, and adds a nullable `recurring_expense_id` foreign key column to the `transactions` table with an index.
- **API**: Adds a new `/recurring-expenses` route module in Hono (`GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `POST /:id/pause`, `POST /:id/resume`, `GET /due`, `POST /:id/post-due`), and updates transaction validation schemas in `packages/schemas`.
- **Frontend**: Adds recurrence controls to `RecordTransactionDialog`, introduces an upcoming/due alert section in the Dashboard and Transactions views, and adds a dedicated `/recurring-expenses` page conforming to the established boxy, sharp-cornered design system.
- **Compatibility**: Completely backwards compatible with existing transaction history and balance calculations.
