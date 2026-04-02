# System Architecture

CRM Omnichannel is a monorepo-based customer relationship management platform with integrated VoIP capabilities, multi-channel communication, and real-time collaboration features.

## Monorepo Structure

```
packages/
├── backend/          # Express.js + TypeScript API server
├── frontend/         # React + Vite + TypeScript UI application
└── shared/           # Shared types, validation schemas, constants
```

### Backend

```
packages/backend/src/
├── controllers/      # HTTP request handlers, input validation
├── services/         # Business logic, database operations
├── routes/           # Express route definitions
├── middleware/       # Auth, RBAC, data scoping, error handling
├── jobs/             # Background jobs (e.g., reminders, scheduled tasks)
├── lib/              # Utilities: JWT, Prisma, Socket.IO, ESL daemon, logger
├── index.ts          # Express app setup and middleware chain
└── prisma/
    └── schema.prisma # PostgreSQL data models
```

### Frontend

```
packages/frontend/src/
├── components/       # Reusable UI components (forms, tables, modals, etc.)
├── pages/            # Page-level components (routes)
├── hooks/            # Custom React hooks (API calls, state)
├── stores/           # Zustand global state
├── services/         # API client and external services
├── lib/              # Utilities: formatting, constants, validation
├── app.tsx           # Root component with routing
└── main.tsx          # Entry point
```

**Page Structure** (14+ pages):
- Auth: login, register, forgot-password
- Dashboard: overview with KPIs
- Contacts: list, detail, create/edit
- Leads: list, detail, create/edit
- DebtCases: list, detail
- CallLogs: list, detail
- Campaigns: list, detail
- Tickets: list, detail, create/edit
- Reports: 3-tab analytics (summary, detail, charts) with shared filters
- Settings: user and team config

**Reports Page Components** (Phase 16+):
- `reports-page.tsx` — Main page with tab routing, shared filter state management, session memory
- `report-filters.tsx` — Shared filter bar component (date range, agent, team, search button)
- `report-summary-tab.tsx` — Summary with "Theo nhân viên" / "Theo team" sub-tabs
- `report-detail-tab.tsx` — Paginated call log table with result and SIP code filters
- `report-charts-tab.tsx` — 4 Recharts visualizations (bar, bar, line, pie)
- `report-export-button.tsx` — CSV export component (reusable, context-aware)

### Shared

```
packages/shared/src/
├── types/            # TypeScript interfaces
├── validation/       # Zod schemas for runtime validation
└── constants/        # Shared constants
```

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend | Express.js | ^4.21.0 |
| Language | TypeScript | ^5.7.0 |
| Database | PostgreSQL | Latest |
| ORM | Prisma | ^6.4.0 |
| Cache/Queue | Redis (ioredis) | ^5.4.0 |
| Auth | JWT (jsonwebtoken) | ^9.0.2 |
| Real-time | Socket.IO | ^4.8.0 |
| VoIP | modesl (ESL library) | ^1.1.2 |
| Validation | Zod | ^3.24.0 |
| Logging | Winston | ^3.17.0 |
| Security | Helmet, bcryptjs, rate-limit | Latest |
| Frontend Framework | React | ^19.0.0 |
| Frontend Build | Vite | ^6.0.0 |
| Styling | Tailwind CSS | ^4.0.0 |
| UI Components | shadcn/ui | Latest |
| State Management | Zustand | ^5.0.0 |
| Data Fetching | Axios | ^1.7.0 |
| Data Caching | TanStack Query | ^5.62.0 |
| Routing | React Router | ^7.1.0 |
| Real-time | Socket.IO Client | ^4.8.0 |

## Backend Architecture

### Request Pipeline

```
HTTP Request
    ↓
[Helmet, CORS, Compression, Morgan]
    ↓
[Express JSON/URL-Encoded Parsers]
    ↓
[Rate Limiter]
    ↓
[Auth Middleware] → Verify JWT token, attach req.user
    ↓
[RBAC Middleware] → Check user role against allowed roles
    ↓
[Data Scope Middleware] → Build WHERE clause based on role/team
    ↓
[Route Handler] → Controller → Service → Prisma
    ↓
[Error Handler] → Consistent error response format
    ↓
HTTP Response
```

### Middleware Chain

#### Auth Middleware (`auth-middleware.ts`)
- Extracts Bearer token from `Authorization` header
- Verifies JWT signature and expiration
- Attaches `req.user` (TokenPayload) with userId, role, teamId
- Returns 401 for missing/invalid tokens

#### RBAC Middleware (`rbac-middleware.ts`)
- `requireRole(...allowedRoles)` factory function
- Checks if `req.user.role` is in allowed list
- Returns 403 if user lacks permission
- Applied per-route to enforce access control

#### Permission Middleware (`permission-middleware.ts`)
- `requirePermission(...permissionKeys)` factory function
- Checks permission keys against database/cache (Redis TTL: 5min)
- super_admin always passes (hardcoded bypass)
- Returns 403 if user lacks permission
- Seamless fallback to database if cache miss

#### Data Scope Middleware (`data-scope-middleware.ts`)
- `applyDataScope(userField)` factory function
- Builds Prisma WHERE conditions based on user role:
  - **admin/manager/qa**: No filter (all data)
  - **leader**: Filter by team (via user's teamId)
  - **agent_telesale/agent_collection**: Filter by assigned field
- Attaches `req.dataScope` for service layer
- `buildScopeWhere()` helper converts dataScope to Prisma WHERE

#### Error Handler (`error-handler.ts`)
- Catches ZodError → 400 with field validation details
- Custom errors with `{ code, message }` → appropriate status
- Unknown errors → 500 (no stack in production)
- All responses follow: `{ success, data?, error? }`

### Controller Pattern

```typescript
// Route handler → Zod validation → Service call → Response

async function createContact(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createContactSchema.parse(req.body); // Zod validation
    const contact = await contactService.create(body, req.user.userId, req);

    res.json({ success: true, data: contact });
  } catch (err) {
    // Zod errors caught by error handler; custom errors rethrown
    next(err);
  }
}
```

### Service Pattern

Services handle all business logic and database operations:

```typescript
// Service layer uses buildScopeWhere to filter data

export async function listContacts(pagination, filters, dataScope) {
  const scopeWhere = buildScopeWhere(dataScope, 'assignedTo');

  const where = {
    ...scopeWhere,
    ...(filters.search && { OR: [...] }),
  };

  return prisma.contact.findMany({ where, ... });
}
```

### Roles & Permissions

| Role | Access Level | Data Scope |
|------|--------------|-----------|
| **super_admin** | Full system + permission management | All data + manage permissions |
| **admin** | Full system access | All data |
| **manager** | Department oversight | All team data |
| **qa** | Quality assurance | All data (audit only) |
| **leader** | Team management | Team members' data |
| **agent_telesale** | Sales operations | Own assigned records |
| **agent_collection** | Collection operations | Own assigned records |

### Permission System (Phase 10+)

**Permission Table**: Dynamic RBAC permissions stored in database
- **ID**: UUID primary key
- **Key**: Unique permission identifier (e.g., "manage_users", "view_reports")
- **Label**: User-friendly label (Vietnamese/English)
- **Group**: UI grouping category (e.g., "users", "reports", "calls")

**RolePermission Table**: Many-to-many mapping roles to permissions
- **Role**: Enum value (admin, manager, leader, agent_telesale, agent_collection, qa)
- **PermissionId**: Foreign key to Permission table
- **Granted**: Boolean flag for permission grant/revoke

**13 Standard Permissions**:
1. `view_reports` - Access report dashboards
2. `make_calls` - Initiate VoIP calls
3. `export_excel` - Export data to Excel
4. `view_recordings` - Access call recordings
5. `manage_campaigns` - Create/edit campaigns
6. `manage_users` - User account management
7. `manage_permissions` - Permission matrix management
8. `manage_extensions` - Extension mapping and reassignment
9. `view_dashboard` - Dashboard access
10. `manage_tickets` - Ticket lifecycle management
11. `manage_debt_cases` - Debt case operations
12. `manage_leads` - Lead pipeline management
13. `manage_contacts` - Contact management

**super_admin Behavior**: Automatically has all permissions (hardcoded bypass in middleware)

### Error Format

All errors follow a consistent structure:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

Common error codes:
- `UNAUTHORIZED` → 401 (auth required)
- `TOKEN_EXPIRED` → 401 (JWT expired)
- `TOKEN_INVALID` → 401 (malformed JWT)
- `FORBIDDEN` → 403 (insufficient permissions)
- `VALIDATION_ERROR` → 400 (Zod validation failed)
- `NOT_FOUND` → 404 (resource not found)
- `INTERNAL_ERROR` → 500 (unhandled exception)

## VoIP Integration (ESL + FreeSWITCH)

### Architecture

Frontend (Socket.IO) ↔ Backend (Node.js) ↔ ESL Daemon ↔ FreeSWITCH (PBX) + CDR Webhook ↔ PostgreSQL

**Key Components**:
- **ESL Daemon**: Persistent FreeSWITCH connection (port 8021), auto-reconnect, Socket.IO broadcast
- **Call Controller**: `POST /initiate`, `POST /:id/transfer`, `POST /:id/end`, `GET /calls`
- **CDR Webhook**: `POST /webhooks/cdr` receives XML, parses, stores CallLog, emits Socket.IO events
- **Recording Service**: Tracks S3/local storage status, provides download/playback endpoints

#### Permission Controller & Service (Phase 10+)
- `GET /api/v1/permissions` → List all permissions
- `PUT /api/v1/permissions/role/:role` → Update role permission matrix
- `GET /api/v1/permissions/user` → Get current user's permissions
- Caches permissions in Redis (5min TTL)

#### Extension Controller & Service (Phase 11+)
- `GET /api/v1/extensions` → List all extensions with SIP registration status
- `PUT /api/v1/extensions/:ext/assign` → Reassign extension to agent
- Queries FreeSWITCH via ESL service for registration status
- Fallback to "Unknown" status if ESL unavailable

#### Lead Scoring & Assignment Services (Phase 15+)
- `GET /api/v1/leads/scored-list` → List leads with calculated scores
- `POST /api/v1/leads/assign-bulk` → Bulk assign leads to agents
- Score calculation: source (10%), status (40%), verification (15%), call count (20%), recency (15%)
- Auto-recalculate scores on contact/lead updates

#### Debt Escalation Service (Phase 15+)
- `POST /api/v1/debt-cases/escalate` → Manual escalation trigger
- Daily cron job at 2 AM for automatic escalation
- Escalation rules: 30 DPD → Tier 2, 60 DPD → Tier 3, 90+ DPD → Collections
- Audit logging on all escalations

#### Call Script Service (Phase 15+)
- `GET /api/v1/scripts/active` → List active call scripts
- `GET /api/v1/scripts/default` → Get default script template
- `GET /api/v1/scripts/active-call/:callId` → Get script with variables substituted
- Variable substitution: ${contact.name}, ${lead.amount}, ${contact.phone}, etc.
- Template storage in Script table

#### Attended Transfer Service (Phase 15+)
- `POST /api/v1/calls/attended-transfer` → Supervised transfer
- ESL command: att_xfer (attended transfer)
- Supports extension or external number routing
- Call remains active during transfer setup

#### Wrap-up Auto-Timer (Phase 15+)
- Auto-transition: HANGUP event → wrap_up status (30s timer)
- Auto-transition: Timer expires → ready status
- Agent can override: click "Ready" earlier
- Stored in AgentStatusLog.wrapUpDuration

#### Monitoring Service (Phase 15+)
- `GET /api/v1/monitoring/live` → Real-time agent grid and active calls
- Metrics: agent count by status, active calls, idle time, availability
- Team filtering, status aggregation
- Real-time updates via Socket.IO

#### Export Service (Phase 15+)
- `GET /api/v1/export/:entity` → Export contacts|leads|debt-cases|call-logs|tickets|campaigns
- Formats: Excel (xlsx), CSV
- Query params: optional filters (dateRange, status, team)
- Returns: formatted file with summary sheet + pivot tables

#### QA Annotations Service (Phase 15+)
- `POST /api/v1/qa-timestamps` → Create timestamp annotation
- `GET /api/v1/qa-timestamps/:callLogId` → List annotations for call
- Fields: timestamp (ms), category (quality|compliance|training|issue), notes, severity
- UI: overlay on audio player with clickable markers

#### SLA Tracking (Phase 15+)
- `GET /api/v1/reports/sla` → SLA compliance report
- Ticket fields: firstResponseAt, resolvedAt, slaBreached
- SLA rule: firstResponseAt <= createdAt + 4 hours
- Report metrics: first response time, resolution time, breach %

#### Contact Merge & Lead Import Services (Phase 15+)
- `POST /api/v1/contacts/merge` → Merge duplicate contacts
- Field conflict resolution: priority ranking
- `POST /api/v1/leads/import-csv` → Bulk import leads from CSV

#### Permission Hierarchy Data Model (Phase 17+)

```
PermissionGroup
  id          UUID
  key         String (unique)
  label       String
  parentId    UUID? (self-referential FK → PermissionGroup.id)
  order       Int

Permission
  id          UUID
  key         String (unique)
  label       String
  groupId     UUID (FK → PermissionGroup.id)

RolePermission
  role        Role (enum)
  permissionId UUID (FK → Permission.id)
  granted     Boolean
```

Parent-child toggle rules enforced at UI and API level:
- Parent toggled OFF → all children in same role column set to false
- Parent toggled ON → all children in same role column set to true
- Children can be individually toggled when parent is ON
- super_admin: all permissions hardcoded ON, switches disabled

#### Data Scope Middleware Flow (Phase 17+)

```
Request arrives with req.user (userId, role, teamId)
    ↓
applyDataScope() middleware executes
    ↓
switch (req.user.role):
  agent_telesale | agent_collection
    → req.dataScope = { type: 'own', userId }
  leader
    → req.dataScope = { type: 'team', teamId }
  manager | admin | qa | super_admin
    → req.dataScope = { type: 'all' }
    ↓
buildScopeWhere(dataScope, assignedField):
  'own'  → { [assignedField]: userId }
  'team' → { assignedUser: { teamId } }
  'all'  → {}
    ↓
Prisma query uses WHERE clause
```

#### Data Allocation Flow (Phase 17+)

```
Leader/Manager selects records on list page (checkbox)
    ↓
Clicks "Phân bổ" button
    ↓
DataAllocationDialog opens:
  - Fetches team members from GET /api/v1/users?teamId=...
  - Agent dropdown populated
    ↓
User selects agent → clicks Confirm
    ↓
POST /api/v1/{entity}/allocate
  Body: { ids: UUID[], agentId: UUID }
    ↓
Backend:
  1. Validates leader/manager has permission over records (dataScope check)
  2. Updates assignedTo = agentId for all records in ids[]
  3. Returns { updated: N }
    ↓
Frontend: success toast, table refreshes, selection cleared
    ↓
Allocated agent now sees records (dataScope filter includes their userId)
```
- `POST /api/v1/contacts/import-csv` → Bulk import contacts from CSV
- Validation and deduplication during import

#### Reports API Services (Phase 16+)
- `GET /api/v1/reports/calls/summary` → Per-agent call statistics
  - Params: fromDate, toDate, agentId, teamId
  - Returns: Agent name, total calls, answered, no answer, busy, voicemail, avg duration, last call time
  - Sorting: by total calls descending
- `GET /api/v1/reports/calls/summary-by-team` → Per-team call statistics
  - Params: fromDate, toDate, teamId
  - Returns: Team name, total calls, per-agent average, team-level metrics
- `GET /api/v1/reports/calls/detail` → Paginated detail logs with advanced filtering
  - Params: fromDate, toDate, agentId, teamId, page, limit, result, sipCode
  - Returns: Paginated call records with time, agent, contact, direction, result, SIP code, duration, recording, notes
  - Default limit: 20 items per page
- `GET /api/v1/reports/calls/charts` → Chart datasets for 4 visualizations
  - Params: fromDate, toDate, teamId
  - Returns: 4 datasets — calls by day (30d), agent comparison (top 10), weekly trend (12w), result distribution (pie)

#### Report Service Layer (Phase 16+)
**report-summary-service.ts**:
- `getCallSummaryByAgent(fromDate, toDate, agentId?, teamId?)`: Aggregates call stats per agent
- `getCallSummaryByTeam(fromDate, toDate, teamId?)`: Aggregates call stats per team

**report-detail-service.ts**:
- `getCallDetail(fromDate, toDate, agentId?, teamId?, page, limit, result?, sipCode?)`: Returns paginated detail logs with multi-filter support

**report-chart-service.ts**:
- `getCallCharts(fromDate, toDate, teamId?)`: Returns 4 chart datasets for visualization
- Datasets: daily calls, agent comparison, weekly trend, result pie

## Frontend Architecture

### Page Layer (Routes)

```
React Router manages navigation:
- /login → LoginPage
- /register → RegisterPage
- /dashboard → DashboardPage (protected)
- /contacts → ContactsListPage
- /contacts/:id → ContactDetailPage
- /contacts/new → ContactFormPage
- /contacts/:id/edit → ContactFormPage
- ... (leads, debt-cases, calls, campaigns, tickets, reports, settings)
```

### Component Structure

**Form Components**:
- `ContactForm` (create/edit with Zod validation)
- `LeadForm` (status pipeline integration)
- `TicketForm` (category selection)
- `BaseForm` (shared form wrapper)

**Table Components**:
- `DataTable` (generic with sorting, filtering, pagination)
- `ContactsTable` (with quick actions)
- `LeadsTable` (with status indicators)
- `CallLogsTable` (with duration formatting)

**Shared Components**:
- `AuthGuard` (route protection)
- `ErrorBoundary` (error fallback UI)
- `LoadingSpinner` (async state)
- `Toast` (notifications)
- `Modal` (dialogs)
- `Sidebar` (navigation)
- `Header` (user menu, settings)

### State Management (Zustand)

**Auth Store** (`stores/auth.ts`):
```typescript
{
  user: User | null,
  token: string | null,
  login(email, password),
  logout(),
  refresh()
}
```

**UI Store** (`stores/ui.ts`):
```typescript
{
  sidebarOpen: boolean,
  theme: 'light' | 'dark',
  toggleSidebar(),
  setTheme()
}
```

### API Integration (Axios + React Query)

**API Client** (`services/api-client.ts`):
- Base URL from `VITE_API_URL` env var
- JWT token in Authorization header (from auth store)
- Auto-refresh on 401 response
- Consistent error response handling

**React Query Hooks** (`hooks/api/`):
- `useContacts()` - list contacts with pagination
- `useContact(id)` - fetch single contact
- `useCreateContact()` - create with optimistic update
- `useUpdateContact(id)` - update with refetch
- `useDeleteContact(id)` - delete with toast notification
- Similar hooks for leads, calls, tickets, etc.

### Real-time Updates (Socket.IO)

**Socket Service** (`services/socket.ts`):
```typescript
const socket = io(SOCKET_URL, {
  auth: { token: authStore.token }
});

socket.on('call:initiated', (data) => {
  // Update UI with new call
  queryClient.invalidateQueries({ queryKey: ['calls'] });
});

socket.on('ticket:updated', (data) => {
  // Show toast notification
  toast.info(`Ticket #${data.id} updated`);
});
```

**Real-time Events Listened**:
- `call:initiated` - New outbound call
- `call:ended` - Call completed
- `agent:status_changed` - Agent availability (+ wrap_up events)
- `ticket:updated` - Ticket status change
- `notification:new` - New notification
- `contact:assigned` - Contact reassignment
- `lead:scored` - Lead score calculated (Phase 15+)
- `debt:escalated` - Debt case escalation (Phase 15+)
- `monitoring:agent_update` - Live monitoring agent status (Phase 15+)

### Utility Functions (lib/)

**Format Utilities** (`lib/format.ts`):
```typescript
formatDuration(5400000) // "1h 30m"
formatMoney(1500.50, 'USD') // "$1,500.50"
formatPercent(0.857, 2) // "85.70%"
```

**Date Utilities** (`lib/dates.ts`):
- Relative dates (e.g., "2 hours ago")
- Timezone handling
- Date range filtering

**Validation** (`lib/validation.ts`):
- Zod schema integration
- Client-side validation before submit
- Field-level error messages

### Performance Optimizations

1. **Code Splitting**: Pages lazy-loaded with React.lazy
2. **Query Caching**: React Query stores results, stale-while-revalidate
3. **Component Memoization**: React.memo on expensive components
4. **Debounced Search**: Search input with 300ms debounce
5. **Image Optimization**: Lazy load avatars and attachments
6. **Bundle Size**: Tree-shake unused components from shadcn/ui

---

## Real-time Communication (Socket.IO)

### Architecture

```
HTTP Socket.IO Server (port 4000)
    ↓
JWT Auth Middleware (validates token on handshake)
    ↓
Event Handlers
    - call:initiated
    - call:ended
    - agent:status_changed
    - ticket:updated
    - notification:new
```

### Integration Points

- **ESL Events** → Socket.IO emit to connected UI clients
- **Database Updates** → Socket.IO broadcast via services
- **Notifications** → Real-time delivery via Socket.IO

## Database Schema (Prisma)

Core entities:

| Table | Purpose |
|-------|---------|
| User | System users with roles and team assignments |
| Team | Organizational teams (sales, collections, support) |
| Contact | Customer/prospect contact information (+ tags, socialProfiles) |
| Lead | Sales lead tracking with status pipeline (+ leadScore, followUpDueDate) |
| DebtCase | Debt collection cases with aging tiers (+ daysPassDue, escalationHistory) |
| Campaign | Outbound/inbound call campaigns |
| Call | Active call tracking (linked to ESL) |
| CallLog | Historical call records (CDR data) |
| Ticket | Support tickets with lifecycle tracking (+ SLA fields) |
| Macro | Pre-configured message templates |
| Notification | User notifications (in-app + email) |
| Dashboard | User dashboard widget configurations |
| Permission | Dynamic RBAC permission definitions |
| RolePermission | Role-permission many-to-many mapping |
| Script | Call script templates with variables |
| AgentStatusLog | Agent status history (+ wrapUpDuration) |
| QaAnnotation | QA annotations on calls (+ timestamp, category) |

### Key Relationships

- User → Team (many-to-one)
- Contact → AssignedUser (many-to-one)
- Lead → Contact, Campaign, AssignedUser
- Call → Contact, CallLog, AssignedUser
- Ticket → Contact, AssignedUser, Category
- Reports services → CallLog (aggregations, filtering, no new tables)

**Note**: Phase 16 Reports page uses existing CallLog table. No new schema migrations required.

## Data Flow Diagrams

### Contact Creation Flow

```
POST /api/v1/contacts
    ↓
[Auth Middleware] ✓ Verify JWT
    ↓
[RBAC Middleware] ✓ Check role in [admin, manager, leader, agent_telesale, agent_collection]
    ↓
[Data Scope Middleware] → Build scopeWhere (agents see own only)
    ↓
[Contact Controller] → Parse & validate request body with Zod
    ↓
[Contact Service]
    - buildScopeWhere(dataScope, 'assignedTo')
    - prisma.contact.create()
    ↓
[Audit Log] → Log creation by userId
    ↓
Response: { success: true, data: { id, fullName, phone, ... } }
```

### Call Initiation Flow

```
POST /api/v1/calls/initiate
    ↓
[Auth Middleware] ✓ Verify JWT
    ↓
[Call Controller] → Validate phone number, contact ID
    ↓
[Call Service]
    - Create Call record (status: initiating)
    - ESL: originate call to FreeSWITCH
    ↓
[ESL Daemon] ↔ FreeSWITCH
    - CHANNEL_CREATE event
    - CHANNEL_ANSWER event
    ↓
[Socket.IO Emit] → call:initiated to connected agents
    ↓
Response: { success: true, data: { callId, status: 'initiating' } }
```

### CDR Webhook Flow

```
POST /api/v1/webhooks/cdr (from FreeSWITCH)
    ↓
[Webhook Controller] → Parse XML body
    ↓
[Call Log Service]
    - Extract: duration, disposition, recording_url
    - Create CallLog record
    - Update Call status to 'completed'
    ↓
[Audit Log] → Record CDR receipt
    ↓
[Socket.IO Emit] → call:ended to connected agents
    ↓
Response: { success: true }
```

## Deployment Architecture

### Development

```
npm install          # Install monorepo dependencies
npm run dev          # Start backend on :4000 + frontend on :3000
npm run db:migrate   # Run Prisma migrations
npm run test         # Run Vitest suite (49 tests)
```

### Production (Phase 09 Complete)

**Docker Compose Services**: backend (Node 18 Alpine, PM2 fork mode), frontend (nginx), PostgreSQL (13+), Redis, Nginx reverse proxy (SSL/TLS ready, gzip, rate limiting)

#### Docker File Structure
- **Backend Dockerfile**: Multi-stage, production optimized
  - Stage 1: Build with dependencies
  - Stage 2: Runtime with minimal image size

- **Frontend Dockerfile**: Multi-stage build
  - Stage 1: Vite build process
  - Stage 2: Nginx serving built assets

- **docker-compose.prod.yml**: Production orchestration with volumes, networking, resource limits

#### PM2 Fork Mode Configuration
- **Fork mode**: Spawns independent processes (not cluster mode)
- **Multi-process**: Automatically uses all available CPU cores
- **Auto-restart**: Restarts crashed processes
- **Log rotation**: Managed by PM2 with size/date-based rotation
- **Monitoring**: PM2 CLI for process health, memory, CPU tracking
- **Config file**: `ecosystem.config.js` in root

#### Nginx Reverse Proxy (nginx.conf)
```
Upstream:
├── api: backend service on :4000
└── static: frontend service on :3000

Routes:
├── /api/* → backend (WebSocket upgrade support)
├── /socket.io/* → backend (Socket.IO)
├── / → static frontend assets
```

Features:
- SSL/TLS termination (ready for certificates)
- Gzip compression (enabled)
- Cache headers for static assets (1 year for hashed files)
- Security headers (X-Frame-Options, X-Content-Type-Options)
- Rate limiting at gateway (optional)

#### Deployment Checklist
- [x] Docker images build successfully
- [x] docker-compose.prod.yml tested locally
- [x] Nginx configuration validated
- [x] PM2 fork mode working
- [x] Environment variables documented
- [x] PostgreSQL migrations tested
- [x] Redis connectivity verified
- [x] SSL/TLS ready (certificates placeholder)

#### Performance (Validated)
- API response: <200ms (p95)
- Call initiation: <2s via ESL
- Dashboard load: <2s
- Concurrent users: 500+

## Security Considerations

### Authentication
- JWT tokens (HS256 signature)
- Refresh token rotation (httpOnly cookies)
- Token expiration: Access (15m), Refresh (7d)

### Authorization
- Role-based access control (RBAC)
- Data scoping by team/user (middleware-level)
- Audit logging (userId, action, resource, timestamp)

### Network
- Helmet.js (security headers)
- CORS with configurable origin
- Rate limiting (global + per-endpoint)
- Rate limit stored in Redis

### Data Protection
- Bcryptjs for password hashing
- HTTPS in production (Helmet enforces secure cookies)
- Input validation via Zod (type safety + sanitization)

## Monitoring & Logging

- **Winston Logger**: Structured logging (info, warn, error)
- **Morgan**: HTTP request logging (short format)
- **Audit Logs**: User actions tracked in database
- **Error Tracking**: Unhandled errors logged with full stack (dev only)

## Performance Considerations

- **Pagination**: Default 20 items/page with offset-based cursor
- **Select Optimization**: Controllers specify only required fields
- **Indexing**: Composite indexes on (teamId, createdAt), (assignedTo, status)
- **Caching**: Redis for rate limiting; Session caching via Socket.IO
- **Compression**: gzip enabled for all responses

## Testing & Quality Assurance

### Test Coverage
- **Vitest Framework**: 49 unit + integration tests
- **Services**: Auth, Contact, Lead, DebtCase, Call, Ticket, Dashboard
- **Controllers**: HTTP request handling and validation
- **Middleware**: Auth, RBAC, data scoping, error handling
- **Endpoints**: 55+ API endpoints with response validation

### Test Categories
- **Unit Tests**: Service functions, utility functions, validation
- **Integration Tests**: API endpoint flows, database operations
- **Data Scoping**: RBAC enforcement and data isolation
- **Error Handling**: Edge cases and error responses

### MCP Server Integration

**Claude MCP Server** (`packages/mcp-server/`):
- 8 Claude integration tools for VoIP management
- Extension querying and management
- Call log retrieval and analytics
- Permission and user management
- Real-time system status monitoring
- Secure JWT authentication for API calls

---

**Last Updated**: 2026-04-01
**Version**: 1.2.1-release (Reports Page Redesign Complete)
**Status**: Phase 16 Complete, Deployed to 10.10.101.207
**Previous Version**: 1.2.0-release (Phase 15 Gap Analysis)
