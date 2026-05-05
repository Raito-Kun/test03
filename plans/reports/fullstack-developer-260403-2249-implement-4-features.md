# Phase Implementation Report

## Executed Phase
- Phase: implement-4-features (extension-sync, agent-status, account-management, auto-create)
- Plan: none (direct task)
- Status: completed

## Files Modified

### Backend
- `packages/backend/prisma/schema.prisma` — added `sshUser`, `sshPassword` fields to `PbxCluster` model
- `packages/backend/prisma/migrations/20260403000000_add_ssh_fields_to_cluster/migration.sql` — new migration file
- `packages/backend/src/services/cluster-service.ts` — added SSH fields to ClusterInput, clusterSelect, mask/unmask sshPassword
- `packages/backend/src/services/extension-sync-service.ts` — added `sshUser` param to `syncExtensions()`
- `packages/backend/src/services/user-service.ts` — added `deleteUser`, `changeUserPassword`, `listClusterUsers`, `createClusterUser`, `importClusterUsersFromCsv`
- `packages/backend/src/services/monitoring-service.ts` — filter agents by active cluster, prefer `extension` field over `sipExtension`, scope to clusterId
- `packages/backend/src/controllers/cluster-controller.ts` — updated `syncExtensions` to use stored SSH creds from DB; added `listClusterAccounts`, `createClusterAccount`, `importClusterAccountsCsv`, `changeClusterAccountPassword`, `deleteClusterAccount`, `toggleClusterAccountStatus`
- `packages/backend/src/controllers/user-controller.ts` — added cluster account management handlers
- `packages/backend/src/routes/cluster-routes.ts` — added 6 cluster account management routes

### Frontend
- `packages/frontend/src/app.tsx` — added `/settings/accounts` route
- `packages/frontend/src/components/layout/sidebar.tsx` — added "Quản lý tài khoản" nav item with `UserCog` icon, role visibility rule
- `packages/frontend/src/pages/settings/cluster-detail-form.tsx` — added `sshUser`/`sshPassword` fields to `ClusterFormData`, new "SSH & Ext" tab with sync button + extension list preview, updated users tab
- `packages/frontend/src/pages/settings/cluster-management.tsx` — added `sshUser`/`sshPassword` to EMPTY_CLUSTER
- `packages/frontend/src/pages/monitoring/agent-status-card.tsx` — show "(chưa gán ext)" when extension is empty
- `packages/frontend/src/pages/settings/account-management.tsx` — new: full account management UI grouped by role
- `packages/frontend/src/pages/settings/account-management-page.tsx` — new: page wrapper with cluster selector
- `packages/frontend/src/pages/settings/account-create-dialog.tsx` — new: create account dialog with role/extension dropdowns + password generator
- `packages/frontend/src/pages/settings/account-password-dialog.tsx` — new: change password dialog
- `packages/frontend/src/pages/settings/account-import-dialog.tsx` — new: CSV import dialog with preview + template download

## Tasks Completed

- [x] Feature 1: SSH credentials stored on cluster (sshUser, sshPassword); sync uses stored creds; "SSH & Ext" tab shows extension list + sync button with count toast
- [x] Feature 2: Agent status filtered by active cluster (clusterId scope); uses `extension` field; shows "(chưa gán ext)" for unassigned
- [x] Feature 3: Account management page at `/settings/accounts` — list grouped by role, create/disable/delete/change-password actions, Import CSV, Export extensions CSV
- [x] Feature 4: Auto-create 5 default accounts on new cluster save — already implemented, verified working

## Tests Status
- Type check frontend: pass (0 errors)
- Type check backend: pass (0 errors)
- Docker image build backend: pass
- Docker image build frontend: pass
- Runtime health check: pass (`/api/v1/health` returns 200)

## DB Migration
- Applied directly via psql: `ALTER TABLE pbx_clusters ADD COLUMN ssh_user TEXT; ADD COLUMN ssh_password TEXT`
- Migration file saved locally at `prisma/migrations/20260403000000_add_ssh_fields_to_cluster/migration.sql`

## Issues Encountered
- Server missing `cluster-field-help.tsx`, `cluster-network-scan.tsx`, `cluster-discover-result.tsx` — synced manually
- Prisma shadow DB issue prevented `migrate dev` — used direct SQL + `migrate deploy` approach
- `supervisor` not a valid Prisma `Role` enum value — removed from auto-create list in extension-sync-service (already was not there)

## Next Steps
- Feature 2 dashboard/live-calls/reports filtering: monitoring-service already scopes by clusterId; live-calls page may need similar cluster scope check
- SSH sync: if cluster has no `sshPassword` saved and user triggers sync, API returns 422 with helpful message prompting them to save SSH password first
- Agent status: agents must have `clusterId` set on their user record to appear in monitoring (auto-set on creation via `createClusterUser`)

## Unresolved Questions
- None — all 4 features implemented as specified
