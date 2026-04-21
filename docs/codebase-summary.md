# CRM VoIP Application - Codebase Summary

## Project Overview

CRM Omnichannel is a comprehensive customer relationship management platform with integrated VoIP capabilities, built as a monorepo using TypeScript, Node.js, React, PostgreSQL, and FreeSWITCH PBX integration.

**Project Status**: Advanced Features Complete (Phases 1-20 Done)
**Repository**: Monorepo structure with packages/backend, packages/frontend, packages/shared, packages/mcp-server
**Team**: Full-stack development team
**Start Date**: 2026-01-15
**Current Phase**: Phase 20 Complete (v1.3.5 deployed to 10.10.101.207)

## Monorepo Structure

```
packages/
├── backend/              # Express.js API server (100+ files)
│   ├── src/
│   │   ├── controllers/  # HTTP request handlers (22+ files)
│   │   ├── services/     # Business logic (30+ files)
│   │   ├── routes/       # Express route definitions (14+ files)
│   │   ├── middleware/   # Auth, RBAC, permissions, data scoping
│   │   ├── lib/          # Utilities: JWT, Prisma, Socket.IO, ESL, Logger
│   │   └── index.ts      # Express app setup
│   ├── prisma/
│   │   └── schema.prisma # PostgreSQL data models (17 tables)
│   └── tests/            # Vitest unit + integration tests
│
├── frontend/             # React + Vite UI application (81+ files)
│   ├── src/
│   │   ├── pages/        # Page-level components (14 pages)
│   │   ├── components/   # Reusable UI components (20+ files)
│   │   ├── hooks/        # Custom React hooks
│   │   ├── stores/       # Zustand global state
│   │   ├── services/     # API client, Socket.IO
│   │   ├── lib/          # Utilities, formatting, validation
│   │   ├── app.tsx       # Root with routing
│   │   └── main.tsx      # Entry point
│   └── vite.config.ts    # Vite build config
│
├── shared/               # Shared types and validation
│   ├── src/
│   │   ├── types/        # TypeScript interfaces
│   │   ├── validation/   # Zod schemas
│   │   └── constants/    # Shared constants
│
└── mcp-server/           # Claude MCP integration (3 files)
    ├── src/index.ts      # MCP server implementation
    └── tests/            # MCP server tests
```

## Backend Architecture

### Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Runtime | Node.js | 18+ |
| Language | TypeScript | ^5.7.0 |
| Framework | Express.js | ^4.21.0 |
| Database | PostgreSQL | Latest |
| ORM | Prisma | ^6.4.0 |
| Cache | Redis (ioredis) | ^5.4.0 |
| Auth | JWT (jsonwebtoken) | ^9.0.2 |
| Real-time | Socket.IO | ^4.8.0 |
| VoIP | modesl (ESL library) | ^1.1.2 |
| Validation | Zod | ^3.24.0 |
| Logging | Winston | ^3.17.0 |
| Security | Helmet, bcryptjs, rate-limit | Latest |

### Database Models (17+ Tables)

**Core Entities**:
- User (accounts with roles and team assignments)
- Team (organizational teams: sales, collections, support)
- Contact (customer/prospect information, + tags, socialProfiles)
- Lead (sales lead tracking + scoring, followUpDueDate)
- DebtCase (debt collection cases + DPD, escalationHistory)
- Campaign (outbound/inbound campaigns)
- Ticket (support ticket lifecycle + SLA fields)
- Macro (message templates)
- Notification (user notifications)
- Dashboard (widget configurations)

**VoIP & Call Management**:
- Call (active call tracking)
- CallLog (historical CDR records)
- Script (call script templates, Phase 15+)
- AgentStatusLog (agent status history + wrapUpDuration)

**QA & Annotations**:
- QaAnnotation (QA scores + timestamp, category, Phase 15+)

**RBAC & Permissions** (Phase 10+):
- Permission (dynamic permission definitions)
- RolePermission (role-permission mapping)

**Supporting**:
- AuditLog (action tracking)

### API Endpoints (70+)

**Auth & Users** (19 endpoints):
- POST /api/v1/auth/register, /login, /refresh, /logout
- GET /api/v1/users (+ list), GET /api/v1/users/:id
- PATCH /api/v1/users/:id, DELETE /api/v1/users/:id
- GET /api/v1/teams, POST /api/v1/teams (CRUD)

**CRM Features** (9 endpoints):
- Contacts: CRUD + timeline (+ merge, import, tags)
- Leads: CRUD + status transitions (+ scoring, assignment, follow-ups)
- DebtCases: CRUD (+ escalation)
- Campaigns: CRUD (+ import, progress)

**VoIP & Calls** (8+ endpoints):
- Calls: POST /initiate, GET list, GET detail
- Call Actions: PATCH /transfer, /hold, /end (+ attended-transfer, wrap-up)
- CDR Webhooks: POST /webhooks/cdr
- Agent Status: GET /agents, PATCH /agents/:id/status (auto-detection)

**Call History & QA** (8+ endpoints):
- CallLogs: GET list, GET detail, analytics (+ bulk-download)
- Disposition Codes: CRUD
- QA Annotations: CRUD (+ timestamps)

**Ticketing** (10+ endpoints, 2026-04-21 Kanban MVP):
- Tickets: CRUD + bulk actions (+ SLA tracking, cluster-scoped, detail includes callLog + auditLog)
- Kanban board: 4-column drag-drop (open, in_progress, resolved, closed) with resolved requiring resultCode
- Delete: admin/super_admin only
- Categories: CRUD
- Comments: Add/list
- Macros: Apply endpoint

**Scripts & Templates** (3+ endpoints, Phase 15+):
- GET /api/v1/scripts/active
- GET /api/v1/scripts/default
- GET /api/v1/scripts/active-call/:callId

**Analytics & Reports** (5+ endpoints):
- Dashboard: GET /dashboard (enhanced KPIs)
- Reports: Agent performance, campaign ROI, contact funnel (+ SLA)
- Analytics: Daily calls, conversion rates

**Lead Scoring & Assignment** (2+ endpoints, Phase 15+):
- GET /api/v1/leads/scored-list
- POST /api/v1/leads/assign-bulk
- GET /api/v1/leads/follow-ups

**Debt Management** (1 endpoint, Phase 15+):
- POST /api/v1/debt-cases/escalate (manual trigger)

**Monitoring** (1 endpoint, Phase 15+):
- GET /api/v1/monitoring/live (agent grid + active calls)

**Export** (1 endpoint, Phase 15+):
- GET /api/v1/export/:entity (contacts|leads|debt-cases|call-logs|tickets|campaigns)

**Permissions** (3 endpoints, Phase 10+):
- GET /api/v1/permissions
- PUT /api/v1/permissions/role/:role
- GET /api/v1/permissions/user

**Extensions** (2 endpoints, Phase 11+):
- GET /api/v1/extensions
- PUT /api/v1/extensions/:ext/assign

**Cluster Management** (11 endpoints, Phase 18+):
- GET /api/v1/clusters → list all clusters
- GET /api/v1/clusters/active → active cluster config
- POST /api/v1/clusters → create cluster
- POST /api/v1/clusters/ssh-discover → network scan for PBX hosts
- POST /api/v1/clusters/test-connection-direct → direct ESL test
- GET /api/v1/clusters/:id → cluster detail (secrets masked)
- PUT /api/v1/clusters/:id → update cluster
- DELETE /api/v1/clusters/:id → delete cluster
- POST /api/v1/clusters/:id/switch → set active cluster
- POST /api/v1/clusters/:id/test-connection → test ESL for saved cluster
- POST /api/v1/clusters/:id/sync-extensions → SSH sync extensions from FusionPBX
- GET /api/v1/clusters/:id/extensions → list synced extensions

**Feature Flags** (3 endpoints, Phase 19+):
- GET /api/v1/feature-flags?clusterId= → List all flags for cluster (super_admin only)
- PUT /api/v1/feature-flags → Bulk update flags (super_admin only)
- GET /api/v1/feature-flags/effective → Get effective flags for current user's cluster (all auth users)

### Middleware Chain

1. **Helmet** - Security headers
2. **CORS** - Cross-origin resource sharing
3. **Compression** - gzip response compression
4. **Morgan** - HTTP request logging
5. **Rate Limiter** - Redis-backed rate limiting
6. **Auth Middleware** - JWT verification, attach req.user
7. **RBAC Middleware** - Role-based access control
8. **Permission Middleware** - Permission checking with cache
9. **Data Scope Middleware** - Filter data by role/team
10. **Feature Flag Middleware** - Feature availability check (Phase 19+)
11. **Error Handler** - Consistent error responses

### Request/Response Pattern

```
Request → Auth → RBAC → Permissions → DataScope → Controller → Service → DB
                                                        ↓
                                                    Validation (Zod)
                                                        ↓
                                                    Business Logic
                                                        ↓
                                                    Response

Error → Error Handler → Consistent Format
```

### Role & Permission System

**Roles** (7 roles):
1. super_admin - Full system + permission management
2. admin - Full system access
3. manager - Department oversight
4. qa - Quality assurance
5. leader - Team management
6. agent_telesale - Sales operations
7. agent_collection - Collection operations

**40+ Permission Keys in 7 Groups** (Phase 10+, v1.3.10 deduped):

| Group | Keys | Purpose |
|-------|------|---------|
| **Switchboard** (Tổng đài) | switchboard.manage, .make_call, .receive_call, .transfer_call, .hold_call, .listen_recording, .download_recording; recording.delete | VoIP operations and recording management |
| **CRM** | crm.manage, .contacts.view, .contacts.create, .contacts.edit, .contacts.delete, .contacts.import, .contacts.export; .leads.view, .leads.create, .leads.edit, .leads.delete, .leads.import; .debt.view, .debt.edit; .data_allocation | Contact, lead, debt case management and data allocation |
| **Campaign** (Chiến dịch) | campaign.manage, .create, .edit, .delete, .assign, .import | Campaign creation, editing, assignment, and CSV import |
| **Report** (Báo cáo) | report.manage, .view_own, .view_team, .view_all, .export | Report viewing and export based on role scope |
| **Ticket** (Phiếu ghi) | ticket.manage, .create, .edit, .delete, .assign | Ticket lifecycle and assignment (delete requires admin/super_admin) |
| **QA** | qa.manage, .score, .review, .annotate | QA scoring and annotations |
| **System** (Hệ thống) | system.manage, .users, .roles, .permissions, .settings, .audit_log | User, role, permission, settings, and audit log management |

**Permission Storage**:
- Database: Permission table + RolePermission mapping
- Cache: Redis (5min TTL)
- JWT: Contains only role (not full permissions due to dynamic nature)
- super_admin: Hardcoded bypass (all permissions automatically)

### Feature Flag System (Phase 19+)

**Purpose**: Dynamic control of feature availability at cluster and domain level.

**Table Structure** (ClusterFeatureFlag):
- cluster_id (FK → PbxCluster)
- domain_name (String, '' = cluster-level, custom domain = domain-level)
- feature_key (20+ keys: contacts, leads, debt, campaigns, tickets, voip_c2c, recording, cdr_webhook, live_monitoring, call_history, reports_summary, reports_detail, reports_chart, reports_export, ai_assistant, ai_qa, team_management, permission_matrix, pbx_cluster_mgmt)
- is_enabled (Boolean)
- updated_by (FK → User)
- updated_at (DateTime)
- Unique constraint: (cluster_id, domain_name, feature_key)

**Hierarchy**:
- Cluster-level flag (domainName="") acts as master override
- Domain-level flags allow per-domain customization
- Lookup: domain-specific → cluster-level (fallback)
- If cluster disables feature, all domains cannot enable it

**Enforcement**:
- Middleware: `checkFeatureEnabled(featureKey)` returns 403 when disabled
- Applied to 13 routes (contacts, leads, debt-cases, campaigns, tickets, calls, call-logs, monitoring, reports, ai, teams, permissions, export)
- super_admin bypasses all checks
- Frontend: FeatureGuard blocks routes, sidebar hides menu items

### VoIP Integration (ESL + FreeSWITCH)

**Architecture**:
```
Frontend (Browser)
    ↓ Socket.IO
Node.js Backend
    ↓ ESL Protocol
ESL Daemon ←→ FreeSWITCH PBX
    ↓ CDR XML
Call Log Service → PostgreSQL
    ↓ Socket.IO Events
Real-time UI Updates
```

**Components**:
- **ESL Daemon** (`lib/esl-daemon.ts`): Persistent connection to FreeSWITCH; loads config from active PbxCluster on startup
- **Call Service**: Initiate, transfer, end calls via ESL
- **CDR Webhook**: Receive and parse call detail records; stores with clusterId from active cluster
- **Extension Sync Service** (`services/extension-sync-service.ts`): SSH into FusionPBX, query v_extensions, upsert to ClusterExtension table
- **Cluster Service** (`services/cluster-service.ts`): Manage PbxCluster records; switch active cluster triggers ESL daemon reload
- **Extension Service**: Query FreeSWITCH for SIP registration status
- **Call Log Service**: Store CDR data in database (cluster-scoped)

**Call Routing**:
- Outbound: User → Node.js → ESL → FreeSWITCH → Agent Phone
- Inbound: FreeSWITCH → ESL Events → Node.js → UI
- Loopback bridge via domain 'crm' for outbound routing

### Security Measures

- **Authentication**: JWT (HS256) with refresh token rotation
- **Authorization**: RBAC middleware + permission checks
- **Data Protection**: Bcryptjs password hashing, HTTPS in production
- **Input Validation**: Zod schemas on all API endpoints
- **Network Security**: Helmet.js headers, CORS, rate limiting
- **Audit Logging**: Track all user actions in database
- **Token Management**: Access token (15m), Refresh token (7d)

### Deployment Stack

**Docker Composition**:
- Backend: Node.js 18 Alpine (optimized)
- Frontend: Node.js 18 build → nginx serving
- PostgreSQL: Production database with volumes
- Redis: Caching and rate limiting
- Nginx: Reverse proxy, SSL termination, static assets

**Process Management**:
- PM2 fork mode (multi-process load balancing)
- Auto-restart on crash
- Log rotation
- Process monitoring

**Performance**:
- API response: <200ms (p95)
- Call initiation: <2s via ESL
- Dashboard load: <2s
- Supports 500+ concurrent users

## Frontend Architecture

### Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | React | ^19.0.0 |
| Build Tool | Vite | ^6.0.0 |
| Language | TypeScript | ^5.7.0 |
| Styling | Tailwind CSS | ^4.0.0 |
| UI Components | shadcn/ui | Latest |
| State Management | Zustand | ^5.0.0 |
| Data Fetching | Axios | ^1.7.0 |
| Query Caching | TanStack Query | ^5.62.0 |
| Routing | React Router | ^7.1.0 |
| Real-time | Socket.IO Client | ^4.8.0 |

### 15+ Feature Pages

1. **Auth Pages** (3): Login, Register, Forgot Password
2. **Dashboard**: Executive KPI overview with widgets (enhanced KPIs, Phase 15+)
3. **Contacts**: List, detail, create/edit pages (+ merge, import, tags, Phase 15+)
4. **Leads**: Sales pipeline with status workflow (+ scoring, follow-ups, auto-assign, Phase 15+)
5. **Debt Cases**: Collection case tracking (+ escalation history, Phase 15+)
6. **Call Logs**: Historical records with analytics (+ bulk download, QA timestamps, Phase 15+)
7. **Campaigns**: Campaign management (+ progress bar, import, auto-assign, Phase 15+)
8. **Tickets**: Support ticket lifecycle (+ SLA tracking, macro templates, Phase 15+)
9. **Reports**: Analytics dashboards (agent performance, ROI, funnel, + SLA, Phase 15+)
10. **Settings**: User profile + team configuration
11. **Extensions**: Extension mapping (admin only)
12. **Permissions**: Permission manager (super_admin only)
13. **Monitoring**: Live monitoring dashboard (agent grid, active calls, Phase 15+)

### Sidebar Navigation Structure (Phase 17+)

**Organization**: 5 groups reflecting business workflow

| Group | Vietnamese | Items | Routes |
|-------|-----------|-------|--------|
| **Monitoring** | Giám sát | Tổng quan, Hoạt động trong ngày | /dashboard, /monitoring/live |
| **CRM** | CRM | Danh sách khách hàng, Nhóm khách hàng, Công nợ | /contacts, /leads, /debt-cases |
| **Campaigns** | Chiến dịch | Danh sách chiến dịch | /campaigns |
| **PBX** | Tổng đài | Lịch sử cuộc gọi, Máy nhánh | /call-logs, /extensions |
| **Support** | Hỗ trợ | Phiếu ghi, Báo cáo | /tickets, /reports |

**Navigation Component**: `packages/frontend/src/components/sidebar.tsx`
- Recursive menu structure supporting nested items
- Vietnamese localized labels
- Role-based visibility (some items hidden for lower permissions)
- Responsive collapsible sidebar
- Active state indication for current route

### Component Structure

**Form Components**:
- ContactForm, LeadForm, TicketForm, BaseForm

**Table Components**:
- DataTable (generic), ContactsTable, LeadsTable, CallLogsTable

**Layout Components**:
- Sidebar, Header, AuthGuard, ErrorBoundary, Modal, Toast

**Utility Components**:
- LoadingSpinner, FormField, DatePicker, StatusBadge

### State Management (Zustand)

**Auth Store**:
- user, token, login(), logout(), refresh()
- hasPermission(key) helper
- isAuthenticated computed property

**UI Store**:
- sidebarOpen, theme
- toggleSidebar(), setTheme()

### API Integration

**Axios Client**:
- Base URL from VITE_API_URL
- JWT token in Authorization header
- Auto-refresh on 401
- Consistent error handling

**React Query Hooks**:
- useContacts(), useContact(id), useCreateContact()
- useLead(), useLeads(), useUpdateLead()
- useCallLogs(), useTickets(), etc.
- usePermissions(), useExtensions() (new)

### Real-time Updates (Socket.IO)

**Events Listened**:
- call:initiated, call:ended
- agent:status_changed
- ticket:updated
- notification:new
- contact:assigned
- permission:changed (new)

**Integration**:
- Socket instance per app lifecycle
- Query invalidation on relevant events
- Toast notifications for updates
- Real-time call state tracking

### Utility Functions

**Formatting** (`lib/format.ts`):
- formatDuration(ms): "2h 35m"
- formatMoney(amount, currency): "$1,500.50"
- formatPercent(value, decimals): "85.70%"

**Date Utilities**:
- Relative dates ("2 hours ago")
- Timezone handling
- Date range filtering

**Validation**:
- Zod schema integration
- Client-side validation
- Field-level error messages

### Performance Optimizations

- Code splitting with React.lazy
- React Query result caching
- Component memoization (React.memo)
- Debounced search (300ms)
- Lazy image loading
- Tree-shaking unused components

## Testing Infrastructure

### Test Framework: Vitest

**Test Organization**:
```
packages/backend/tests/
  setup.ts              # Environment and database
  helpers.ts            # Token generation, test utilities
  auth.test.ts          # Authentication tests
  permissions.test.ts   # Permission system tests
  extensions.test.ts    # Extension tests
  contacts.test.ts      # Contact CRUD tests
  ...
```

### Test Coverage

- **49+ Tests**: Unit + integration tests
- **Coverage Areas**:
  - Auth service (login, refresh, logout)
  - Contact/Lead/DebtCase CRUD
  - Call management and ESL integration
  - Data scoping and RBAC
  - Error handling and validation
  - Permission checks
  - Extension assignment

### E2E Tests (Playwright)

- **Auth Flow**: Login → dashboard
- **CRUD Workflows**: Contact creation, lead status transitions
- **Permission UI**: Permission manager matrix
- **VoIP**: Call initiation flows
- **Reports**: Analytics dashboard loading

## Key Features & Highlights

### 1. Multi-Channel Communication
- Click-to-call (C2C) integration with FreeSWITCH
- Outbound call origination via ESL
- Call transfer (blind and attended, Phase 15+)
- Real-time call state tracking
- Auto-detection of agent status from ESL events (Phase 15+)

### 2. CRM Core
- Contact management with relationship tracking (+ merge, tags, Phase 15+)
- Lead pipeline with status workflow (+ scoring, follow-ups, Phase 15+)
- Debt case aging and collection tracking (+ auto-escalation, Phase 15+)
- Activity timeline for all entities
- Bulk import workflows (CSV, Phase 15+)

### 3. VoIP & Call Center
- Extension mapping with SIP registration tracking
- Call logs with CDR analytics (+ bulk download, Phase 15+)
- QA annotations with scoring (+ timestamp markers, Phase 15+)
- Call recording tracking
- Call script templates with variable substitution (Phase 15+)
- Wrap-up auto-timer (30s countdown after hangup, Phase 15+)

### 4. Ticketing & Support
- Ticket lifecycle management
- SLA tracking (first response, resolution, Phase 15+)
- Auto-routing and assignment
- Ticket categories and priorities
- Macro templates for quick responses (Phase 15+)

### 5. Analytics & Reporting
- Executive dashboard with enhanced KPIs (Phase 15+)
  - Contact rate, close rate, PTP rate, recovery rate
  - Wrap-up average, amount collected
- Agent performance metrics
- Campaign ROI analysis
- Contact funnel tracking
- SLA compliance reporting (Phase 15+)

### 6. Security & Access Control
- Role-based access control (RBAC)
- Dynamic permission system with caching
- Data scoping by role and team
- Audit logging of all actions

### 7. Real-time Collaboration
- Socket.IO event broadcasting
- Live call state updates
- Real-time notifications
- Agent status tracking
- Live monitoring dashboard (Phase 15+)
- Real-time lead scoring updates (Phase 15+)

### 8. Lead & Debt Management (Phase 15+)
- Intelligent lead scoring (rule-based: source, status, verification, call count, recency)
- Automatic lead assignment to agents
- Follow-up lead discovery (overdue, due-today, due-this-week)
- Automatic debt tier escalation (DPD-based)
- Daily escalation cron job + manual trigger

### 9. Data Management (Phase 15+)
- Excel export for all entities (contacts, leads, debt-cases, call-logs, tickets, campaigns)
- Bulk recording download as ZIP archives
- CSV import with deduplication
- Contact merge with conflict resolution

### 10. Compliance & Quality
- QA timestamp annotations on recordings with categories
- SLA tracking and reporting
- Audit logging and compliance reports
- Permission-based feature access control

## Development Workflow

### Code Organization Principles

- **Controllers**: Validate input, call services, return responses
- **Services**: Business logic, database operations, external integrations
- **Middleware**: Cross-cutting concerns (auth, validation, logging)
- **Routes**: Express route definitions with middleware chaining

### Naming Conventions

- **Files**: kebab-case (user-controller.ts, auth-middleware.ts)
- **Functions**: camelCase (createUser, listContacts)
- **Classes**: PascalCase (UserService, ContactController)
- **Constants**: UPPER_SNAKE_CASE (JWT_SECRET, MAX_RETRIES)
- **Database Fields**: camelCase in code, snake_case in database

### Database Migrations

- Prisma migrations in prisma/migrations/
- Run with: `npm run db:migrate`
- Rollback with: `npx prisma migrate resolve --rolled-back <migration_name>`

### Build & Deployment

**Development**:
```bash
npm install            # Install dependencies
npm run dev            # Start backend (:4000) + frontend (:3000)
npm run db:migrate     # Run migrations
npm run db:seed        # Seed initial data
```

**Production**:
```bash
npm run build          # Build for production
docker-compose -f docker-compose.prod.yml up
```

### Code Quality Standards

- **Linting**: ESLint with TypeScript support
- **Formatting**: Prettier (opinionated)
- **Type Safety**: Strict TypeScript mode
- **Validation**: Zod at API boundaries
- **Testing**: Vitest with >80% coverage target
- **Security**: npm audit, OWASP compliance

### Git & Version Control

- **Main Branch**: master (production ready)
- **Feature Branches**: feature/description-name
- **Commit Format**: Conventional commits (feat:, fix:, docs:, etc.)
- **No Secrets**: .env files never committed

## Current Project Status

### Completed Phases

- **Phase 01** ✓ Project Setup & Infrastructure
- **Phase 02** ✓ Core Data Models & CRUD
- **Phase 03** ✓ CRM Features & Relationships
- **Phase 04** ✓ VoIP Integration & Call Management
- **Phase 05** ✓ Call History & QA Features
- **Phase 06** ✓ Support Ticketing System
- **Phase 07** ✓ Dashboard & Analytics
- **Phase 08** ✓ Frontend UI Implementation
- **Phase 09** ✓ Testing & Production Hardening
- **Phase 10** ✓ Super Admin Role + Permission Manager
- **Phase 11** ✓ Extension Mapping Config
- **Phase 12-14** — Merged into Phase 15 scope
- **Phase 15** ✓ Gap Analysis Features & Advanced Features (v1.2.0)
- **Phase 16** ✓ Reports Page Redesign (v1.2.1)
- **Phase 17** ✓ RBAC Overhaul + UI Navigation Restructure (v1.3.0 / v1.3.1)
- **Phase 18** ✓ Extension Sync, Accounts & Multi-Tenancy (v1.3.2)
- **Phase 19** ✓ Feature Toggle System (v1.3.3)
- **Phase 20** ✓ Auth Hardening & Telephony Polish (v1.3.4 → v1.3.6)

### Next Steps (Phase 21+)

1. Predictive dialing + auto-calling campaigns
2. ML-based lead scoring refinement
3. Webhook system for third-party integrations
4. Mobile app (React Native)
5. AI-powered customer insights and recommendations
6. Third-party CRM integrations (Salesforce, HubSpot)

## Metrics & Statistics

| Metric | Value |
|--------|-------|
| Backend Files | 100+ TypeScript files |
| Frontend Files | 95+ TypeScript/TSX files |
| API Endpoints | 85+ |
| Database Tables | 17 (+ extended fields) |
| Controllers | 26+ |
| Services | 26+ |
| Frontend Pages | 15 |
| Frontend Components | 30+ |
| Middleware | 6 |
| Lines of Code (Backend) | ~12,000 |
| Lines of Code (Frontend) | ~9,500 |
| Test Coverage | 49+ tests |
| Tech Debt | Low (consistent patterns) |
| Project Completion | 100% (20/20 phases) |

## Dependencies & External Services

### Required Services

- **FreeSWITCH PBX**: VoIP platform for call management
- **PostgreSQL 13+**: Primary database
- **Redis**: Caching, rate limiting, session storage
- **Node.js 18+**: Runtime environment
- **Docker** (optional): Containerized deployment

### Key NPM Packages

- express, typescript, prisma, zod
- react, vite, tailwind, shadcn/ui
- axios, tanstack/react-query, zustand
- socket.io, modesl, jsonwebtoken
- vitest, supertest, playwright

## Documentation

- `docs/development-roadmap.md` - Phase tracking and milestones
- `docs/system-architecture.md` - System design and components
- `docs/project-changelog.md` - Version history and changes
- `docs/code-standards.md` - Coding standards and patterns
- `docs/codebase-summary.md` - This file

---

**Last Updated**: 2026-04-21
**Maintained By**: Development Team
**Status**: Phase 20+ Complete (v1.3.10 — RBAC dedup + recording.delete)
**Deployed To**: 10.10.101.207 (v1.3.10)
**Next Review**: 2026-04-28
