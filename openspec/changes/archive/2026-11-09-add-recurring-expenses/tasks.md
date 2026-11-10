# Tasks

## 1. Schema & Domain Foundation

- [x] 1.1 Define shared Zod schemas and TypeScript types for recurring expenses in `packages/schemas/src/recurring-expenses.ts` (including `intervalMonths`, status enum, create, update, due query schemas) and export them from `packages/schemas/src/index.ts`; verify with schema unit tests via `pnpm test`.
- [x] 1.2 Implement calendar month arithmetic utility `addCalendarMonths` with month-end day clamping in shared utilities; verify with Vitest tests covering leap years, 30/31-day months, and year rollovers.
- [x] 1.3 Add `recurring_expenses` table definition and add nullable `recurring_expense_id` foreign key column to `transactions` in `server/api/src/db/schema.ts`; generate Drizzle migration and verify schema generation via `pnpm --filter @personal-finance/server run db:generate`.

## 2. API Endpoints & Business Logic

- [x] 2.1 Implement `recurring-expenses` repository and service in `server/api/src` handling rule creation, cadence interval updates, and lifecycle transitions (`active`, `paused`, `completed`, `cancelled`); verify with service unit and integration tests.
- [x] 2.2 Implement `GET /recurring-expenses/due` endpoint to list rules due on or before a specified cutoff date; verify with route tests ensuring paused, completed, and future rules are excluded.
- [x] 2.3 Implement `POST /recurring-expenses/:id/post-due` (with optional amount/date overrides) and `POST /recurring-expenses/:id/skip` endpoints to advance due dates and atomically create ledger transactions; verify with route tests testing balance debits and idempotency.
- [x] 2.4 Update `POST /transactions` route to support the optional `recurrence` payload, atomically recording the immediate expense transaction and scheduling the recurring rule; verify with transaction API tests.

## 3. Frontend Web Integration

- [x] 3.1 Create frontend API client services and TanStack Query hooks in `apps/web/src/services/recurring-expenses.ts` and `apps/web/src/hooks/use-recurring-expenses.ts`; verify TypeScript compiles with zero errors via `pnpm --filter @personal-finance/web run typecheck`.
- [x] 3.2 Update `TransactionFormDialog` in `apps/web/src/components/transactions/` to add recurrence controls ("Repeat this expense" toggle, interval in months selector: 1, 2, 3, 6, 12, and optional end date); verify UI rendering and form submission.
- [x] 3.3 Create a "Due Recurring Expenses" interactive review card/banner on Dashboard and Transactions pages allowing one-click posting, editing, and skipping; verify that confirming posts the transaction and updates account balance live.
- [x] 3.4 Build the dedicated `/recurring-expenses` route page with sharp-cornered boxy UI, listing recurring rules, status filter pills, duration cadence edit modal, and pause/resume/cancel controls; verify route rendering in browser.

## 4. End-to-End Verification & Documentation

- [x] 4.1 Run full type-check, lint, and automated test suite across all monorepo packages (`pnpm run typecheck`, `pnpm run lint`, `pnpm test`); verify zero errors or warnings.
- [x] 4.2 Verify OpenAPI schema generation with Scalar documentation covers all recurring expense endpoints; verify schema accuracy against specification.
