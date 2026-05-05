# Thread H — Monitoring Alignment Report

## Files Modified

| File | Change |
|------|--------|
| `pages/monitoring/live-calls.tsx` | Full rewrite: breadcrumb, live pulsing badge + auto-refresh toggle, table with 7 cols (THỜI LƯỢNG / HƯỚNG / CALLER / DESTINATION / AGENT / TRẠNG THÁI / THAO TÁC), status pills, empty state |
| `pages/monitoring/agent-status-card.tsx` | M3 lavender avatar (#e8deff / #5434ae), leading-dot status pill, dashed divider, hover lift — removed emoji/CSS variable references |
| `pages/monitoring/agent-status-grid.tsx` | Breadcrumb, segment chips (Tất cả / Trực tuyến / Đang gọi / Vắng mặt / Offline) with violet active state, primary sweep line colour, kept existing StatsBar + TeamSection wiring |
| `pages/monitoring/team-stats.tsx` | Breadcrumb, team chip selector, KPI hero cards (4-col: Tổng / Tỷ lệ / Đang gọi / Ngoại tuyến), agent ranking table with mono cells, dashed dividers |
| `pages/monitoring/live-dashboard.tsx` | Breadcrumb, static tab strip (Cuộc gọi trực tiếp / Trạng thái agent / Thống kê team) with violet active underline on first tab, Panel border → #cac4d5, header dashed divider, avatar → #e8deff/#5434ae |

## TSC Result
Pass — zero errors

## Status
DONE

## Concerns / Unresolved Questions

1. **Tab strip in live-dashboard is static** — it renders the 3 tab labels with CSS `first-of-type` hack to highlight the first tab. Real routing/tab switching requires knowing the router structure (not in file ownership). Tabs are visual-only placeholders; no functionality broken.
2. **live-calls status filter** — active calls API returns arbitrary status strings; filter keeps rows where status is NOT in `['ended', 'failed']`. If the backend adds new terminal statuses, this allowlist approach needs updating.
3. **agent-status-card.tsx** — `AgentStatusCard` component is exported but `agent-status-grid.tsx` uses `AgentCardData` from `@/components/monitoring/agent-card` (read-only), not this card. The card is available for use elsewhere but not yet wired into the grid page (existing TeamSection handles rendering).
