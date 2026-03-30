# Phase Implementation Report

## Executed Phase
- Phase: phase-15-import-csv
- Plan: plans/260326-1734-contact-import/
- Status: completed

## Files Modified

| File | Change |
|------|--------|
| `packages/backend/prisma/seed.ts` | +4 permission defs, +3 admin grants, +2 manager grants, updated log msg |
| `packages/backend/src/routes/lead-routes.ts` | Added POST /import with multer + requireRole |
| `packages/backend/src/routes/campaign-routes.ts` | Added POST /import with multer + requireRole |
| `packages/backend/src/index.ts` | Import + register templateRoutes at /api/v1/templates |
| `packages/frontend/src/pages/contacts/contact-list.tsx` | Added ImportButton (admin/super_admin via hasPermission) |
| `packages/frontend/src/pages/leads/lead-list.tsx` | Added ImportButton (import_leads permission) |

## Files Created

| File | Purpose |
|------|---------|
| `packages/backend/src/templates/contacts-template.csv` | CSV template with header + example row |
| `packages/backend/src/templates/leads-template.csv` | CSV template with header + example row |
| `packages/backend/src/templates/campaigns-template.csv` | CSV template with header + example row |
| `packages/backend/src/templates/debt-cases-template.csv` | CSV template with header + example row |
| `packages/backend/src/routes/template-routes.ts` | GET /:type - serve CSV file download, no auth |
| `packages/backend/src/services/lead-import-service.ts` | Parse CSV/XLSX, resolve/create contacts, create leads |
| `packages/backend/src/services/campaign-import-service.ts` | Parse CSV/XLSX, validate type, create campaigns |
| `packages/frontend/src/components/import-button.tsx` | Reusable upload + template download button |

## Tasks Completed
- [x] Add 3 import permissions to seed (import_contacts, import_leads, import_campaigns)
- [x] Add to defaultGrants: admin gets all 3, manager gets import_leads + import_campaigns
- [x] Create 4 CSV template files with (*required)/(optional) markers + example rows
- [x] Create template-routes.ts serving templates as file download (no auth)
- [x] Register /api/v1/templates in index.ts
- [x] Create lead-import-service.ts (xlsx parse, contact resolve/create, lead create)
- [x] Create campaign-import-service.ts (xlsx parse, validate type, campaign create)
- [x] Add POST /import to lead-routes.ts (admin/super_admin/manager)
- [x] Add POST /import to campaign-routes.ts (admin/super_admin)
- [x] Contact import route already existed in contact-routes.ts - no change needed
- [x] Create ImportButton component (upload + template download, toast feedback)
- [x] Add ImportButton to contact-list.tsx (behind import_contacts permission)
- [x] Add ImportButton to lead-list.tsx (behind import_leads permission)

## Tests Status
- Backend typecheck: pass (exit 0)
- Frontend typecheck: pre-existing errors in contact-form.tsx (Collapsible) and contact-detail-dialog.tsx (income type) — none from Phase 15 files

## Implementation Notes
- Header normalization strips `(*required)` / `(optional)` markers so template headers parse cleanly
- Lead import resolves contact by phone; creates new contact if not found
- Campaign `description` field maps to `script` column (only existing text field in Campaign model)
- Template download uses absolute `__dirname` path to locate CSV files regardless of CWD

## Issues Encountered
- Pre-existing frontend TS errors in contact-form.tsx (missing Collapsible import) and contact-detail-dialog.tsx (income number vs string) — out of scope for Phase 15

## Next Steps
- Run `npx prisma db seed` to add the 3 new permissions to the DB
- Fix pre-existing Collapsible import error in contact-form.tsx (separate task)
