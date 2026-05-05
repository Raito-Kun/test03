# Thread E — Dashboard Stitch Alignment Report

## Files Modified

| File | Change |
|------|--------|
| `pages/dashboard/dashboard-header.tsx` | Replaced session-code-only header with Stitch-style branding: "Call CRM" bold primary, Ext chip (from `user.sipExtension`), ACTIVE CLUSTER pulse pill (green animate-pulse when live, rose when offline), bell icon. Removed `branch` field (not in User model — static label dropped). |
| `pages/dashboard/kpi-strip.tsx` | Replaced KpiCell imports with inline `KpiCard` component: bigger `text-3xl` mono value, tone-tinted dot + icon per card, full-width sparkline at bottom. Reordered to match mockup priority: Cuộc gọi hôm nay / Tỷ lệ trả lời / Cuộc gọi đang chờ first. |
| `pages/dashboard/call-volume-heatmap.tsx` | Full restyle: 24×7 rounded cells with M3 lavender intensity scale (`bg-accent/20` → `bg-primary`), x-axis ticks at 00:00/06:00/12:00/18:00/23:59, today's date in header, overflow-x-auto for narrow viewports. Demo data kept (API not implemented). |
| `pages/dashboard/agents-panel.tsx` | Added prominent `text-3xl` online count + green pulse dot "Online" caption matching mockup. Dividers changed to `border-dashed border-border/40`. Avatar bg changed to `bg-accent` (M3 primary-container). |
| `pages/dashboard/activity-log-panel.tsx` | Relabelled to "Recent Activity". Each entry now has: colored dot pill icon (5×5 rounded-full bg), text block, timestamp mono right-aligned. Dividers `border-dashed border-border/40`. |
| `pages/dashboard/index.tsx` | Reordered sections: Header → KPI strip → Rate cards → **Heatmap (full width)** → bottom 3-col row (Agents / Activity / Dialer). Matches mockup layout flow. |

## TSC Result

`npx tsc --noEmit` — **PASS** (no output, exit 0)

## Status

**DONE**

## Concerns

- `branch` field does not exist on `User` model — the "Chi nhánh: HCM" chip from mockup was dropped. If branch becomes a real field it can be wired from `user.branch`.
- Heatmap uses static demo grid (7×24 cosmetic values). Real data requires `GET /dashboard/call-volume-24h` endpoint which is not implemented yet.
- `stitch-preview.png` was not found at `.playwright-mcp/stitch-preview.png`; design reference taken from `plans/260504-1037-stitch-redesign/01-dashboard/design.png` instead.

## Unresolved Questions

- Should "Chi nhánh" be derived from `user.teamId` (mapped to a team name) or added as a new field to the User model?
- Should the heatmap wire to a real endpoint or stay demo until Phase 5?
- Mockup shows a "Doanh thu: 50.6M VNĐ" revenue KPI — no backend field in `OverviewData` for this. Add to `debtCases.amountCollectedToday` display, or new field?
