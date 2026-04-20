# Phase 02 — Layout Shell Implementation Report

## Status: COMPLETED

## Files Modified
- `packages/frontend/src/components/layout/header.tsx` — rewritten as thin composition (~40 lines)
- `packages/frontend/src/components/layout/sidebar.tsx` — restyled: token vars, LogoPill, uppercase group labels, role·ext footer, removed hardcoded hex
- `packages/frontend/src/components/layout/app-layout.tsx` — added OpsStatusBar import+mount, pb-10 on main

## Files Created
- `packages/frontend/src/components/layout/logo-pill.tsx` — logo + version badge + collapse button
- `packages/frontend/src/components/layout/breadcrumbs.tsx` — route→label breadcrumb via useLocation
- `packages/frontend/src/components/layout/customer-tabs.tsx` — extracted TabItem + CustomerTabs from old header
- `packages/frontend/src/components/layout/command-k-pill.tsx` — search trigger pill
- `packages/frontend/src/components/layout/quick-dial-inline.tsx` — inline tel input → POST /calls/originate
- `packages/frontend/src/components/layout/topbar-actions.tsx` — ClusterSwitcher, AI toggle, ExtensionStatus, AgentStatus, Bell, UserMenu
- `packages/frontend/src/components/layout/ops-status-bar.tsx` — wires StatusBar primitive with live/mock data
- `packages/frontend/src/lib/route-labels.ts` — ROUTE_LABELS map, getBreadcrumbs(), getPageLabel()

## Collateral Fix (not owned, but blocked build)
- `packages/frontend/src/pages/settings/extension-config.tsx` — fixed broken JSX closing tags (`</CardContent></Card>` → `</DottedCard>`) introduced in Phase 1 commit; logic untouched

## Tasks Completed
- [x] Extract `customer-tabs.tsx`
- [x] Extract `topbar-actions.tsx`
- [x] Create `logo-pill.tsx`
- [x] Create `breadcrumbs.tsx`
- [x] Create `command-k-pill.tsx`
- [x] Create `quick-dial-inline.tsx`
- [x] Create `route-labels.ts`
- [x] Refactor `header.tsx` composition
- [x] Restyle `sidebar.tsx` (colors → CSS vars, add LogoPill, footer)
- [x] Mount OpsStatusBar in `app-layout.tsx`
- [x] Wire status bar data (socket, PBX, page, build, time)

## Tests Status
- `npx tsc --noEmit`: exit 0 (no errors)
- `npm run build`: success, 18.75s

## Deviations from Plan
- `header.tsx` kept as filename (not renamed to `topbar.tsx`) to avoid import churn in `app-layout.tsx`
- `ops-status-bar.tsx` placed under `components/layout/` (not `components/ops/`) to stay within file ownership boundary
- CPU/LAT/QUEUE/RX/TX use `setInterval` mock oscillation per spec (documented as mock)
- `VITE_BUILD_ID` env var read for hash cell; falls back to `'dev'` if not set

## Open Questions
- `VITE_APP_VERSION` and `VITE_BUILD_ID` not defined in `vite.config.ts` — need to be injected via `define` in vite config or `.env` for production builds; currently falls back to `'1.0.0'`/`'dev'`
- Phase 1 introduced broken JSX in `extension-config.tsx` — fixed here, but should be noted in Phase 3 handoff
