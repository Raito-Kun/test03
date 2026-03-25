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

**Page Structure** (14 pages):
- Auth: login, register, forgot-password
- Dashboard: overview with KPIs
- Contacts: list, detail, create/edit
- Leads: list, detail, create/edit
- DebtCases: list, detail
- CallLogs: list, detail
- Campaigns: list, detail
- Tickets: list, detail, create/edit
- Reports: analytics dashboards
- Settings: user and team config

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
| **admin** | Full system access | All data |
| **manager** | Department oversight | All team data |
| **qa** | Quality assurance | All data (audit only) |
| **leader** | Team management | Team members' data |
| **agent_telesale** | Sales operations | Own assigned records |
| **agent_collection** | Collection operations | Own assigned records |

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

```
Frontend (UI)
    ↓
Socket.IO (real-time events)
    ↓
Backend (Node.js)
    ↓
ESL Daemon (modesl library) ←→ FreeSWITCH (PBX)
    ↓
CDR Webhook ← Call Detail Records (XML)
    ↓
Call Log Service → PostgreSQL
```

### Components

#### ESL Daemon (`lib/esl-daemon.ts`)
- Maintains persistent connection to FreeSWITCH ESL port (8021)
- Listens for ESL events (call state changes, agent status)
- Auto-reconnects on connection loss
- Non-blocking initialization (doesn't block server startup)
- Emits events to Socket.IO for real-time UI updates

#### Call Controller & Service
- `POST /api/v1/calls/initiate` → Create outbound call
- `POST /api/v1/calls/:id/transfer` → Blind/attended transfer
- `POST /api/v1/calls/:id/end` → Disconnect call
- `GET /api/v1/calls` → List active calls with data scoping

#### CDR Webhook (`webhook-controller.ts`)
- `POST /api/v1/webhooks/cdr` → Receives XML call detail records
- Parses FreeSWITCH XML → Extracts call metadata
- Creates CallLog record in PostgreSQL
- Triggers call-ended events to Socket.IO

#### Recording Service (`recording-service.ts`)
- Monitors S3/local storage for call recordings
- Tracks recording status (available, failed, none)
- Provides download/playback endpoints

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
- `agent:status_changed` - Agent availability
- `ticket:updated` - Ticket status change
- `notification:new` - New notification
- `contact:assigned` - Contact reassignment

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
| Contact | Customer/prospect contact information |
| Lead | Sales lead tracking with status pipeline |
| DebtCase | Debt collection cases with aging tiers |
| Campaign | Outbound/inbound call campaigns |
| Call | Active call tracking (linked to ESL) |
| CallLog | Historical call records (CDR data) |
| Ticket | Support tickets with lifecycle tracking |
| Macro | Pre-configured message templates |
| Notification | User notifications (in-app + email) |
| Dashboard | User dashboard widget configurations |

### Key Relationships

- User → Team (many-to-one)
- Contact → AssignedUser (many-to-one)
- Lead → Contact, Campaign, AssignedUser
- Call → Contact, CallLog, AssignedUser
- Ticket → Contact, AssignedUser, Category

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
```

### Production (Planned - Phase 09)

```
Docker Compose
├── PostgreSQL (db service)
├── Redis (cache/queue)
├── Node.js API (backend on :4000)
├── Nginx (reverse proxy + static frontend)
└── FreeSWITCH (external PBX connection)
```

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

---

**Last Updated**: 2026-03-25
**Version**: 1.0.1-alpha
