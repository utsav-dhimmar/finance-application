# Design

## Context

All account/category selection today uses the Base UI `Select` (`packages/ui/src/components/select.tsx`) directly inside react-hook-form `Controller` fields (forms) or plain state (transaction list filters). The shadcn Base UI combobox primitive is already scaffolded and committed-ready in `packages/ui/src/components/combobox.tsx` (untracked, unused; imports `input-group.tsx`, also untracked). No new dependencies are needed (`@base-ui/react` is already a `packages/ui` dependency). The official composition for select-like behavior is the docs' "Popup" pattern: a `ComboboxTrigger` button showing `ComboboxValue`, with the search `ComboboxInput` (`showTrigger={false}`) inside `ComboboxContent`.

## Goals / Non-Goals

**Goals:**

- One reusable web-app wrapper that gives any `{value, label}` list a searchable, single-select combobox with a select-style trigger.
- Drop-in replacement at the eight call sites (transaction form: account, category; transfer form: from/to account; recurring expense form: account, category; transaction filters: account, category) with zero change to form schemas, filter state, or API payloads.
- Preserve existing behaviors that ride along on these fields: archived-account labels, the account current-balance hint, filter "All accounts"/"All categories" reset entries.

**Non-Goals:**

- Multi-select/chips anywhere (single-select only, per proposal).
- Creatable/free-text options (search filters the existing list; no inline category/account creation).
- Replacing fixed small lists (transaction type, recurrence interval, currency) — they stay `Select`.
- Changes to `packages/ui` component internals beyond committing the already-scaffolded files (plus the relative-import conversion needed for cross-package compilation); `textarea.tsx` is tracked only as `input-group.tsx`'s compile dependency and gains no usage.

## Decisions

- **Select-like "Popup" composition, not input-as-trigger.** The trigger is a button-styled `ComboboxTrigger` rendering `ComboboxValue`; the search input lives inside `ComboboxContent` with `showTrigger={false}`. Rationale: keeps visual parity with the `SelectTrigger` controls these fields replace (same height, border, chevron) so dialogs and the filter row do not change look-and-feel. Alternative (default input-as-trigger) rejected: it turns every selector into a text field and loses the clean "selected label" display.

- **One shared wrapper in the web app: `apps/web/src/components/shared/combobox-select-field.tsx`.** Props: `items: { value: string; label: string }[]`, `value`, `onValueChange`, `placeholder`, `id`, `disabled`, `aria-label`, optional `emptyMessage`. It encapsulates the Popup composition, the filter function, and the object↔id value mapping. Rationale: mirrors the existing `type-select-field.tsx` shared-field pattern and keeps each call site to a few lines; `packages/ui` stays a generic registry copy with no app-specific logic (per AGENTS.md, shared packages must not know about app entry points).

- **Items are objects; forms keep string IDs.** `ComboboxItem` receives the item object, `itemToStringValue` returns the label, the wrapper resolves the controlled `value` (string id) to its item object and maps `onValueChange` back to `item.value` (id). Rationale: react-hook-form state, filter state, and API payloads continue to carry entity IDs unchanged — this is purely a presentation-layer swap. Alternative (string items where value = label) rejected: would force renaming or surrogate keys and risk leaking labels into persisted state.

- **Explicit case-insensitive "contains" filter.** Pass a filter derived from `Combobox.useFilter()`'s `contains` matcher to the `Combobox` `filter` prop rather than relying on the library default matcher, whose exact matching semantics (starts-with vs contains) are not documented as a stable contract. Rationale: the spec requires case-insensitive substring behavior; making it explicit guarantees it.

- **Filter reset via first list item, not clearable state.** The transaction filters include their existing `ALL_ACCOUNTS`/`ALL_CATEGORIES` sentinel items as the first entries; selecting one dispatches the existing `""`-reset action. Rationale: preserves current filter-state semantics and URL/query behavior with no new "empty selection" state to handle.

- **Styling overrides stay at call sites.** The wrapper forwards `className` to the trigger and accepts an `invalid` flag mapping to aria-invalid styles, so routes that apply boxy overrides today (e.g. `rounded-none` in `recurring-expenses.tsx`) keep doing so. Rationale: keeps AGENTS.md's sharp-corner preference enforcement where it already lives, without hardcoding either style into the shared component.

## Risks / Trade-offs

- [Popup inside dialog scroll containment] Comboboxes inside the entity form dialogs must position above dialog content → the scaffolded `ComboboxContent` uses a portal, positioner with `sideOffset`, and `max-h-(--available-height)` like the existing Select popup; verify inside the transaction form dialog during implementation (the dialog already handles viewport containment per web-ui spec).
- [Base UI value typing with object items] Controlled value must be the exact item object reference from `items`, otherwise the trigger shows a placeholder → wrapper resolves the object from the same `items` array it renders and documents this contract in its props.
- [Regression in filter reset behavior] The filters currently rely on sentinel-string equality checks (`value === ALL_ACCOUNTS`) → tasks include keeping those checks and adding a test that picking "All accounts" dispatches the reset action.
- [Empty option lists] An account/category list can be empty (e.g. no categories yet) → wrapper renders `ComboboxEmpty` with a sensible default message ("No options found"), matching the old Select behavior of showing an empty popup rather than breaking.

## Migration Plan

Presentation-layer swap only; no data, API, or migration concerns. Rollback is a git revert of the call-site changes. Order: commit the UI primitives first, add the wrapper with tests, then migrate call sites one screen at a time (transaction form → transfer form → recurring form → filters), running typecheck/lint/tests after each.

## Open Questions

- None.
