---
type: deploy-report
date: 2026-04-21 22:05 +0700
target: 10.10.101.207 (dev)
branch: feat/ui-ops-console-redesign
commits: 4afc578, afbb205
---

# RBAC Permission Dedup + recording.delete + Enforcement Fixes

## Scope

1. 16 legacy plural permission keys (`manage_*`, `view_*`, `import_*`, `export_*`) merged into modern `resource.action` keys. Permission matrix UI now shows 7 groups instead of 12+.
2. New permission `recording.delete` + `DELETE /api/call-logs/:id/recording` endpoint with cluster scope, path-escape guard, audit log.
3. `ticket.delete` enforcement moved from hardcoded role check in service to `requirePermission` middleware.
4. `crm.contacts.delete` + bulk-delete wired through permission middleware.
5. Legacy `manage_teams` / `manage_clusters` sidebar keys collapsed to `system.manage`.

## Deploy flow

1. `tar czf /tmp/crm-sync.tar.gz packages/` → `scp` → server extract — 924KB
2. `docker compose build backend frontend` — 97s backend, 42s frontend
3. `docker compose up -d --force-recreate backend frontend` — healthy after 9s
4. Migration `20260421211700_rbac_dedup` applied via direct `psql` (see issue below), then recorded in `_prisma_migrations` manually.
5. `prisma db seed` — added `campaign.import`, `crm.leads.import`, `recording.delete` with default role grants.
6. Redis scan `permissions:*` + DEL — no keys existed (in-memory cache; Redis not yet wired).

## Verification

```
    group    | count 
-------------+-------
 campaign    |     6
 crm         |    15
 qa          |     4
 report      |     5
 switchboard |     8
 system      |     6
 ticket      |     5
(7 rows)
```

| Permission | Grants (cluster × role) |
|---|---|
| `campaign.import` | 9 (super_admin, admin, manager × 3 clusters) |
| `crm.leads.import` | 9 |
| `crm.contacts.delete` | 10 |
| `ticket.delete` | 9 |
| `recording.delete` | **6** (super_admin + admin only × 3 clusters) ✓ |

- `curl https://localhost/api/v1/auth/me` → 401 (correct, unauthenticated)
- `curl https://localhost/` → 200 (frontend served)
- Container health:
  - `crm-backend`: Up 4m (healthy)
  - `crm-frontend`: Up 4m
  - `crm-postgres`, `crm-redis`: healthy (no restart needed)

## Issues encountered

1. **Prisma `migrate deploy` didn't detect the new migration** — reported "5 migrations found" despite 18 being present in both host and container `prisma/migrations/`. Worked around by applying SQL directly via `psql`, then manually inserting into `_prisma_migrations` to mark resolved. Root cause unclear, may be related to `NODE_ENV=production` + Prisma config baseline behavior; warrants investigation before next schema change.
2. **Migration SQL had enum cast bug** — `('super_admin'::text)` passed to `role` column (Postgres enum `Role`) errored. Fixed in-place (`r.role::"Role"`) and re-applied; idempotent DO block recovered cleanly.
3. **Redis permission cache is in-memory per-worker** — not a Redis key, so nothing to bust. Cache TTL ~5min; behavior acceptable for single-worker dev. Flagged for follow-up (W3 in code review).

## Rules preserved

- Prod gate respected — dev only, no prod deploy attempted.
- No `.env` modified; no destructive commands without idempotency guard.
- Role capabilities preserved exactly (audit by key mapping, no user lost access).

## Unresolved / Follow-up

1. Prisma `migrate deploy` drift — 18 migrations in dir, Prisma sees 5. Need to investigate before next migration.
2. Permission cache → move from in-memory Map to Redis for multi-worker safety.
3. `createCluster` does NOT seed default `role_permissions` for new clusters — pre-existing gap; any fresh tenant added via UI won't have modern permissions until manual seed. Flagged by code-reviewer.
4. Contact create/update routes still use `requireRole` instead of `requirePermission('crm.contacts.create'/'edit')` — inconsistent with dedup direction; follow-up.
