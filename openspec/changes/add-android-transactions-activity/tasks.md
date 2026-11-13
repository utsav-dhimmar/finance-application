# Tasks

## 1. Activity feed foundation

- [x] 1.1 Port the transactions filter reducer to `src/components/transactions/filter-state.ts` as a pure function (tab, type, accountId, categoryId, from/to, search, page — every filter change resets the page; type change clears the category) with unit tests in `tests/components/transactions/filter-state.test.ts` asserting web-parity reset rules; verify tests pass.
- [x] 1.2 Add infinite-feed support: extend `src/services/transactions-service.ts` (or an `activity-service.ts` matching the web's organization) with `activityQueryOptions` and a `useInfiniteQuery` hook in `src/hooks/use-activity.ts` over `activityListQuerySchema` params; verify with `tests/hooks/use-activity.test.tsx` — first page fetches, load-more appends the next page with filters preserved, filter change restarts from page 1, and error mapping produces the service's user copy.

## 2. Feed list and filters

- [ ] 2.1 Build `src/app/(app)/transactions.tsx`: FlatList of boxy activity rows (`src/components/activity/activity-row.tsx` — date, kind, category or counterparty, signed amount via the currency formatter and tabular numerals), status tabs (Active/Archived/Trash), empty state per tab, and a "Load more" control; replace the placeholder screen; verify in Expo Go against the running API: feed renders newest first, tabs scope by status, signed amounts match the web's rendering for the same data.
- [x] 2.2 Build the filter row (`src/components/activity/activity-filters.tsx`): type select with the transfer-aware option, account select, category select cleared when the type excludes it, from/to date fields (`@react-native-community/datetimepicker` via `npx expo install`, verified by `expo-doctor`, string `YYYY-MM-DD` in state), debounced search input; verify filters produce the same request params as the web for the same selections (unit test on the param serialization) and the feed updates.

## 3. Transaction management

- [x] 3.1 Build `src/components/transactions/transaction-form-dialog.tsx` (unified create/edit, `transactionFormSchema` via zodResolver, `useForm<TransactionFormInput, unknown, TransactionFormValues>`, date picker, account/category selects fed by the account/category queries) and `tests/components/transactions/transaction-form-dialog.test.tsx` covering the spec scenarios — valid submit sends parsed minor-unit payload, invalid fields block with schema messages, edit prefills; verify tests pass.
- [ ] 3.2 Wire create/edit from the screen and the archive/delete/restore lifecycle through the shared confirm-dialog and transaction hooks; verify in Expo Go (create income/expense appears in feed; edit updates; archive/delete/restore move between tabs) and via `tests/components/transactions/lifecycle.test.tsx`.

## 4. Transfer management

- [x] 4.1 Build `src/components/transfers/transfer-form-dialog.tsx` (unified create/edit, `transferFormSchema` via zodResolver including the different-accounts refinement surfaced on the destination field) and `tests/components/transfers/transfer-form-dialog.test.tsx` covering valid submit, same-account blocking, invalid fields blocking, edit prefill; verify tests pass.
- [ ] 4.2 Wire create/edit from the screen and the archive/delete/restore lifecycle; verify in Expo Go (transfer renders debit on source and credit on destination; same transfer id may appear on both sides in an unscoped feed) and via `tests/components/transfers/lifecycle.test.tsx`; run `pnpm turbo run typecheck lint test build` from the root and confirm `apps/android` passes all four tasks.
