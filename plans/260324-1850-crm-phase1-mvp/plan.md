---
title: "CRM Omnichannel Phase 1 MVP + v1.2.0 Gap Closure"
description: "Full-stack CRM for Telesale & Collection with FusionPBX/FreeSWITCH integration — Softphone mode, 17 DB tables, 70+ API endpoints, 20 advanced features"
status: completed
priority: P1
effort: 10w
branch: main
tags: [crm, voip, telesale, collection, fusionpbx, mvp, complete]
created: 2026-03-24
completed: 2026-03-28
---

# CRM Omnichannel — Phase 1 MVP

## Goal
Working CRM where agents can: login, manage contacts/leads/debt, click-to-call via softphone, receive CDR automatically, listen to recordings, create tickets, view basic dashboard.

## Tech Stack
React (Vite) + TypeScript + Tailwind + shadcn/ui | Express.js + TypeScript | PostgreSQL 15+ + Prisma | JWT auth | Socket.IO | modesl (ESL) | Redis | Docker Compose

## Architecture
Monorepo: `packages/frontend`, `packages/backend`, `packages/shared`
Backend: Express + Prisma + ESL daemon + Socket.IO on **single Node process** (NO PM2 cluster — ESL/Socket.IO require singleton)
Frontend: SPA with sidebar layout, call bar, real-time updates via Socket.IO

## Phases

| # | Phase | Effort | Status |
|---|-------|--------|--------|
| 01 | [Project Setup & Infrastructure](./phase-01-project-setup.md) | 3d | completed |
| 02 | [Auth & User Management](./phase-02-auth-user-management.md) | 4d | completed |
| 03 | [Core CRM Data](./phase-03-core-crm-data.md) | 4d | completed |
| 04 | [VoIP Integration](./phase-04-voip-integration.md) | 7d | completed |
| 05 | [Call Management](./phase-05-call-management.md) | 4d | completed |
| 06 | [Tickets & Workflow](./phase-06-tickets-workflow.md) | 3d | completed |
| 07 | [Dashboard & Reports](./phase-07-dashboard-reports.md) | 3d | completed |
| 08 | [Frontend UI](./phase-08-frontend-ui.md) | 7d | completed |
| 09 | [Integration Testing & Security](./phase-09-testing-security.md) | 3d | completed |
| 10 | [Super Admin + Permissions](./phase-10-ai-ux-redesign.md) | 1d | completed |
| 11 | [Extension Mapping Config](./phase-11-extension-mapping.md) | 1d | completed |
| 12 | [Lead Scoring + Auto-Assign](./phase-12-lead-scoring.md) | 1d | completed |
| 13 | [Contact Merge + Export UI](./phase-13-contact-merge.md) | 1d | completed |
| 14 | [Call Script Management](./phase-14-call-scripts.md) | 1d | completed |
| 15 | [Monitoring + QA Timestamps](./phase-15-monitoring.md) | 1d | completed |

**Total: 44 working days (8.8 weeks) — Phase 1 MVP + 20 Advanced Features + v1.1.1 fixes + v1.2.0 Gap Closure DELIVERED**

## Key Dependencies
- FusionPBX 5.5.7 / FreeSWITCH 1.10.x running with ESL port 8021 accessible
- Nginx on FusionPBX serving recordings on :8088 (internal only)
- xml_cdr configured to POST to CRM webhook
- PostgreSQL 15+ available
- Redis available

## Research Reports
- [PRD Review](../reports/brainstorm-260324-1622-prd-review.md) — 12 issues found & fixed
- [ESL/WebRTC Stack](../reports/researcher-260324-1736-freeswitch-esl-webrtc-stack.md) — modesl recommended
- [FusionPBX Assessment](../reports/researcher-260324-1748-fusionpbx-crm-integration-assessment.md) — all 10 capabilities supported

## Definition of Done (Phase 1 + v1.2.0)

### Core MVP (Phases 1-11)
- ✅ Agent click-to-call (softphone) works end-to-end
- ✅ CDR auto-received via webhook, parsed, stored
- ✅ Recording playback with RBAC
- ✅ Tickets (Phieu ghi) CRUD operational
- ✅ Basic dashboard shows call stats + agent statuses
- ✅ 6-role RBAC enforced on all endpoints (list AND single-resource)

### Gap Closure (v1.2.0, Phases 12-15)
- ✅ Lead scoring with rule-based algorithm
- ✅ Auto-assign leads/campaigns (round-robin)
- ✅ Auto-escalation debt tier (daily cron)
- ✅ Follow-up reminders (cron + API)
- ✅ Call script management & display during call
- ✅ Contact merge (duplicate dedup)
- ✅ Export Excel UI (all list pages)
- ✅ Live monitoring dashboard (real-time agent grid)
- ✅ QA annotation at timestamp (markers in player)
- ✅ Bulk recording download (ZIP archive)
- ✅ Attended transfer (warm transfer)
- ✅ SLA reporting (response + resolution time)
- ✅ Wrap-up auto-timer (30s countdown)
- ✅ Dashboard KPIs (contact/close/PTP/recovery rates)
- ✅ Tags/segments UI
- ✅ Macro templates in ticket UI
- ✅ Inbound call popup enhancements
- ✅ Campaign progress bar (real-time %)
- ✅ Lead source tracking UI
- ✅ Agent status auto-detection (ESL events)

## Deferral List (Phase 2+)
- Waveform audio player (use HTML5 `<audio>` with speed dropdown instead) — Phase 2
- Hierarchical ticket categories (use flat list with parent_id for future) — Phase 2
- Macro keyboard shortcuts (basic macro selection only) — Phase 2
- Dark/light theme toggle (ship light theme only) — Phase 2
- Per-campaign disposition codes (global only in Phase 1) — Phase 2
- Scheduled reports / email reports — Phase 2
- Embedded WebRTC softphone (SIP.js) — use external FusionPBX softphone or SIP client for MVP — Phase 2
- Listen/Whisper/Barge (call supervision) — Phase 2
- AI transcription & call summary — Phase 2
- Zalo OA / SMS integration — Phase 2

## MVP-Minus Cut Line (if timeline slips)
If Phase 04 VoIP takes >7d, defer these to Phase 2:
1. Recording proxy + playback (agents use FusionPBX directly)
2. Agent status auto-transitions (manual status only)
3. Dashboard reports (keep overview only, drop 3 report types)
4. QA annotations
5. Macros

## Red Team Review

### Session — 2026-03-24
**Findings:** 15 accepted, 4 rejected
**Severity breakdown:** 6 Critical, 7 High, 2 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | PM2 cluster breaks ESL singleton + cron | Critical | Accept | Phase 09 |
| 2 | ESL command injection via phone numbers | Critical | Accept | Phase 04 |
| 3 | No deferral list or cut line | Critical | Accept | plan.md |
| 4 | Zero buffer on 33-day greenfield | Critical | Accept | plan.md |
| 5 | VoIP phase too dense (6 subsystems, 5d) | Critical | Accept | Phase 04 |
| 6 | CDR webhook IP whitelist bypass | Critical | Accept | Phase 04 |
| 7 | No token bootstrap on page refresh | High | Accept | Phase 02, 08 |
| 8 | IDOR: data scope only on list endpoints | High | Accept | Phase 02, 03 |
| 9 | Recording proxy SSRF/path traversal | High | Accept | Phase 04 |
| 10 | XXE injection in CDR XML parsing | High | Accept | Phase 04 |
| 11 | Refresh token race — no atomic design | High | Accept | Phase 02 |
| 12 | CSRF on cookie-based refresh endpoint | High | Accept | Phase 02 |
| 13 | Seed credentials no production guard | High | Accept | Phase 02 |
| 14 | Dashboard cache ignores RBAC scope | Medium | Accept | Phase 07 |
| 15 | Waveform audio player is gold plating | Medium | Accept | Phase 08 |

## Validation Log

### Session 1 — 2026-03-24
**Trigger:** Post red-team validation before implementation
**Questions asked:** 8

#### Questions & Answers

1. **[Architecture]** Monorepo strategy for Windows 11?
   - Options: npm workspaces | Turborepo | Separate repos
   - **Answer:** npm workspaces
   - **Rationale:** Simple, native, good enough for 3 packages

2. **[Dependency]** FusionPBX/FreeSWITCH availability for development?
   - Options: Already running | Need setup | Mock first
   - **Answer:** Already running and accessible
   - **Rationale:** No blocker for Phase 04. ESL :8021, recordings :8088, xml_cdr POST all available.

3. **[Auth Strategy]** Access token storage approach?
   - Options: In-memory + cookie refresh | localStorage | Session-based
   - **Answer:** In-memory + cookie refresh
   - **Rationale:** Most secure. Silent refresh on F5 adds ~100ms but prevents XSS theft.

4. **[Frontend]** State management libraries?
   - Options: Zustand + React Query | Redux + RTK Query | Zustand only
   - **Answer:** Zustand + React Query
   - **Rationale:** Lightweight, minimal boilerplate. Zustand for call/auth state, RQ for server data.

5. **[Seed Data]** Number of seeded user accounts?
   - Options: 1 per role (6) | Minimal (2) | Full team (10+)
   - **Answer:** 1 per role (6 users)
   - **Rationale:** Covers all RBAC paths during testing.

6. **[VoIP Config]** FusionPBX domain + gateway knowledge?
   - Options: Yes, known | Know IP only | Need guidance
   - **Answer:** Yes, I know the domain + gateway
   - **Rationale:** Can provide FusionPBX domain, SIP gateway, ESL password for .env.

7. **[Dev Infra]** PostgreSQL + Redis hosting for development?
   - Options: Docker Compose | Local | Hybrid
   - **Answer:** Docker Compose
   - **Rationale:** Consistent environment, easy cleanup.

8. **[Business]** Excel import file format?
   - Options: Vietnamese headers | English headers | Both | Template-based
   - **Answer:** .xlsx with Vietnamese headers
   - **Rationale:** Business team uses Vietnamese column names. Need header mapping layer.

#### Confirmed Decisions
- npm workspaces monorepo — simple, Windows-compatible with forward slashes
- In-memory JWT + httpOnly cookie refresh — most secure, bootstrap on F5
- Zustand + React Query — lightweight client + server state
- Docker Compose for dev infra — consistent environment
- FusionPBX already available — no setup delay
- 6 seed users (1 per role) — full RBAC testing
- Vietnamese Excel headers — add header mapping in import service

#### Action Items
- [x] Add Vietnamese header mapping to Phase 03 import service
- [x] Add FusionPBX config vars to .env.example in Phase 01
- [x] Seed 6 users (1 per role) with sample team in Phase 02

#### Impact on Phases
- Phase 01: Add FusionPBX env vars (ESL_HOST, ESL_PORT, ESL_PASSWORD, FUSIONPBX_DOMAIN, SIP_GATEWAY, FUSIONPBX_RECORDING_URL)
- Phase 02: Seed 6 users across 2 teams (telesale + collection)
- Phase 03: Import service needs Vietnamese→English header mapping dict

### Session 2 — 2026-03-24
**Trigger:** Pre-implementation validation — build order, team, deployment, i18n
**Questions asked:** 8

#### Questions & Answers

1. **[Scope]** Phase 08 (Frontend) depends on ALL phases 02-07. Should frontend be built incrementally alongside backend phases?
   - Options: Incremental | Backend-first, then UI | Parallel with stubs
   - **Answer:** Incremental
   - **Rationale:** Build frontend pages as each backend phase completes. Catches integration issues early, faster feedback loop.

2. **[Scope]** UI language — Vietnamese or English for labels, menus, messages?
   - Options: Vietnamese | English | i18n from start
   - **Answer:** Vietnamese
   - **Rationale:** End-users are Vietnamese-speaking telesale/collection agents. No i18n overhead for MVP.

3. **[Architecture]** Production deployment target?
   - Options: Single VPS | Separate servers | Cloud managed
   - **Answer:** Separate servers
   - **Rationale:** CRM on one server, FusionPBX on another. Network connectivity via internal/private network.

4. **[Scope]** Team size?
   - Options: Solo | 2 developers | 3+ developers
   - **Answer:** 3+ developers
   - **Rationale:** Full team enables heavy parallelism. Needs strict task ownership.

5. **[Architecture]** Work split strategy for 3+ devs?
   - Options: By layer | By feature domain | Backend then swarm
   - **Answer:** By layer
   - **Rationale:** Dev A: backend (Phases 01-07). Dev B: frontend (UI as APIs ready). Dev C: VoIP/infra (Phase 04 + 09). Clean ownership boundaries.

6. **[Architecture]** API error messages — Vietnamese or English?
   - Options: API English + FE translates | API Vietnamese | Both (code + message)
   - **Answer:** API in English, FE translates
   - **Rationale:** Cleaner separation. API returns error codes/English. Frontend maps to Vietnamese display text. Easier debugging.

7. **[Dependency]** Network between CRM server and FusionPBX?
   - Options: Internal/private network | Public IP + firewall | VPN tunnel
   - **Answer:** Internal/private network
   - **Rationale:** Both servers on same private network. ESL port 8021 accessible internally. Most secure.

8. **[Scope]** Task tracking tool for 3+ dev team?
   - Options: GitHub Issues + PRs | External tool | Claude Code tasks only
   - **Answer:** GitHub Issues + PRs
   - **Rationale:** Lightweight, already integrated with code. PRs for code review.

#### Confirmed Decisions
- Incremental frontend build — UI pages built as each backend phase completes
- Vietnamese UI — all labels, menus, messages in Vietnamese. No i18n framework needed.
- API errors in English — frontend maps error codes to Vietnamese display text
- Separate servers — CRM server + FusionPBX on different machines, connected via private network
- 3+ devs split by layer — backend dev, frontend dev, VoIP/infra dev
- GitHub Issues + PRs — primary task tracking and code review tool

#### Action Items
- [x] Restructure Phase 08 into sub-phases aligned with backend phases
- [x] Add Vietnamese UI text constants/translation file to Phase 08 frontend setup
- [x] Add error code → Vietnamese message mapping utility to frontend
- [x] Update Docker/deployment config in Phase 09 for separate-server architecture (CRM ↔ FusionPBX via private IP)
- [ ] Create GitHub Issues for each phase with assignee labels (backend/frontend/infra)
- [x] Document API error code contract in shared package for FE/BE alignment

#### Impact on Phases
- Phase 01: Add git repo + GitHub Issues setup. Define API error response format in shared package.
- Phase 08: Restructure — split into incremental sub-phases (08a: auth+layout, 08b: contacts/leads, 08c: calls/VoIP, 08d: tickets/dashboard). All UI text in Vietnamese.
- Phase 09: Update docker-compose.prod.yml for separate-server deployment. Add Nginx config for CRM→FusionPBX private network routing.
- All phases: Add error code constants to shared package. Backend returns English codes, frontend maps to Vietnamese.

### Session 3 — 2026-03-24
**Trigger:** Final pre-implementation validation — softphone, security, phone format, shared pkg, action items
**Questions asked:** 6

#### Questions & Answers

1. **[Architecture]** Softphone location — where do agents make/receive calls?
   - Options: External SIP client | Embedded WebRTC (SIP.js) | Embedded later, external for MVP
   - **Answer:** Embedded later, external for MVP
   - **Rationale:** Ship MVP with agents using FusionPBX's built-in web softphone or desktop SIP app. CRM triggers calls via ESL originate. Plan WebRTC embedding as Phase 2 feature — validates core CRM flows first without WebRTC complexity.

2. **[Security]** Refresh token cookie `secure` flag in dev (localhost has no HTTPS)?
   - Options: Conditional on NODE_ENV | HTTPS everywhere (mkcert)
   - **Answer:** Conditional on NODE_ENV
   - **Rationale:** `secure: NODE_ENV === 'production'`, `sameSite: 'lax'` in dev, `'strict'` in prod. Standard practice.

3. **[Architecture]** Vietnamese phone number storage and CDR matching format?
   - Options: Normalize to +84 on input | Store original + normalized column | Store as-entered, normalize on match
   - **Answer:** Store as-entered, normalize on match
   - **Rationale:** No normalization on storage. Normalize at query time when matching CDR numbers. Simpler writes. Build phone normalization utility for query-time matching.

4. **[Architecture]** Shared package (packages/shared) consumption method?
   - Options: Direct TS imports | TypeScript project references
   - **Answer:** Direct TS imports
   - **Rationale:** Workspace symlink + TypeScript path aliases. FE/BE import .ts files directly. No build step. Simplest for MVP monorepo.

5. **[Scope]** Apply Session 2 action items to plan files before implementation?
   - Options: Apply now before implementation | Handle during implementation
   - **Answer:** Apply now before implementation
   - **Rationale:** Clean plan = fewer surprises. Update phase files with all pending action items.

6. **[Architecture]** React routing library?
   - Options: react-router-dom v6 | TanStack Router
   - **Answer:** react-router-dom v6
   - **Rationale:** Mature, widely adopted, team likely has experience. Plan already specifies this.

#### Confirmed Decisions
- External softphone for MVP — agents use FusionPBX web softphone or SIP client. CRM uses ESL originate only. WebRTC embedding deferred to Phase 2.
- Cookie security conditional on NODE_ENV — `secure: false` + `sameSite: 'lax'` in dev, `secure: true` + `sameSite: 'strict'` in prod.
- Phone stored as-entered — normalize at query time for CDR matching. Build `normalizePhone()` utility.
- Shared package via direct TS imports — no build step, workspace symlinks + path aliases.
- Apply all pending action items to plan files now — clean plan before implementation.
- react-router-dom v6 — confirmed, no change needed.

#### Action Items
- [ ] Add phone normalization utility to Phase 03 (for CDR matching in Phase 04)
- [x] Update Phase 02 cookie config: conditional `secure`/`sameSite` based on NODE_ENV
- [x] Add "WebRTC softphone" — implemented with SIP.js in Phase 10
- [x] Apply all Session 2 action items to phase files

#### Impact on Phases
- Phase 02: Cookie config — `secure: NODE_ENV === 'production'`, `sameSite` conditional
- Phase 03: Add `normalizePhone(phone: string): string` utility for query-time matching
- Phase 04: Clarify ESL originate rings agent's external softphone (FusionPBX/SIP client), not embedded WebRTC
- Phase 08: Confirm react-router-dom v6. Apply Session 2 restructuring into sub-phases.
