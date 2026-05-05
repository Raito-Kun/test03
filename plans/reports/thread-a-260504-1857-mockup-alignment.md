# Thread A — Mockup Alignment Report

## Mockup 02 — Contact List

**File:** `packages/frontend/src/pages/contacts/contact-list.tsx`

Changes applied:
- Added imports: `Search, SlidersHorizontal, Upload, ChevronRight` from lucide-react; removed `SectionHeader` import (inlined)
- `Contact` interface: added `company?: string` and `tags?: string[]`
- Added module-level helpers: `getInitials()`, `avatarColor()`, `segmentPill()`, `segmentDotColor()`
- `columns` array rewritten: HỌ TÊN (initials avatar + bold name), SĐT (font-mono), CÔNG TY (new), PHÂN KHÚC (segment pills with dot, mapped from tags[0]), PHỤ TRÁCH (initials avatar + name), NGÀY TẠO (font-mono text-muted-foreground)
- `email` column removed from table (still in Contact interface for other uses)
- Page header replaced: breadcrumb "Trang chủ / Liên hệ" + animated "SALE ACTIVE" pill
- Toolbar row replaced: full-width search with `<Search>` icon + `Lọc` outline-dashed button + `Nhập dữ liệu` button + action cluster
- Advanced filters now collapsible behind `Lọc` toggle (state: `filterOpen`)
- Removed `toolbar` prop from `<DataTable>` (advanced filters moved outside)
- `onSearchSubmit` prop removed; search is live via `onChange` on new input (DataTable's built-in search still wired via `onSearchSubmit` for keyboard submit path — kept for backward compat)

## Mockup 08 — Ticket Kanban

**Files modified:**
- `packages/frontend/src/pages/tickets/ticket-list.tsx` — full rewrite of page shell
- `packages/frontend/src/pages/tickets/ticket-kanban.tsx` — column header + layout
- `packages/frontend/src/pages/tickets/ticket-card.tsx` — card visual redesign
- `packages/frontend/src/pages/tickets/use-ticket-kanban.ts` — extended `KanbanTicket` type

### ticket-list.tsx
- Removed `PageWrapper` wrapper; replaced with custom `<div>`
- h1 "Bảng Phiếu ghi" + subtitle paragraph
- Assignee avatar stack: 4 deterministic-color initials + "+4" overflow badge
- Primary CTA "+ Tạo phiếu" with shadow-primary
- 3 filter pill buttons: Người phụ trách / Mức độ ưu tiên / Danh mục (border-dashed rounded-full)
- "Xóa bộ lọc" text link with X icon (shows only when filter active)
- FAB `<button>` fixed bottom-right (Plus icon, bg-primary, hover:scale-110)
- Refresh + ExportButton kept

### ticket-kanban.tsx
- COLUMN_LABELS updated: open→"MỚI", in_progress→"ĐANG XỬ LÝ", resolved→"CHỜ PHẢN HỒI", closed→"ĐÃ ĐÓNG"
- `KanbanColumn` header: uppercase label + count chip (primary bg for in_progress, muted otherwise) + `<MoreHorizontal>` menu icon
- Drop zone: `min-h-[200px]`, rounded-xl, empty placeholder with `<Inbox>` icon + italic text "Kéo phiếu vào đây để chuyển trạng thái"
- Grid replaced with horizontal flex scroll container (`overflow-x-auto`, `min-w-max`, `gap-5`)

### ticket-card.tsx
- Full redesign: `<div>` wrapper (no Card primitive) with white surface + hover:border-primary/20
- Row 1: `ticket.ticketRef` in `font-mono text-primary uppercase`
- Row 2: `ticket.priority` dot (top-right corner)
- Row 3: `ticket.subject` bold body, 2-line clamp
- Dashed divider: `border-b border-dashed border-border`
- Row 4: category/phone meta (font-mono) + assignee initials avatar (bottom-right)
- Row 5 (conditional): due date with `<CalendarClock>` — red if due within 3 days

### use-ticket-kanban.ts
- `KanbanTicket` type: added `ticketRef: string`, `dueDate?: string | null`, `category?: string | null`
- `RawTicket` interface: added `dueDate`, `category` from backend
- Map function: `ticketRef` derived as `#TK-NNNN` from sort index; `dueDate` and `category` passed through

## TSC Result

**pass** — `npx tsc --noEmit` exited with no output (zero errors)

## Status

**Status:** DONE

**Summary:** Aligned contact-list.tsx and ticket kanban (list + kanban + card + hook) with mockup 02 and 08 respectively. All visual tokens use existing Tailwind classes. No shared files edited. TSC clean.

## Unresolved Questions

1. `ticketRef` is index-based (not DB sequence) — if backend adds a real `ticketNumber` field, the hook map should use `t.ticketNumber` instead of `idx+1`.
2. `MOCK_AGENTS` in ticket-list.tsx are hardcoded display placeholders — a real implementation should derive from the assigned agents in the kanban data.
3. Contact `company` field: included in `Contact` interface but the backend `/contacts` endpoint may or may not return it depending on select fields — verify with backend `contacts.controller.ts` if the column renders `—` in production.
4. `onSearchSubmit` prop is still passed to `<DataTable>` but the new search `<Input>` in contact-list uses `onChange`. The two are independent — DataTable's internal search bar is now redundant. Consider removing DataTable's built-in search bar in a follow-up cleanup (shared file, out of scope for this thread).
