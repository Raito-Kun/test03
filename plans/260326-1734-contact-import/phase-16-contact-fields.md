---
phase: 16
title: "Contact Extended Fields + Dialog Detail"
status: pending
effort: 3h
---

# Phase 16: Contact Extended Fields + Dialog Detail View

## Context
- [Current Contact model](../../packages/backend/prisma/schema.prisma) (lines 206-235)
- [Contact controller](../../packages/backend/src/controllers/contact-controller.ts)
- [Contact form](../../packages/frontend/src/pages/contacts/contact-form.tsx)
- [Contact detail page](../../packages/frontend/src/pages/contacts/contact-detail.tsx)
- [Contact list page](../../packages/frontend/src/pages/contacts/contact-list.tsx)

## Overview
Extend Contact model with personal/financial/work fields, update backend validation, add fields to frontend form, and add a large centered Dialog for quick contact detail view when clicking a row in the list.

## Key Insights
- Contact already has: idNumber, dateOfBirth, gender, address. Missing 12 fields.
- Contact form is a Sheet (side panel). Keep it for create/edit.
- Contact detail is a full page. Add Dialog as quick-view from list, keep page as fallback.
- `customFields` JsonB column exists but typed fields are better for querying/validation.

---

## Part A: Prisma Migration

### Files to Modify
- `packages/backend/prisma/schema.prisma`

### New Fields on Contact Model

```prisma
model Contact {
  // ... existing fields ...

  // Personal
  occupation    String?
  income        Decimal?  @db.Decimal(15, 2)

  // Address (keep existing address field, add structured fields)
  province      String?
  district      String?
  fullAddress   String?  @map("full_address")

  // Work
  company       String?
  jobTitle      String?  @map("job_title")
  companyEmail  String?  @map("company_email")

  // Financial
  creditLimit   Decimal?  @map("credit_limit") @db.Decimal(15, 2)
  bankAccount   String?   @map("bank_account")
  bankName      String?   @map("bank_name")

  // Notes
  internalNotes String?   @map("internal_notes")
}
```

### Migration SQL (for reference)
```sql
ALTER TABLE contacts
  ADD COLUMN occupation VARCHAR,
  ADD COLUMN income DECIMAL(15,2),
  ADD COLUMN province VARCHAR,
  ADD COLUMN district VARCHAR,
  ADD COLUMN full_address VARCHAR,
  ADD COLUMN company VARCHAR,
  ADD COLUMN job_title VARCHAR,
  ADD COLUMN company_email VARCHAR,
  ADD COLUMN credit_limit DECIMAL(15,2),
  ADD COLUMN bank_account VARCHAR,
  ADD COLUMN bank_name VARCHAR,
  ADD COLUMN internal_notes TEXT;
```

### Steps
1. Add fields to schema.prisma Contact model
2. Run `npx prisma migrate dev --name add-contact-extended-fields`
3. Run `npx prisma generate`

---

## Part B: Backend Validation

### Files to Modify
- `packages/backend/src/controllers/contact-controller.ts`
- `packages/backend/src/services/contact-import-service.ts`

### Steps
1. Update `createContactSchema` in contact-controller.ts to add:
   ```ts
   occupation: z.string().max(100).optional(),
   income: z.number().positive().optional(),
   province: z.string().max(100).optional(),
   district: z.string().max(100).optional(),
   fullAddress: z.string().max(500).optional(),
   company: z.string().max(200).optional(),
   jobTitle: z.string().max(100).optional(),
   companyEmail: z.string().email().optional(),
   creditLimit: z.number().nonnegative().optional(),
   bankAccount: z.string().max(30).optional(),
   bankName: z.string().max(100).optional(),
   internalNotes: z.string().optional(),
   ```
2. `updateContactSchema` already derives from `createContactSchema.partial()` - no change needed.
3. Update contact-import-service.ts HEADER_MAP to include new Vietnamese headers:
   ```ts
   'Nghe nghiep': 'occupation',
   'Thu nhap': 'income',
   'Tinh/Thanh': 'province',
   'Quan/Huyen': 'district',
   'Dia chi day du': 'fullAddress',
   'Cong ty': 'company',
   'Chuc vu': 'jobTitle',
   'Email cong ty': 'companyEmail',
   'Han muc tin dung': 'creditLimit',
   'So tai khoan': 'bankAccount',
   'Ngan hang': 'bankName',
   'Ghi chu noi bo': 'internalNotes',
   ```
4. Update import service to pass new fields to prisma create.
5. Update export service to include new fields.
6. Update contacts-template.csv to include new field headers.

---

## Part C: Frontend Contact Form

### Files to Modify
- `packages/frontend/src/pages/contacts/contact-form.tsx`

### Steps
1. Expand `FormState` interface and `EMPTY_FORM` with all new fields
2. Expand `Contact` interface with new fields
3. Add form sections with visual grouping using fieldsets or dividers:
   - **Thong tin ca nhan** (Personal): occupation, income, dateOfBirth, gender
   - **Dia chi** (Address): province, district, fullAddress
   - **Cong viec** (Work): company, jobTitle, companyEmail
   - **Tai chinh** (Financial): creditLimit, bankAccount, bankName
   - **Ghi chu noi bo** (Internal): internalNotes textarea
4. Use Accordion or Tabs to keep form manageable (recommended: collapsible sections via shadcn Accordion)
5. Add to mutation payload mapping

---

## Part D: Contact Detail Dialog (Quick View)

### Files to Create
- `packages/frontend/src/pages/contacts/contact-detail-dialog.tsx`

### Files to Modify
- `packages/frontend/src/pages/contacts/contact-list.tsx`

### Contact Detail Dialog Design
- Large centered Dialog (shadcn Dialog, max-w-4xl)
- Shows all contact fields organized in sections (same grouping as form)
- Tabs at bottom: Tickets, Calls, Timeline (reuse same queries as contact-detail.tsx)
- Header: contact name, phone, call button, edit button
- Edit button opens the Sheet form
- "Xem chi tiet" (View full detail) link navigates to `/contacts/:id`

### Steps
1. Create `contact-detail-dialog.tsx`:
   - Props: `{ contactId: string | null; open: boolean; onClose: () => void }`
   - Fetches contact data via `GET /api/v1/contacts/:id`
   - Displays info in 2-col grid within Dialog
   - Includes Tabs for tickets/calls/timeline
2. Modify `contact-list.tsx`:
   - Add state: `const [previewId, setPreviewId] = useState<string | null>(null)`
   - Change `onRowClick` to set `previewId` instead of navigating
   - Render `<ContactDetailDialog contactId={previewId} open={!!previewId} onClose={() => setPreviewId(null)} />`

---

## Part E: Vietnamese Labels

### Files to Modify
- `packages/frontend/src/lib/vi-text.ts`

### Steps
Add to `VI.contact`:
```ts
occupation: 'Nghe nghiep',
income: 'Thu nhap',
province: 'Tinh/Thanh pho',
district: 'Quan/Huyen',
fullAddress: 'Dia chi day du',
company: 'Cong ty',
jobTitle: 'Chuc vu',
companyEmail: 'Email cong ty',
creditLimit: 'Han muc tin dung',
bankAccount: 'So tai khoan',
bankName: 'Ngan hang',
internalNotes: 'Ghi chu noi bo',
importCsv: 'Import CSV',
downloadTemplate: 'Tai template mau',
```

---

## Todo List
- [ ] Add 12 new fields to Contact model in schema.prisma
- [ ] Run prisma migrate dev
- [ ] Run prisma generate
- [ ] Update createContactSchema in contact-controller.ts
- [ ] Update HEADER_MAP in contact-import-service.ts
- [ ] Update import/export functions for new fields
- [ ] Add Vietnamese labels to vi-text.ts
- [ ] Expand contact-form.tsx with new field sections
- [ ] Create contact-detail-dialog.tsx
- [ ] Update contact-list.tsx to use dialog on row click
- [ ] Update contacts-template.csv with new headers

## Success Criteria
- 12 new fields stored in DB, queryable
- Contact form shows all fields in organized sections
- Row click in list opens large centered Dialog with full contact info
- Dialog has edit button (opens Sheet form) and "View full" link
- Import/export handles all new fields

## Risk Assessment
- **Form too long**: mitigate with Accordion sections, only personal section expanded by default
- **Dialog performance**: lazy-load tabs content, only fetch when tab selected

## Security
- Financial fields (creditLimit, bankAccount) visible only in detail views, not in list columns
- internalNotes not exposed in exports by default (internal use only)
