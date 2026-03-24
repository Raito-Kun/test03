---
phase: 02
title: "Auth & User Management"
status: completed
priority: P1
effort: 4d
depends_on: [01]
---

# Phase 02 — Auth & User Management

## Context Links
- [PRD](../../Guildline/PRD.md) — Section 2 (RBAC), Section 5.1 (Security), API 7.1-7.2
- [Plan Overview](./plan.md)

## Overview
JWT auth (access 15min + refresh 7d with rotation), 6-role RBAC middleware, user CRUD (admin only), team CRUD, seed data.

## Key Insights
- Access token: 15min TTL, stored in memory (not localStorage). Refresh token: 7d, httpOnly cookie, rotation on use.
- RBAC is role-based, not permission-based — simpler. Middleware checks `req.user.role` against allowed roles per route.
- Data scoping: agents see own data, leaders see team data, managers see all. Implement as query filter middleware.
- Password: bcrypt with salt rounds 12.

## Requirements
**Functional:**
- Login returns access + refresh tokens
- Refresh rotates token (old one invalidated via Redis blacklist)
- Logout invalidates refresh token
- GET /auth/me returns current user profile
- Admin CRUD users (create, list, update, delete/deactivate)
- Team CRUD with member listing
- All routes protected except /auth/login and /auth/refresh

**Non-functional:**
- Rate limit: 10/min on /auth/login (brute force protection)
- Passwords min 8 chars

## Architecture

```
Request → authMiddleware → rbacMiddleware(roles[]) → dataScopeMiddleware → controller
```

- `authMiddleware`: Verify JWT, attach `req.user`
- `rbacMiddleware(allowedRoles)`: Check `req.user.role` in allowedRoles
- `dataScopeMiddleware`: Add `where` clause based on role (own/team/all)

## Related Code Files
**Create:**
- `packages/backend/src/middleware/auth-middleware.ts`
- `packages/backend/src/middleware/rbac-middleware.ts`
- `packages/backend/src/middleware/data-scope-middleware.ts`
- `packages/backend/src/middleware/rate-limiter.ts`
- `packages/backend/src/routes/auth-routes.ts`
- `packages/backend/src/routes/user-routes.ts`
- `packages/backend/src/routes/team-routes.ts`
- `packages/backend/src/controllers/auth-controller.ts`
- `packages/backend/src/controllers/user-controller.ts`
- `packages/backend/src/controllers/team-controller.ts`
- `packages/backend/src/services/auth-service.ts`
- `packages/backend/src/services/user-service.ts`
- `packages/backend/src/services/team-service.ts`
- `packages/backend/src/lib/jwt.ts`
- `packages/backend/prisma/seed.ts` (admin user + disposition codes)
- `packages/shared/src/validation/auth-schemas.ts`
- `packages/shared/src/types/auth-types.ts`

## Implementation Steps

### 1. JWT utilities (`lib/jwt.ts`)
1. `generateAccessToken(user)` — 15min, payload: {userId, role, teamId}
2. `generateRefreshToken(user)` — 7d, random UUID stored in Redis
3. `verifyAccessToken(token)` — returns decoded payload
4. `invalidateRefreshToken(tokenId)` — use Redis `GETDEL` (atomic get-and-delete) to prevent race condition. If token already deleted, refresh fails immediately. [RED TEAM #11]

### 2. Auth middleware
1. Extract Bearer token from Authorization header
2. Verify token, attach `{userId, role, teamId}` to `req.user`
3. On expired: return 401 with `token_expired` code (FE auto-refreshes)

### 3. RBAC middleware
1. Factory function: `requireRole(...roles: Role[])` returns middleware
2. Check `req.user.role` against allowed roles
3. Return 403 if unauthorized

### 4. Data scope middleware
1. Factory: `applyDataScope(entityUserField: string)`
2. Role logic:
   - admin/manager/qa → no filter (all data)
   - leader → filter by team_id (user's team)
   - agent_telesale/agent_collection → filter by assigned_to = userId
3. Attaches `req.dataScope` object for services to use in Prisma `where`
4. **CRITICAL [RED TEAM #8]:** Data scope MUST apply to BOTH list queries AND single-resource access (GET/:id, PATCH/:id, DELETE/:id). Services must include dataScope in `where` clause for all operations: `where: { id, ...dataScope }`. Add IDOR integration tests for every entity.

### 5. Auth routes & controller
1. <!-- Updated: Validation Session 3 - Cookie security conditional on NODE_ENV -->
   `POST /auth/login` — validate email+password, return tokens. Set refresh token as httpOnly cookie with `sameSite: NODE_ENV === 'production' ? 'strict' : 'lax'`, `secure: NODE_ENV === 'production'`. [RED TEAM #12]
2. `POST /auth/refresh` — require expiring/expired access token in Authorization header as CSRF proof (attacker can't read it). Validate refresh token via Redis GETDEL (atomic). Rotate and return new pair. [RED TEAM #11, #12]
3. `POST /auth/logout` — invalidate refresh token
4. `GET /auth/me` — return current user (no password_hash). Include unread notification count for FE bootstrap. [RED TEAM #7]

### 6. User routes & controller (Admin only)
1. `GET /users` — list with pagination, filter by role/team/status
2. `POST /users` — create user (validate unique email, hash password)
3. `PATCH /users/:id` — update user fields (admin or self for limited fields)
4. `DELETE /users/:id` — soft deactivate (set status=inactive)

### 7. Team routes & controller
1. `GET /teams` — list teams
2. `POST /teams` — create team (admin)
3. `PATCH /teams/:id` — update team
4. `DELETE /teams/:id` — deactivate team (admin)
5. `GET /teams/:id/members` — list team members

### 8. Rate limiting
1. Use `express-rate-limit` + Redis store (`rate-limit-redis`)
2. Global: 60/min per user
3. Login: 10/min per IP
4. Click-to-Call: 10/min per user (configured in Phase 04)

### 9. Seed data
1. **[RED TEAM #13]** Seed script MUST check `NODE_ENV !== 'production'` before creating default credentials. Production admin setup: read email/password from env vars `ADMIN_EMAIL` / `ADMIN_PASSWORD`, or fail with clear error.
2. Dev seed: admin@crm.local / changeme123 with `must_change_password: true` flag (add boolean column to users table). Enforce password change on first login.
3. <!-- Updated: Validation Session 1 - Seed 6 users (1 per role) across 2 teams -->
   Seed 6 users (1 per role): admin, manager, qa, leader (team telesale), agent_telesale, agent_collection. Create 2 teams: "Telesale Team A" and "Collection Team A".
4. Default disposition codes (telesale: contacted, callback, not_interested, qualified, won, lost; collection: contacted, promise_to_pay, paid, refused, wrong_number, no_answer)
5. Default ticket categories (Consultation, Complaint, Support, Callback Request)

## Todo List
- [x] JWT utility functions + Redis token store
- [x] Auth middleware (JWT verification)
- [x] RBAC middleware (role check)
- [x] Data scope middleware (own/team/all filter)
- [x] Auth routes: login, refresh, logout, me
- [x] User CRUD routes (admin)
- [x] Team CRUD routes
- [x] Rate limiting (login + global)
- [x] Seed script (admin user + disposition codes + categories)
- [x] Zod validation schemas for auth/user/team

## Success Criteria
- Login returns valid JWT pair
- Refresh rotates token correctly
- Unauthorized access returns 401/403
- Admin can CRUD users
- Data scoping filters results by role
- Rate limiter blocks after threshold

## Risk Assessment
- Token rotation race condition: use Redis `GETDEL` for atomic token consumption. If two requests race, only the first succeeds. [RED TEAM #11]
- Clock skew between servers could affect JWT expiry. Use same time source.
- CSRF on refresh endpoint: mitigated by requiring access token in Authorization header + sameSite=Strict cookie. [RED TEAM #12]

## Security Considerations
- Password never returned in API responses (exclude in Prisma select)
- Refresh token stored as httpOnly, secure, sameSite cookie
- Failed login attempts logged in audit_logs
- Inactive users cannot login
