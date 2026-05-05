# Thread G — Campaign List M3 Alignment

## Files Modified
- `packages/frontend/src/pages/campaigns/campaign-list.tsx` (full restyle, 273 lines)
- `packages/frontend/src/pages/campaigns/campaign-actions-menu.tsx` — not needed; actions inlined in column

## TSC Result
`npx tsc --noEmit` — **PASS** (no output = no errors)

## Status
**DONE**

## Changes Applied
- Breadcrumb: `Trang chủ / Chiến dịch` with ChevronRight separator (matches contact-list pattern)
- CTA moved to top-right: `<CampaignCreateDialog />` positioned inline with breadcrumb row
- Segment chips (Tất cả / Đang chạy / Tạm dừng / Đã kết thúc / Bản nháp) replace Select dropdown status filter; chips drive `statusFilter` state and reset page on click
- Table columns reworked:
  - **TÊN CHIẾN DỊCH**: h-name + `CMP-{id.slice(0,8)}` mono subtext
  - **TIẾN ĐỘ**: mini progress bar in `bg-primary`, `pct%` mono label
  - **AGENTS**: avatar stack (initials, deterministic color, +N overflow)
  - **TRẠNG THÁI**: dot-pill consistent with `campaign-detail.tsx` STATUS_CONFIG
  - **NGÀY**: `fmtDateRange` → `01/10 – 31/12` mono
  - Actions: `AutoAssignButton` + `MoreHorizontal` dropdown (Xem chi tiết)
- Advanced filters collapsed behind "Lọc nâng cao" border-dashed button (type + date range); status filter removed from adv panel since handled by chips
- Table wrapped in `<DottedCard>` (same as contact-list)
- Removed `SectionHeader`, `Badge`, `Select` — no longer needed
- All data wiring preserved: query, pagination, search, allocate, export

## Concerns
- `agents` field not guaranteed in `/campaigns` list API response — avatar stack renders `—` gracefully if absent. If API doesn't populate agents on list endpoint, avatars will always show `—`. No code change needed; backend addition is a separate concern.
- `campaign-actions-menu.tsx` left untouched — file not needed for this scope.
