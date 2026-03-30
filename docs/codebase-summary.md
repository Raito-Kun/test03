# CRM VoIP Application - Codebase Summary

## Project Overview

CRM Omnichannel is a comprehensive customer relationship management platform with integrated VoIP capabilities, built as a monorepo using TypeScript, Node.js, React, PostgreSQL, and FreeSWITCH PBX integration.

**Project Status**: MVP Complete (Phases 1-11 Done, Phase 12 Testing In Progress)
**Repository**: Monorepo structure with packages/backend, packages/frontend, packages/shared, packages/mcp-server
**Team**: Full-stack development team
**Start Date**: 2026-01-15
**Current Phase**: Phase 12 (Smart Test Suite - In Progress)

## Monorepo Structure

```
packages/
├── backend/              # Express.js API server (85+ files)
│   ├── src/
│   │   ├── controllers/  # HTTP request handlers (19+ files)
│   │   ├── services/     # Business logic (21+ files)
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

### Database Models (17 Tables)

**Core Entities**:
- User (accounts with roles and team assignments)
- Team (organizational teams: sales, collections, support)
- Contact (customer/prospect information)
- Lead (sales lead tracking with status pipeline)
- DebtCase (debt collection cases)
- Campaign (outbound/inbound campaigns)
- Ticket (support ticket lifecycle)
- Macro (message templates)
- Notification (user notifications)
- Dashboard (widget configurations)

**VoIP & Call Management**:
- Call (active call tracking)
- CallLog (historical CDR records)

**RBAC & Permissions** (Phase 10+):
- Permission (dynamic permission definitions)
- RolePermission (role-permission mapping)

**Supporting**:
- AuditLog (action tracking)

### API Endpoints (57+)

**Auth & Users** (19 endpoints):
- POST /api/v1/auth/register
- POST /api/v1/auth/login
- POST /api/v1/auth/refresh
- POST /api/v1/auth/logout
- GET /api/v1/users, GET /api/v1/users/:id
- PATCH /api/v1/users/:id, DELETE /api/v1/users/:id
- GET /api/v1/teams, POST /api/v1/teams (CRUD)

**CRM Features** (9 endpoints):
- Contacts: CRUD + timeline
- Leads: CRUD + status transitions
- DebtCases: CRUD
- Campaigns: CRUD

**VoIP & Calls** (8 endpoints):
- Calls: POST /initiate, GET list, GET detail
- Call Actions: PATCH /transfer, /hold, /end
- CDR Webhooks: POST /webhooks/cdr
- Agent Status: GET /agents, PATCH /agents/:id/status

**Call History & QA** (8 endpoints):
- CallLogs: GET list, GET detail, analytics
- Disposition Codes: CRUD
- QA Annotations: CRUD

**Ticketing** (10 endpoints):
- Tickets: CRUD + bulk actions
- Categories: CRUD
- Comments: Add/list

**Analytics & Reports** (5 endpoints):
- Dashboard: GET /dashboard
- Reports: Agent performance, campaign ROI, contact funnel
- Analytics: Daily calls, conversion rates

**Permissions** (3 endpoints, Phase 10+):
- GET /api/v1/permissions
- PUT /api/v1/permissions/role/:role
- GET /api/v1/permissions/user

**Extensions** (2 endpoints, Phase 11+):
- GET /api/v1/extensions
- PUT /api/v1/extensions/:ext/assign

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
10. **Error Handler** - Consistent error responses

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

**13 Permission Keys** (Phase 10+):
- view_reports, make_calls, export_excel, view_recordings
- manage_campaigns, manage_users, manage_permissions, manage_extensions
- view_dashboard, manage_tickets, manage_debt_cases, manage_leads, manage_contacts

**Permission Storage**:
- Database: Permission table + RolePermission mapping
- Cache: Redis (5min TTL)
- JWT: Contains only role (not full permissions due to dynamic nature)
- super_admin: Hardcoded bypass (all permissions automatically)

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
- **ESL Daemon** (`lib/esl-daemon.ts`): Persistent connection to FreeSWITCH
- **Call Service**: Initiate, transfer, end calls via ESL
- **CDR Webhook**: Receive and parse call detail records
- **Extension Service**: Query FreeSWITCH for SIP registration status
- **Call Log Service**: Store CDR data in database

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

### 14 Feature Pages

1. **Auth Pages** (3): Login, Register, Forgot Password
2. **Dashboard**: Executive KPI overview with widgets
3. **Contacts**: List, detail, create/edit pages
4. **Leads**: Sales pipeline with status workflow
5. **Debt Cases**: Collection case tracking
6. **Call Logs**: Historical records with analytics
7. **Campaigns**: Campaign management
8. **Tickets**: Support ticket lifecycle
9. **Reports**: Analytics dashboards (agent performance, ROI, funnel)
10. **Settings**: User profile + team configuration
11. **Extensions**: Extension mapping (admin only)
12. **Permissions**: Permission manager (super_admin only)

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
- Call transfer (blind and attended)
- Real-time call state tracking

### 2. CRM Core
- Contact management with relationship tracking
- Lead pipeline with status workflow
- Debt case aging and collection tracking
- Activity timeline for all entities

### 3. VoIP & Call Center
- Extension mapping with SIP registration tracking
- Call logs with CDR analytics
- QA annotations with scoring
- Call recording tracking

### 4. Ticketing & Support
- Ticket lifecycle management
- SLA tracking (first response, resolution)
- Auto-routing and assignment
- Ticket categories and priorities

### 5. Analytics & Reporting
- Executive dashboard with KPIs
- Agent performance metrics
- Campaign ROI analysis
- Contact funnel tracking

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

### In Progress

- **Phase 12** Smart Test Suite (comprehensive test coverage expansion)

### Next Steps

1. Complete Phase 12 comprehensive test coverage
2. Deploy to staging environment
3. Production smoke tests
4. User onboarding and training
5. Post-launch monitoring and feature enhancements

## Metrics & Statistics

| Metric | Value |
|--------|-------|
| Backend Files | 85+ TypeScript files |
| Frontend Files | 81+ TypeScript/TSX files |
| API Endpoints | 57+ |
| Database Tables | 17 |
| Controllers | 21 |
| Services | 21 |
| Frontend Pages | 14 |
| Middleware | 6 |
| Lines of Code (Backend) | ~9,500 |
| Lines of Code (Frontend) | ~7,000 |
| Test Coverage | 49+ tests |
| Tech Debt | Low (consistent patterns) |
| Project Completion | 91.7% (11/12 phases) |

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

**Last Updated**: 2026-03-26
**Maintained By**: Development Team
**Status**: MVP Complete + Phase 12 In Progress
**Next Review**: 2026-03-31
