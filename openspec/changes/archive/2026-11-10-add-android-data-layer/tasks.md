# Tasks

## 1. Dependencies and providers

- [x] 1.1 Install `@tanstack/react-query`, `react-hook-form`, and `@hookform/resolvers` with `pnpm add` and `sonner-native` with `npx expo install` in `apps/android`; run `npx expo-doctor` and `pnpm turbo run typecheck --filter=@finance-application/android` and confirm both pass with the new deps resolved through Metro.
- [x] 1.2 Create `src/lib/query-client.ts` (single `QueryClient`, `staleTime: 30_000`) and mount `QueryClientProvider` and the sonner-native toast root in `src/app/_layout.tsx`; verify by rendering the app with `npx expo start` and confirming sign-in still works end to end.

## 2. Services layer (web parity)

- [x] 2.1 Add `src/services/transactions-service.ts`, `accounts-service.ts`, `categories-service.ts`, `preferences-service.ts`, and `reports-service.ts` wrapping the `@finance-application/api-client` modules through the session's `run()` flow, exporting query-key constants, `*QueryOptions` factories (`staleTime: 30_000`), and per-domain `ApiError` → user-message functions matching the web's wording; verify each with unit tests in `tests/services/*.test.ts` that stub fetch and assert query keys, request paths, and error copy (pattern: `apps/web/tests/hooks/use-transactions.test.tsx`).
- [x] 2.2 Add a `tests/services/session-bound-fetch.test.ts` that asserts a request rejected with `401 UNAUTHENTICATED` triggers one shared refresh and is retried with the fresh session, and that `401 INVALID_REFRESH_TOKEN` clears the session; verify the test passes against the existing `SessionMachine` without changes to the session layer.

## 3. Hooks layer (web parity)

- [x] 3.1 Add `src/hooks/use-accounts.ts`, `use-categories.ts`, `use-transactions.ts`, `use-activity.ts`, `use-preferences.ts`, and `use-report-summary.ts` with `useQuery`/`useMutation` wrappers that invalidate all related keys on success (same sets as `apps/web/src/hooks`); verify with hook tests in `tests/hooks/*.test.tsx` using `renderHook` with a `QueryClientProvider` wrapper and stubbed fetch, including one test asserting a transaction mutation invalidates transactions, accounts, categories, activity, and report keys.
- [x] 3.2 Wire mutation toasts: success and error toasts fired from hook `onSuccess`/`onError` handlers using the service message mapping, with no credential or cookie content; verify via a hook test asserting the toast function receives the mapped user copy and never the raw error.

## 4. Form validation pattern (web parity)

- [x] 4.1 Establish the react-hook-form + zodResolver pattern in the sign-in screen as the reference: `useForm<LoginInput, unknown, LoginOutput>` with `loginBodySchema`, per-field error display, and parsed values on submit; verify by rendering the sign-in screen in `tests/components/sign-in.test.tsx` — invalid email shows the schema's message and blocks submit, valid values submit the parsed payload.

## 5. Test reorganization

- [x] 5.1 Move colocated tests into `tests/` mirroring `src/` (`src/session/*.test.ts` → `tests/session/`, `src/theme.test.ts` → `tests/theme.test.ts`), fix relative imports, and update `vitest.config.mts` to `include: ["tests/**/*.test.{ts,tsx}"]` with `passWithNoTests` removed; verify `pnpm turbo run test --filter=@finance-application/android` passes with the moved files and no stale colocated tests remain (`git status` shows only moved paths).
- [x] 5.2 Add the `@testing-library/react-native` Vitest setup per its documented integration for the installed version (matchers, environment, `renderHook`/`QueryClientProvider` wrapper in `tests/helpers.tsx` mirroring `apps/web/tests/routes/helpers.tsx`) and prove it with a smoke component test rendering the sign-in screen; verify the smoke test passes and `pnpm turbo run test build --filter=@finance-application/android` is green.
- [x] 5.3 Document the Android test conventions (location, naming, helpers, RNTL setup, stubbed-fetch pattern) in `apps/android/AGENTS.md`; verify the documented commands run as written.

## 6. Pipeline verification

- [x] 6.1 Run `pnpm turbo run typecheck lint test build` from the repository root and confirm `apps/android` passes all four tasks in the Node-only pipeline; confirm `pnpm format:check` passes (run biome format on touched files if needed).
