---
name: crm-permission
description: Manage CRM dynamic RBAC permissions — add permission keys, map them to roles, wire middleware, and bust the Redis cache. Use when gating a route or UI element by a permission key.
version: 1.0.0
argument-hint: "[add-key|grant|revoke] [permission-key] [role]"
---

# CRM Permission Skill

Add and apply fine-grained permissions on top of the role system, using the project's Permission + RolePermission tables and Redis-cached lookups.

## When to Use

- Gating a backend route or frontend element by a fine-grained capability
- Granting or revoking a permission for a role without code changes
- Adding a new permission key to the matrix UI
- Debugging "why does this role see/miss X"

## Model

**Roles** (7 fixed): super_admin, admin, manager, qa, leader, agent_telesale, agent_collection

**Permission Groups** (7 groups, 40+ keys, v1.3.10):
1. **switchboard** — VoIP operations: switchboard.manage, .make_call, .receive_call, .transfer_call, .hold_call, .listen_recording, .download_recording, recording.delete
2. **crm** — Contact/lead/debt/allocation: crm.manage, .contacts.{view,create,edit,delete,import,export}, .leads.{view,create,edit,delete,import}, .debt.{view,edit}, .data_allocation
3. **campaign** — Campaign ops: campaign.{manage,create,edit,delete,assign,import}
4. **report** — Reports: report.{manage,view_own,view_team,view_all,export}
5. **ticket** — Tickets: ticket.{manage,create,edit,delete,assign}
6. **qa** — Quality assurance: qa.{manage,score,review,annotate}
7. **system** — Admin: system.{manage,users,roles,permissions,settings,audit_log}

**Tables**:
- **Permission**: `{ id, key, label, group, parentId (optional) }`
- **RolePermission**: `{ role, permissionId, granted }`
- **super_admin**: hardcoded all-access bypass (no DB lookup)

## Adding a New Permission

1. Pick a `resource.action` key (lowercase, dot-separated) and Vietnamese label
2. Assign to one of 7 groups (switchboard, crm, campaign, report, ticket, qa, system)
3. Add to seed (permissionDefs array, lines 130-193) with optional `parentKey` for hierarchy
4. Add to role default grants in seed (roleGrants section)
5. Re-seed locally: `npm run db:seed`
6. Deploy: `npm run build && docker push`; re-seed on server: `npm run db:seed`
7. Bust Redis cache: `redis-cli DEL 'permissions:role:*'`
8. Apply `requirePermission('resource.action')` middleware on backend route
9. Gate frontend with `hasPermission('resource.action')` from auth store (socket event auto-refreshes)

## When to Use Which Gate

| Choice | Use when |
|---|---|
| `requireRole` | Entire surface belongs to one or two roles |
| `requirePermission` | Configurable per role via UI matrix |
| `checkFeatureEnabled` | Whole capability on/off at tenant level |

Middleware order: `auth → feature-flag → permission → data-scope`.

## Cache Lifecycle

Permissions are cached per role in Redis with a short TTL. Invalidation triggers:
- Matrix PUT endpoint (automatic)
- Manual `DEL` on the permission cache keys
- Frontend listens for `permission:changed` socket event to refresh the current user's effective set

## Reference

- Middleware: `packages/backend/src/middleware/permission-middleware.ts`
- Service: `packages/backend/src/services/permission-service.ts`
- Seed: `packages/backend/prisma/seed.ts`
- Frontend store: `packages/frontend/src/stores/auth.ts`
- Related skills: `crm-backend-feature`, `crm-feature-flag`

## Naming Convention (v1.3.10)

Permission keys use `resource.action` format:
- **Resource** (singular, lowercase): ticket, crm, campaign, report, switchboard, recording, qa, system
- **Action** (verb, lowercase): manage, create, edit, delete, view, import, export, assign, score, review, annotate
- **Nesting** (optional): `crm.contacts.view`, `crm.leads.import`, `system.users`

**Legacy plural forms are deprecated** (migrated 2026-04-21):
- `manage_X` → `X.manage`
- `view_X` → `X.view` or `X.view_own` / `X.view_team` / `X.view_all`
- `import_X` → `X.import`
- `export_X` → `X.export`

Do not reintroduce flat/plural keys; use dot-separated modern format.

## Ticket RBAC (v1.3.10, rev 2)

- **Create**: any authenticated user (agent+) — no permission required
- **List/Get**: admin/manager/qa sees all in cluster; agent sees own; data-scoped
- **Update**: same as Get; agent can update own; `ticket.edit` permission-gated
- **Delete**: requires `ticket.delete` permission — **middleware-enforced** on `DELETE /api/tickets/:id` route
  - Default grant: super_admin, admin
  - Cannot be granted to agent roles via UI

## Anti-patterns

- Using plural/flat keys like `manage_tickets` — use `ticket.manage` instead
- Hand-checking `req.user.role === '...'` in handlers — use `requireRole` or `requirePermission` middleware
- Shoving permission lists into the JWT payload — rely on database lookups + Redis cache
- Deleting rows to revoke permission — set `granted = false` so history remains intact
- Hardcoding permission enforcement in service layer — apply middleware at route level instead
