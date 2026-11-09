# Design

## Context

The personal finance application tracks accounts, categories, transactions, and transfers using Cloudflare Workers, Cloudflare D1, Drizzle ORM, Hono, and a TanStack Start web frontend (see `proposal.md` - Why).

Currently, all transactions are recorded individually. Many typical personal expenses (rent, subscriptions, gym memberships, utilities, insurance) recur on a duration-driven cadence (1 month, 2 months, 3 months, etc.). Users often pay the first installment immediately upon recording the expense and need future occurrences scheduled, tracked, and surfaced for review.

## Goals / Non-Goals

**Goals:**
- Provide a robust database schema and domain model for recurring expense rules with flexible duration cadences specified in months.
- Support atomic "pay now and repeat" creation directly from the existing `RecordTransactionDialog`.
- Implement an interactive Due & Upcoming review queue on the dashboard and transaction list to allow one-click confirmation (with optional date/amount edits) or skipping of due occurrences.
- Enable full lifecycle management (active, paused, completed, cancelled) and duration modifications that adjust future schedules without mutating historical transactions.
- Maintain boxy, sharp-cornered visual design consistent with repository style rules.

**Non-Goals:**
- Autonomous background worker silent writes without user review: All recurring occurrences are surfaced in the due queue for transparent user confirmation.
- Recurring income or recurring inter-account transfers (reserved for future changes).
- Variable recurring schedules (e.g., custom day intervals or complex cron expressions) outside month-based durations.

## Decisions

### Decision 1: Month-Based Interval (`intervalMonths`) vs Fixed Day Counts or Cron
- **Choice**: Store the recurring cadence as an integer `intervalMonths` (e.g., 1, 2, 3, 6, 12) along with `startDate` and `nextDueDate` in `YYYY-MM-DD` format.
- **Rationale**: Real-world recurring obligations align with calendar months (monthly rent, quarterly subscriptions, annual insurance). Fixed day counts (e.g. 30 days) cause rapid calendar drift across months with 28, 30, or 31 days.
- **Month Clamping**: When advancing dates across month boundaries (e.g., Jan 31 + 1 month), clamp to the target month's maximum valid day (Feb 28/29), preserving the original target billing day where possible.
- **Alternatives considered**: Cron strings (overly complex for personal finance and mobile client reuse) or fixed day intervals (causes calendar drift).

### Decision 2: Due & Upcoming Review Queue vs Headless Background Posting
- **Choice**: Maintain a stateful `nextDueDate` on the recurring rule. Surface due rules (`nextDueDate <= today`) in an interactive review banner/modal on the dashboard and transactions view, allowing the user to review, edit actual amounts/dates/notes, and post with one click.
- **Rationale**: In personal finance, recurring obligations are frequently not identical every cycle — the actual bill can differ in amount, payment date, or notes. The rule's stored `amountMinor` is therefore an **expected amount**: it pre-fills each occurrence's posting form as a default, while the posted ledger transaction records the actual values supplied at confirmation time. A review queue provides visibility and control, guarantees idempotency, and avoids background D1 worker overhead.
- **Alternatives considered**: Automatic Cloudflare Worker cron posting (lacks human-in-the-loop validation for variable bills and risk silent misstatements); treating the stored amount as display-only (forces manual entry every cycle) or as "last posted amount" (couples the schedule to ledger history and surprises on edit).

### Decision 3: Atomic Recurrence Creation via Transaction Endpoint
- **Choice**: Extend the transaction creation payload with an optional `recurrence` object:
  ```ts
  recurrence?: {
    intervalMonths: number;
    endDate?: string;
  }
  ```
  When provided, the API executes a D1 transaction creating:
  1. The immediate expense transaction in `transactions`.
  2. The new rule in `recurring_expenses`, with `lastPostedDate = transaction.date` and `nextDueDate = addMonths(transaction.date, intervalMonths)`.
  3. Sets `recurringExpenseId` on the initial transaction to link it.
- **Rationale**: Eliminates race conditions or partial failures where a transaction is posted but the recurring schedule fails to save.

### Decision 4: Cadence Modifications Adjust Only Future Cycles
- **Choice**: Updating a recurring expense's duration (e.g., switching from 1 month to 3 months) updates `intervalMonths` and recalculates `nextDueDate` based on the rule's `lastPostedDate` (or effective date).
- **Rationale**: Adheres to `AGENTS.md` core rule: "Do not silently rewrite historical transactions when categories or preferences change." Historical transactions remain permanently anchored to their recorded values.

### Decision 5: Schema and Foreign Key Strategy
- **Choice**:
  - New table `recurring_expenses` with columns: `id`, `user_id`, `name`, `amount_minor` (expected amount used to pre-fill postings; actual posted amounts may differ per occurrence), `interval_months`, `source_account_id`, `category_id`, `start_date`, `next_due_date`, `end_date`, `last_posted_date`, `status` (`active`, `paused`, `completed`, `cancelled`), `notes`, `created_at`, `updated_at`.
  - Add nullable `recurring_expense_id` to `transactions` referencing `recurring_expenses.id` with `onDelete: "set null"`.
- **Rationale**: Setting null on delete ensures that deleting or cancelling a recurring rule never invalidates or deletes past ledger records.

## Risks / Trade-offs

- **[Risk] Month-end date overflow (e.g. Jan 31 + 1 month)**  
  → **Mitigation**: Implement a shared, pure date utility function `addCalendarMonths(dateStr, months)` that safely clamps day numbers to the last day of the resulting month.
- **[Risk] Duplicate postings when clicking "Confirm" rapidly**  
  → **Mitigation**: Generate client-side UUIDv7 transaction IDs for the posted occurrence and derive deterministic idempotency guards based on `${recurringExpenseId}:${nextDueDate}`.
- **[Risk] Long absence leaves multiple missed cycles**  
  → **Mitigation**: When a recurring expense is overdue by more than one cycle, the due review queue flags it with the number of missed cycles, allowing the user to either post all missed cycles individually, post only the latest cycle, or fast-forward/skip to the current date.

## Migration Plan

1. Generate a new Drizzle migration creating the `recurring_expenses` table and adding `recurring_expense_id` to `transactions`.
2. Apply migration using `pnpm --filter @personal-finance/server run db:migrate` (or local D1 equivalent).
3. Backwards compatibility: Existing transactions have `recurring_expense_id = null` and continue functioning with zero schema conflicts.
