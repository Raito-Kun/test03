---
type: code-review
date: 2026-03-24
phase: 01-02 (Foundation + Auth/RBAC/Teams/Users)
reviewer: code-reviewer
---

# Code Review: Phase 01-02 -- Foundation & Auth/RBAC

## Score: 7.5 / 10

## Scope

- **Files reviewed**: 31 files across backend/src, shared/src, frontend/src, prisma, root configs
- **LOC**: ~1,200 (backend ~800, shared ~150, frontend ~50, prisma schema ~510, seed ~120, configs ~100)
- **Focus**: Security (JWT, RBAC, cookies, input validation), Architecture, Code Quality, Prisma Schema, Error Handling

## Overall Assessment

Solid foundation for a CRM Omnichannel project. The code demonstrates good architectural awareness: proper separation into controllers/services/middleware, Zod validation at boundaries, httpOnly cookies for refresh tokens, atomic refresh token rotation via Redis GETDEL, and a comprehensive Prisma schema. There are several security and correctness issues that need attention before production.

---

## Critical Issues

### C1. Hardcoded JWT Secrets with Weak Fallbacks

**File**: `packages/backend/src/lib/jwt.ts` (lines 5-6)

```typescript
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
```

**Problem**: If env vars are unset, the app silently runs with known secrets. In a misconfigured production deploy, all tokens are forgeable. `REFRESH_SECRET` is declared but never actually used (refresh tokens are UUIDs stored in Redis, not signed JWTs), making its existence misleading.

**Fix**: Fail fast on startup if secrets are missing. Remove `REFRESH_SECRET` since it is unused.

```typescript
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
if (!ACCESS_SECRET) {
  throw new Error('FATAL: JWT_ACCESS_SECRET env var is required');
}
```

**Severity**: CRITICAL -- silent secret fallback in production is a common path to full auth bypass.

### C2. No `.env.example` in Project Root or Backend Package

There is no `.env.example` file for the backend. Developers will not know which environment variables are required (`DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `FRONTEND_URL`, `PORT`, `NODE_ENV`). This directly contributes to C1 -- devs may ship without setting secrets.

**Fix**: Create `packages/backend/.env.example` with all required vars (values blanked).

**Severity**: CRITICAL -- operational/security risk.

### C3. Data Scope Middleware Leader Branch is Incomplete

**File**: `packages/backend/src/middleware/data-scope-middleware.ts` (lines 38-44)

```typescript
case 'leader':
  if (teamId) {
    req.dataScope = {
      [userField]: {
        // Prisma doesn't have direct team filter on assigned_to...
      },
      _teamScope: teamId,
    };
  }
```

The object assigned to `[userField]` is empty `{}`. The `buildScopeWhere` function at line 80 then applies `[userField]: { not: null }` which only filters out unassigned records, but does NOT restrict to the leader's team members. Any leader can see all assigned records across all teams as long as `assigned_to` is not null.

**Fix**: Ensure the service layer correctly implements team-scoped filtering OR complete the middleware logic to produce a proper Prisma nested where clause.

**Severity**: CRITICAL -- data isolation between teams is broken for leaders.

---

## High Priority

### H1. Pagination `sort` Field Allows Arbitrary Column Names

**File**: `packages/backend/src/lib/pagination.ts` (line 25)

```typescript
const prismaField = fieldMap[sort] || sort;
```

If the client sends `?sort=passwordHash`, the server passes it to Prisma `orderBy`. While Prisma will reject unknown fields, it still exposes internal column names and could cause 500 errors. An attacker can enumerate column names.

**Fix**: Validate `sort` against an allowlist; reject or ignore unknown sort fields.

```typescript
const ALLOWED_SORTS = new Set(Object.keys(fieldMap).concat(Object.values(fieldMap)));
const prismaField = fieldMap[sort] || (ALLOWED_SORTS.has(sort) ? sort : 'createdAt');
```

### H2. User Filter Params Not Validated

**File**: `packages/backend/src/controllers/user-controller.ts` (lines 10-15)

```typescript
const filters = {
  role: req.query.role as string | undefined,
  teamId: req.query.team_id as string | undefined,
  status: req.query.status as string | undefined,
  search: req.query.search as string | undefined,
};
```

These are cast directly from query params with no Zod validation. `role` and `status` should be validated against their enums. `teamId` should be validated as a UUID. `search` should have a max length to prevent regex DoS via Prisma's `contains`.

**Fix**: Create a `listUsersQuerySchema` with Zod and validate in the controller.

### H3. Team Validation Schemas Defined in Controller, Not Shared

**File**: `packages/backend/src/controllers/team-controller.ts` (lines 6-17)

Team create/update Zod schemas are defined inline in the controller. This violates DRY -- the frontend cannot reuse these schemas. They should be in `@crm/shared/src/validation/`.

**Fix**: Move to `packages/shared/src/validation/team-schemas.ts` and import in both controller and frontend.

### H4. Error Handling Pattern Uses Unsafe Type Assertion

Multiple files use:
```typescript
const error = err as Error & { code?: string };
```

This is unsafe -- `err` could be anything. If a non-Error is thrown (e.g., a string, or a Prisma error object), `.code` may resolve to Prisma's internal error code (like `P2002` for unique constraint), leading to unhandled errors falling through to the generic 500 handler when they should be caught.

**Fix**: Create a typed custom `AppError` class:

```typescript
class AppError extends Error {
  constructor(public code: string, message: string, public httpStatus: number = 500) {
    super(message);
  }
}
```

Replace `Object.assign(new Error(...), { code: ... })` pattern across all services.

### H5. No Password Complexity Validation Beyond Length

**File**: `packages/shared/src/validation/auth-schemas.ts`

Passwords only require `min(8)`. For a CRM handling financial/debt collection data, enforce at least: uppercase, lowercase, digit, special char.

### H6. Docker Compose Exposes Default Credentials

**File**: `docker-compose.yml` (lines 9-11)

```yaml
POSTGRES_USER: crm_user
POSTGRES_PASSWORD: crm_password
```

Hardcoded credentials in a committed file. These should reference `.env` variables.

**Fix**:
```yaml
POSTGRES_USER: ${POSTGRES_USER:-crm_user}
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
```

---

## Medium Priority

### M1. Missing Indexes on Prisma Schema

- `Lead` model: no index on `assignedTo`, `campaignId`, or `status`. Queries filtering leads by agent or campaign will full-table-scan.
- `DebtCase` model: no index on `assignedTo`, `tier`, `status`.
- `Notification` model: no index on `userId + isRead` (used by `getProfile` on every login and /me call).
- `Contact` model: no index on `assignedTo` or `email`.

**Fix**: Add composite and single-column indexes where query patterns exist:

```prisma
@@index([assignedTo])
@@index([userId, isRead])
```

### M2. N+1 Risk in Seed Script

The seed iterates with individual `upsert` calls inside loops. For 6 users and 12 disposition codes this is fine, but the pattern won't scale. Consider `createMany` for future bulk data.

### M3. `as never` Type Casts in Services

**Files**: `user-service.ts` (line 79), `team-service.ts` (line 41)

```typescript
role: input.role as never,
```

This suppresses TypeScript type checking entirely. The `role` comes from Zod validation as a string union, but Prisma expects its generated `Role` enum. Instead, validate at the schema level that the value matches the Prisma enum, or use a proper type assertion.

### M4. Refresh Token Not Scoped to User Session

The refresh token in Redis stores only `userId`. If an admin changes a user's role or deactivates their account, existing refresh tokens continue to work (the role is re-fetched on refresh, which is good). However, there is no "invalidate all sessions for user" capability. Consider a Redis set tracking all active refresh tokens per user.

### M5. No Request ID / Correlation ID

There is no request ID middleware. When debugging production issues across multiple services, correlating logs will be very difficult.

**Fix**: Add a simple middleware that generates/reads `X-Request-Id` header and attaches to logger context.

### M6. Inconsistent Response Shape for Paginated Endpoints

`listUsers` and `listTeams` return `{ success: true, ...paginatedResponse() }` which produces `{ success, data, meta }`. Single-entity endpoints return `{ success, data }`. The `PaginatedResponse` type from shared does not include `success`. The response shape should be consistent -- wrap paginated responses inside `data` or unify the envelope.

### M7. Frontend Has Minimal Code -- No Auth Integration

Frontend is a placeholder with no auth flow, no API client, no route guards. This is expected for Phase 01-02 but should be flagged so it is not forgotten in Phase 03.

---

## Low Priority

### L1. `refreshTokenSchema` is Empty

**File**: `packages/shared/src/validation/auth-schemas.ts` (lines 8-10)

```typescript
export const refreshTokenSchema = z.object({});
```

This validates nothing and is never used. Remove or implement.

### L2. Prisma Client Event Typing Workaround

**File**: `packages/backend/src/lib/prisma.ts` (line 14)

```typescript
prisma.$on('error' as never, (e: unknown) => {
```

The `as never` cast suggests a Prisma version mismatch or incorrect event API usage. Verify against Prisma 6.x docs.

### L3. `callMode` Field Uses Enum Default `softphone` But Domain May Prefer `webrtc`

This is a business decision, but `softphone` as default may not match the FusionPBX WebRTC integration described in the project. Confirm with stakeholders.

### L4. `tsconfig.base.json` Has `noUnusedLocals: false` and `noUnusedParameters: false`

For a new project, enabling these catches dead code early. Consider setting to `true`.

### L5. Redis Has No Password

The Docker Compose Redis instance has no `requirepass`. In any shared environment, this is a risk.

---

## Positive Observations

1. **Atomic refresh token rotation** via Redis `GETDEL` prevents replay attacks -- excellent.
2. **httpOnly + secure + sameSite + path-scoped cookies** for refresh tokens -- proper cookie security.
3. **Rate limiting** with Redis-backed store on both global and login routes.
4. **Zod validation at API boundaries** -- defense in depth for input validation.
5. **Soft delete pattern** (deactivate rather than delete) for users and teams.
6. **Clean separation**: controllers handle HTTP, services handle business logic, middleware handles cross-cutting concerns.
7. **Comprehensive Prisma schema** with proper field mapping (snake_case DB, camelCase TS), UUIDs, appropriate decimal precision for financial fields.
8. **Production guard in seed script** prevents accidental seeding.
9. **Proper error handler** distinguishing Zod errors, known errors, and unknown errors with stack suppression in production.
10. **Helmet, CORS, compression** applied correctly in the Express pipeline.

---

## Recommended Actions (Priority Order)

1. **[CRITICAL]** Fix C1: Remove JWT secret fallbacks; fail on startup if unset
2. **[CRITICAL]** Fix C3: Complete data scope filtering for `leader` role
3. **[CRITICAL]** Fix C2: Create `.env.example` for backend
4. **[HIGH]** Fix H1: Validate sort field against allowlist
5. **[HIGH]** Fix H2: Add Zod validation for query params on list endpoints
6. **[HIGH]** Fix H4: Create `AppError` class, replace `Object.assign` pattern
7. **[HIGH]** Fix H3: Move team schemas to shared package
8. **[HIGH]** Fix H6: Remove hardcoded credentials from docker-compose.yml
9. **[MEDIUM]** Fix M1: Add missing database indexes
10. **[MEDIUM]** Fix M5: Add request correlation ID middleware
11. **[MEDIUM]** Fix M6: Unify API response envelope

---

## Metrics

| Metric | Value |
|--------|-------|
| Type Coverage | ~85% (strict mode enabled; `as never` casts reduce effective coverage) |
| Test Coverage | 0% (no tests exist yet) |
| Linting Issues | Not runnable (eslint config not checked); no obvious lint errors in code |
| Security Score | 6/10 (good patterns, but critical gaps in C1, C3, H6) |
| Architecture Score | 8/10 (clean layering, good monorepo structure) |
| Code Quality Score | 7.5/10 (readable, consistent, some DRY violations) |

---

## Unresolved Questions

1. Is there a plan for integration/E2E tests in Phase 02 or later?
2. Should the `Contact.phone` field have a unique constraint or is duplicate-phone-per-contact intentional?
3. Is `changePasswordSchema` (defined in shared) implemented anywhere? No endpoint exists for it yet.
4. What is the migration strategy for the Prisma schema? No migration files were found.
5. Should `WebhookLog.rawPayload` be `String` or `Json`? Storing raw JSON as text loses queryability.
