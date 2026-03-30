---
phase: 15
title: "CSV Import + Permissions + Templates"
status: pending
effort: 3h
---

# Phase 15: CSV Import, Permissions & Templates

## Context
- [Existing contact import service](../../packages/backend/src/services/contact-import-service.ts)
- [RBAC middleware](../../packages/backend/src/middleware/rbac-middleware.ts)
- [Seed file](../../packages/backend/prisma/seed.ts)

## Overview
Add 3 import permission keys, create CSV import endpoints for leads/campaigns (contacts already has one), add import UI buttons on list pages, create downloadable CSV template files.

## Key Insights
- Contact import already works via `/api/v1/contacts/import` (xlsx-based). Extend to support CSV too (xlsx lib handles CSV natively).
- Lead and Campaign import endpoints don't exist yet.
- `requirePermission()` middleware already works - just need to add new permission keys and wire them.
- PageWrapper's `actions` prop lets us inject buttons without modifying the component.

---

## Part A: Import Permissions

### Files to Modify
- `packages/backend/prisma/seed.ts`

### Steps
1. Add 3 permission definitions to `permissionDefs` array in seed.ts:
   ```
   { key: 'import_contacts',  label: 'Import danh ba',       group: 'contacts' }
   { key: 'import_leads',     label: 'Import khach tiem nang', group: 'leads' }
   { key: 'import_campaigns', label: 'Import chien dich',     group: 'campaigns' }
   ```
2. Add grants to `defaultGrants`:
   - `admin`: add all 3
   - `super_admin`: auto-bypasses (no change needed)
   - `manager`: add `import_contacts`, `import_leads`
3. Re-run seed: `npx prisma db seed`

---

## Part B: CSV Templates

### Files to Create
- `packages/backend/src/templates/contacts-template.csv`
- `packages/backend/src/templates/leads-template.csv`
- `packages/backend/src/templates/campaigns-template.csv`
- `packages/backend/src/templates/debt-cases-template.csv`
- `packages/backend/src/routes/template-routes.ts`

### Template Content

**contacts-template.csv:**
```csv
Ho ten (required),So dien thoai (required),So DT phu (optional),Email (optional),CMND/CCCD (optional),Dia chi (optional),Ngay sinh (optional),Gioi tinh (optional),Nguon (optional),Nhan (optional),Ghi chu (optional)
Nguyen Van A,0901234567,0912345678,a@email.com,012345678901,123 Le Loi Q1 HCM,1990-01-15,Nam,Facebook,"VIP, Khach cu",Ghi chu mau
```

**leads-template.csv:**
```csv
So dien thoai lien he (required),Trang thai (optional),Diem (optional),Ghi chu (optional)
0901234567,new,50,Lead mau tu CSV
```

**campaigns-template.csv:**
```csv
Ten chien dich (required),Loai (required),Ngay bat dau (optional),Ngay ket thuc (optional),Script (optional)
Chien dich Tet 2026,telesale,2026-04-01,2026-04-30,Xin chao anh/chi...
```

**debt-cases-template.csv:**
```csv
So dien thoai lien he (required),So tien goc (required),So tien con lai (required),So ngay qua han (optional),Trang thai (optional),Ghi chu (optional)
0901234567,50000000,35000000,15,active,No tu hop dong 123
```

### Template Route
- `GET /api/v1/templates/:type` - serves static CSV file
- `:type` = `contacts | leads | campaigns | debt-cases`
- Set `Content-Disposition: attachment; filename={type}-template.csv`
- Auth required, no specific permission (anyone logged in can download templates)

### Files to Modify
- `packages/backend/src/index.ts` - register template routes

---

## Part C: Lead Import Endpoint

### Files to Create
- `packages/backend/src/services/lead-import-service.ts`

### Files to Modify
- `packages/backend/src/routes/lead-routes.ts` - add import route

### Steps
1. Create `lead-import-service.ts`:
   - Parse CSV/Excel buffer using `xlsx`
   - Header map: `So dien thoai lien he` -> contactPhone, `Trang thai` -> status, `Diem` -> score, `Ghi chu` -> notes
   - For each row: find Contact by phone, if not found -> add to errors. Create Lead linked to found contact.
   - Return `{ total, success, failed, errors }` same pattern as contact import
2. Add to `lead-routes.ts`:
   ```ts
   import multer from 'multer';
   const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
   router.post('/import', requirePermission('import_leads'), upload.single('file'), handler);
   ```
3. Update contact import route to use `requirePermission('import_contacts')` instead of `requireRole()`

---

## Part D: Campaign Import Endpoint

### Files to Create
- `packages/backend/src/services/campaign-import-service.ts`

### Files to Modify
- `packages/backend/src/routes/campaign-routes.ts` - add import route

### Steps
1. Create `campaign-import-service.ts`:
   - Header map: `Ten chien dich` -> name, `Loai` -> type, `Ngay bat dau` -> startDate, `Ngay ket thuc` -> endDate, `Script` -> script
   - Validate: name required, type must be `telesale|collection`
   - Return same ImportResult pattern
2. Add route:
   ```ts
   router.post('/import', requirePermission('import_campaigns'), upload.single('file'), handler);
   ```

---

## Part E: Frontend Import UI

### Files to Modify
- `packages/frontend/src/pages/contacts/contact-list.tsx`
- `packages/frontend/src/pages/leads/lead-list.tsx`
- `packages/frontend/src/pages/campaigns/campaign-list.tsx`

### Files to Create
- `packages/frontend/src/components/import-button.tsx` (reusable component)

### Import Button Component
```
Props: { endpoint: string; templateType: string; onSuccess: () => void; permissionKey?: string }
```
- Renders two buttons: "Import CSV" (Upload icon) + "Tai template mau" (Download icon)
- "Import CSV" opens hidden file input (accept=".csv,.xlsx,.xls")
- On file select: POST to `endpoint` with FormData, show toast with results
- "Tai template mau": calls `GET /api/v1/templates/{templateType}` and triggers download
- Both buttons go into PageWrapper's `actions` slot

### Integration per page
- contact-list.tsx: `<ImportButton endpoint="/contacts/import" templateType="contacts" />`
- lead-list.tsx: `<ImportButton endpoint="/leads/import" templateType="leads" />`
- campaign-list.tsx: `<ImportButton endpoint="/campaigns/import" templateType="campaigns" />`

---

## Todo List
- [ ] Add 3 permission keys to seed.ts permissionDefs
- [ ] Add permission grants for admin/manager in seed defaultGrants
- [ ] Create 4 CSV template files in packages/backend/src/templates/
- [ ] Create template-routes.ts with GET /api/v1/templates/:type
- [ ] Register template routes in index.ts
- [ ] Create lead-import-service.ts
- [ ] Add import route to lead-routes.ts
- [ ] Create campaign-import-service.ts
- [ ] Add import route to campaign-routes.ts
- [ ] Update contact import route to use requirePermission
- [ ] Create ImportButton reusable component
- [ ] Add ImportButton to contact-list.tsx
- [ ] Add ImportButton to lead-list.tsx
- [ ] Add ImportButton to campaign-list.tsx
- [ ] Test all import endpoints with sample CSV files

## Success Criteria
- 3 new permissions in DB, granted to super_admin (auto) and admin
- CSV import works for contacts, leads, campaigns
- Template download works for all 4 types
- Import UI shows on each list page with upload + template download buttons
- Error rows reported back to user with row number + error message

## Risk Assessment
- **Duplicate contacts on re-import**: current contact-import creates new records. Consider upsert by phone number. Flag for future enhancement.
- **Large file uploads**: 10MB limit already set. xlsx lib handles this fine.

## Security
- All import endpoints require auth + permission check
- File size limited to 10MB via multer
- Input validated and sanitized before DB insert
