# Phase 01 — Backend seed + migration + middleware

**Stream A** · Priority: P0 · Status: Complete

## Overview

Dedupe permission keys in seed.ts, write idempotent Prisma migration to rename keys (preserving role_permissions FK), update middleware usages, add `recording.delete`, fix hardcoded role checks.

## Context

- Research: frontend/backend audit summary in `plan.md` migration table
- Skill: `.claude/skills/crm-permission/SKILL.md`
- Schema: `packages/backend/prisma/schema.prisma` (models `Permission`, `RolePermission`)

## Files to modify

### Seed
- `packages/backend/prisma/seed.ts` — remove 16 legacy perm defs, add `recording.delete`, update role-grant arrays (lines ~254-286) to use modern keys
- `packages/backend/prisma/seed-role-permissions.ts` — same dedup

### Migration (NEW)
- `packages/backend/prisma/migrations/260421_rbac_dedup/migration.sql` — idempotent UPSERT:
  ```sql
  -- Rename legacy keys to modern (preserves FK cascade)
  UPDATE permissions SET key = 'campaign.import' WHERE key = 'import_campaigns';
  UPDATE permissions SET key = 'campaign.manage' WHERE key = 'manage_campaigns';
  -- ... (14 more)
  -- Insert new: recording.delete
  INSERT INTO permissions (id, key, label, "group") VALUES (gen_random_uuid(), 'recording.delete', 'Xoá ghi âm', 'switchboard') ON CONFLICT (key) DO NOTHING;
  -- Grant recording.delete to super_admin + admin
  INSERT INTO role_permissions (id, role, permission_id, granted)
  SELECT gen_random_uuid(), r.role, p.id, true
  FROM (VALUES ('super_admin'::text), ('admin')) r(role)
  CROSS JOIN permissions p WHERE p.key = 'recording.delete'
  ON CONFLICT (role, permission_id) DO UPDATE SET granted = true;
  -- Handle UNIQUE key collisions (if modern key already exists):
  -- Merge grants from legacy → modern, then DELETE legacy row
  ```
  **Critical**: migration must handle case where BOTH legacy and modern rows exist (e.g., `manage_tickets` + `ticket.manage`). Merge granted=true from legacy into modern, then delete legacy row.

### Middleware/route updates
- `packages/backend/src/routes/assignment-routes.ts:9` — `manage_campaigns` → `campaign.manage`
- `packages/backend/src/routes/script-routes.ts:82,99,110,120` — same
- `packages/backend/src/routes/export-routes.ts:10` — `export_excel` → `report.export`
- `packages/backend/src/routes/monitoring-routes.ts:14,47,59` — `view_dashboard` → `report.view_own`
- `packages/backend/src/routes/monitoring-routes.ts:73` — `view_recordings` → `switchboard.listen_recording`
- `packages/backend/src/routes/qa-timestamp-routes.ts:25,87,135` — `view_recordings` → `switchboard.listen_recording`
- `packages/backend/src/routes/contact-merge-routes.ts:9` — `manage_contacts` → `crm.contacts.edit`

### Enforcement fixes
- `packages/backend/src/services/ticket-service.ts:~187` — remove hardcoded `if (role !== 'admin'...)` from `deleteTicket`; middleware handles it
- `packages/backend/src/routes/ticket-routes.ts` — add `requirePermission('ticket.delete')` on `DELETE /tickets/:id`
- `packages/backend/src/routes/contact-routes.ts` — add `requirePermission('crm.contacts.delete')` on `DELETE /contacts/:id` + `POST /contacts/bulk-delete`
- `packages/backend/src/controllers/call-log-controller.ts` — add `deleteRecording` method if missing
- `packages/backend/src/routes/call-log-routes.ts` — add `DELETE /call-logs/:id/recording` route with `requirePermission('recording.delete')`

### Service
- `packages/backend/src/services/call-log-service.ts` — add `deleteRecording(callLogId, userId)` — set `recordingFile = null`, delete file from FS (rsync/fs.unlink), audit-log the action

### Cache
- `packages/backend/src/services/permission-service.ts` — confirm cache-bust on seed/migration; add CLI script `scripts/bust-permission-cache.ts` to run post-deploy

## Implementation steps

1. Read current `seed.ts` + `schema.prisma` + `permission-service.ts`
2. Update seed.ts with single-source permission list (dedup)
3. Write `260421_rbac_dedup/migration.sql` with 3 sections: rename-collisions, rename-no-conflict, add-new
4. Update all route/middleware files listed above
5. Fix ticket-service.ts hardcoded check
6. Add contact DELETE middleware
7. Add `recording.delete` endpoint + service + middleware
8. Compile TS: `npm --workspace packages/backend run build`
9. Run `npx prisma migrate dev --name rbac_dedup --skip-seed`
10. Re-seed: `npx prisma db seed`
11. Verify in psql: `SELECT "group", COUNT(*) FROM permissions GROUP BY "group" ORDER BY 1;` → expect exactly 7 groups

## Todo

- [x] Update seed.ts (remove 16 legacy, add recording.delete)
- [x] Write migration.sql
- [x] Update 7 route files with new permission keys
- [x] Fix ticket-service hardcoded check
- [x] Add DELETE /contacts + bulk-delete middleware
- [x] Add DELETE /call-logs/:id/recording endpoint
- [x] Compile check
- [ ] Run migration on dev DB (requires DB access — manual step)
- [ ] Re-seed (requires DB access — manual step)
- [ ] DB sanity: 7 groups total (requires DB access — manual step)

## Success criteria

- `SELECT DISTINCT "group" FROM permissions` returns exactly: campaign, crm, report, switchboard, ticket, qa, system
- No permission row with legacy key format remains
- `ticket.delete`, `crm.contacts.delete`, `recording.delete` all have `requirePermission()` on corresponding routes
- Backend compiles cleanly
- `npx prisma migrate status` clean

## Risks

- UNIQUE constraint on `permissions.key` may fail if both legacy + modern rows exist → migration must MERGE first (copy granted=true to modern, delete legacy)
- `role_permissions.permissionId` FK prevents naive delete → always update legacy → new key in place, FK preserves

## Dependencies

- Depends on: none (first parallel stream)
- Unblocks: Phase 03 (tests)
