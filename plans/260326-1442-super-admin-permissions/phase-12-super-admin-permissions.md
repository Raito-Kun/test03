# Phase 12: Super Admin Role + Permission Manager

## Context Links
- Prisma schema: `packages/backend/prisma/schema.prisma`
- RBAC middleware: `packages/backend/src/middleware/rbac-middleware.ts`
- Auth store: `packages/frontend/src/stores/auth-store.ts`
- Sidebar: `packages/frontend/src/components/layout/sidebar.tsx`

## Overview
- **Priority**: P1
- **Status**: pending
- **Description**: Add `super_admin` to Role enum, create Permission/RolePermission tables, build permission-based middleware, build Permission Manager UI, seed default data.

## Key Insights
- Currently 14 route files use `requireRole()` with hardcoded role lists
- `TokenPayload` has `{ userId, role, teamId }` -- role stays in JWT, permissions loaded separately
- `data-scope-middleware.ts` also checks roles -- needs super_admin added to full-access list
- Sidebar already has `roleVisibility` pattern -- will extend to use permissions

## Requirements

### Functional
- super_admin role has all permissions, cannot be restricted
- Permission Manager: toggle matrix of roles vs permission keys
- 13 permission keys: `view_reports`, `make_calls`, `export_excel`, `view_recordings`, `manage_campaigns`, `manage_users`, `manage_permissions`, `manage_extensions`, `view_dashboard`, `manage_tickets`, `manage_debt_cases`, `manage_leads`, `manage_contacts`
- Changes persist to DB and apply immediately (Redis cache invalidated on save)
- Seed super_admin user: `superadmin@crm.local` / `SuperAdmin@123`

### Non-Functional
- Permission check adds <5ms latency (Redis cache)
- Cache TTL: 5 minutes, invalidated on permission update

## Architecture

### New Prisma Models
```prisma
// Add to Role enum: super_admin

model Permission {
  id    String @id @default(uuid()) @db.Uuid
  key   String @unique          // e.g. "manage_users"
  label String                  // e.g. "Quan ly nguoi dung"
  group String                  // e.g. "users" (for UI grouping)

  rolePermissions RolePermission[]
  @@map("permissions")
}

model RolePermission {
  role         Role
  permissionId String     @map("permission_id") @db.Uuid
  granted      Boolean    @default(true)

  permission   Permission @relation(fields: [permissionId], references: [id])

  @@id([role, permissionId])
  @@map("role_permissions")
}
```

### Permission Cache (Redis)
- Key: `perms:{role}` -> JSON array of granted permission keys
- TTL: 300s
- Invalidated on PUT `/permissions/role/:role`

### API Endpoints
- `GET /api/v1/permissions` -- list all permissions with role grants (admin/super_admin only)
- `PUT /api/v1/permissions/role/:role` -- update grants for a role (super_admin only)
- `GET /auth/me` response adds `permissions: string[]`

## Related Code Files

### Files to Create
| File | Purpose |
|------|---------|
| `packages/backend/src/services/permission-service.ts` | Load/cache/update permissions |
| `packages/backend/src/controllers/permission-controller.ts` | API handlers |
| `packages/backend/src/routes/permission-routes.ts` | Route definitions |
| `packages/backend/prisma/migrations/xxx_add_permissions/migration.sql` | DB migration |
| `packages/frontend/src/pages/settings/permission-manager.tsx` | Permission matrix UI |

### Files to Modify
| File | Change |
|------|--------|
| `packages/backend/prisma/schema.prisma` | Add super_admin to Role enum, add Permission + RolePermission models |
| `packages/backend/prisma/seed.ts` | Seed super_admin user + 13 permissions + default role grants |
| `packages/backend/src/middleware/rbac-middleware.ts` | Add `requirePermission()` function, add super_admin bypass to `requireRole()` |
| `packages/backend/src/middleware/data-scope-middleware.ts` | Add super_admin to full-access case |
| `packages/backend/src/lib/jwt.ts` | No change needed (role already in token) |
| `packages/backend/src/services/auth-service.ts` | Include permissions array in `/auth/me` response |
| `packages/backend/src/index.ts` | Register permission routes |
| `packages/backend/src/routes/user-routes.ts` | Add super_admin to allowed roles where admin is |
| `packages/backend/src/routes/report-routes.ts` | Same |
| `packages/backend/src/routes/campaign-routes.ts` | Same |
| `packages/backend/src/routes/team-routes.ts` | Same |
| `packages/backend/src/routes/contact-routes.ts` | Same |
| `packages/backend/src/routes/disposition-code-routes.ts` | Same |
| `packages/backend/src/routes/qa-annotation-routes.ts` | Same |
| `packages/backend/src/routes/ticket-category-routes.ts` | Same |
| `packages/backend/src/routes/agent-status-routes.ts` | Same |
| `packages/backend/src/routes/call-log-routes.ts` | Same |
| `packages/frontend/src/stores/auth-store.ts` | Add `permissions: string[]` to User, add `hasPermission()` |
| `packages/frontend/src/components/layout/sidebar.tsx` | Use permissions for visibility |
| `packages/frontend/src/app.tsx` | Add permission-manager route |
| `packages/frontend/src/pages/settings/settings-page.tsx` | Add link to Permission Manager (for super_admin/admin) |

## Implementation Steps

### Step 1: Schema + Migration
1. Add `super_admin` to `Role` enum in schema.prisma (MUST be first value so existing data isn't affected)
2. Add `Permission` and `RolePermission` models
3. Run `npx prisma migrate dev --name add_permissions`

### Step 2: Permission Service
1. Create `permission-service.ts`:
   - `getPermissionsForRole(role: Role): Promise<string[]>` -- check Redis `perms:{role}` first, fallback to DB query
   - `getAllPermissionsWithGrants(): Promise<{key, label, group, grants: {role, granted}[]}[]>`
   - `updateRolePermissions(role: Role, permissions: {key: string, granted: boolean}[]): Promise<void>` -- update DB + invalidate Redis
   - super_admin always returns all permission keys (no DB lookup)

### Step 3: RBAC Middleware
1. Add to `rbac-middleware.ts`:
   ```typescript
   export function requirePermission(...keys: string[]) {
     return async (req, res, next) => {
       if (!req.user) return res.status(401)...
       if (req.user.role === 'super_admin') return next(); // bypass
       const perms = await getPermissionsForRole(req.user.role as Role);
       if (keys.some(k => perms.includes(k))) return next();
       return res.status(403)...
     };
   }
   ```
2. Update `requireRole()` to always allow `super_admin`
3. Update `data-scope-middleware.ts`: add `'super_admin'` to full-access case

### Step 4: Controller + Routes
1. Create permission controller with `list` and `updateRole` handlers
2. Create permission routes: `GET /` and `PUT /role/:role`
3. Guard with `requireRole('super_admin')` for updates, `requireRole('admin', 'super_admin')` for list
4. Register in `index.ts`: `app.use('/api/v1/permissions', permissionRoutes)`

### Step 5: Auth Service Update
1. In `GET /auth/me` handler, fetch permissions for user's role
2. Return in response: `{ ...userData, permissions: ['manage_users', ...] }`

### Step 6: Update All Route Files
1. In each route file that uses `requireRole('admin', ...)`, add `'super_admin'` to the list
2. Files: user-routes, team-routes, contact-routes, campaign-routes, disposition-code-routes, qa-annotation-routes, ticket-category-routes, agent-status-routes, call-log-routes, report-routes

### Step 7: Seed Data
1. Add super_admin user to seed: `{ email: 'superadmin@crm.local', fullName: 'Super Admin', role: 'super_admin', sipExtension: '1000' }` with password `SuperAdmin@123`
2. Seed 13 Permission records
3. Seed default RolePermission grants:
   - admin: all except manage_permissions
   - manager: view_reports, make_calls, export_excel, view_recordings, manage_campaigns, view_dashboard, manage_tickets, manage_leads, manage_contacts
   - qa: view_reports, view_recordings
   - leader: view_reports, make_calls, view_recordings, manage_leads, manage_contacts, manage_debt_cases, view_dashboard
   - agent_telesale: make_calls, manage_leads, manage_contacts
   - agent_collection: make_calls, manage_debt_cases, manage_contacts

### Step 8: Frontend Auth Store
1. Add `permissions: string[]` to User interface
2. Add `hasPermission(key: string): boolean` as a helper (reads from `user.permissions`)
3. Update bootstrap/login to parse permissions from `/auth/me`

### Step 9: Permission Manager UI
1. Create `packages/frontend/src/pages/settings/permission-manager.tsx`
2. Table: rows = 13 permission keys (grouped), columns = 7 roles
3. Each cell = toggle switch (disabled for super_admin column, always ON)
4. Save button per role column or global save
5. Use `useMutation` for PUT `/permissions/role/:role`
6. Only accessible to super_admin (check `hasPermission('manage_permissions')`)

### Step 10: Sidebar + Routing
1. Add route in `app.tsx`: `/settings/permissions` -> `PermissionManager`
2. Add nav item or sub-link in settings page
3. Update sidebar `roleVisibility` to use `hasPermission()` where applicable

## Todo List
- [ ] Schema: add super_admin to Role enum
- [ ] Schema: add Permission + RolePermission models
- [ ] Run migration
- [ ] Create permission-service.ts with Redis caching
- [ ] Update rbac-middleware.ts: requirePermission + super_admin bypass
- [ ] Update data-scope-middleware.ts: super_admin full access
- [ ] Create permission controller + routes
- [ ] Register routes in index.ts
- [ ] Update auth-service: include permissions in /auth/me
- [ ] Update all 10+ route files: add super_admin
- [ ] Update seed.ts: super_admin user + permissions + grants
- [ ] Frontend: update auth-store with permissions
- [ ] Frontend: build permission-manager.tsx
- [ ] Frontend: add route + sidebar entry
- [ ] Test permission middleware
- [ ] Test cache invalidation

## Success Criteria
- super_admin can log in and access all features
- Permission Manager UI shows toggle matrix, saves to DB
- Toggling a permission off for a role immediately blocks that role's access (within 5min cache)
- Existing role-based checks still work (backward compat)
- `GET /auth/me` returns permissions array

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|-----------|
| Migration breaks existing Role enum data | High | Add super_admin as new value, don't rename existing |
| Permission cache stale after update | Medium | Explicit Redis DEL on permission save |
| Route files miss super_admin addition | Medium | Grep all `requireRole` usages systematically |

## Security Considerations
- Only super_admin can modify permissions (`manage_permissions` key)
- super_admin role cannot be assigned via UI (only via seed/direct DB)
- Permission changes logged in audit_logs
- Redis cache prevents DB overload but has staleness window (5min max)
