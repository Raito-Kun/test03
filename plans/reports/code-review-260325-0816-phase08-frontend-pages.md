# Code Review: Phase 08 Frontend Pages

**Date**: 2026-03-25
**Reviewer**: code-reviewer
**Scope**: 11 new page files in `packages/frontend/src/pages/`

---

## Code Review Summary

### Scope

- **Files**: 11 (contact-detail, lead-detail, debt-case-list, debt-case-detail, call-log-list, call-log-detail, campaign-list, campaign-detail, ticket-detail, reports-page, settings-page)
- **LOC**: 1,578 total
- **Focus**: New frontend pages for CRM Phase 08

### Overall Assessment

Solid, consistent implementation. Pages follow a uniform pattern: React Query for data fetching, shadcn/ui components, VI constants for Vietnamese text, proper loading/empty states. The code is readable and well-structured. Several DRY violations and a handful of hardcoded Vietnamese strings outside `vi-text.ts` are the main concerns.

---

### Critical Issues

**None found.**

- No XSS vectors (no `dangerouslySetInnerHTML`, no unsafe HTML injection)
- No secrets or credentials exposed
- Auth handled via api-client interceptor (JWT in-memory, not localStorage)
- No direct DOM manipulation with user input

---

### High Priority

#### H1. Unused Imports in `contact-detail.tsx`

**File**: `contacts/contact-detail.tsx:3,9`

`useMutation`, `useQueryClient`, `CardHeader`, and `CardTitle` are imported but never used. This causes unnecessary bundle size and lint warnings.

```typescript
// Remove unused imports:
// - useMutation, useQueryClient from @tanstack/react-query
// - CardHeader, CardTitle from @/components/ui/card
```

#### H2. DRY Violation: `formatDuration()` duplicated 5 times

**Files**: `contact-detail.tsx:53`, `call-log-list.tsx:26`, `call-log-detail.tsx:42`, `reports-page.tsx:39`, `dashboard.tsx:26`

Identical function copy-pasted across 5 files. Should be extracted to `lib/utils.ts` or a dedicated `lib/format.ts`.

```typescript
// lib/format.ts
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
```

#### H3. DRY Violation: `formatMoney()` duplicated with inconsistent output

**Files**: `debt-case-list.tsx:41`, `debt-case-detail.tsx:34`

Two copies, but they differ: the list version omits the ` d` suffix while the detail version appends it. This inconsistency confuses users. Extract to shared utility with consistent behavior.

#### H4. DRY Violation: `STATUS_COLORS` maps duplicated between list/detail pages

**Affected pairs**:
- `campaign-list.tsx:24` and `campaign-detail.tsx:25` (identical `CampaignStatus` color map)
- `ticket-list.tsx:27` and `ticket-detail.tsx:38` (identical `TicketStatus` color map)

Extract to a shared constants file per domain (e.g., `campaigns/constants.ts`) or a central `lib/status-colors.ts`.

#### H5. `ticket-detail.tsx` re-declares shared types locally

**File**: `tickets/ticket-detail.tsx:14-16`

`TICKET_STATUSES`, `TicketStatus`, and `TicketPriority` are redeclared inline instead of importing from `@shared/constants/enums`. Other pages (lead-detail, debt-case-detail, campaign-detail) correctly import from shared. This creates drift risk.

```typescript
// Replace local declarations with:
import { TICKET_STATUSES, type TicketStatus, type TicketPriority } from '@shared/constants/enums';
```

#### H6. Missing error handlers on `dispositionMutation` and `qaMutation`

**File**: `call-logs/call-log-detail.tsx:69-85`

Both mutations have `onSuccess` but no `onError` handler. Failed API calls will silently fail with no user feedback. Other mutations in the codebase consistently provide `onError: () => toast.error(...)`.

```typescript
// Add to both mutations:
onError: () => toast.error('Thao tac that bai'),
```

---

### Medium Priority

#### M1. Hardcoded Vietnamese strings outside `vi-text.ts`

Approximately 30+ inline Vietnamese strings found across the reviewed files. Examples:

| File | Line | String |
|------|------|--------|
| `call-log-list.tsx` | 60,84,88 | `'So goi'`, `'Tu ngay'`, `'Den ngay'` |
| `call-log-detail.tsx` | 113,115,116,174,182,195 | `'Chi tiet cuoc goi'`, `'So goi'`, `'So nhan'`, `'boi ...'`, `'Diem (0-100)'`, `'Chua co danh gia'` |
| `lead-detail.tsx` | 86 | `'Thong tin Lead'` |
| `debt-case-detail.tsx` | 106,110,111,119 | `'Thong tin cong no'`, `'Con lai'`, `'ngay'`, `'Lien he'` |
| `ticket-detail.tsx` | 107,111 | `'Thong tin'`, `'Nguoi tao'` |
| `campaign-detail.tsx` | 67 | `'Thong tin chien dich'` |
| `settings-page.tsx` | 59 | `'Vai tro'` |
| `reports-page.tsx` | 72,76,104,139-143,176-180 | Multiple table headers |
| Toast messages | Various | All `toast.success()`/`toast.error()` strings |

**Impact**: Breaks the localization pattern. If the app ever needs i18n, these will be scattered landmines.

**Recommendation**: Add missing keys to `vi-text.ts` and replace all inline strings. This is a medium-priority batch task.

#### M2. File size violations (200-line rule)

Per `code-standards.md`, files should stay under 200 lines:

| File | Lines | Over by |
|------|-------|---------|
| `contact-detail.tsx` | 207 | 7 |
| `call-log-detail.tsx` | 201 | 1 |
| `reports-page.tsx` | 206 | 6 |

**contact-detail.tsx**: Extract the tabs content (tickets list, calls list, timeline) into small sub-components.

**reports-page.tsx**: Each report tab table (calls, telesale, collection) is nearly identical structure. Extract a generic `ReportTable` component.

**call-log-detail.tsx**: The QA annotation section (lines 167-198) could be extracted to a `<QaAnnotationCard>` component.

#### M3. `handleCall()` function duplicated across 3 pages

**Files**: `contact-detail.tsx:88`, `lead-detail.tsx:49`, `debt-case-detail.tsx:68`

Nearly identical click-to-call logic. Consider extracting to a shared hook:

```typescript
// hooks/use-originate-call.ts
export function useOriginateCall() {
  return (phone: string) => {
    api.post('/calls/originate', { phone })
      .then(() => toast.success(`Dang goi ${phone}...`))
      .catch(() => toast.error(VI.errors.callFailed));
  };
}
```

#### M4. All report queries fire simultaneously on mount

**File**: `reports/reports-page.tsx:54-67`

Three useQuery hooks fire on mount regardless of which tab is active. Only the visible tab's data is needed. Use `enabled` to defer:

```typescript
const [activeTab, setActiveTab] = useState('calls');

const { data: callReport } = useQuery({
  queryKey: ['report-calls', params],
  queryFn: ...,
  enabled: activeTab === 'calls',
});
```

#### M5. Interface types duplicated instead of sharing

Multiple pages define their own `Contact`, `DebtCase`, `CallLog` interfaces that partially overlap. Consider creating shared type files:
- `types/contact.ts`, `types/debt-case.ts`, etc.
- Or generate from the backend API schema.

This is not urgent but improves maintainability.

#### M6. Code standards recommend creating hooks for API calls

**File**: `docs/code-standards.md:583` states: "Create hooks for API calls (`useContacts()`, `useLeads()`)"

All pages use inline `useQuery` with raw `api.get()` calls instead. Consider creating hooks like `useContact(id)`, `useDebtCase(id)` to centralize query keys and fetch logic.

---

### Low Priority

#### L1. `reports-page.tsx` uses index as table row key

**File**: `reports-page.tsx:111,147,184`

```typescript
{callReport?.map((row, i) => <TableRow key={i}>...)}
```

Using array index as key is acceptable here since report rows have no interactive state, but using `row.agentName` would be semantically better and prevent subtle bugs if sorting is added later.

#### L2. `contact-detail.tsx:137` uses `VI.lead.notes` for contact notes

The contact notes section uses `VI.lead.notes` instead of a dedicated `VI.contact.notes` key. While the label text may be the same ("Ghi chu"), it couples contact UI to lead domain text.

#### L3. Non-null assertion operators

Several uses of `!` operator:
- `lead-detail.tsx:52`: `lead.contact!.phone`
- `debt-case-detail.tsx:71,118`: `debt.contact!.phone`, `debt.contact!.id`
- `call-log-detail.tsx:123`: `call.contact!.id`

These are all within guarded blocks (`if (!lead?.contact?.phone) return` etc.), so they are safe in practice. However, optional chaining would be more robust:

```typescript
// Instead of: lead.contact!.phone
// Use: lead.contact?.phone ?? ''
```

---

### Edge Cases Found by Scout

1. **Invalid date strings**: `format(new Date(row.createdAt), ...)` will throw if `createdAt` is null/undefined/invalid. No try-catch around date formatting anywhere. A single malformed API response crashes the whole page.

2. **Missing `id` param**: All detail pages use `useParams<{ id: string }>()` but `id` could be undefined if route params change. The `enabled: !!id` guard prevents the query from firing, but the page renders the "no data" state without distinguishing "not found" from "invalid URL".

3. **PTP dialog number parsing**: `debt-case-detail.tsx:56` uses `Number(promiseAmount)` which converts empty string to `0` and non-numeric input to `NaN`. The button is disabled when `!promiseAmount`, but a value like `"abc"` would pass the check and submit `NaN` to the API.

4. **QA score validation gap**: `call-log-detail.tsx:183` has `min={0} max={100}` on the input, but the mutation (`line 78`) sends `Number(qaScore)` without validating range. Browser min/max only constrains the stepper UI, not typed input. A user could type `999` and submit it.

5. **Race condition in `handleCall()`**: The fire-and-forget `api.post('/calls/originate', ...)` pattern (no mutation, no loading state) allows double-clicking to fire multiple originate requests. Consider adding a loading guard or using `useMutation`.

6. **Stale closure in contact-detail `handleCall()`**: The function captures `contact` from render scope. If the contact data refetches while the call is in-flight, the toast message uses the old reference. Minor, but worth noting.

---

### Positive Observations

1. **Consistent page structure**: All pages follow the same pattern -- query hooks at top, loading skeleton, empty state, then JSX. Easy to navigate.

2. **Good use of `enabled: !!id`**: All detail page queries correctly gate on the ID parameter.

3. **Clean shadcn/ui integration**: Proper use of Card, Badge, Tabs, Dialog, Select components with consistent styling.

4. **Vietnamese localization mostly centralized**: The `VI` constant is used extensively; the inline strings are the exception rather than the rule.

5. **Proper loading states**: Every page shows Skeleton components during loading.

6. **Type-safe enum badge rendering**: Pages like debt-case-list use `Record<DebtTier, string>` for color maps, ensuring compile-time completeness.

7. **Security**: In-memory JWT storage, no localStorage tokens, no `dangerouslySetInnerHTML`, no exposed secrets.

8. **File sizes mostly within limit**: 8 of 11 files are under 200 lines.

---

### Recommended Actions (Prioritized)

1. **[H2/H3/H4]** Extract `formatDuration`, `formatMoney`, and `STATUS_COLORS` maps into shared modules. This is the biggest DRY win.
2. **[H5]** Import `TicketStatus`/`TicketPriority`/`TICKET_STATUSES` from `@shared/constants/enums` in ticket-detail.tsx.
3. **[H6]** Add `onError` handlers to the two mutations in call-log-detail.tsx.
4. **[H1]** Remove unused imports in contact-detail.tsx.
5. **[M1]** Batch-add missing Vietnamese strings to `vi-text.ts` and replace inline strings.
6. **[M4]** Gate report queries on active tab to avoid unnecessary API calls.
7. **[M3]** Extract `handleCall` to a shared hook.
8. **[Edge 3/4]** Add client-side validation for PTP amount and QA score before submitting.
9. **[M2]** Split the 3 over-limit files into smaller components.
10. **[M6]** Create custom query hooks as recommended by code-standards.md.

### Metrics

- **Type Coverage**: Good -- all props typed, interfaces declared, shared enums used (with exception of ticket-detail)
- **Test Coverage**: Not assessed (no test files present for these pages)
- **Linting Issues**: ~4 unused imports in contact-detail.tsx
- **DRY Violations**: 5 distinct duplications identified
- **Hardcoded Strings**: ~30+ inline Vietnamese strings outside vi-text.ts
- **Files Over 200 Lines**: 3 of 11

### Unresolved Questions

1. Are custom query hooks (e.g., `useContact(id)`) planned for a follow-up phase, or should they be added now?
2. Should the inline Vietnamese strings be addressed in this phase or deferred?
3. Is the `handleCall` fire-and-forget pattern intentional (matching a call-bar UX), or should it use `useMutation` with loading state?
