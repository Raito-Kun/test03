## Phase Implementation Report

### Executed Phase
- Phase: Thread B — Mockup 03 (Lead Details) + Mockup 09 (Report)
- Plan: plans/260420-1147-ui-ops-console-redesign
- Status: DONE

### Files Modified

| File | Change |
|---|---|
| `packages/frontend/src/pages/leads/lead-detail.tsx` | Full layout realignment to mockup 03 |
| `packages/frontend/src/pages/reports/reports-page.tsx` | KPI cards + chart overview + segment tabs aligned to mockup 09 |

### Mockup 03 — Lead Details changes
File: `packages/frontend/src/pages/leads/lead-detail.tsx`
- Header card: avatar circle with `initials()` helper (2-char initials from contact name) + status pill with live-dot for active statuses
- Mono ID + created-at line in header (`ID: <truncated> • Tạo lúc: HH:mm, dd/MM/yyyy`)
- Assignee block right-aligned in header with dashed-border chip
- 8/4 `lg:grid-cols-12` layout replacing the old 2-col grid
- Left col: tab strip (Thông tin / Lịch sử cuộc gọi / Hồ sơ / Tệp đính kèm) with `border-b-2 border-primary` active indicator
- Info tab: 2-col data grid with `text-[10px] font-bold uppercase tracking-widest` labels
- Call history mini-list: `PhoneCall` / `PhoneMissed` icons + success/missed badges + `font-mono` timestamps
- Right rail: "Thao tác nhanh" DottedCard (Gọi ngay via ClickToCallButton, Tạo phiếu, Đặt lịch) + "Dòng thời gian" vertical dotted-line timeline with real `createdAt`/`updatedAt` data
- Removed `ArrowLeft` back button (handled by router tabs); kept `editOpen` + LeadForm mutation

### Mockup 09 — Report dashboard changes
File: `packages/frontend/src/pages/reports/reports-page.tsx`
- Top utility row: date range pill (font-mono, dashed border) + existing ReportFilters inline + "Xuất Excel" outline button (calls `exportCsv`)
- Segment tabs renamed: Tóm tắt→Tổng quan (kept existing sub-tabs inside), Chi tiết, Biểu đồ, Phiếu ghi
- "Tổng quan" tab body (new): 4 KPI cards (Tổng cuộc gọi, Tỷ lệ trả lời, Cuộc gọi nhỡ, Đã nghe) with progress bar, trend chip/icon
- "Cuộc gọi theo ngày" BarChart (recharts) using `callsByDay` from existing `/reports/calls/charts` endpoint; primary lavender bars + destructive missed bars
- "Top 10 Agents" list: rank badge (accent bg, mono font) + name + totalCalls right-aligned mono
- "Phân loại Disposition" donut: recharts PieChart with PIE_COLORS from design tokens; legend grid below
- ReportSummaryTab (full agent table) appended below KPI section — preserves all existing detail data
- KPI numbers derived at client from existing `/reports/calls/summary` aggregation — no new endpoint

### TSC result
- `npx tsc --noEmit` — **PASS** (0 errors after fixing `className` prop not in `ClickToCallButtonProps`)

### Issues Encountered
- `ClickToCallButton` has no `className` prop — wrapped in `<div className="w-full">` as workaround
- Mockup 09 shows "Doanh thu 1.2B VND" KPI — no revenue endpoint exists; replaced with "Cuộc gọi đã nghe" (real data). Revenue card can be added once backend exposes the metric.
- Call history mini-list in Lead Detail uses static sample rows (no per-lead call history endpoint). Real data flows via the call-logs page already.

**Status:** DONE_WITH_CONCERNS
**Summary:** Both pages aligned to mockup layout; TSC clean. All existing data fetch logic preserved.
**Concerns:**
1. Revenue KPI card replaced with answered-calls metric (no backend endpoint for revenue).
2. Lead detail call-history mini-list shows static placeholder rows — real per-lead call history would need a dedicated API query.
