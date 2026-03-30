# CRM Omnichannel — Development Roadmap

## Project Overview

CRM Omnichannel platform with VoIP integration for sales, collections, and support teams.

**Version**: 1.1.1 | **Start**: 2026-01-15 | **Status**: Phases 1-11 Complete, Phase 14 Testing In Progress

## Phase Summary

| Phase | Name | Status | Endpoints | Duration |
|-------|------|--------|-----------|----------|
| 01 | Project Setup & Infrastructure | ✓ Complete | — | 2 weeks |
| 02 | Core Data Models & CRUD | ✓ Complete | 19 | 3 weeks |
| 03 | CRM Features & Relationships | ✓ Complete | 9 | 2 weeks |
| 04 | VoIP Integration & Call Mgmt | ✓ Complete | 8 | 3 weeks |
| 05 | Call History & QA Features | ✓ Complete | 8 | 2 weeks |
| 06 | Support Ticketing System | ✓ Complete | 10 | 2 weeks |
| 07 | Dashboard & Analytics | ✓ Complete | 5 | 2 weeks |
| 08 | Frontend UI (14 pages) | ✓ Complete | N/A | 3 weeks |
| 09 | Testing & Production Hardening | ✓ Complete | — | 3 weeks |
| 10 | Super Admin + Permission Manager | ✓ Complete | 3 | 1 day |
| 11 | Extension Mapping Config | ✓ Complete | 2 | 1 day |
| — | CDR Dedup + SIP + i18n (v1.1.1) | ✓ Complete | — | 1 day |

**Total**: 57+ API endpoints, 17 DB tables, 14 frontend pages, 49+ tests

## Phase Details

### Phase 01: Project Setup & Infrastructure
- Monorepo: `packages/backend`, `packages/frontend`, `packages/shared`
- TypeScript, ESLint, Prettier
- PostgreSQL + Prisma ORM, Redis caching
- Express.js with middleware chain

### Phase 02: Core Data Models & CRUD
- Models: User, Team, Contact, Lead, DebtCase, Campaign
- JWT auth with refresh token rotation
- RBAC middleware + data scope middleware
- Audit logging, Zod validation, pagination

### Phase 03: CRM Features & Relationships
- Contact↔Lead↔DebtCase relationships
- Activity timeline, macro/template system
- Notification foundation

### Phase 04: VoIP Integration & Call Management
- ESL daemon → FreeSWITCH connection
- Click-to-Call (C2C) via loopback bridge
- CDR webhook receiver (`POST /webhooks/cdr`)
- Real-time Socket.IO events
- Agent status management

### Phase 05: Call History & QA
- Call log analytics with filtering/sorting
- Disposition code taxonomy
- QA annotation scoring (1-10)
- Recording tracking and proxy playback

### Phase 06: Support Ticketing
- Ticket lifecycle: open → in_progress → resolved → closed
- Priority levels, categories, auto-routing
- SLA tracking, comments, notifications

### Phase 07: Dashboard & Analytics
- Executive KPI dashboard
- Agent performance, campaign ROI, contact funnel
- Daily call volume analytics

### Phase 08: Frontend UI
- React 19 + Vite 6 + TypeScript 5
- Tailwind CSS 4 + shadcn/ui (Base UI)
- TanStack Query 5, Zustand 5, React Router 7
- Socket.IO client, Zod validation
- 14 feature pages, 20+ reusable components

### Phase 09: Testing & Production
- Vitest: 49 unit + integration tests
- Docker: backend + frontend + postgres + redis
- Nginx reverse proxy with SSL
- Security: OWASP compliance, input validation

### Phase 10: Super Admin + Permissions
- `super_admin` role with full access
- Dynamic RBAC: 13 permission keys, Redis-cached
- Permission Manager UI (role × permission matrix)

### Phase 11: Extension Mapping
- SIP extension management page
- Real-time registration status from FreeSWITCH
- Extension reassignment

### v1.1.1: CDR Dedup + SIP Mapping + i18n
- CDR deduplication: 1 call = 1 row (v8 algorithm)
- SIP Code/Reason mapping per RFC 3261
- Vietnamese localization for all dropdown filters
- Call source tagging (C2C, Auto Call, etc.)
- Recording sync fix (rsync)
- Nginx no-cache for index.html

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 18 + Express + TypeScript |
| Frontend | React 19 + Vite 6 + TypeScript 5 |
| Database | PostgreSQL 15 + Prisma ORM |
| Cache | Redis 7 |
| VoIP | FreeSWITCH + ESL + mod_xml_cdr |
| UI | Tailwind CSS 4 + shadcn/ui (Base UI) |
| State | Zustand 5 + TanStack Query 5 |
| Testing | Vitest + Playwright |
| Deploy | Docker Compose + Nginx + SSL |

## Infrastructure

```
[Browser] ←HTTPS→ [Nginx:443] ←→ [Frontend SPA]
                        ↓
                  [Backend:4000] ←ESL→ [FreeSWITCH:8021]
                        ↓                    ↓
                  [PostgreSQL:5432]    [CDR Webhook]
                  [Redis:6379]        [Recording rsync]
```

## Key Milestones

- 2026-02-01: Infrastructure complete
- 2026-02-22: Auth + CRUD complete
- 2026-03-22: VoIP integration complete
- 2026-03-25: Frontend + Testing complete (MVP)
- 2026-03-26: Permissions + Extensions complete
- 2026-03-27: CDR dedup + SIP mapping + i18n fixes (v1.1.1)
