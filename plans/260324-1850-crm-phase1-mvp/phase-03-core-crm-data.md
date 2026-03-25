---
phase: 03
title: "Core CRM Data"
status: completed
priority: P1
effort: 4d
depends_on: [02]
---

# Phase 03 — Core CRM Data

## Context Links
- [PRD](../../Guildline/PRD.md) — Sections 4.1.1-4.1.5, 6.2-6.7, API 7.4-7.6, 7.14
- [Plan Overview](./plan.md)

## Overview
CRUD for Contacts, Leads, Debt Cases, Campaigns. Import/Export contacts via Excel. Contact relationships. All endpoints RBAC-protected with data scoping.

## Key Insights
- contacts.phone is INDEX not UNIQUE (VN customers may share phone)
- Leads are always linked to a contact + optionally to a campaign
- Debt cases linked to contact + optionally campaign
- Import/Export uses xlsx library (Excel .xlsx format)
- Pagination convention: `?page=1&limit=20&sort=created_at&order=desc&search=keyword&filter[field]=value`
- Response format: `{ data: [...], meta: { total, page, limit, totalPages } }`

## Requirements
**Functional:**
- Contacts: CRUD, search (phone/name/id_number), import/export Excel, timeline, relationships
- Leads: CRUD, status pipeline, follow-up scheduling, filter by status/campaign/agent
- Debt Cases: CRUD, import, PTP (Promise to Pay) recording, filter by tier/status/agent
- Campaigns: CRUD, basic management (full campaign management is Phase 2)
- Contact relationships: link family/guarantor contacts

**Non-functional:**
- API < 200ms p95
- Support 10,000 contacts efficiently (indexed queries)

## Architecture
Standard REST pattern: Route → Controller → Service → Prisma
- Services use `req.dataScope` from Phase 02 middleware
- Pagination/filter/sort as reusable utility

## Related Code Files
**Create:**
- `packages/backend/src/routes/contact-routes.ts`
- `packages/backend/src/routes/lead-routes.ts`
- `packages/backend/src/routes/debt-case-routes.ts`
- `packages/backend/src/routes/campaign-routes.ts`
- `packages/backend/src/controllers/contact-controller.ts`
- `packages/backend/src/controllers/lead-controller.ts`
- `packages/backend/src/controllers/debt-case-controller.ts`
- `packages/backend/src/controllers/campaign-controller.ts`
- `packages/backend/src/services/contact-service.ts`
- `packages/backend/src/services/lead-service.ts`
- `packages/backend/src/services/debt-case-service.ts`
- `packages/backend/src/services/campaign-service.ts`
- `packages/backend/src/services/import-export-service.ts`
- `packages/backend/src/lib/phone-utils.ts`
- `packages/backend/src/lib/pagination.ts`
- `packages/backend/src/lib/audit.ts`
- `packages/shared/src/validation/contact-schemas.ts`
- `packages/shared/src/validation/lead-schemas.ts`
- `packages/shared/src/validation/debt-case-schemas.ts`
- `packages/shared/src/validation/campaign-schemas.ts`

## Implementation Steps

### 1. Pagination & filter utility
1. Create `lib/pagination.ts` — parse query params, build Prisma `skip`, `take`, `orderBy`, `where`
2. Create response helper: `paginatedResponse(data, total, page, limit)`
3. Create `lib/query-builder.ts` — generic filter builder from `filter[field]=value` params

### 2. Phone normalization utility
<!-- Added: Validation Session 3 - Store as-entered, normalize on match -->
1. Create `lib/phone-utils.ts` — `normalizePhone(phone: string): string`
2. Rules: strip spaces/dashes, if starts with `0` replace with `+84`, if starts with `84` prepend `+`, if starts with `+84` keep as-is
3. Used by: CDR webhook contact matching (Phase 04), contact search, import dedup
4. Phone stored as-entered in DB — normalization only at query/match time

### 3. Audit logging utility
1. Create `lib/audit.ts` — `logAudit(userId, action, entityType, entityId, changes, req)`
2. Captures: user_id, action, entity_type, entity_id, changes (old/new JSONB), ip_address, user_agent
3. Used by all CUD operations

### 4. Contact endpoints
1. `GET /contacts` — list with pagination, search by phone/name/id_number, filter by tags/source/assigned_to
2. `POST /contacts` — create, validate phone format, assign created_by
3. `GET /contacts/:id` — detail with relationships
4. `PATCH /contacts/:id` — update, audit log changes
5. `DELETE /contacts/:id` — soft delete or hard delete (Manager+ only), audit log
6. `POST /contacts/import` — accept .xlsx file, parse rows, bulk upsert, return success/error count
7. `GET /contacts/export` — generate .xlsx from filtered query, stream download
8. `GET /contacts/:id/timeline` — aggregate: call_logs + tickets + leads + debt_cases ordered by date

### 5. Contact relationships
1. Add to contact detail response: linked contacts with relationship_type
2. `POST /contacts/:id/relationships` — link two contacts
3. `DELETE /contacts/:contactId/relationships/:id` — unlink

### 6. Lead endpoints
1. `GET /leads` — list with pagination, filter by status/campaign/assigned_to/next_follow_up range
2. `POST /leads` — create, must link to existing contact_id
3. `PATCH /leads/:id` — update status (pipeline progression), score, notes
4. `POST /leads/:id/follow-up` — set next_follow_up date, create notification reminder

### 7. Debt Case endpoints
1. `GET /debt-cases` — list, filter by tier/status/dpd range/campaign/assigned_to
2. `POST /debt-cases` — create/import, link to contact
3. `PATCH /debt-cases/:id` — update status, tier auto-calculated from dpd
4. `POST /debt-cases/:id/promise` — record PTP: promise_date, promise_amount, create notification

### 8. Campaign endpoints (basic CRUD for Phase 1)
1. `GET /campaigns` — list, filter by type/status
2. `POST /campaigns` — create (admin/manager)
3. `PATCH /campaigns/:id` — update name, status, script, dates
4. `POST /campaigns/:id/assign` — assign contacts to campaign agents (basic, manual only for Phase 1)

### 9. Import/Export service
<!-- Updated: Validation Session 1 - Vietnamese header mapping confirmed -->
1. Import: parse xlsx using `xlsx` library. **Vietnamese header mapping**: create `HEADER_MAP` dict mapping Vietnamese → English column names (e.g., `"Họ tên" → "full_name"`, `"Số điện thoại" → "phone"`, `"CMND/CCCD" → "id_number"`, `"Địa chỉ" → "address"`, `"Ngày sinh" → "date_of_birth"`, `"Giới tính" → "gender"`, `"Nguồn" → "source"`, `"Email" → "email"`). Normalize headers before validation.
2. Validate rows, skip invalid with error report (row number + error reason in Vietnamese)
3. Export: query with filters, generate xlsx with Vietnamese headers, set Content-Disposition header
4. Template download: `GET /contacts/import-template` — empty xlsx with Vietnamese column headers + example row

## Todo List
- [x] Phone normalization utility (normalizePhone)
- [x] Pagination & filter utility
- [x] Audit logging utility
- [x] Contact CRUD + search + relationships
- [x] Contact import/export (Excel) — Implemented with Vietnamese headers
- [x] Contact timeline aggregation
- [x] Lead CRUD + follow-up scheduling
- [x] Debt Case CRUD + PTP recording
- [x] Campaign basic CRUD + assignment
- [x] Zod validation for all entities
- [x] Data scope applied to all queries

## Success Criteria
- All CRUD operations work with proper RBAC
- Agent sees only own data, leader sees team, manager sees all
- Import 1000 contacts from Excel < 10s
- Export generates valid .xlsx
- Timeline shows all interactions for a contact
- Audit log captures all create/update/delete actions

## Risk Assessment
- Excel import with bad data: validate each row, return detailed error report
- Large export memory: stream xlsx generation, don't buffer entire file
- <!-- Updated: Validation Session 3 - Store as-entered, normalize on match -->
- Phone number format inconsistency: store as-entered (no normalization on input). Build `normalizePhone()` utility for query-time matching (CDR lookup). Handles: 0912345678 → +84912345678, +84912345678 → +84912345678, 84912345678 → +84912345678.

## Security Considerations
- Input validation via Zod on all endpoints
- SQL injection prevented by Prisma parameterized queries
- File upload: validate .xlsx MIME type, limit file size (10MB)
- Export: RBAC check before generating
