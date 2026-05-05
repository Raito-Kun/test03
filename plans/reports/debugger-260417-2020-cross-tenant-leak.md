# Cross-Tenant Data Leak — debugger report
**Date:** 2026-04-17 | **Branch:** master | **Commit under review:** `1d0c429`

---

## Evidence

### 1. `resolveListClusterFilter` ignores `userRole` entirely

`packages/backend/src/lib/active-cluster.ts:27-33`

```ts
export async function resolveListClusterFilter(
  userRole: string | undefined,
  userClusterId?: string | null,
): Promise<string | null> {
  void userRole;                        // <-- role is explicitly discarded
  return getActiveClusterId(userClusterId);
}
```

`getActiveClusterId` (line 9-17) short-circuits immediately when `userClusterId` is truthy:
```ts
if (userClusterId) return userClusterId;  // returns blueva's ID every time
```

### 2. super_admin JWT always carries `clusterId = blueva`

`packages/backend/src/services/auth-service.ts:55-58` — JWT payload is:
```ts
{ userId, role, teamId, clusterId: user.clusterId }
```

Dev DB confirms: `users` table — `superadmin@crm.local` has `cluster_id = 13bec0b3` (PBX-101.206_blueva).

```
 id (users)       | role        | cluster_id
------------------+-------------+--------------------------------------
 10000000-…-0000  | super_admin | 13bec0b3-a748-4bff-9e4e-046e20c65319  ← blueva
```

### 3. `switchCluster` mutates `pbx_clusters.is_active` only — JWT unchanged

`packages/backend/src/services/cluster-service.ts:132-141`

```ts
export async function switchCluster(id: string, ...) {
  await prisma.$transaction([
    prisma.pbxCluster.updateMany({ data: { isActive: false } }),
    prisma.pbxCluster.update({ where: { id }, data: { isActive: true } }),
  ]);
  // No user.clusterId update, no JWT re-issue
}
```

Frontend (`cluster-switcher.tsx:37-44`) calls `POST /clusters/:id/switch` then `window.location.reload()`.  
The existing 15-minute JWT survives the reload — it still holds `clusterId = blueva`.

### 4. All list services use the leaking pattern

Every service passes `req.user.clusterId` (= blueva) into `resolveListClusterFilter`:

| Service | File | Line |
|---|---|---|
| contacts | contact-service.ts | 67 |
| contacts (getById) | contact-service.ts | 166 |
| leads | lead-service.ts | 46 |
| leads (followUps) | lead-service.ts | 179 |
| call_logs | call-log-service.ts | 48 |
| debt_cases | debt-case-service.ts | 50 |
| campaigns | campaign-service.ts | 46 |
| users | user-service.ts | 32 |

Pattern in every service:
```ts
const clusterId = await resolveListClusterFilter(userRole, userClusterId);
const where = { ...(clusterId && { clusterId }) };
```
When `clusterId` = blueva's ID (truthy), filter is `WHERE cluster_id = '13bec0b3'` — always blueva.

### 5. Dev DB data distribution

```
pbx_clusters.is_active:
  20000000-…-0001  crm         is_active=false
  2fa9d81c-…      ncp2        is_active=true   ← currently active
  13bec0b3-…      blueva      is_active=false

call_logs per cluster:
  crm cluster    → 24 rows
  blueva cluster → 11 rows
  null           →  3 rows

contacts per cluster:
  blueva cluster → 3 rows (all contacts are blueva)
```

When super_admin is "on" the crm cluster (switched via UI), their API calls return blueva contacts/call_logs because JWT `clusterId` = blueva and `resolveListClusterFilter` returns it verbatim.

---

## Root Cause

`resolveListClusterFilter` was re-written in commit `1d0c429` to discard the `userRole` parameter (`void userRole`) and delegate entirely to `getActiveClusterId(userClusterId)`. For super_admin, `userClusterId` is always the cluster they belong to in the `users` table (blueva), so `getActiveClusterId` returns blueva immediately without ever consulting the DB's `isActive` flag. The `switchCluster` endpoint only flips `pbx_clusters.isActive` — it never re-issues the JWT or updates `users.cluster_id`. The frontend reloads with the stale JWT, so every subsequent list request is scoped to blueva regardless of which tenant the super_admin switched to. The stale comment on `contact-service.ts:86` ("super_admin bypasses cluster filter") documents the original intended behaviour that was never wired up.

---

## Recommended Fix

**Strategy:** For super_admin, `resolveListClusterFilter` should fall through to the DB-based `isActive` lookup (ignoring the JWT `clusterId`), so it follows whatever `switchCluster` last set. For all other roles, keep the existing JWT-based fast-path.

**File:** `packages/backend/src/lib/active-cluster.ts`

### Before (lines 27-33)
```ts
export async function resolveListClusterFilter(
  userRole: string | undefined,
  userClusterId?: string | null,
): Promise<string | null> {
  void userRole;
  return getActiveClusterId(userClusterId);
}
```

### After
```ts
export async function resolveListClusterFilter(
  userRole: string | undefined,
  userClusterId?: string | null,
): Promise<string | null> {
  // super_admin: ignore JWT clusterId — always scope to the globally-active cluster
  // so that switchCluster (which flips pbx_clusters.isActive) takes effect immediately.
  if (userRole === 'super_admin') {
    const cluster = await prisma.pbxCluster.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    return cluster?.id ?? null;
  }
  // All other roles: use JWT clusterId (fast-path, no DB hit)
  return getActiveClusterId(userClusterId);
}
```

**Blast radius:** Single function, 6 lines changed. All 8 call-sites are unmodified. The `getActiveClusterId` helper used for create/stamp operations is untouched — no regression risk there.

**Caveat:** This ties super_admin's view to whichever cluster is globally marked `isActive`. That is how `switchCluster` works today and matches the frontend UI. If the intent later becomes per-user/per-session selection, a separate `X-Selected-Cluster-Id` header + per-user session store would be needed — but that is a separate feature.

---

## Risk

| Risk | Severity | Notes |
|---|---|---|
| Super_admin can now only see one cluster at a time | Low | This is the intended UX per commit description |
| If no cluster has `isActive=true`, filter returns `null` → all rows | Medium | Pre-existing gap; can add a fallback or enforce at least one active cluster |
| Concurrent `switchCluster` calls from multiple super_admins | Medium | Already shared-state; not introduced by this fix |

---

## Unresolved

1. The `users.cluster_id` for `superadmin@crm.local` is set to blueva. Should super_admin have `cluster_id = null` in the `users` table to make the intent explicit? Currently it's meaningful only as a fallback in the existing broken path.
2. Dashboard/report endpoints — are there any that bypass `resolveListClusterFilter` entirely and do their own Prisma queries without a cluster filter? Not checked (no `resolveListClusterFilter` import found in `dashboard-service` — verify if that service exists).
3. If the fix lands, super_admins currently mid-session will still leak for up to 15 minutes (JWT TTL). A forced token invalidation on `switchCluster` would close this window.
