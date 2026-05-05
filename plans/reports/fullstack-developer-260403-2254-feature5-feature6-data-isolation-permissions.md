# Phase Implementation Report

### Executed Phase
- Phase: feature5-permission-headers + feature6-data-isolation
- Plan: none (ad-hoc tasks)
- Status: completed

### Files Modified

**Backend:**
- `packages/backend/src/lib/jwt.ts` — added `clusterId: string | null` to `TokenPayload`
- `packages/backend/src/lib/active-cluster.ts` — added optional `userClusterId` param; when provided, skips DB query and returns it directly
- `packages/backend/src/services/auth-service.ts` — include `user.clusterId` in JWT payload for both `login()` and `refresh()`
- `packages/backend/src/services/contact-service.ts` — `listContacts`, `createContact`, `getContactById`, `updateContact`, `deleteContact`, `getContactTimeline` accept `userClusterId?` and pass to `getActiveClusterId()`
- `packages/backend/src/services/lead-service.ts` — `listLeads`, `createLead`, `listFollowUps` accept `userClusterId?`
- `packages/backend/src/services/debt-case-service.ts` — `listDebtCases`, `createDebtCase` accept `userClusterId?`
- `packages/backend/src/services/call-log-service.ts` — `listCallLogs` accepts `userClusterId?`
- `packages/backend/src/services/campaign-service.ts` — `listCampaigns`, `createCampaign` accept `userClusterId?`
- `packages/backend/src/services/user-service.ts` — `listUsers`, `createUser` accept `userClusterId?`
- `packages/backend/src/controllers/contact-controller.ts` — passes `req.user!.clusterId` to all service calls
- `packages/backend/src/controllers/lead-controller.ts` — passes `req.user!.clusterId`
- `packages/backend/src/controllers/debt-case-controller.ts` — passes `req.user!.clusterId`
- `packages/backend/src/controllers/call-log-controller.ts` — passes `req.user!.clusterId`
- `packages/backend/src/controllers/campaign-controller.ts` — passes `req.user!.clusterId`
- `packages/backend/src/controllers/user-controller.ts` — passes `req.user!.clusterId`

**Frontend:** No changes needed (ROLE_LABELS already English).

**Server:** Removed stale `/opt/crm/packages/backend/src/src/` compiled output, rebuilt + redeployed backend container.

### Tasks Completed

- [x] Feature 5: Permission matrix table headers — already correct, `ROLE_LABELS` in `permission-matrix-table.tsx` already uses Manager/Supervisor/Leader/Agent (English)
- [x] Feature 6: Add `clusterId` to JWT `TokenPayload`
- [x] Feature 6: `getActiveClusterId()` accepts optional `userClusterId` override (per-user isolation)
- [x] Feature 6: All 6 services pass user's clusterId through from controllers
- [x] Feature 6: JWT now contains clusterId (verified via login test)
- [x] Feature 6: Data isolation verified — 4 contacts returned for active cluster only
- [x] Backend rebuilt and deployed to dev server (healthy)

### Tests Status
- Type check backend: pass (no output = clean)
- Type check frontend: pass (no output = clean)
- Backend deploy: healthy container confirmed
- JWT payload verification: clusterId `20000000-0000-0000-0000-000000000001` present in token
- Contacts API: returns cluster-scoped results (4 records matching DB count)

### Issues Encountered

1. **Stale `src/src/` compiled TS files** on dev server caused Docker build failure — fixed by removing `/opt/crm/packages/backend/src/src/`. Pre-existing issue, not caused by these changes.
2. **Feature 5 was already implemented** — `ROLE_LABELS` in `permission-matrix-table.tsx` already had English names (Manager, Supervisor, Leader, Agent). No code change needed.
3. **`supervisor` role** exists in frontend code but NOT in Prisma DB enum. Pre-existing inconsistency, out of scope.

### Key Design Decision — Data Isolation

Previous: `getActiveClusterId()` hit DB each request to find `isActive=true` cluster. When no active cluster → returns null → no filter → all data visible.

Now: JWT token contains `clusterId` from user's own `clusterId` field. Each request uses the user's cluster directly (zero extra DB queries for common case). Falls back to global active cluster only if user has no `clusterId`.

### Next Steps

- When a user has `clusterId = null` (e.g. super_admin), they still fall back to global active cluster. Consider if super_admin should see ALL clusters or only the active one.
- Webhook controller still uses global `getActiveClusterId()` (correct — no auth context in webhooks).

### Unresolved Questions

- Should super_admin (who may have `clusterId = null`) see data from ALL clusters or only the active one?
- Are there any jobs/cron tasks that query data without user context that need cluster isolation?
