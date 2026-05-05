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

**Page Structure** (14+ pages, 2026-04-21):
- Auth: login, register, forgot-password
- Dashboard: overview with KPIs
- Contacts: list, detail, create/edit
- Leads: list, detail, create/edit
- DebtCases: list, detail
- CallLogs: list, detail
- Campaigns: list, detail
- Tickets: kanban board with 4-column drag-drop (open, in_progress, resolved, closed); detail dialog with waveform + click-to-call; resolved status requires resultCode; delete admin/super_admin only
- Reports: 3-tab analytics (summary, detail, charts) with shared filters
- Settings: user and team config

**Sidebar Navigation** (Phase 17+): 5 groups (Giám sát, CRM, Chiến dịch, Tổng đài, Hỗ trợ) with Vietnamese labels. Details in codebase-summary.md

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

### Permission System (Phase 10+, v1.3.10 deduped)

**Permission Table**: Dynamic RBAC permissions stored in database with parent-child hierarchy
- **ID**: UUID primary key
- **Key**: Unique permission identifier using `resource.action` format (e.g., "switchboard.make_call", "crm.contacts.delete")
- **Label**: User-friendly Vietnamese label
- **Group**: UI grouping category (7 groups: switchboard, crm, campaign, report, ticket, qa, system)
- **ParentId**: Optional FK for parent permission (enables cascading enable/disable in matrix UI)

**RolePermission Table**: Many-to-many mapping roles to permissions
- **Role**: Enum value (super_admin, admin, manager, leader, qa, agent_telesale, agent_collection)
- **PermissionId**: Foreign key to Permission table
- **Granted**: Boolean flag for permission grant/revoke

**40+ Permissions Organized in 7 Groups** (v1.3.10):
1. **Switchboard** (Tổng đài): switchboard.manage, .make_call, .receive_call, .transfer_call, .hold_call, .listen_recording, .download_recording; recording.delete (new)
2. **CRM**: crm.manage, .contacts.view, .contacts.create, .contacts.edit, .contacts.delete, .contacts.import, .contacts.export, .leads.view, .leads.create, .leads.edit, .leads.delete, .leads.import, .debt.view, .debt.edit, .data_allocation
3. **Campaign** (Chiến dịch): campaign.manage, .create, .edit, .delete, .assign, .import
4. **Report** (Báo cáo): report.manage, .view_own, .view_team, .view_all, .export
5. **Ticket** (Phiếu ghi): ticket.manage, .create, .edit, .delete (middleware-enforced), .assign
6. **QA**: qa.manage, .score, .review, .annotate
7. **System** (Hệ thống): system.manage, .users, .roles, .permissions, .settings, .audit_log

**Enforcement**:
- `ticket.delete` — middleware applied to DELETE /api/tickets/:id (default: super_admin, admin)
- `crm.contacts.delete` — middleware applied to DELETE /contacts/:id + POST /contacts/bulk-delete
- `recording.delete` — middleware applied to new DELETE /api/call-logs/:id/recording (default: admin only; super_admin opt-in per cluster)

**super_admin Behavior**: Auto-passes every permission EXCEPT keys listed in `SUPER_ADMIN_OPT_IN_PERMISSIONS` (currently `recording.delete`). For opt-in keys, super_admin must hold an explicit `role_permissions` grant per cluster; the matrix UI exposes a toggle. See `packages/backend/src/lib/permission-constants.ts`.

**Single Source of Truth**: `packages/backend/prisma/seed.ts` lines 130-193

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
- `POST /api/v1/contacts/merge` → Merge duplicate contacts (field conflict resolution)
- `POST /api/v1/leads/import-csv` → Bulk import leads from CSV

#### Permission Hierarchy Data Model (Phase 17+)
- PermissionGroup: id, key, label, parentId (self-ref), order
- Permission: id, key, label, groupId (FK)
- RolePermission: role, permissionId (FK), granted
- Parent-child toggle rules: parent OFF → all children OFF; parent ON → all children ON
- super_admin: all permissions hardcoded ON, switches disabled

#### Extension Sync Flow (Phase 18+)

Cluster configuration includes SSH credentials (sshUser, sshPassword) for reaching the FusionPBX host. Sync is triggered via `POST /api/v1/clusters/:id/sync-extensions`.

```
Admin triggers "Sync Extensions" in Cluster Management UI
    ↓
POST /api/v1/clusters/:id/sync-extensions
    ↓
extension-sync-service.syncExtensions(clusterId, sshHost, sshPassword, sipDomain)
    ↓
SSH Client (ssh2) connects to PBX host
    ↓
Executes: sudo -u postgres psql -d fusionpbx -c "SELECT extension, password, ... FROM v_extensions"
    ↓
Parses rows → ExtensionRow[] { extension, password, callerName, accountcode }
    ↓
Upserts rows into ClusterExtension table (unique: clusterId + extension)
    ↓
Returns { synced: N } to UI with success toast
```

**Cluster Routes** (`/api/v1/clusters`):
- `GET /` → List all clusters
- `GET /active` → Get active cluster config (used by ESL daemon on startup)
- `POST /` → Create cluster (auto-activates if first cluster)
- `POST /ssh-discover` → Network scan to discover PBX hosts
- `POST /test-connection-direct` → Test ESL without saved cluster
- `GET /:id` → Get cluster detail (secrets masked)
- `PUT /:id` → Update cluster settings
- `DELETE /:id` → Delete cluster
- `POST /:id/switch` → Set as active cluster and reload ESL daemon
- `POST /:id/test-connection` → Test ESL connection to saved cluster
- `POST /:id/sync-extensions` → SSH into PBX, fetch extensions, upsert to DB
- `GET /:id/extensions` → List synced extensions for cluster

#### Multi-Tenant Data Isolation (Phase 18+)

Every major entity table carries an optional `cluster_id` foreign key referencing `PbxCluster`. Records are scoped to the active cluster at time of creation, ensuring data isolation in multi-cluster deployments.

**Tables with cluster_id**:
- Contact, Lead, DebtCase, CallLog, Campaign, Ticket, User

**Isolation Rules**:
- When active cluster changes (switch), service layer filters by new clusterId
- Within a cluster, DataScope middleware still applies role-based filtering
- Super admin can query across clusters (no cluster filter applied)
- ClusterExtension table is cluster-specific by design (onDelete: Cascade)

#### Feature Toggle System (Phase 19+)

Dynamic feature control at cluster and domain level with middleware enforcement.

**Database Model** (`ClusterFeatureFlag`):
```
cluster_id        UUID (FK → PbxCluster)
domain_name       String (optional, '' for cluster-level)
feature_key       String (enum of 20+ feature keys)
is_enabled        Boolean
updated_by        UUID (FK → User)
updated_at        DateTime
Unique: (cluster_id, domain_name, feature_key)
```

**Feature Keys** (20+ total):
- CRM: `contacts`, `leads`, `debt`, `campaigns`
- VoIP: `tickets`, `voip_c2c`, `recording`, `cdr_webhook`
- Monitoring: `live_monitoring`, `call_history`
- Reports: `reports_summary`, `reports_detail`, `reports_chart`, `reports_export`
- AI: `ai_assistant`, `ai_qa`
- Admin: `team_management`, `permission_matrix`, `pbx_cluster_mgmt`

**API Endpoints** (Feature Flag Controller):
- `GET /api/v1/feature-flags?clusterId=` — List all flags for cluster (super_admin only)
- `PUT /api/v1/feature-flags` — Bulk update flags (super_admin only)
- `GET /api/v1/feature-flags/effective` — Get effective flags for current user's cluster (all auth users)

**Middleware Integration** (`checkFeatureEnabled(featureKey)`):
- Applied to routes: contacts, leads, debt-cases, campaigns, tickets, calls, call-logs, monitoring, reports, ai, teams, permissions, export
- Returns 403 with message when feature disabled
- Skips check for super_admin users

**Hierarchy**:
- Cluster-level flag (domainName="") acts as master override
- If cluster disables a feature, all domains in cluster cannot use it
- Domain-level flags (domainName specified) allow per-domain customization
- Lookup order: check domain-specific flag first, fallback to cluster-level

**Frontend Integration** (`useFeatureFlags` hook):
- Fetches effective flags on app initialization
- `FeatureGuard` component wraps routes, shows friendly message if disabled
- Sidebar hides menu items for disabled features
- `useFeatureFlags()` hook provides flag state in components

#### Auto-Create Accounts on Cluster Creation (Phase 18+)

When a new `PbxCluster` is saved and synced for the first time, the system auto-creates CRM user accounts for any extensions found in FusionPBX that do not already have a matching account.

**Flow**:
```
POST /:id/sync-extensions completes → N extensions synced
    ↓
For each ExtensionRow where accountcode matches no existing User.extension:
  Create User { username: extension, role: agent_telesale, clusterId }
    ↓
Returns { synced: N, accountsCreated: M }
```

#### Account Management Module (Phase 18+)

Settings page includes an Account Management tab for admins to view, create, and assign extensions to CRM users.

**Frontend**: `packages/frontend/src/pages/settings/cluster-management.tsx` — cluster list + detail form with extension list tab
**Backend endpoints** (cluster-scoped):
- `GET /api/v1/clusters/:id/extensions` → List ClusterExtension rows with assigned User info
- `POST /api/v1/clusters/:id/sync-extensions` → Sync extensions from FusionPBX via SSH

#### Data Scope Middleware Flow (Phase 17+)
- Agents (agent_telesale, agent_collection) → req.dataScope = { type: 'own', userId }
- Leaders → req.dataScope = { type: 'team', teamId }
- Manager/admin/qa/super_admin → req.dataScope = { type: 'all' }
- buildScopeWhere(): 'own' → filter by userId, 'team' → filter by teamId, 'all' → no filter
- Prisma applies WHERE clause based on scope

#### Data Allocation Flow (Phase 17+)
- Leader/Manager selects records, clicks "Phân bổ" button
- DataAllocationDialog fetches team members and shows agent dropdown
- POST /api/v1/{entity}/allocate with { ids[], agentId }
- Backend validates permission, updates assignedTo for all records
- Frontend refreshes table, allocated agent now sees records
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

## Key Data Flow Patterns

**Contact Creation**: JWT auth → RBAC check → dataScope build → Zod validation → create with audit log

**Call Initiation**: JWT auth → validate input → create Call record → ESL originate → Socket.IO emit

**CDR Webhook**: Parse XML → extract CDR data → create CallLog → update Call status → Socket.IO emit

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

#### Docker & Orchestration
- **Backend**: Multi-stage Dockerfile (Node 18 Alpine, PM2 fork mode)
- **Frontend**: Multi-stage build (Vite → nginx)
- **docker-compose.prod.yml**: Full stack orchestration with volumes, networking, limits
- **Nginx**: Reverse proxy with SSL/TLS, gzip, cache headers, rate limiting
- **PM2**: Fork mode with auto-restart, log rotation, process monitoring

#### Deployment Validation
Docker images, Nginx config, PM2 mode, PostgreSQL migrations, Redis connectivity, and SSL/TLS verified. Performance: API <200ms (p95), call initiation <2s, dashboard <2s, 500+ concurrent users.

## Security Considerations

**Authentication**: JWT (HS256) with refresh tokens (15m access, 7d refresh)
**Authorization**: RBAC with data scoping by team/user, audit logging
**Network**: Helmet.js headers, CORS, rate limiting (Redis)
**Data Protection**: Bcryptjs hashing, HTTPS production, Zod validation

## Monitoring & Logging

Winston structured logging, Morgan HTTP logging, database audit logs, and error tracking (dev only).

## Performance Considerations

Pagination (20/page), optimized SELECT, composite indexes, Redis caching, gzip compression.

## Testing & Quality Assurance

**Vitest Framework**: 49 unit + integration tests covering services, controllers, middleware, endpoints, RBAC/data scoping, and error handling. See codebase-summary.md for detailed test organization and coverage areas.

---

**Last Updated**: 2026-04-17
**Version**: 1.3.5-release (Call History Timing & Recording Fix)
**Status**: Phase 20 Complete, Deployed to 10.10.101.207
**Previous Version**: 1.3.3-release (Feature Toggle System)
