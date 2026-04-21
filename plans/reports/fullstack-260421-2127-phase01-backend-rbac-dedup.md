# Phase 01 Report — Backend RBAC Permission Dedup

**Date:** 2026-04-21
**Status:** Complete (code + migration SQL). DB runtime steps require manual execution.

## Files Modified

| File | Change |
|---|---|
| `packages/backend/prisma/seed.ts` | Removed 16 legacy flat permission defs; added `recording.delete` under switchboard group; stripped all legacy keys from role-grant arrays |
| `packages/backend/prisma/seed-role-permissions.ts` | Same dedup: removed legacy keys from all role grant arrays; added `super_admin` entry with `recording.delete`; added `admin` with `recording.delete` |
| `packages/backend/prisma/migrations/20260421211700_rbac_dedup/migration.sql` | New idempotent migration SQL (created) |
| `packages/backend/src/routes/assignment-routes.ts` | `manage_campaigns` → `campaign.manage` |
| `packages/backend/src/routes/script-routes.ts` | `manage_campaigns` → `campaign.manage` (4 occurrences) |
| `packages/backend/src/routes/export-routes.ts` | `export_excel` → `report.export` |
| `packages/backend/src/routes/monitoring-routes.ts` | `view_dashboard` → `report.view_own` (3 occurrences); `view_recordings` → `switchboard.listen_recording` (1 occurrence) |
| `packages/backend/src/routes/qa-timestamp-routes.ts` | `view_recordings` → `switchboard.listen_recording` (3 occurrences) |
| `packages/backend/src/routes/contact-merge-routes.ts` | `manage_contacts` → `crm.contacts.edit` |
| `packages/backend/src/routes/ticket-routes.ts` | Replaced `requireRole(Role.admin, Role.super_admin)` with `requirePermission('ticket.delete')` on DELETE |
| `packages/backend/src/routes/contact-routes.ts` | `requireRole(...)` → `requirePermission('crm.contacts.delete')` on DELETE /:id and POST /bulk-delete |
| `packages/backend/src/routes/call-log-routes.ts` | Added `DELETE /:id/recording` with `requirePermission('recording.delete')` |
| `packages/backend/src/services/ticket-service.ts` | Removed hardcoded `if (role !== 'admin' ...)` check in `deleteTicket`; permission now enforced at route |
| `packages/backend/src/services/call-log-service.ts` | Added `deleteRecording(callLogId, userId)` method |
| `packages/backend/src/controllers/call-log-controller.ts` | Added `deleteRecording` controller method |

## Migration SQL Summary

Path: `packages/backend/prisma/migrations/20260421211700_rbac_dedup/migration.sql`

Three sections:
1. PL/pgSQL loop over 16 legacy→modern pairs: if both exist → merge grants via INSERT ON CONFLICT, then DELETE legacy; if only legacy exists → UPDATE key in-place (FK preserved)
2. INSERT `recording.delete` permission ON CONFLICT DO NOTHING
3. INSERT `recording.delete` grants for `super_admin` + `admin` in all clusters ON CONFLICT DO UPDATE

**Critical deviation from task spec:** The task migration template used `(id, role, permission_id, granted)` columns but `role_permissions` PK in schema is `(cluster_id, role, permission_id)` with no `id` column. Migration SQL corrected to use `(cluster_id, role, permission_id, granted)`.

## Schema Notes

- `CallLog.recordingPath` (mapped from `recording_path`) — no `recordingDeletedAt`/`recordingDeletedBy` columns exist in schema. Per YAGNI, `deleteRecording` nulls out `recordingPath` and sets `recordingStatus = 'none'` without adding new columns.
- `crm.leads.import` and `crm.contacts.import` are in the modern key set but were NOT previously in the permission defs. The migration renames legacy `import_leads`→`crm.leads.import` and `import_contacts`→`crm.contacts.import` in-place if they exist without a modern counterpart.

## Compile

`npm --workspace packages/backend run build` → clean, 0 errors.

`grep` for all 16 legacy keys in `packages/backend/src/` → 0 matches.

## Manual Steps Required (DB access needed)

```bash
cd packages/backend
npx prisma migrate dev --name rbac_dedup --skip-seed
npx prisma db seed
psql $DATABASE_URL -c 'SELECT "group", COUNT(*) FROM permissions GROUP BY "group" ORDER BY 1;'
# Expected: 7 groups — campaign, crm, qa, report, switchboard, system, ticket
```

## Unresolved Questions

- `campaign.import` key: added by migration rename but not in new `permissionDefs` in seed.ts. If seed runs before migration (fresh DB), this key won't exist. Consider adding `{ key: 'campaign.import', label: 'Nhập chiến dịch CSV', group: 'campaign', parentKey: 'campaign.manage' }` to seed.ts if campaign import is still a needed feature.
- `crm.leads.import` / `crm.contacts.import`: same concern — these are migration-rename targets but not in `permissionDefs`. They existed as legacy keys. If needed as modern permissions, add to seed.
