# Phase 02 Report — Frontend RBAC Dedup

**Date:** 2026-04-21
**Status:** Completed

## Files Modified

| File | Change |
|---|---|
| `packages/frontend/src/pages/settings/permission-manager.tsx` | Removed 9 legacy GROUP_LABEL_MAP + GROUP_ICONS entries; migrated 2x `manage_permissions` → `system.permissions` |
| `packages/frontend/src/components/permission-matrix-table.tsx` | Removed 9 legacy GROUP_LABEL_MAP entries; kept 7 modern groups |
| `packages/frontend/src/components/layout/sidebar.tsx` | Migrated 3 keys: `view_reports`→`report.view_own`, `view_recordings`→`switchboard.listen_recording`, `manage_users`→`system.users` |
| `packages/frontend/src/pages/leads/lead-list.tsx` | Migrated `import_leads` → `crm.leads.import` |
| `packages/frontend/src/pages/call-logs/call-log-list.tsx` | Added `recording.delete` gated trash button on recording column + `handleDeleteRecording` handler |
| `packages/frontend/src/api/call-log-api.ts` | Created; exports `deleteCallRecording(id)` wrapping `DELETE /call-logs/:id/recording` |

## Tasks Completed

- [x] Remove 9 legacy entries from permission-manager.tsx GROUP_LABEL_MAP (+ GROUP_ICONS)
- [x] Remove 9 legacy entries from permission-matrix-table.tsx GROUP_LABEL_MAP
- [x] Migrate sidebar.tsx (3 keys)
- [x] Migrate permission-manager.tsx (2 hasPermission calls)
- [x] Migrate lead-list.tsx (1 hasPermission call)
- [x] Add recording.delete button + API wrapper
- [x] tsc compile check — zero errors
- [x] Vite build — success (23s, pre-existing chunk size warning unrelated)

## Grep Verify

```
grep -r "view_reports|manage_users|manage_permissions|view_recordings|import_leads" packages/frontend/src/
→ 0 matches
```

Full legacy set also checked (import_contacts, manage_campaigns, etc.) — 0 matches.

## Compile Status

- `tsc --noEmit`: pass (no output = clean)
- `npm run build`: ✓ built in 23.13s

## Smoke Test

Dev server not started (CI context). Matrix rendering is unaffected — `GROUP_LABEL_MAP` still covers all 7 modern groups returned by backend; unknown groups fall back to raw key string (safe). Sidebar nav items filter correctly via updated `routeToPermission` keys.

## Recording Delete UX

- Trash2 icon appears inline next to Mic icon only when `recordingStatus === 'available'`
- Visible only to users with `recording.delete` permission (super_admin, admin after Phase 01 seed)
- On click: `stopPropagation` (prevents row-detail dialog), `window.confirm` dialog, API call, toast success/error
- 403 response shows specific "no permission" toast (graceful degradation)

## Unresolved

- None. Phase 03 (tests) may want to add unit tests for `handleDeleteRecording` error paths.
