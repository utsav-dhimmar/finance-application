# Design

## Context

In `apps/web/src/components/`, four entity domains (`accounts`, `categories`, `transactions`, `transfers`) maintain separate dialog components for entity creation and entity editing:
- `accounts/create-account-dialog.tsx` & `accounts/edit-account-dialog.tsx`
- `categories/create-category-dialog.tsx` & `categories/edit-category-dialog.tsx`
- `transactions/create-transaction-dialog.tsx` & `transactions/edit-transaction-dialog.tsx`
- `transfers/create-transfer-dialog.tsx` & `transfers/edit-transfer-dialog.tsx`

Each pair duplicates Zod validation schemas, form state management (`react-hook-form`), input field layouts, select controls, dialog framing, and error banners. The divergence between Create and Edit in each domain is limited to:
1. Dialog title and description strings.
2. Initial/default values (empty defaults vs. existing entity values).
3. Mutation hook invoked on submission (`create.mutate` vs. `update.mutate`).
4. Submit button text ("Create ..." vs. "Save changes").
5. Contextual guidance (such as opening balance / account type lock description).

See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**
- Unify the create and edit dialogs in each of the 4 domains into a single cohesive form dialog component:
  - `AccountFormDialog` in `apps/web/src/components/accounts/account-form-dialog.tsx`
  - `CategoryFormDialog` in `apps/web/src/components/categories/category-form-dialog.tsx`
  - `TransactionFormDialog` in `apps/web/src/components/transactions/transaction-form-dialog.tsx`
  - `TransferFormDialog` in `apps/web/src/components/transfers/transfer-form-dialog.tsx`
- Support both create mode (when entity is omitted or `null`) and edit mode (when entity is provided).
- Maintain 100% feature parity, accessibility attributes, test compatibility, and boxy visual styling (zero border-radius).
- Re-export `CreateAccountDialog`, `EditAccountDialog`, etc., as aliases or migrate callers cleanly to prevent regressions.
- Reduce code duplication by ~40-50% across these dialog implementations.

**Non-Goals:**
- Creating an over-abstracted generic form generator that renders arbitrary schemas dynamically (which harms TypeScript ergonomics and layout flexibility).
- Modifying deletion, archival, or restoration confirmation dialogs (`confirm-lifecycle-dialog.tsx`, etc.).
- Changing backend API contracts or validation schemas in `@finance-application/schemas`.

## Decisions

### 1. Discriminated or Optional Entity Prop Pattern
We will use a clean, standard prop signature for all unified dialogs:
```tsx
interface AccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: AccountResponse | null;
}
```
- When `account` is provided and non-null: Edit mode (`isEdit = true`).
  - Title: `Edit "${account.name}"`
  - Submit label: `Save changes` / `Saving...`
  - Mutation: `useUpdateAccount().mutate`
- When `account` is `null` or `undefined`: Create mode (`isEdit = false`).
  - Title: `Add account`
  - Submit label: `Create account` / `Creating...`
  - Mutation: `useCreateAccount().mutate`

*Alternatives considered*:
- Discriminated union of props (`{ mode: "create", open, onOpenChange } | { mode: "edit", open, onOpenChange, account: AccountResponse }`): While type-safe, passing `{ account, open, onOpenChange }` is more ergonomic for route state where `editing` is `AccountResponse | null`. The unified component can derive `isEdit = Boolean(account)`.

### 2. Form Reset and Value Synchronization
Because a single dialog component instance may be reused across multiple edits or toggled between create and edit, form values must synchronize reliably:
- Use a `useEffect` watching `[open, entity]` or React Hook Form `reset` to populate either default values or formatted entity values whenever `open` transitions to `true` or the active entity changes.
- Reset errors and root error alert upon modal open/close transitions.

*Alternatives considered*:
- Unmounting the dialog when closed: Possible, but dialog animations and Base UI modal behavior work best when `Dialog open={open}` manages its own transition lifecycle while internal form state resets cleanly.

### 3. Backwards Compatibility and Migration Strategy
- In each domain directory, introduce the unified dialog file (`account-form-dialog.tsx`, etc.).
- Re-export legacy component names (`CreateAccountDialog`, `EditAccountDialog`) pointing to the unified component with pre-set props if needed, or update route imports directly in `routes/accounts.tsx`, `routes/categories.tsx`, and `routes/transactions.tsx`.
- Delete redundant legacy files once all usages are updated.

## Risks / Trade-offs

- **[Risk] Form State Pollution**: Opening create mode after editing an account might retain the previous account's values if resetting is incomplete.
  - *Mitigation*: Explicitly invoke `form.reset(getDefaultValues(entity))` when `open` changes or entity changes. Ensure unit tests cover opening create mode after edit mode.
- **[Risk] Route Test Breakage**: Existing tests in `apps/web/tests/routes/*.test.tsx` query buttons and dialog headings by exact text (e.g. `getByRole('button', { name: /create account/i })`).
  - *Mitigation*: Keep identical strings for titles, labels, placeholders, and buttons.
- **[Risk] Lock Behavior Discrepancy**: In accounts, the edit dialog mentions "Opening balance and type lock once the account has transactions."
  - *Mitigation*: Dynamically display the lock note description in edit mode while keeping the create description in create mode.
