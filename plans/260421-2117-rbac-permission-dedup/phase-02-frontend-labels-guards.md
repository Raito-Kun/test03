# Phase 02 — Frontend labels + guards

**Stream B** · Priority: P0 · Status: Pending

## Overview

Remove legacy group entries from GROUP_LABEL_MAP. Migrate 6 active legacy `hasPermission()` calls to modern keys. Add UI for `recording.delete` action.

## Files to modify

### GROUP_LABEL_MAP dedup
- `packages/frontend/src/pages/settings/permission-manager.tsx` (lines 21-39) — remove entries: `reports`, `calls`, `users`, `campaigns`, `dashboard`, `tickets`, `debts`, `leads`, `contacts`. Keep only modern: `campaign`, `crm`, `report`, `switchboard`, `ticket`, `qa`, `system`.
- `packages/frontend/src/components/permission-matrix-table.tsx` (lines 6-24) — same removal.
- **Consolidation (optional, YAGNI)**: if both files have identical maps, extract to `packages/frontend/src/lib/permission-groups.ts`. Skip if diff significant.

### Active legacy key migrations
| File | Line | Old | New |
|---|---|---|---|
| `packages/frontend/src/components/layout/sidebar.tsx` | 23 | `view_reports` | `report.view_own` |
| `packages/frontend/src/components/layout/sidebar.tsx` | 24 | `view_recordings` | `switchboard.listen_recording` |
| `packages/frontend/src/components/layout/sidebar.tsx` | 28 | `manage_users` | `system.users` |
| `packages/frontend/src/pages/settings/permission-manager.tsx` | 109 | `manage_permissions` | `system.permissions` |
| `packages/frontend/src/pages/settings/permission-manager.tsx` | 144 | `manage_permissions` | `system.permissions` |
| `packages/frontend/src/pages/leads/lead-list.tsx` | 249 | `import_leads` | `crm.leads.import` |

### New recording delete UI
- `packages/frontend/src/pages/call-logs/call-log-list.tsx` (or detail) — add delete button for row recording, gated by `hasPermission('recording.delete')`. POST to `DELETE /api/call-logs/:id/recording`, toast success, refresh list.
- `packages/frontend/src/api/call-log-api.ts` — add `deleteRecording(id)` wrapper

## Implementation steps

1. Read both permission-manager.tsx + permission-matrix-table.tsx files
2. Edit GROUP_LABEL_MAP: keep only 7 modern group keys
3. Grep `packages/frontend` for each legacy key string → replace with modern key
4. Add recording-delete button in call-logs UI, wired to new API
5. Run `npm --workspace packages/frontend run build` (tsc + vite)
6. Smoke test locally: open /permissions, visually confirm 7 groups (no dupes)

## Todo

- [ ] Remove 9 legacy entries from permission-manager.tsx GROUP_LABEL_MAP
- [ ] Remove 9 legacy entries from permission-matrix-table.tsx GROUP_LABEL_MAP
- [ ] Migrate sidebar.tsx (3 keys)
- [ ] Migrate permission-manager.tsx (2 hasPermission calls)
- [ ] Migrate lead-list.tsx (1 hasPermission call)
- [ ] Add recording.delete button + API wrapper
- [ ] tsc compile check
- [ ] Visual smoke test /permissions page

## Success criteria

- `grep -r "view_reports\|manage_users\|manage_permissions\|view_recordings\|import_leads" packages/frontend/src/` → zero hits
- Permission matrix UI renders exactly 7 grouped accordions, no duplicates
- Recording row with `recording.delete` shows delete button for super_admin/admin; hidden for others

## Risks

- If backend migration lags, users with only legacy keys in their `user.permissions[]` may temporarily lose access → backend must run migration BEFORE frontend deploy (or grant both during transition window).

## Dependencies

- Depends on: none (can run parallel with Phase 01)
- Unblocks: Phase 03 (tests)
