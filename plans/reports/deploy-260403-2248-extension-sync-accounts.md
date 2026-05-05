# Deployment Report — Extension Sync & Account Management

**Date**: 2026-04-03
**Target**: 10.10.101.207 (dev server)
**Version**: v1.3.2
**Phase**: Phase 18

---

## Features Deployed

### Extension Sync via SSH
- `extension-sync-service.ts`: SSH into FusionPBX host using ssh2, query `v_extensions` table, upsert results into `ClusterExtension` table
- Endpoint: `POST /api/v1/clusters/:id/sync-extensions`
- SSH key auth (`/root/.ssh/id_rsa`) with 20s timeout fallback
- Returns `{ synced: N }` to UI

### Account Management (Cluster Extensions)
- Cluster detail form includes extensions tab showing all synced extensions
- `cluster-management.tsx`: pill color update (active=green, inactive=gray), banner removed
- `cluster-detail-form.tsx`: unsaved indicator + Cancel button

### Permission Matrix English Role Names
- `permission-matrix-table.tsx`: English labels in role column headers
- `role-tab-panel.tsx`: consistent English role display

### Data Isolation Fixes
- All service files (contact, lead, debt-case, call-log, campaign, user) now filter by active `clusterId`
- CDR webhook stores `clusterId` from active cluster context

### Contact Form Improvements
- Province/district dropdowns in `contact-form.tsx`
- `contact-detail-dialog.tsx`: wider dialog (max-w-4xl)

---

## Test Results

### Backend TypeScript Check
- `npx tsc --noEmit` — **PASS** (no errors)

### Frontend TypeScript Check
- `npx tsc --noEmit` — **PASS** (no errors)

### Backend Unit Tests (Vitest)
- Test files: 13 passed
- Tests: **217 passed** / 0 failed
- Duration: 34.87s

### E2E Tests
- Not run (server-side tests require live environment; skipped per standard deploy flow)

---

## Deployment Status

### File Transfer
- `packages/frontend/src/` → `/opt/crm/packages/frontend/src/` — OK
- `packages/backend/src/` → `/opt/crm/packages/backend/src/` — OK
- `packages/backend/prisma/schema.prisma` → OK
- `packages/backend/package.json` → OK

### Docker Build
- `crm-backend`: Built successfully (tsc + prisma generate)
- `crm-frontend`: Built successfully (vite build, 4060 modules)
- Build warnings: chunk size >500kB for `index.js` and `reports-page.js` (known, non-blocking)

### Database Migrations
- `npx prisma migrate deploy` — No pending migrations (5 applied, all current)

---

## Container Health Status

| Container | Image | Status | Health | Ports |
|-----------|-------|--------|--------|-------|
| crm-backend | crm-backend | running | **healthy** | 4000/tcp (internal) |
| crm-frontend | crm-frontend | running | running | 0.0.0.0:80,443 |
| crm-postgres | postgres:15-alpine | running | **healthy** | 5432/tcp (internal) |
| crm-redis | redis:7-alpine | running | **healthy** | 6379/tcp (internal) |

All containers up. Backend health check passed.

---

## Documentation Updated

- `docs/system-architecture.md` — Added: Extension Sync Flow, Multi-Tenant Data Isolation, Auto-Create Accounts, Account Management Module sections
- `docs/project-changelog.md` — Added v1.3.2 entry with full feature/file list
- `docs/codebase-summary.md` — Updated phase status (Phase 18, v1.3.2), file counts, Cluster Management endpoints, Extension Sync Service notes

---

## Issues Found

- Frontend chunk size warnings (index.js ~868kB gzip 280kB; reports-page.js ~408kB gzip 118kB). Not blocking; recommend code-splitting in future phase.
- No SSH host key configured by default on fresh clusters — sync will fail until `sshUser`/`sshPassword` are set per cluster.

---

## Next Steps

- Monitor logs for ESL reconnection after cluster switch
- Consider code-splitting reports-page bundle (dynamic import)
- Validate extension sync against live FusionPBX domain config
