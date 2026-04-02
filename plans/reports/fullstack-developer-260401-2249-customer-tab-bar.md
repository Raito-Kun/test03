# Phase Implementation Report

## Executed Phase
- Phase: customer-tab-bar
- Plan: none (direct task)
- Status: completed

## Files Modified/Created

| File | Lines | Action |
|---|---|---|
| `packages/frontend/src/stores/customer-tab-store.ts` | 65 | created |
| `packages/frontend/src/components/layout/customer-tab-bar.tsx` | 77 | created |
| `packages/frontend/src/hooks/use-open-customer-tab.ts` | 24 | created |
| `packages/frontend/src/components/layout/app-layout.tsx` | 91 | modified (+36 lines) |

## Tasks Completed

- [x] `customer-tab-store.ts` — Zustand store with persist (sessionStorage), openTab/closeTab/setActiveTab, max-10 guard with Vietnamese toast
- [x] `customer-tab-bar.tsx` — h-9 tab bar with type icons, active/inactive styling, X close button (hover reveal), truncation at 120px, horizontal scroll, "+ Thêm" button
- [x] `use-open-customer-tab.ts` — hook that calls openTab + navigate, builds path for all 3 entity types
- [x] `app-layout.tsx` — CustomerTabBar placed between Header and main; useEffect route-change listener auto-opens/focuses tabs on `/contacts/:id`, `/leads/:id`, `/debt-cases/:id`; clears activeTabId on non-detail routes

## Tests Status
- Type check: pass (0 errors, confirmed via `npx tsc --noEmit`)
- Unit tests: n/a (no test framework configured for frontend)
- Integration tests: n/a

## Design Decisions

1. **Placeholder label on direct navigation** — when a user navigates directly to a detail URL (e.g. browser refresh), the layout opens the tab with the raw ID as label. Detail pages should call `openTab` again once data loads to update the label with the real name. This avoids fetching data inside app-layout.

2. **`closeTab` accepts optional `navigate`** — the store itself is router-agnostic; navigation on close is injected by the tab bar component. This keeps the store testable.

3. **`setState` call in useEffect** — used `useCustomerTabStore.setState` directly for the non-detail branch to avoid adding `tabs` to the effect dependency array (which would re-run on every tab change).

4. **scrollbar-hide class** — applied to the tab overflow container. Requires the Tailwind scrollbar plugin or a custom utility; if not present, scroll still works but scrollbar may be visible. Can be added via `@layer utilities { .scrollbar-hide { scrollbar-width: none; } }` in the global CSS.

## Integration Points (no file changes needed)
- Contact/Lead/Debt-case list rows: call `useOpenCustomerTab()` and pass `{ id, type, label }` on row click
- Detail pages: call `useCustomerTabStore().openTab({ id, type, label: realName, path })` once API data resolves to update the placeholder label

## Issues Encountered
None.

## Unresolved Questions
- `scrollbar-hide` Tailwind utility may need adding to global CSS if not already present.
- Detail pages currently show raw UUID as tab label until they explicitly update it — a follow-up task could add a `updateTabLabel(id, label)` action to the store.
