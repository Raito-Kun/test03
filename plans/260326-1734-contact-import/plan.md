---
title: "CSV Import, Contact Extended Fields & Templates"
description: "Add CSV import for contacts/leads/campaigns, extend Contact model with personal/financial fields, and create downloadable CSV templates"
status: pending
priority: P1
effort: 6h
branch: master
tags: [import, contact, csv, permissions]
created: 2026-03-26
---

# CSV Import, Contact Extended Fields & Templates

## Phases

| # | Phase | Effort | Status |
|---|-------|--------|--------|
| 15 | [CSV Import + Permissions](./phase-15-import-csv.md) | 3h | pending |
| 16 | [Contact Extended Fields + Dialog Detail](./phase-16-contact-fields.md) | 3h | pending |

Phase 15 includes Feature 1 (import permissions + CSV import endpoints/UI) and Feature 3 (CSV templates).
Phase 16 covers Feature 2 (extended Contact fields + dialog detail view).

## Key Findings

- **Contact import already exists**: `contact-import-service.ts` uses `xlsx` lib, imports from Excel buffer. Currently handles: fullName, phone, phoneAlt, email, idNumber, address, dateOfBirth, gender, source, tags, notes.
- **Lead/campaign import does NOT exist**: need new services.
- **Permission system ready**: `requirePermission()` middleware exists in `rbac-middleware.ts`. Permission + RolePermission tables seeded with 13 keys.
- **PageWrapper has `actions` prop**: can inject import/template buttons easily.
- **Contact model already has**: idNumber, dateOfBirth, gender, address. Missing: occupation, income, province, district, fullAddress, company, jobTitle, companyEmail, creditLimit, bankAccount, bankName, internalNotes.
- **No `csv-parse` installed**: current import uses `xlsx`. For CSV-specific import, either use `xlsx` (it reads CSV too) or add `csv-parse`. Recommend sticking with `xlsx` since it's already installed and handles CSV.

## Dependencies

- `xlsx` (already installed) - for CSV/Excel parsing
- `multer` (already installed) - for file upload
- No new npm packages needed
