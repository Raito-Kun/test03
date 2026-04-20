# Phase 03 Implementation Report — Dashboard Tổng quan

## Executed Phase
- Phase: phase-03-dashboard-tong-quan
- Plan: plans/260420-1147-ui-ops-console-redesign
- Status: completed

## Files Modified
- `packages/frontend/src/app.tsx` — 1 line: import path → `@/pages/dashboard/index`
- `packages/frontend/src/pages/dashboard.tsx` — DELETED (replaced by folder)

## Files Created
| File | Lines | Purpose |
|---|---|---|
| `src/hooks/use-dashboard-overview.ts` | 62 | Wraps dashboard-overview query + 6 sparkline buffers |
| `src/hooks/use-activity-log.ts` | 89 | Socket.IO event buffer (ring 50), seed fallback |
| `src/pages/dashboard/index.tsx` | 37 | Composition root (<100 lines) |
| `src/pages/dashboard/dashboard-header.tsx` | 108 | Session code, LIVE indicator, REFRESH/EXPORT/THÊM |
| `src/pages/dashboard/kpi-strip.tsx` | 70 | 6 KpiCell cards with sparklines |
| `src/pages/dashboard/rate-cards-row.tsx` | 82 | 4 progress-bar rate cards with target marker |
| `src/pages/dashboard/activity-log-panel.tsx` | 62 | Live event feed, tone-coded dots, auto-scroll |
| `src/pages/dashboard/agents-panel.tsx` | 107 | Agent table: monogram avatar, ext, status chip, elapsed |
| `src/pages/dashboard/inline-dialer-panel.tsx` | 94 | Keypad + phone input + ClickToCallButton + recent list |
| `src/pages/dashboard/call-volume-heatmap.tsx` | 95 | 3×24 SVG heatmap, deterministic mock, MOCK pill |

All files under 150 lines. ✓

## Tasks Completed
- [x] Extract `useDashboardOverview` hook
- [x] Build `useActivityLog` hook (socket events + seed)
- [x] Build `DashboardHeader` (session code, LIVE, actions)
- [x] Build `KpiStrip` with sparklines + `—` delta placeholders
- [x] Build `RateCardsRow` with progress bars + 60% target marker
- [x] Build `ActivityLogPanel` (auto-scroll, tone dots)
- [x] Build `AgentsPanel` (monogram, ext badge, status chip, elapsed)
- [x] Build `InlineDialerPanel` (keypad, ClickToCallButton, recent)
- [x] Build `CallVolumeHeatmap` (3 rows × 24 cols, MOCK pill)
- [x] Compose `pages/dashboard/index.tsx` (<40 lines)
- [x] Update route import in `app.tsx`
- [x] Delete old `pages/dashboard.tsx`

## Tests Status
- Type check: **pass** — 0 errors in Phase 3 files (pre-existing campaign errors in vi-text unrelated to this phase)
- Build: **pass** — `✓ built in 11.61s` (4108 modules)
- Unit tests: not run (no unit tests exist for dashboard in this repo)

## Mock / Deferred Items (per gap analysis)
- KPI deltas: render `—` placeholder everywhere ✓
- 24h heatmap: deterministic seed mock, MOCK pill visible ✓
- Uptime: hardcoded `100%` ✓
- Recent calls in dialer: static seed data (cosmetic) ✓

## Issues Encountered
- Windows OneDrive EPERM on first `npm run build` (dist dir locked). Resolved by `rm -rf dist` before rebuild.
- Pre-existing TS errors in `campaign-agents-tab.tsx` / `campaign-create-dialog.tsx` / `campaign-info-form.tsx` referencing VI.campaign fields. These exist in `vi-text.ts` working tree but are from a different branch state — not introduced by Phase 3. Build compiles successfully despite tsc errors in those files.

## Next Steps
- Phase 04 applies same primitives to other pages
- Follow-up backend: `GET /dashboard/call-volume-24h` + `?compare=yesterday` to swap mocks
- Agents panel: add whisper button (POST /monitoring/whisper) when permission guard is wired
