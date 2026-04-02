# Phase Implementation Report

### Executed Phase
- Phase: RBAC Hierarchy + Data Allocation
- Plan: none (standalone task)
- Status: completed

### Files Modified

**Backend:**
- `packages/backend/prisma/schema.prisma` — Added `parentId`, `parent`, `children` to Permission model
- `packages/backend/prisma/seed.ts` — Full hierarchical permission tree (60+ permissions across 7 groups), updated role grants for all 7 roles
- `packages/backend/src/middleware/data-scope-middleware.ts` — Clarified QA gets full access, leader without team gets full access
- `packages/backend/src/middleware/rbac-middleware.ts` — No changes needed (already handles permission key lookup)
- `packages/backend/src/index.ts` — Registered data-allocation routes

**Backend (new files):**
- `packages/backend/src/controllers/data-allocation-controller.ts` — `allocateEntities` + `getAssignableAgents`
- `packages/backend/src/routes/data-allocation-routes.ts` — POST /allocate, GET /agents (both require `crm.data_allocation`)

**Frontend:**
- `packages/frontend/src/pages/contacts/contact-list.tsx` — Checkbox column, "Phân bổ" button, DataAllocationDialog
- `packages/frontend/src/pages/leads/lead-list.tsx` — Same pattern
- `packages/frontend/src/pages/debt-cases/debt-case-list.tsx` — Same pattern
- `packages/frontend/src/pages/campaigns/campaign-list.tsx` — Checkbox column, "Phân bổ" button (shows info toast — campaigns use AutoAssign instead)

**Frontend (new files):**
- `packages/frontend/src/components/data-allocation-dialog.tsx` — Reusable dialog, fetches agents, calls POST /api/v1/data-allocation/allocate

### Tasks Completed

- [x] Permission model: added parentId/parent/children hierarchy
- [x] Seed: 60+ permissions across switchboard, crm, campaign, report, ticket, qa, system groups
- [x] Seed: parent-child upsert ordering (parents first, then children with parentId)
- [x] Seed: role grants for all 7 roles including super_admin
- [x] data-scope-middleware: roles → data visibility documented and refined
- [x] data-allocation-controller: POST /allocate (contact, lead, debt_case), GET /agents
- [x] data-allocation-routes: wired with authMiddleware + requirePermission('crm.data_allocation')
- [x] Route registered in index.ts at /api/v1/data-allocation
- [x] DataAllocationDialog: reusable, fetches agent list, calls API, success/error toasts
- [x] contact-list, lead-list, debt-case-list: checkbox column + Phân bổ button (permission-gated)
- [x] campaign-list: checkbox column + Phân bổ button (guides user to AutoAssign per campaign detail)
- [x] prisma generate — success
- [x] backend tsc --noEmit — pass
- [x] frontend tsc --noEmit — pass

### Tests Status
- Type check (backend): pass
- Type check (frontend): pass
- Unit tests: not run (no new test files required per task scope)

### Issues Encountered
1. `auth-middleware.ts` exports `authMiddleware`, not `authenticate` — fixed import in routes file
2. `SelectTrigger onValueChange` typed as `(value: string | null)` — fixed with `(v) => setSelectedAgentId(v ?? '')`

### Campaign Note
Campaign entity has no `assignedTo` field — allocation is done at the leads/debt-cases level. The "Phân bổ" button on campaign-list shows an info toast guiding users to the per-campaign AutoAssign feature (already implemented via `AutoAssignButton`).

### Next Steps
- Run `prisma migrate dev` when DB migration window opens (adds `parent_id` column to permissions table)
- Agent 3 (permission-manager.tsx) can now read hierarchical permissions from GET /api/v1/permissions to render tree UI
- Consider adding `_hasCreatedBy` scope flag for Contact model in data-scope-middleware if agents need to see contacts they created
