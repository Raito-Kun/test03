# Code Standards

This document defines coding conventions, patterns, and best practices for the CRM Omnichannel project.

## File Organization

### Backend File Structure

```
src/
├── controllers/      # HTTP handlers
├── services/         # Business logic
├── routes/           # Route definitions
├── middleware/       # Express middleware
├── jobs/             # Background tasks
├── lib/              # Utilities and libraries
├── prisma/           # Database configuration
└── index.ts          # Express app setup
```

### File Naming

- **kebab-case** for all `.ts` files
- **Descriptive names** that indicate purpose without reading content
- Examples:
  - `auth-controller.ts` → HTTP handlers for auth
  - `contact-service.ts` → Business logic for contacts
  - `rbac-middleware.ts` → Role-based access control

### File Size

- **Keep under 200 lines** per file for optimal readability
- Split large files into focused modules
- Use composition and helper functions to reduce duplication

## Code Patterns

### Route → Controller → Service → Prisma

All features follow this strict layering:

```typescript
// routes/contact-routes.ts
router.post('/', authMiddleware, requireRole('admin', 'manager'), contactCtrl.createContact);

// controllers/contact-controller.ts
export async function createContact(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createContactSchema.parse(req.body);
    const contact = await contactService.create(input, req.user.userId, req);

    res.json({ success: true, data: contact });
  } catch (err) {
    next(err);
  }
}

// services/contact-service.ts
export async function create(input: CreateContactInput, userId: string, req?: Request) {
  const contact = await prisma.contact.create({
    data: { ...input, createdBy: userId },
    select: contactSelect,
  });

  logAudit(userId, 'create', 'contacts', contact.id, { new: input }, req);
  return contact;
}
```

### Responsibilities

| Layer | Responsibility |
|-------|-----------------|
| **Routes** | Define endpoints, apply middleware |
| **Controllers** | Parse/validate input, call services, format responses |
| **Services** | Business logic, database queries, cross-cutting concerns |
| **Prisma** | ORM queries, database operations |

### Controllers: Request → Validation → Service

```typescript
// Pattern: validate → call service → handle errors → respond

export async function updateLead(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const input = updateLeadSchema.parse(req.body);

    const lead = await leadService.update(id, input, req.user.userId, req);

    res.json({ success: true, data: lead });
  } catch (err: unknown) {
    const error = err as Error & { code?: string };

    // Known errors: handle with specific status codes
    if (error.code === 'NOT_FOUND') {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Lead not found' },
      });
      return;
    }

    // Unknown/unexpected errors: delegate to error handler
    next(err);
  }
}
```

### Services: Data Operations + Data Scoping

```typescript
// Pattern: build WHERE clause → execute query → return selected fields

import { buildScopeWhere } from '../middleware/data-scope-middleware';

export async function list(pagination: PaginationParams, filters: any, dataScope: Record<string, unknown>) {
  const scopeWhere = buildScopeWhere(dataScope, 'assignedTo');
  const where = { ...scopeWhere, ...filters };

  const [items, total] = await Promise.all([
    prisma.contact.findMany({ where, select: contactSelect, skip: pagination.skip, take: pagination.limit }),
    prisma.contact.count({ where }),
  ]);

  return paginatedResponse(items, total, pagination.page, pagination.limit);
}

export async function create(input: any, userId: string, req?: Request) {
  const item = await prisma.contact.create({
    data: { ...input, createdBy: userId },
    select: contactSelect,
  });

  logAudit(userId, 'create', 'contacts', item.id, { new: input }, req);
  return item;
}
```

## Validation

### Zod at Controller Boundaries

All input validation happens in controllers using Zod schemas from `@crm/shared`:

```typescript
// shared/validation/contact-schemas.ts
import { z } from 'zod';

export const createContactSchema = z.object({
  fullName: z.string().min(1).max(255),
  phone: z.string().regex(/^\d{10,15}$/),
  email: z.string().email().optional(),
  assignedTo: z.string().uuid().optional(),
});

// backend/controllers/contact-controller.ts
export async function createContact(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createContactSchema.parse(req.body);
    // ... rest of handler
  } catch (err) {
    next(err); // Error handler converts ZodError → 400
  }
}
```

### Error Responses

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email address"
      }
    ]
  }
}
```

## Authentication & Authorization

### Middleware Chain Order

```typescript
// Routes must apply middlewares in this order:
router.use(authMiddleware);              // 1. Verify JWT, attach req.user
router.use(requireRole(...));            // 2. Check user role
router.use(applyDataScope('assignedTo')); // 3. Build data filtering

router.get('/', controllerHandler);      // 4. Business logic
```

### RBAC: Role-Based Access Control

```typescript
// Restrict route to specific roles
router.post('/users', requireRole('admin', 'manager'), createUserHandler);

// Check role in multiple routes
const adminOnly = [requireRole('admin')];
const managerPlus = [requireRole('admin', 'manager')];

router.delete('/:id', ...adminOnly, deleteUserHandler);
router.patch('/:id', ...managerPlus, updateUserHandler);
```

### Data Scoping: Automatic Row-Level Filtering

```typescript
// Middleware automatically builds WHERE conditions:

// admin/manager/qa: req.dataScope = {} (no filter)
// leader: req.dataScope = { _teamScope: teamId }
// agent: req.dataScope = { assignedTo: userId }

// Service layer applies filtering:
const scopeWhere = buildScopeWhere(dataScope, 'assignedTo');
const results = await prisma.contact.findMany({ where: { ...scopeWhere, ... } });

// Result: Agents only see their own records; leaders see their team's records
```

## Error Handling

### Throwing Custom Errors

Services throw errors with a `code` property for controller recognition:

```typescript
export async function getContact(id: string, dataScope: Record<string, unknown>) {
  const contact = await prisma.contact.findUnique({
    where: { id },
    select: contactSelect,
  });

  if (!contact) {
    const err = new Error('Contact not found');
    (err as any).code = 'NOT_FOUND';
    throw err;
  }

  return contact;
}
```

### Controller Error Handling

Controllers catch known errors and respond appropriately:

```typescript
export async function getContact(req: Request, res: Response, next: NextFunction) {
  try {
    const contact = await contactService.get(req.params.id, req.dataScope);
    res.json({ success: true, data: contact });
  } catch (err: unknown) {
    const error = err as Error & { code?: string };

    if (error.code === 'NOT_FOUND') {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Contact not found' },
      });
      return;
    }

    next(err); // Unknown errors → error handler → 500
  }
}
```

### Error Handler: Global Safety Net

The global error handler catches unexpected exceptions:

```typescript
// middleware/error-handler.ts
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ZodError) {
    // Validation → 400
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', ... } });
  }

  logger.error('Unhandled error', { error: err.message, stack: err.stack });

  // Unknown → 500 (no stack in production)
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: isProd ? 'Internal server error' : err.message },
  });
}
```

## Response Format

All API responses follow a consistent structure:

```typescript
// Success response
{
  "success": true,
  "data": { id, name, ... }
}

// Paginated success
{
  "success": true,
  "data": [ { id, name, ... }, ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "hasMore": true
  }
}

// Error response
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": [ ... ] // For validation errors only
  }
}
```

## TypeScript

### Type Declarations

- Use explicit return types for all functions
- Declare interface for function inputs
- Use `unknown` for untyped errors, cast as needed

```typescript
// Good: explicit types
export async function create(
  input: CreateContactInput,
  userId: string,
  req?: Request
): Promise<Contact> {
  const contact = await prisma.contact.create({ data: input, select: contactSelect });
  return contact;
}

// Avoid: implicit types
export async function create(input, userId, req) { ... }
```

### Extend Express Types

```typescript
// Declare global Express Request additions
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      dataScope?: Record<string, unknown>;
    }
  }
}
```

## Testing Patterns

### Service Unit Tests

Test business logic in isolation:

```typescript
// Test data scoping, filtering, error conditions
describe('contactService.list', () => {
  it('should filter by assignedTo when user is agent', async () => {
    const dataScope = { assignedTo: 'agent-123' };
    const result = await contactService.list({ page: 1, limit: 20 }, {}, dataScope);

    expect(result.data).toHaveLength(2); // Only agent's contacts
  });

  it('should return all contacts when user is admin', async () => {
    const dataScope = {}; // Admin has no filter
    const result = await contactService.list({ page: 1, limit: 20 }, {}, dataScope);

    expect(result.data.length).toBeGreaterThan(2);
  });
});
```

### Integration Tests

Test controller → service → database flow:

```typescript
describe('POST /api/v1/contacts', () => {
  it('should create contact with auth + RBAC + data scoping', async () => {
    const response = await request(app)
      .post('/api/v1/contacts')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ fullName: 'John Doe', phone: '1234567890' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ success: true, data: { id: expect.any(String), ... } });
  });
});
```

## Audit Logging

### Pattern

Every create/update/delete operation logs an audit record:

```typescript
// services/contact-service.ts
export async function create(input: CreateContactInput, userId: string, req?: Request) {
  const contact = await prisma.contact.create({
    data: { ...input, createdBy: userId },
    select: contactSelect,
  });

  // Log the action
  logAudit(userId, 'create', 'contacts', contact.id, { new: input }, req);

  return contact;
}
```

### Audit Log Structure

- **userId**: Who performed the action
- **action**: 'create', 'update', 'delete', 'read'
- **resource**: Table/entity name
- **resourceId**: Record ID
- **changes**: { old: {...}, new: {...} }
- **timestamp**: Auto-recorded
- **ipAddress**: From req if available

## Security Best Practices

### Password Hashing

```typescript
import bcryptjs from 'bcryptjs';

export async function createUser(input: CreateUserInput) {
  const hashedPassword = await bcryptjs.hash(input.password, 10);

  return prisma.user.create({
    data: { ...input, password: hashedPassword },
  });
}
```

### Input Sanitization

- Zod handles type coercion and sanitization
- SQL injection prevented by Prisma parameterization
- XSS prevented by returning JSON (not HTML)

### Rate Limiting

```typescript
// Global rate limiter (middleware/rate-limiter.ts)
const globalLimiter = rateLimit({
  store: new RedisStore({ client: redis }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
});

app.use(globalLimiter);

// Per-route limiting
router.post('/login', loginLimiter, loginHandler);
```

## Environment Variables

Backend requires:

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/crm_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
FRONTEND_URL=http://localhost:3000
ESL_HOST=localhost
ESL_PORT=8021
ESL_PASSWORD=ClueCon
NODE_ENV=development
PORT=4000
```

## Importing from Shared

Always import validation and types from `@crm/shared`:

```typescript
// Correct
import { createContactSchema } from '@crm/shared/src/validation/contact-schemas';
import { Contact } from '@crm/shared/src/types/contact';

// Avoid
import schema from '../../../shared/src/validation/contact-schemas';
```

## Development Workflow

### Before Committing

1. **Check for syntax errors**: `npm run build`
2. **Run tests**: `npm test` (when test suite exists)
3. **Verify data types**: `npm run tsc --noEmit`
4. **Check linting**: `npm run lint` (when configured)

### Commit Message Format

Use conventional commits:

```
feat: add contact assignment workflow
fix: prevent duplicate phone numbers on contact creation
docs: update API authentication guide
refactor: extract data scoping logic to utility
test: add contact service unit tests
chore: update dependencies
```

## Database Migrations

### Creating New Features

1. Update `prisma/schema.prisma`
2. Run `npm run db:migrate`
3. Verify migration SQL in `prisma/migrations/`
4. Update seed file if needed
5. Test locally: `npm run db:seed`

### Rollback Pattern

```bash
# Reset database (dev only)
npm run db:migrate reset

# View migration history
npx prisma migrate status
```

## API Endpoint Naming

Follow RESTful conventions:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/contacts` | List contacts (with pagination) |
| POST | `/api/v1/contacts` | Create contact |
| GET | `/api/v1/contacts/:id` | Get single contact |
| PATCH | `/api/v1/contacts/:id` | Update contact |
| DELETE | `/api/v1/contacts/:id` | Delete contact |
| GET | `/api/v1/contacts/:id/timeline` | Get contact activity timeline |

## Frontend Conventions (Phase 08+)

### Component Structure

- Use kebab-case for component file names
- Keep components under 200 lines
- Use TypeScript for type safety
- Follow React hooks best practices

### State Management

- Use Zustand for global state
- Use React Query for server state
- Keep local state minimal

### API Integration

- Create hooks for API calls (`useContacts()`, `useLeads()`)
- Handle loading/error/success states
- Implement optimistic updates where appropriate

---

**Last Updated**: 2026-03-24
**Version**: 1.0.0-alpha
