# Phase 03 — Dashboard "Tổng quan" Rebuild

## Context Links
- Plan: [../plan.md](./plan.md)
- Phase 01 (primitives): [./phase-01-design-tokens.md](./phase-01-design-tokens.md)
- Phase 02 (shell): [./phase-02-layout-shell.md](./phase-02-layout-shell.md)
- Gap analysis: [./research/api-gap-analysis.md](./research/api-gap-analysis.md)
- Current: `packages/frontend/src/pages/dashboard.tsx` (237 lines — over limit, will split)

## Overview
- **Priority**: P2
- **Status**: pending
- **Effort**: ~1.5 days
- Rebuild the `/` dashboard to match mockup: session-code header, 6 KPI strip, 4 rate cards, 3-col row (live log + agents + inline dialer), 24h heatmap. Uses same React Query keys, same endpoints, same data contracts.

## Key Insights
- Existing query keys `['dashboard-overview']` + `['dashboard-agents']` with 30s refetch — reuse as-is.
- Mockup's "session code" is cosmetic; generate client-side on mount.
- Sparklines need a value history — `use-sparkline-buffer.ts` (from phase-01) captures last 7 overview values in memory; resets on page unmount (acceptable).
- Live log needs Socket.IO subscription to multiple event names → centralize in new `use-activity-log.ts` hook, buffer last 50 events.
- Heatmap: no backend API (flagged). Ship with mocked data + clearly marked "MOCK" pill in corner; wire real data once `GET /dashboard/call-volume-24h` exists.
- Agents table already has `currentStatus.status` — add extension, wrap time, last activity via existing fields (no new API).

## Requirements

### Functional
- Header strip: session code (`SESS-XXXXX`), LIVE indicator (green pulse when socket connected), REFRESH (refetches both queries), EXPORT (opens existing export route if available for the user's role), THÊM (dropdown: add contact/lead/ticket).
- KPI strip (6 cards): Tổng cuộc gọi / Đã nghe / Nhỡ / Đang gọi / Thời lượng TB / Uptime. Each card shows value + sparkline + delta placeholder `—` (until backend supports compare).
- Rate cards (4): Tỷ lệ liên hệ / chốt đơn / PTP / thu hồi — progress bar + % + source subtitle.
- Live log panel: scrolling feed of socket events, color-coded by type, max 50 items.
- Agents panel: table/list with extension, status dot, status label, elapsed time, phone icon for whisper (reuse `POST /monitoring/whisper`).
- Inline dialer panel: keypad grid + input + call button. Wraps existing `ClickToCallButton` behavior — no new SIP logic.
- 24h heatmap: 24 cells × 1 row (or 24×3 for total/answered/missed). MOCK badge visible.

### Non-functional
- Each component file <150 lines.
- Dashboard page file <100 lines (composition only).
- Refetch interval: 30s (unchanged).
- No new deps; heatmap = pure SVG (see decisions).

## Architecture

### File split
```
pages/dashboard/
├── index.tsx                      (composition, <100 lines)
├── dashboard-header.tsx           (session + LIVE + actions, <80)
├── kpi-strip.tsx                  (6 KpiCell in grid, <60)
├── rate-cards-row.tsx             (4 rate cards, <80)
├── activity-log-panel.tsx         (live feed, <120)
├── agents-panel.tsx               (agents list, <120)
├── inline-dialer-panel.tsx        (softphone-style UI, <150)
└── call-volume-heatmap.tsx        (24-bucket SVG, <100)

hooks/
├── use-activity-log.ts            (socket event buffer, <80)
└── use-dashboard-overview.ts      (extracted query + sparkline buffers, <60)
```

### Data flow
```
useDashboardOverview() ──┬── KpiStrip (values + sparkline buffers)
                         └── RateCardsRow
useQuery('dashboard-agents') ──── AgentsPanel
useActivityLog()          ──── ActivityLogPanel    (reads socket)
heatmap (mocked)          ──── CallVolumeHeatmap
```

### Library decisions (resolves open questions)

| Decision | Choice | Rationale |
|---|---|---|
| Mono font | **JetBrains Mono** (free via fontsource) | Geist Mono lacks fontsource package; JetBrains Mono has full Latin + Vietnamese diacritics support & variable axis |
| Heatmap | **Custom SVG** (no library) | 24 cells, one row. `recharts` + `visx` add >80KB for trivial render. SVG = ~60 lines, zero deps |
| Inline dialer | **Widget wrapping existing `ClickToCallButton` / SIP.js store** — replaces dashboard's `QuickDialCard` only. Global call bar (`CallBar`) untouched |
| Theme toggle | **Remove toggle** — mockup is light-only. Keep `theme-store.ts` (stores default 'light'); delete any UI button. Not dropping `.dark` CSS block in phase-01 (regression safety net) |

## Related Code Files

### Modify
- `packages/frontend/src/pages/dashboard.tsx` → split into folder `pages/dashboard/index.tsx`
- Route import in `app.tsx` → update lazy path `'@/pages/dashboard/index'`

### Create
- `packages/frontend/src/pages/dashboard/dashboard-header.tsx`
- `packages/frontend/src/pages/dashboard/kpi-strip.tsx`
- `packages/frontend/src/pages/dashboard/rate-cards-row.tsx`
- `packages/frontend/src/pages/dashboard/activity-log-panel.tsx`
- `packages/frontend/src/pages/dashboard/agents-panel.tsx`
- `packages/frontend/src/pages/dashboard/inline-dialer-panel.tsx`
- `packages/frontend/src/pages/dashboard/call-volume-heatmap.tsx`
- `packages/frontend/src/hooks/use-activity-log.ts`
- `packages/frontend/src/hooks/use-dashboard-overview.ts`

### Delete
- Old `pages/dashboard.tsx` single file (moved into folder)

## Implementation Steps

1. Create `hooks/use-dashboard-overview.ts` — wraps the existing query, exposes `{ data, isLoading, sparklines: Record<string, number[]> }`.
2. Create `hooks/use-activity-log.ts` — subscribes to `call-update`, `agent-status-update`, `ticket-created`, `inbound-call` socket events; pushes to a ring buffer (50).
3. Build `kpi-strip.tsx` using `KpiCell` primitive + sparkline buffer.
4. Build `rate-cards-row.tsx` with progress bars (plain div + width%).
5. Build `activity-log-panel.tsx` consuming `useActivityLog()`.
6. Build `agents-panel.tsx` — restyle existing `AgentListItem` rendering.
7. Build `inline-dialer-panel.tsx` — keypad grid + input + `ClickToCallButton`.
8. Build `call-volume-heatmap.tsx` — accepts `Array<{ hour, total }>`; renders 24 rects; MOCK pill visible.
9. Build `dashboard-header.tsx` — session code, LIVE dot, Refresh (calls `queryClient.invalidateQueries(['dashboard-overview'])`), Export, Thêm menu.
10. Compose in `pages/dashboard/index.tsx` — <100 lines.
11. Update route import path in `app.tsx`.
12. `npm run build`; run dev; verify refetch, socket log, dialer.

## Todo List
- [ ] Extract `useDashboardOverview` hook
- [ ] Build `useActivityLog` hook (socket events)
- [ ] Build `DashboardHeader` (session, LIVE, actions)
- [ ] Build `KpiStrip` with sparklines
- [ ] Build `RateCardsRow`
- [ ] Build `ActivityLogPanel`
- [ ] Build `AgentsPanel`
- [ ] Build `InlineDialerPanel`
- [ ] Build `CallVolumeHeatmap` (mocked data + MOCK pill)
- [ ] Compose in new `dashboard/index.tsx`
- [ ] Update route import in `app.tsx`
- [ ] Delete old `pages/dashboard.tsx`
- [ ] Build green; manual smoke (refresh / socket / dial / whisper)

## Success Criteria
- Dashboard renders without console errors.
- Refresh button clears both queries.
- Socket connect/disconnect flips LIVE indicator.
- Activity log populates when an inbound call or status change happens.
- Inline dialer successfully triggers call via existing endpoint.
- Heatmap displays MOCK pill unambiguously.
- All files <200 lines.

## Risk Assessment
- **Risk**: sparkline buffer resets on unmount (agent navigates away and back).
  - **Mitigation**: acceptable for MVP; flag in gap analysis as "persist to localStorage" follow-up.
- **Risk**: socket event names drift from backend over time.
  - **Mitigation**: use shared event name constants from `packages/shared` if they exist; else add TODO comment.
- **Risk**: Agent role sees dashboard but `RoleGuard` already redirects non-supervisors to `/contacts` — rebuild must respect.
  - **Mitigation**: no change to `app.tsx` route guard.
- **Risk**: Heatmap mock data looks real and misleads ops.
  - **Mitigation**: persistent MOCK badge + tooltip "Dữ liệu mô phỏng — endpoint chưa triển khai".

## Security Considerations
- Whisper action requires `view_recordings` permission — already enforced backend-side.
- Export action respects existing FeatureGuard for `/reports`.

## Next Steps
- Phase 04 applies same primitives to other pages.
- Follow-up backend phase: implement `/dashboard/call-volume-24h` + `?compare=yesterday` → swap mock for real data.
