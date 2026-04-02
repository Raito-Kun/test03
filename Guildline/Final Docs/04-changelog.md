# CRM Omnichannel — Changelog

## Version 1.2.0 (2026-03-28)

### Feature: Lead Scoring & Automation
- **Lead Scoring**: Rule-based algorithm in `lead-scoring-service.ts`
  - Score calculation based on: qualification status, engagement history, conversion likelihood
  - Auto-updated on lead status transitions
- **Auto-Assign Leads**: Round-robin assignment endpoint `POST /leads/assign`
  - Distributes leads evenly among available agents
  - UI dialog for bulk assign to users/team
- **Auto-Escalation Debt Tier**: Daily cron + manual endpoint
  - Auto-escalate tier based on days overdue
  - `POST /debt-cases/escalate` for manual escalation
  - Promise-to-Pay auto-reminder cron job
- **Follow-Up Reminders**: Enhanced cron job + API
  - `GET /leads/follow-ups` to fetch due follow-ups
  - Automated notification trigger on schedule

### Feature: Call Script Management
- **Script Service**: Full CRUD in `call-script-service.ts`
  - Script templates per campaign
  - Variable substitution ({{contact.name}}, {{lead.status}}, etc.)
- **Script Display During Call**: Call script panel + auto-popup
  - `call-script-panel.tsx` component
  - Auto-display when call connected
  - Quick-reference during customer interaction

### Feature: Contact Management Enhancement
- **Contact Merge**: Deduplication dialog
  - `contact-merge-dialog.tsx` + service
  - Merge by phone number, consolidate history
  - Merges related leads, debt cases, tickets
- **Contact Custom Fields**: UI extended
  - Tags/segments support in UI
  - Custom field editor in contact detail

### Feature: Export & Reporting
- **Export Excel UI**: Button on all 6 list pages
  - `export-button.tsx` component
  - Contacts, Leads, Debt Cases, Call Logs, Campaigns, Tickets
  - Direct download with filters applied
- **SLA Reporting**: First response + resolution time
  - `first_response_at`, `resolved_at` tracking on tickets
  - `GET /reports/sla` endpoint with agent/team breakdown
  - SLA metrics in dashboard

### Feature: Call Operations
- **Attended Transfer**: ESL att_xfer support
  - `POST /calls/attended-transfer` endpoint
  - Agent consults before transferring (warm transfer)
- **Bulk Recording Download**: ZIP archive
  - `POST /call-logs/bulk-download` with filter params
  - Checkbox UI to select recordings
  - ZIP returned with metadata CSV

### Feature: Monitoring & Supervision
- **Live Monitoring Dashboard**: Real-time agent grid
  - `live-dashboard.tsx` new page
  - Agent status, current calls, call duration
  - Real-time updates via Socket.IO
  - `GET /monitoring/live` endpoint
- **QA Annotation at Timestamp**: Markers in recording
  - `qa-timestamp-annotations.tsx` component
  - `POST /qa-timestamps`, `GET /qa-timestamps/:callLogId`
  - Mark specific moments for QA review
  - UI timestamp markers in player

### Feature: Agent Status & UX
- **Agent Status Auto-Detection**: From ESL events
  - Auto-transition: ringing → on_call → wrap-up → ready
  - ESL event listener in `esl-service.ts`
  - Real-time status grid updates
- **Wrap-up Auto-Timer**: 30s countdown
  - Auto-triggered after hangup
  - Countdown UI in call bar
  - Auto-transition to ready after timeout
- **Inbound Call Popup Improvements**:
  - Show recent call history with customer
  - Ticket count display
  - Quick-access to contact detail

### Feature: Campaign & Lead Management
- **Campaign Progress Bar**: Real-time % completion
  - Progress tracking on campaign list
  - Completion % = (assigned + contacted + won) / total leads
  - Real-time update on lead status change
- **Lead Source Tracking UI**: Enforced source field
  - Source dropdown on lead form (web, phone, referral, etc.)
  - Filter by source in lead list
  - Report by source in analytics

### Feature: Ticket & Macro
- **Macro Templates in Ticket UI**:
  - Apply macros when creating/updating ticket
  - `POST /macros/apply` endpoint
  - Variable substitution in templates
  - Quick-reply preset messages

### Database Changes
- New migrations: contact_extended_fields, expand_lead_fields, expand_debt_fields
- New tables: script, script_template, qa_timestamp
- Enhanced fields: lead (source enforced), contact (tags, custom_fields), debt_case (tier_escalation_date)

### API Endpoints Added (20 new)
- `POST /leads/assign` — Auto-assign leads
- `POST /leads/score` — Recalculate lead score
- `GET /leads/follow-ups` — Fetch due follow-ups
- `POST /debt-cases/escalate` — Manual tier escalation
- `POST /contacts/merge` — Merge duplicate contacts
- `GET /export/:entity` — Export to Excel
- `POST /call-logs/bulk-download` — ZIP archive download
- `POST /calls/attended-transfer` — Warm transfer
- `GET /monitoring/live` — Live dashboard data
- `POST /qa-timestamps` — Create annotation
- `GET /qa-timestamps/:callLogId` — List annotations
- `POST /scripts` — Create script
- `PATCH /scripts/:id` — Update script
- `DELETE /scripts/:id` — Delete script
- `GET /scripts/active` — Scripts for active campaign
- `GET /scripts/default` — Default script templates
- `GET /scripts/active-call` — Script for current call
- `POST /macros/apply` — Apply macro template
- `GET /reports/sla` — SLA metrics report
- `PUT /agent-status/wrap-up-timer` — Update wrap-up status

### Files Changed
- Backend: 20+ files (services, routes, controllers, migrations)
- Frontend: 15+ files (new pages, components, dialogs)
- Shared: 5+ files (enums, types updates)

---

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
