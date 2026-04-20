# Phase 04b Part 1 — Contacts / Debt-Cases / Leads Restyle

**Date:** 2026-04-20  
**Status:** Completed

## Files Modified

| File | Changes |
|---|---|
| `components/data-table/data-table.tsx` | `border-dashed` on table wrapper; `font-mono text-[10px] uppercase tracking-wider` on `thead`; pagination bar wrapped in mono uppercase div |
| `pages/contacts/contact-list.tsx` | `PageWrapper` → `SectionHeader` + `DottedCard` |
| `pages/contacts/contact-detail.tsx` | Left panel border → `border-dashed`; avatar gradient → violet; nav items → mono uppercase; field labels → mono uppercase; info `Card` → `DottedCard`; section headings → mono uppercase |
| `pages/contacts/call-history-tab.tsx` | `thead` → mono uppercase bg-muted/30; wrapper → `border-dashed` |
| `pages/leads/lead-list.tsx` | `PageWrapper` → `SectionHeader` + `DottedCard`; `STATUS_COLORS` → CSS token vars |
| `pages/leads/lead-detail.tsx` | Header → `SectionHeader`; cards → `DottedCard`; field labels → mono uppercase; `STATUS_COLORS` → CSS token vars; `Card/CardHeader/CardTitle` removed |
| `pages/debt-cases/debt-case-list.tsx` | `PageWrapper` → `SectionHeader` + `DottedCard`; `TIER_COLORS` + `STATUS_COLORS` → CSS token vars |
| `pages/debt-cases/debt-case-detail.tsx` | Header → `SectionHeader`; cards → `DottedCard`; field labels → mono uppercase; amount colors → CSS token vars |

## Files Skipped (A-impact — inherits tokens)

- `contact-detail-dialog.tsx` — A-impact, inherits
- `contact-form.tsx` — A-impact, inherits
- `contact-merge-dialog.tsx` — A-impact, inherits
- `contact-import-wizard.tsx` + step files — A-impact, inherits
- `lead-form.tsx` — A-impact, inherits

## Pre-existing TS Errors in Owned Folders

None — `npx tsc --noEmit 2>&1 | grep -E "pages/(contacts|debt-cases|leads)|data-table.tsx"` returned zero lines.

## Pre-existing 200-line Violations (NOT fixed — pre-WIP)

- `contact-list.tsx`: was 330 lines before this session, now 339
- `contact-detail.tsx`: was 299 lines, now 300
- `lead-list.tsx`: was 307 lines, now 319
- `debt-case-list.tsx`: was 249 lines, now 263

These files exceeded 200 lines before this restyle phase. Splitting was deferred — it would require business logic restructuring beyond this visual-only phase scope.

## Verification

```
npx tsc --noEmit 2>&1 | grep -E "pages/(contacts|debt-cases|leads)|data-table.tsx" | head -30
# → (empty — zero errors)
```
