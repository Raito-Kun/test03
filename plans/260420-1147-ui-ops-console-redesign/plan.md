---
title: "UI Ops Console Redesign"
description: "Full frontend visual redesign to match retro-terminal Ops Console mockup, zero backend changes"
status: pending
priority: P2
effort: 5-7d
branch: feat/ui-ops-console-redesign
tags: [ui, frontend, redesign, tailwind, shadcn]
created: 2026-04-20
---

# UI Ops Console Redesign — Plan Overview

View-layer-only redesign to match the "CRM PLS — Ops Console" mockup. Business logic, stores, hooks, services, API contracts, routing guards, RBAC, feature flags, Socket.IO — all preserved. Backup tag `backup/pre-ui-redesign-260420` enables instant rollback.

## Design language summary
- Dark indigo sidebar `#1e1838`, cream body `#faf9f5`, violet accents `#c4b5fd/#a78bfa`
- Mono typography via JetBrains Mono (justified in phase-01)
- Dotted borders, dense dashboards, DOS/htop status bar
- Vietnamese labels preserved via `VI` dictionary

## Phases

| # | File | Status | Deliverable |
|---|------|--------|-------------|
| 01 | [phase-01-design-tokens.md](./phase-01-design-tokens.md) | pending | New `app.css` tokens, mono font, dotted border utility, reusable primitives |
| 02 | [phase-02-layout-shell.md](./phase-02-layout-shell.md) | pending | New sidebar, topbar (breadcrumbs + tabs + ⌘K + AI + quick-dial), status bar |
| 03 | [phase-03-dashboard-tong-quan.md](./phase-03-dashboard-tong-quan.md) | pending | Rebuild `pages/dashboard.tsx` — KPI strip, rate cards, live log, agents table, 24h heatmap, inline dialer |
| 04 | [phase-04-pages-migration.md](./phase-04-pages-migration.md) | pending | Apply tokens/primitives to all 14 pages (list/detail/settings/monitoring) |
| 05 | [phase-05-test-and-deploy.md](./phase-05-test-and-deploy.md) | pending | E2E tests, visual regression, staged dev deploy, rollback drill |

## Key constraints
- No backend/API contract changes (see [research/api-gap-analysis.md](./research/api-gap-analysis.md))
- Each phase independently merge-able & deployable to dev
- Every file stays <200 lines (project rule)
- YAGNI: no features beyond mockup

## Dependencies
- Phase 01 blocks all others (tokens + primitives)
- Phase 02 blocks 03, 04 (layout shell)
- Phase 03 & 04 can run in parallel after 02
- Phase 05 requires 03 + 04 complete

## API gaps flagged (defer to follow-up backend)
- 24h call volume heatmap → `GET /dashboard/call-volume-24h` (not yet built — mock in phase-03)
- System activity log → reuse Socket.IO event stream (no new endpoint)
- KPI deltas "vs HÔM QUA" → `GET /dashboard/overview?compare=yesterday` (defer; UI shows `—` placeholder)
- Inline softphone UI → reuses existing `ClickToCallButton` + SIP.js store; cosmetic only

See [research/api-gap-analysis.md](./research/api-gap-analysis.md) for full matrix.

## Rollback
`git reset --hard backup/pre-ui-redesign-260420` per phase if needed.

## Post-merge follow-ups (2026-04-22)

Micro-iterations on top of the merged redesign — delivered independently of phase 05, deployed dev + prod.

| Date | Change | Files | Deploy |
|---|---|---|---|
| 2026-04-22 12:23 | Call-logs list UX: drop default search frame, add dedicated "Số nhận" input, disposition save button (emerald) when dirty | `pages/call-logs/*` | dev + prod `8a005a2` |
| 2026-04-22 12:40 | Call-logs filter explicit submit — draft state + "Tìm kiếm" button, Enter-to-submit | `pages/call-logs/*` | dev + prod `29200b6` |
| 2026-04-22 15:45 | Cluster ext-sync lifecycle — 4 DB fields, auto-sync state machine, UI badges + 2s polling, migration `20260422150000_add_cluster_ext_sync_status` | `cluster-service.ts`, `cluster-controller.ts`, `cluster-management.tsx`, `cluster-detail-form.tsx`, `app.css`, `schema.prisma` | dev + prod (uncommitted) |
| 2026-04-22 16:05 | Primary CTA color darkened `#b8a5f5 → #6d4fc8` — "Lưu thay đổi" + 80 other default-variant buttons read as solid | `app.css` | dev + prod (uncommitted) |

Uncommitted changes still live on dev + prod — commit + push to `feat/ui-ops-console-redesign` when ready.
