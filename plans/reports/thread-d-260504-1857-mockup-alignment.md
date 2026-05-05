# Thread D — Mockup Alignment Report
Date: 2026-05-04 | Branch: feat/ui-ops-console-redesign

## Mockup 06 — call-log-list.tsx

**Changes applied:**
- Filter toolbar: added `font-mono text-[11px] uppercase tracking-wider` labels above each input (SỐ ĐÍCH / HƯỚNG / TRẠNG THÁI / NHÂN VIÊN / TỪNGÀY/ĐẾN NGÀY)
- Search button: `bg-primary text-white` filled, `<Search>` icon + "Tìm kiếm" text, disabled when no draft changes
- Removed separate SIP Code / Lý do SIP / Phân loại / Kết thúc / Thời gian nói columns from table
- Reordered columns to: checkbox / THỜI GIAN / HƯỚNG / CALLER / DESTINATION / AGENT / THỜI LƯỢNG / SIP STATUS / DISPOSITION / GHI ÂM
- THỜI GIAN cell: `font-mono text-xs`, format changed from `dd/MM/yyyy HH:mm` → `yyyy-MM-dd HH:mm:ss`
- HƯỚNG cell: icon-only (`ArrowDownLeft`/`ArrowUpRight` in `text-primary`), no text pill
- CALLER cell: phone mono in `font-mono text-[11px]` (contact name row reserved but blank — list API doesn't carry it)
- DESTINATION cell: `font-mono text-xs`
- AGENT cell: 24px circular avatar with `bg-[#e8deff] text-[#5434ae]` initials + name
- THỜI LƯỢNG cell: `font-mono text-xs tabular-nums`
- SIP STATUS: extracted `SipStatusPill` component — bordered pill `200 OK` / `486 Busy` etc. matching mockup exactly (`bg-*-50 border-*-100 font-mono text-[10px]`)
- DISPOSITION: select trigger border/shadow removed (`border-0 shadow-none`), cleaner inline edit UX
- GHI ÂM: icons right-aligned

## Mockup 07 — call-log-detail.tsx

**Changes applied:**
- Header: green `CheckCircle2` badge + mono UUID `h1` + status pill + caller info line → `justify-between` with "Tạo Ticket" filled violet button
- Layout: `grid-cols-12` — left col `col-span-8`, right rail `col-span-4`
- Left top: audio card with waveform header icon (inline SVG), download icon in top-right corner, `DottedCard` replaced with raw `bg-card rounded-xl border` pattern
- Left middle: 2-col grid — "THÔNG TIN NGƯỜI GỌI + THÔNG TIN ĐÍCH" card / "THỜI GIAN + KỸ THUẬT" card
  - Each card uses `MetaRow` (label left, value right, dashed divider between rows)
  - `CardSection` helper for uppercase mono section headers
  - Time values: `yyyy-MM-dd HH:mm:ss` mono; duration bold `text-primary`
  - SIP code: `bg-muted px-2 rounded` badge inline; hangup reason `font-mono text-xs text-muted-foreground`
- Left bottom: disposition + AI score side by side (2-col)
- Right rail:
  - "TICKET LIÊN KẾT": dashed violet border card `border-[#cdbdff] bg-[#e8deff]/20` with `#TK-code` bold primary + status amber pill
  - "LỊCH SỬ XỬ LÝ": `TimelineNode` component — dashed vertical connector `border-l border-dashed`, 24px circular icon containers with color-coded bg, timestamps in `font-mono text-[10px]`
  - Timeline auto-generates nodes for: answerTime → ticket → endTime → disposition (only if data present)
- Removed: `DottedCard` import (no longer needed); kept all existing data wiring intact

## TSC Result
`npx tsc --noEmit` — **0 errors, 0 warnings**

## Status
**DONE**

## Concerns
- CALLER column: list API response (`CallLog` interface) has no contact name field — only phone number shown. If BE ever adds `contactName` to the list endpoint the column will auto-populate (slot is reserved in render).
- `call.ticket` field added to `CallLogDetail` interface for the right-rail ticket card — if backend doesn't return this field yet the card gracefully shows "Chưa có ticket liên kết".

## Unresolved Questions
- None blocking.
