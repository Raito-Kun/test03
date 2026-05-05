---
name: crm-backend-feature
description: Scaffold a new CRM backend feature following the controller → service → route pattern with Zod validation, JWT auth, RBAC, dataScope filtering, cluster-aware multi-tenancy, and feature-flag middleware. Use when adding API endpoints or business entities.
version: 1.0.0
argument-hint: "[feature-name]"
---

# CRM Backend Feature Skill

Produce new backend modules that match the project's established patterns, so new code reads like existing code.

## When to Use

- Exposing a new entity over HTTP
- Adding endpoints to an existing resource
- Introducing a new business service with its own routes
- Wiring auth, permission, feature-flag, and data-scope middleware correctly

## Pattern

```
packages/backend/src/
├── controllers/<feature>-controller.ts   # Zod-parse, call service, return JSON
├── services/<feature>-service.ts         # Prisma + business logic + audit
├── routes/<feature>-routes.ts            # Router + middleware chain
└── index.ts                               # Mount under /api/v1/<features>
```

Files stay under ~200 lines; split when larger. Kebab-case filenames with `-controller`, `-service`, `-routes` suffixes.

## Middleware Order (mandatory)

`authMiddleware → checkFeatureEnabled → applyDataScope → requirePermission → handler`

RBAC (`requireRole`) goes per-route only when coarser than permission.

## Contract Checklist

| Concern | Rule |
|---|---|
| Input validation | Zod schema on every body + relevant query params |
| Multi-tenancy | Filter/assign `clusterId` on any tenant-scoped table |
| Data scoping | `buildScopeWhere(dataScope, 'assignedTo')` for list/read |
| Audit | Write audit log on mutations via the shared helper |
| Errors | Let Zod bubble; use project-wide error codes |
| Response shape | `{ success: true, data }` or paginated `{ success, data, pagination }` |

## Copy-From

Existing features that demonstrate the pattern end-to-end:
- `contacts` — full CRUD + merge + tags + import
- `leads` — status workflow + scoring + bulk assign
- `tickets` — SLA + macro + categories

Read these before scaffolding.

## Reference

- Architecture overview: `docs/system-architecture.md`
- Middleware implementations: `packages/backend/src/middleware/*-middleware.ts`
- Error format: `docs/system-architecture.md` → "Error Format"
- Related skills: `crm-prisma` (schema), `crm-permission` (new keys), `crm-feature-flag` (gating), `crm-test` (verify)

## Anti-patterns

- Business logic in controllers
- Direct Prisma calls in routes
- Skipping `clusterId` on tenant-scoped writes
- Inventing new error codes or response shapes
- Creating parallel `enhanced-*` files instead of editing existing
