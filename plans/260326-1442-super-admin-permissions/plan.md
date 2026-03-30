---
title: "Super Admin + Permissions + Extension Mapping + Tests"
description: "Add dynamic RBAC with permission manager UI, extension mapping config, and comprehensive test suite"
status: in_progress
priority: P1
effort: 12h
branch: master
tags: [rbac, permissions, extensions, testing]
created: 2026-03-26
last_updated: 2026-03-26
---

# Super Admin + Permissions + Extension Mapping + Tests

## Phases

| # | Phase | Status | Effort | Dependencies |
|---|-------|--------|--------|-------------|
| 12 | Super Admin Role + Permission Manager | complete | 5h | None |
| 13 | Extension Mapping Config | complete | 3h | Phase 12 (super_admin role) |
| 14 | Smart Test Suite | in_progress | 4h | Phase 12+13 |

## Architecture Overview

### Permission System Design

Current state: `requireRole('admin', 'manager')` hardcoded in every route file.

Target state: `requirePermission('manage_users')` checks DB `role_permissions` table.

```
Role enum += super_admin
Permission table: id, key, label, group
RolePermission table: roleId (enum), permissionId (FK), granted (bool)
```

super_admin bypasses all permission checks (hardcoded shortcut in middleware).

### Data Flow

1. Login -> JWT includes role (no permissions in token, too dynamic)
2. Middleware loads permissions from DB (cached in Redis, 5min TTL)
3. `requirePermission('manage_users')` checks cache -> DB fallback
4. Frontend: `/auth/me` response includes `permissions: string[]`
5. Frontend `useAuthStore` exposes `hasPermission(key)` helper

### Extension Mapping

Reads FreeSWITCH `sofia status profile internal reg` via existing ESL service.
New page under Settings, restricted to super_admin/admin.

## Key Decisions

- Permissions cached in Redis (not JWT) so changes apply immediately
- super_admin always has all permissions (no DB check needed)
- Keep `requireRole` alongside `requirePermission` during migration (backward compat)
- Permission keys are flat strings, grouped by UI label for the matrix
- Tests use existing `setup.ts` + `helpers.ts` infrastructure

## Files Impact Summary

See individual phase files for detailed file lists.

- **Schema**: 1 migration (Permission + RolePermission tables, super_admin enum value)
- **Backend new**: 3 files (permission service, controller, routes)
- **Backend modified**: ~15 route files, rbac-middleware, seed, auth-service, jwt
- **Frontend new**: 2 pages (permission-manager, extension-config)
- **Frontend modified**: auth-store, sidebar, app.tsx, settings-page
- **Tests**: extend existing test files + new permission/extension test files
