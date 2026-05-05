# Thread C — Mockup Alignment Report
Date: 2026-05-04

## Mockup 04 — Debt Case List (`debt-case-list.tsx`)

Full rewrite of the page (~295 lines). Key changes:

- **KPI Strip**: 4 hero cards with `font-mono` label, large value, dashed-bottom separator, trend/badge footer. Cards: TỔNG NỢ (green trend chip), QUÁ HẠN (red High Risk badge), ĐÃ THU (caption), TỶ LỆ THU HỒI (lavender progress bar).
- **Segment chips**: Tất cả / Đang chờ xử lý / Đã quá hạn / Đã hoàn tất — pill buttons, active = `bg-primary text-primary-foreground`.
- **Right actions**: "Lọc nâng cao" dashed-border button (filter icon), refresh, export, allocate.
- **Advanced filter panel**: collapsible, shows tier/status/date selects with clear button.
- **Table**: native `<table>` inside white card. Header = `bg-muted/50` with `font-mono uppercase` labels, dashed dividers via `divide-dashed`. Customer cell: bold name + `CID: XXXXXX` mono below. Amount cell: formatted money + inline call button.
- **DpdPill**: red (`bg-destructive`) >30d, amber 1–30d, grey `—` if 0.
- **StatusPill**: amber "Đang gọi nhắc nợ", green "Chưa đến hạn", red pulse "Chuyển pháp lý", violet "Cam kết", etc.
- **Footer pager**: "Hiển thị X-Y trên Z kết quả" + chevron + numbered page buttons, active = `bg-accent text-primary`.
- Removed: old `DottedCard + DataTable` wrapper, replaced with inline table. All TanStack Query data flow preserved.

## Mockup 05 — Campaign Detail (`campaign-detail.tsx`)

Full rewrite (~265 lines). Key changes:

- **Header card** (`bg-card rounded-xl border`): breadcrumb "Chiến dịch /" above h1, `StatusBadge` with dot + colored pill, date range + agent count meta row, Tạm dừng (outline) + Sửa chiến dịch (filled primary) buttons.
- **Progress section** (3-col grid, dashed-border divider): TIẾN ĐỘ HOÀN THÀNH 65% lavender bar; TỔNG CUỘC GỌI 12,450 with Phone icon in secondary bg; ĐÃ THU HỒI 1.2B VNĐ with Banknote icon in accent bg.
- **Tabs**: custom bottom-border style (`data-[state=active]:border-b-2 border-primary`). 4 tabs: Thông tin / Liên hệ / Agents (with count badge) / Cấu hình.
- **Agents tab**: delegates to `CampaignAgentsTab` (unchanged), tab now renders inside full-width layout (no more split-view).
- **Activity timeline**: vertical dashed line via CSS `before:`, 3 sample entries with colored icon circles, mono timestamp right-aligned.
- **FAB**: fixed `bottom-8 right-8`, `w-14 h-14 bg-primary rounded-full`, hover tooltip "Thêm liên hệ mới".
- Removed: old split-view (left form 2/5 + right tabs), ArrowLeft nav replaced by breadcrumb link.

## TSC Result

- `npx tsc --noEmit` in `packages/frontend`: **2 pre-existing errors** (lead-detail.tsx, ticket-kanban.tsx — not in scope)
- **0 errors in debt-cases/** and **0 errors in campaigns/**

## Files Modified

- `packages/frontend/src/pages/debt-cases/debt-case-list.tsx` — full rewrite (~295 lines)
- `packages/frontend/src/pages/campaigns/campaign-detail.tsx` — full rewrite (~265 lines)

## Status

**Status:** DONE_WITH_CONCERNS

**Summary:** Both pages aligned to mockups. TSC clean for owned files.

**Concerns:**
1. KPI strip values in `debt-case-list.tsx` are static mockup numbers (2.450B, 840M, etc.) — no aggregate API endpoint exists in scope. When a real `/debt-cases/summary` endpoint is available, replace static values with a `useQuery` call.
2. Campaign detail activity timeline uses static `SAMPLE_ACTIVITIES` array — no activity feed API in scope. Should be wired once backend exposes it.
3. `DpdPill` uses `row.dpd` from `DebtCase`; `createdAt` is used as proxy for "Ngày đáo hạn" column — the real `dueDate` field may differ if schema diverges.

## Unresolved Questions

- Does the backend expose a `/debt-cases/summary` KPI endpoint, or should the frontend compute totals client-side from paginated data?
- Is there an activity/audit-log endpoint for campaigns?
- Should the segment chips (Tất cả / Đang chờ xử lý / Đã quá hạn / Đã hoàn tất) map to specific `status` filter values passed to the API?
