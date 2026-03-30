# Phase Implementation Report

## Executed Phase
- Phase: expand-fields (ad-hoc, 4 features)
- Plan: none (direct task)
- Status: completed

## Files Modified

| File | Change |
|---|---|
| `packages/backend/prisma/schema.prisma` | Added leadScore, product, budget to Lead; added contractNumber, debtType, paidAmount, remainingAmount, debtGroup, dueDate to DebtCase |
| `packages/backend/prisma/migrations/20260326200000_expand_lead_fields/migration.sql` | Created — ALTER TABLE leads ADD COLUMN |
| `packages/backend/prisma/migrations/20260326200001_expand_debt_fields/migration.sql` | Created — ALTER TABLE debt_cases ADD COLUMN |
| `packages/backend/src/controllers/lead-controller.ts` | Zod schema: added leadScore, product, budget |
| `packages/backend/src/services/lead-service.ts` | leadSelect + CreateLeadInput + create/update logic |
| `packages/backend/src/controllers/debt-case-controller.ts` | Zod schemas: added contractNumber, debtType, paidAmount, remainingAmount, debtGroup, dueDate |
| `packages/backend/src/services/debt-case-service.ts` | debtCaseSelect + CreateDebtCaseInput + create/update logic |
| `packages/backend/src/routes/template-routes.ts` | All 4 CSV templates updated with new fields + Vietnamese example rows |
| `packages/frontend/src/lib/vi-text.ts` | Added VI.lead.leadScore/product/budget; VI.debt.debtGroup/contractNumber/debtType/dueDate/remainingAmount |
| `packages/frontend/src/pages/leads/lead-list.tsx` | Lead interface + columns: leadScore, product |
| `packages/frontend/src/pages/debt-cases/debt-case-list.tsx` | DebtCase interface + columns: contractNumber, debtType, dpd, debtGroup |

## Tasks Completed

- [x] Feature 1: Lead schema expanded (leadScore, product, budget)
- [x] Feature 1: Migration SQL created
- [x] Feature 1: Lead controller Zod schema updated
- [x] Feature 1: Lead service create/update updated
- [x] Feature 2: DebtCase schema expanded (contractNumber, debtType, paidAmount, remainingAmount, debtGroup, dueDate)
- [x] Feature 2: Migration SQL created
- [x] Feature 2: Debt case controller Zod schema updated
- [x] Feature 2: Debt case service create/update updated
- [x] Feature 3: contacts template — all 22 fields + Vietnamese example
- [x] Feature 3: leads template — new fields (leadScore, product, budget) + example
- [x] Feature 3: debt-cases template — new fields + example
- [x] Feature 3: campaigns template — updated format
- [x] Feature 4: Lead list — leadScore + product columns added
- [x] Feature 4: Debt case list — contractNumber + debtType + dpd + debtGroup columns added

## Tests Status
- Type check backend: pass (no output)
- Type check frontend: pass (no output)
- Prisma generate: pass

## Notes

- `dpd` field already existed in DebtCase model — not re-added, just added to select output for display. It was already in the UI column list.
- Lead `score` field kept as-is; `leadScore` is the new dedicated field per spec. Both exist in schema.
- debt-case-list had `dpd` column already — kept and added the 3 new columns around it.
- Migration SQL uses `IF NOT EXISTS` guard for safety if re-run.

## Issues Encountered
None.

## Next Steps
- Run the migration SQL manually against the database (DO NOT use prisma migrate)
- Optionally expose new lead/debt fields in detail pages (lead-detail.tsx, debt-case-detail.tsx) and forms
