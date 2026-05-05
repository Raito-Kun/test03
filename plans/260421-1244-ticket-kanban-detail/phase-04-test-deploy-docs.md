# Phase 04 — Tests + Docs + Rules + Skills

## Owner
Worker 4 (docs-manager, with tester subagent spawn)

## Files (exclusive)
- `docs/project-changelog.md` (EDIT — add 2 entries: SIP presence cross-tenant fix + ticket kanban feature)
- `docs/development-roadmap.md` (EDIT — mark ticket management milestone progress)
- `docs/codebase-summary.md` (EDIT — add ticket kanban flow summary)
- `docs/system-architecture.md` (EDIT — update ticket entity description if changed)
- `.claude/rules/pbx-incident-patterns.md` (EDIT — add cross-tenant presence leak incident entry)
- `.claude/skills/crm-permission/SKILL.md` (EDIT — document delete ticket permission check)
- `e2e/ticket-kanban.spec.ts` (NEW — happy-path + RBAC test)

## Do NOT touch
Any code files under `packages/`. Workers 1-3 own those. Read-only for understanding.

## Task 1 — `project-changelog.md`
Prepend two entries under today's date (2026-04-21):

Entry A — SIP presence cross-tenant fix:
```
### 2026-04-21 — fix(sip-presence): cross-tenant presence leak
- Root cause: sofia_reg_*.db shared across domains on one PBX; query did not filter by `sip_realm`.
- Symptom: ext 105 on domain A showed online in domain B's dashboard.
- Fix: `sip-presence-service.ts` now requires `sipDomain` param, filters both PG and SQLite paths by `sip_realm`. `sip-presence-job.ts` loops per cluster and scopes updates to `cluster_id`.
- Files: packages/backend/src/services/sip-presence-service.ts, packages/backend/src/jobs/sip-presence-job.ts.
```

Entry B — Ticket Kanban feature (summarize Phase 1-3 after they complete).

## Task 2 — `pbx-incident-patterns.md`
Prepend to "Known incident log" section:
```
- **2026-04-21** — SIP presence poll (`sip-presence-service.ts`) did not filter by `sip_realm` → extensions with same number on different domains (e.g. ext 105 on `hoangthienfinance.vn` + `blueva`) all marked online in every tenant's dashboard. Fix: add `sip_realm` filter in PG query and SQLite query; rewrite job to iterate per-cluster with domain-scoped fetch.
```
Also update Symptom→Skill map: add row
```
| Tenant A sees tenant B's ext as online | sofia_reg query missing `sip_realm` filter | `crm-pbx-cluster` → "SIP presence multi-tenant" |
```

## Task 3 — `crm-permission` skill
Add a note under the skill body listing ticket permissions:
```
## Ticket RBAC (2026-04-21)
- Create: any authenticated user (agent+)
- List/Get: admin sees all in cluster; agent sees own tickets only
- Update: same as Get + agent can update own
- Delete: **admin / super_admin only** — enforced in `ticket-service.ts deleteTicket`
```

## Task 4 — e2e `ticket-kanban.spec.ts`
Three scenarios (use `@playwright/test`):
1. **Happy-path kanban:** login as admin → visit `/tickets` → assert 4 columns present → drag a test ticket from "open" to "in_progress" → verify status persisted via `GET /api/v1/tickets/:id`
2. **Resolution required:** drag ticket to "resolved" column → resolution dialog appears → submit without resultCode → error shown → submit with resultCode + note → success
3. **Delete RBAC:** login as agent → navigate to ticket → assert no Delete button; login as admin → Delete button visible → click + confirm → ticket disappears from kanban

Test data: create ticket via API in `test.beforeEach` with known `callLogId` (reuse existing seed or a dedicated fixture).

## Task 5 — `codebase-summary.md` + `system-architecture.md`
Brief update: ticket entity now has `clusterId`, detail response includes `callLog` + `auditLog`; delete requires admin+.

## Task 6 — `development-roadmap.md`
Mark "Ticket Management" row progress (if exists); otherwise append MVP-complete entry.

## Done criteria
- All 7 files saved
- e2e spec file syntactically valid (`npx playwright test --list`)
- No code files touched
- Report to `plans/260421-1244-ticket-kanban-detail/reports/worker-4-docs-done.md`
