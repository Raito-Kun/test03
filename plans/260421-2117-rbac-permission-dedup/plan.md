# RBAC Permission Deduplication + Gap Fill

**Date:** 2026-04-21
**Branch:** `feat/ui-ops-console-redesign`
**Triggered by:** Phân quyền UI showing duplicate groups (Chiến dịch x2, Báo cáo x2, Tổng đài x2, Hệ thống x2, Phiếu ghi x2)

## Goals

1. **Dedup**: Collapse 16 legacy keys (plural form) into modern `resource.action` keys. Single row per Vietnamese label in matrix UI.
2. **Preserve grants**: Zero loss of existing role capabilities after migration.
3. **Fix enforcement gaps**:
   - `ticket.delete` — replace hardcoded `role !== 'admin'` check in service with middleware
   - `crm.contacts.delete` / bulk-delete — wire existing permission into controller
   - Add `recording.delete` (new) for admin to purge call recordings
4. **Parallel execution**: 4 streams to minimize wall time.

## Migration map (16 legacy → modern)

| Legacy | Modern | Backend refs | Frontend refs |
|---|---|---|---|
| `import_campaigns` | `campaign.import` | seed | — |
| `manage_campaigns` | `campaign.manage` | assignment-routes, script-routes | — |
| `view_reports` | `report.view_own` | seed | sidebar.tsx:23 |
| `export_excel` | `report.export` | export-routes, tests | — |
| `make_calls` | `switchboard.make_call` | seed | — |
| `view_recordings` | `switchboard.listen_recording` | monitoring-routes, qa-timestamp-routes | sidebar.tsx:24 |
| `view_dashboard` | `report.view_own` | monitoring-routes | — |
| `manage_users` | `system.users` | seed | sidebar.tsx:28 |
| `manage_permissions` | `system.permissions` | seed | permission-manager.tsx:109,144 |
| `manage_tickets` | `ticket.manage` | seed | — |
| `manage_contacts` | `crm.contacts.edit` | contact-merge-routes | — |
| `manage_leads` | `crm.leads.edit` | seed | — |
| `manage_debt_cases` | `crm.debt.edit` | seed | — |
| `import_leads` | `crm.leads.import` | seed | lead-list.tsx:249 |
| `import_contacts` | `crm.contacts.import` | seed | — |
| `manage_extensions` | `system.manage` | seed | — |

## New permissions

| Key | Label VN | Group | Default roles |
|---|---|---|---|
| `recording.delete` | Xoá ghi âm | switchboard | super_admin, admin |

## Phases (parallel)

| # | Phase | Stream | Owner | Status |
|---|---|---|---|---|
| 01 | Backend seed + migration + middleware | A | fullstack-developer | Complete |
| 02 | Frontend labels + guards | B | fullstack-developer | Complete |
| 03 | Tests + TC updates | C | tester | Complete |
| 04 | Docs + skill update | D | docs-manager | Complete |

Phase 01 & 02 parallel. Phase 03 depends on 01+02. Phase 04 can run parallel with 03.

## Key dependencies

- Prisma migration for permission key rename
- Redis cache bust after seed re-run
- Role grants preserved via SQL UPDATE (not DELETE+reinsert)

## Success criteria

- Matrix UI shows exactly 7 groups (no duplicates): Chiến dịch, CRM, Báo cáo, Tổng đài, Phiếu ghi, QA, Hệ thống
- All existing role permissions still functional (no user loses access)
- `ticket.delete`, `crm.contacts.delete`, `recording.delete` enforced via middleware
- `grep -r "manage_campaigns\|view_reports\|..." packages/` returns zero hits outside migration scripts
- Backend vitest + e2e playwright green

## Risks

- **Migration idempotence**: re-run must not drop grants. Use `UPDATE permissions SET key=... WHERE key=...` pattern.
- **Cache stale**: after deploy, must DEL `permissions:role:*` Redis keys.
- **Frontend/backend skew**: during rollout window, legacy keys temporarily granted to both — sunset after confirm.

## Next steps

- Run Phase 01+02 in parallel
- Tests (Phase 03) gate completion
- Docs (Phase 04) run in background
