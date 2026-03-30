# CRM Omnichannel — Changelog

## Version 1.1.1 (2026-03-27)

### CDR Deduplication Fix (Critical)
- **Problem**: FusionPBX sends 2-4 CDR legs per call with different UUIDs → duplicate rows, wrong duration/billsec
- **Solution (webhook-controller v8)**:
  - Legs with destination: merge via `other_loopback_leg_uuid`
  - Legs without destination: time-window search (60s) to merge into existing record
  - `sofia/internal/*` legs: skipped (inflated billsec includes routing time)
  - `sofia/external/*` legs: search by destination from channel_name for merging
  - Orphan legs & internal ext→ext: skipped
  - SIP fields written once per call (first leg wins, prevents cross-leg conflicts)
  - **Result**: 1 physical call = 1 row, billsec = actual talk time

### SIP Code/Reason Mapping
- SIP Code as source of truth for "Kết quả" and "SIP Reason" columns
- Backend derives missing sipCode from hangupCause (RFC 3261): ORIGINATOR_CANCEL→487, NO_ANSWER→480, USER_BUSY→486, CALL_REJECTED→403, UNALLOCATED_NUMBER→404, NORMAL_CLEARING+billsec>0→200
- Unmapped SIP reasons display as "SIP Error (raw_value)"

### Vietnamese Localization
- All dropdown filters show Vietnamese text (Base UI Select fix: replaced SelectValue with manual span rendering)
- Pages fixed: call logs, leads, tickets, campaigns, debt cases
- Removed duplicate "Kết quả" column, renamed disposition to "Phân loại"

### Call Source Tagging
- ESL originate sets `crm_call_source=c2c` (exported to all CDR legs)
- Webhook stores in `notes` field
- "Phân loại" column maps: c2c→C2C, autocall→Auto Call, manual→Thủ công, inbound→Gọi vào

### Recording Sync
- Changed cron from `scp -r` to `rsync -az` for reliable incremental sync
- Local file served first with range request support, fallback to upstream proxy

### Nginx
- Added `no-cache, no-store, must-revalidate` for `/index.html` to prevent stale JS caching after deploys

### Files Changed
- `packages/backend/src/controllers/webhook-controller.ts`
- `packages/backend/src/services/esl-service.ts`
- `packages/frontend/src/pages/call-logs/call-log-list.tsx`
- `packages/frontend/src/pages/leads/lead-list.tsx`
- `packages/frontend/src/pages/tickets/ticket-list.tsx`
- `packages/frontend/src/pages/campaigns/campaign-list.tsx`
- `packages/frontend/src/pages/debt-cases/debt-case-list.tsx`
- `packages/frontend/nginx.conf`
- Server crontab (rsync)

---

## Version 1.1.0-beta (2026-03-26)

### Phase 10: Super Admin + Permission Manager
- `super_admin` role with full system access
- Dynamic RBAC: 13 permission keys, RolePermission matrix, Redis cache (5min TTL)
- Permission Manager UI for toggling role permissions

### Phase 11: Extension Mapping Config
- Extension management page (Settings)
- Real-time SIP registration status from FreeSWITCH via ESL
- Extension reassignment by admin

### VoIP & C2C Fixes
- Outbound routing via loopback bridge through FusionPBX domain dialplan
- ESL ACL configuration, SIP URI handling, form-urlencoded CDR support
- Vietnamese call log UI, timezone handling, clear filters button

---

## Version 1.0.0-release (2026-03-25)

### Phase 09: Testing & Production Hardening
- 49 unit + integration tests (Vitest)
- Docker: backend + frontend + PostgreSQL + Redis (docker-compose.prod.yml)
- Nginx reverse proxy with SSL
- OWASP compliance, dependency audit, security hardening
- PM2 fork mode configuration

### Phase 08: Frontend UI (14 pages)
- React 19 + Vite 6 + TypeScript 5 + Tailwind CSS 4 + shadcn/ui
- TanStack Query 5, Zustand 5, React Router 7, Socket.IO
- Pages: login, dashboard, contacts, leads, debt cases, call logs, campaigns, tickets, reports, settings, permissions, extensions
- 20+ reusable components, 10+ custom hooks

---

## Version 1.0.0-alpha (2026-03-24)

### Phases 01-07: Core Platform
- **Phase 01**: Monorepo, TypeScript, PostgreSQL + Prisma, Redis, Express
- **Phase 02**: Auth (JWT), CRUD (19 endpoints), RBAC, data scoping, audit logging
- **Phase 03**: Contact-lead-debtcase relationships, timeline, macros, notifications
- **Phase 04**: ESL daemon, C2C originate, CDR webhook, Socket.IO events, agent status
- **Phase 05**: Call log analytics, disposition codes, QA scoring, recording tracking
- **Phase 06**: Ticket lifecycle, categories, auto-routing, SLA tracking
- **Phase 07**: KPI dashboard, agent performance, campaign ROI, contact funnel

---

## Metrics

| Metric | Value |
|--------|-------|
| API Endpoints | 57+ |
| Database Tables | 17 |
| Frontend Pages | 14 |
| Test Count | 49+ |
| Backend LoC | ~9,500 |
| Frontend LoC | ~7,000 |
