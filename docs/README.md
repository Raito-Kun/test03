# CRM Omnichannel Documentation

Welcome to the CRM Omnichannel project documentation. This directory contains comprehensive guides for developers, architects, and team members.

## Documentation Overview

### [System Architecture](./system-architecture.md)
Comprehensive technical documentation covering:
- Monorepo structure and organization
- Technology stack and dependencies
- Backend architecture (Route → Controller → Service → Prisma pattern)
- Middleware chain (Auth, RBAC, Data Scoping, Error Handling)
- **Frontend architecture** (pages, components, state management, API integration)
- VoIP integration with ESL daemon and FreeSWITCH
- Real-time communication via Socket.IO
- Database schema overview
- Data flow diagrams (ASCII)
- Deployment considerations

**Best for**: System architects, new team members, infrastructure planning

---

### [Code Standards](./code-standards.md)
Coding conventions and best practices including:
- File naming (kebab-case) and organization
- File size guidelines (keep under 200 lines)
- Core pattern: Route → Controller → Service → Prisma
- Validation using Zod at controller boundaries
- Error handling conventions (custom error codes, error handler)
- RBAC and data scoping patterns
- TypeScript practices
- Testing patterns (unit, integration)
- Audit logging patterns
- Security best practices
- Environment variables
- Frontend conventions (Phase 08+)

**Best for**: Developers implementing features, code reviews, onboarding

---

### [Development Roadmap](./development-roadmap.md)
Project status and planning including:
- Phase breakdown (01-09)
- Current progress (Phase 09 in progress)
- Completed deliverables by phase (~55 API endpoints + 14 frontend pages)
- Success criteria and metrics
- Milestones and timelines
- Key metrics and endpoint count
- Risk assessment
- Next steps and long-term plans

**Best for**: Project managers, team leads, progress tracking

---

### [Project Changelog](./project-changelog.md)
Complete record of all significant changes including:
- Feature releases by phase
- Bug fixes and improvements
- Version history
- Technical milestones
- Dependencies and external services
- Known issues and resolutions

**Best for**: Tracking project evolution, release notes, debugging history

---

## Quick Start

### For New Developers
1. Read [System Architecture](./system-architecture.md) → Understand the overall design
2. Read [Code Standards](./code-standards.md) → Learn the patterns you'll use every day
3. Explore `packages/backend/src` → See real examples of the patterns
4. Pick a small endpoint and modify it → Get hands-on experience

### For DevOps/Infrastructure
1. Read [System Architecture](./system-architecture.md) → Deployment Architecture section
2. Review environment variables section in [Code Standards](./code-standards.md)
3. Check Docker configuration (Phase 09)

### For Project Managers
1. Read [Development Roadmap](./development-roadmap.md) → Current status and milestones
2. Review metrics section for progress tracking
3. Check risk assessment and dependencies

---

## Key Concepts

### Route → Controller → Service → Prisma Pattern

This is the architectural foundation for all features:

```
HTTP Request
    ↓
Route (applies middleware: auth, RBAC, data scope)
    ↓
Controller (validates input, calls service, formats response)
    ↓
Service (business logic, database queries)
    ↓
Prisma (ORM, database operations)
    ↓
HTTP Response
```

Example:
- **Route**: `POST /api/v1/contacts` with `requireRole('admin', 'manager')`
- **Controller**: Validates input with Zod, calls `contactService.create()`
- **Service**: Applies data scoping, creates record in database
- **Prisma**: Executes SQL via ORM

### Middleware Chain

All routes pass through this middleware stack in order:

1. **Auth**: Verify JWT token → attach `req.user`
2. **RBAC**: Check user role against allowed roles
3. **Data Scope**: Build WHERE clause for data filtering based on role/team
4. **Route Handler**: Business logic

Result: Agents can only see their own records, leaders see their teams' records, admins see all data.

### Error Handling

Services throw errors with a `code` property:

```typescript
const error = new Error('Contact not found');
error.code = 'NOT_FOUND';
throw error;
```

Controllers catch known errors and respond:

```typescript
catch (err: unknown) {
  const error = err as Error & { code?: string };
  if (error.code === 'NOT_FOUND') {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', ... } });
    return;
  }
  next(err); // Unknown → 500
}
```

---

## Project Structure

```
C:\Users\Raito\OneDrive\TRAINNING\VIBE CODING\02.CRM\
├── docs/                          # Documentation (this directory)
│   ├── README.md                  # This file
│   ├── system-architecture.md     # Technical architecture
│   ├── code-standards.md          # Coding conventions
│   ├── development-roadmap.md     # Project status & phases
│   └── project-changelog.md       # Change history & releases
│
├── packages/
│   ├── backend/                   # Express.js API server
│   │   ├── src/
│   │   │   ├── controllers/       # HTTP handlers
│   │   │   ├── services/          # Business logic
│   │   │   ├── routes/            # Route definitions
│   │   │   ├── middleware/        # Express middleware
│   │   │   ├── jobs/              # Background tasks
│   │   │   ├── lib/               # Utilities
│   │   │   └── index.ts           # App setup
│   │   └── prisma/                # Database config
│   │       └── schema.prisma      # Data models
│   │
│   ├── frontend/                  # React + Vite UI
│   │   └── src/
│   │       ├── components/        # React components
│   │       ├── pages/             # Page components
│   │       ├── hooks/             # Custom React hooks
│   │       └── lib/               # Utilities
│   │
│   └── shared/                    # Shared types & validation
│       └── src/
│           ├── types/             # TypeScript interfaces
│           ├── validation/        # Zod schemas
│           └── constants/         # Shared constants
│
├── plans/                         # Planning documents & reports
└── .claude/                       # Claude agent configuration
```

---

## Technology Stack Summary

| Area | Stack |
|------|-------|
| **Backend** | Express.js + TypeScript |
| **Database** | PostgreSQL + Prisma ORM |
| **Real-time** | Socket.IO |
| **VoIP** | modesl (ESL) + FreeSWITCH |
| **Caching** | Redis (ioredis) |
| **Auth** | JWT (jsonwebtoken) |
| **Validation** | Zod |
| **Frontend** | React + Vite + TypeScript |
| **Styling** | Tailwind CSS + shadcn/ui |
| **State** | Zustand |
| **Data Fetching** | Axios + TanStack Query |

---

## Development Phases

| Phase | Status | Endpoints | Focus |
|-------|--------|-----------|-------|
| 01 | ✓ Complete | N/A | Project setup & infrastructure |
| 02 | ✓ Complete | 19 | Auth & core CRUD |
| 03 | ✓ Complete | 9 | CRM features & relationships |
| 04 | ✓ Complete | 8 | VoIP integration |
| 05 | ✓ Complete | 8 | Call history & QA |
| 06 | ✓ Complete | 10 | Support ticketing |
| 07 | ✓ Complete | 5 | Dashboard & analytics |
| 08 | ✓ Complete | N/A | Frontend UI (14 pages) |
| 09 | IN PROGRESS | N/A | Testing & production hardening |

**Total Implemented**: 55+ API endpoints + 14 frontend pages

---

## Common Tasks

### Adding a New Feature

1. **Plan**: Read [Development Roadmap](./development-roadmap.md)
2. **Code**: Follow patterns in [Code Standards](./code-standards.md)
3. **Validate**: Use Zod at controller boundaries
4. **Scope**: Apply data scope middleware
5. **Handle Errors**: Throw errors with `code` property
6. **Test**: Write unit tests for service layer
7. **Document**: Update this README with endpoint details

### Creating a New Endpoint

Example: `POST /api/v1/contacts`

1. **Define Route** (`routes/contact-routes.ts`):
   ```typescript
   router.post('/', authMiddleware, requireRole('admin', 'manager'), contactCtrl.createContact);
   ```

2. **Add Controller** (`controllers/contact-controller.ts`):
   ```typescript
   export async function createContact(req: Request, res: Response, next: NextFunction) {
     try {
       const input = createContactSchema.parse(req.body);
       const contact = await contactService.create(input, req.user.userId, req);
       res.json({ success: true, data: contact });
     } catch (err) {
       next(err);
     }
   }
   ```

3. **Add Service** (`services/contact-service.ts`):
   ```typescript
   export async function create(input: CreateContactInput, userId: string, req?: Request) {
     const contact = await prisma.contact.create({
       data: { ...input, createdBy: userId },
       select: contactSelect,
     });
     logAudit(userId, 'create', 'contacts', contact.id, { new: input }, req);
     return contact;
   }
   ```

4. **Add Validation** (`shared/validation/contact-schemas.ts`):
   ```typescript
   export const createContactSchema = z.object({
     fullName: z.string().min(1).max(255),
     phone: z.string().regex(/^\d{10,15}$/),
     // ... other fields
   });
   ```

5. **Test**: Write tests for the service and controller

---

## API Response Format

All endpoints return consistent responses:

**Success** (200):
```json
{
  "success": true,
  "data": { "id": "...", "name": "..." }
}
```

**Paginated Success** (200):
```json
{
  "success": true,
  "data": [ { ... }, ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "hasMore": true
  }
}
```

**Error** (4xx/5xx):
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human description",
    "details": [ { "field": "name", "message": "..." } ]
  }
}
```

---

## Environment Variables

Backend requires these in `.env`:

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/crm_db

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key

# Frontend
FRONTEND_URL=http://localhost:3000

# VoIP (FreeSWITCH)
ESL_HOST=localhost
ESL_PORT=8021
ESL_PASSWORD=ClueCon

# Server
NODE_ENV=development
PORT=4000
```

---

## Getting Help

### Found a Bug?
1. Check [Development Roadmap](./development-roadmap.md) for known issues
2. Review error codes in [Code Standards](./code-standards.md)
3. Check real implementations in `packages/backend/src`

### Want to Extend?
1. Read the relevant section in [Code Standards](./code-standards.md)
2. Look at similar endpoints for patterns
3. Follow the Route → Controller → Service → Prisma pattern

### Questions on Architecture?
1. Check [System Architecture](./system-architecture.md)
2. Look for data flow diagrams (ASCII)
3. Review the middleware chain section

---

## Contributing

When contributing:
1. Follow patterns from [Code Standards](./code-standards.md)
2. Keep files under 200 lines
3. Use kebab-case filenames
4. Write descriptive commit messages
5. Test your changes before committing
6. Update documentation if behavior changes

---

## Current Status

**Phase**: 09 (Testing & Production Hardening) - IN PROGRESS
**Last Updated**: 2026-03-25
**Backend Endpoints**: 55+ implemented and tested
**Frontend Pages**: 14 implemented and connected to API
**Next Milestone**: Phase 09 completion (2026-04-15)

---

## Links to Main Docs

- [System Architecture →](./system-architecture.md)
- [Code Standards →](./code-standards.md)
- [Development Roadmap →](./development-roadmap.md)
- [Project Changelog →](./project-changelog.md)

---

**Version**: 1.0.1-alpha
**Maintained By**: Development Team
**Last Reviewed**: 2026-03-25
