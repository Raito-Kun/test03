# Phase 02 — Kanban board + Card

## Owner
Worker 2 (fullstack-developer)

## Files (exclusive)
- `packages/frontend/src/pages/tickets/ticket-kanban.tsx` (NEW, ~160 LoC)
- `packages/frontend/src/pages/tickets/ticket-card.tsx` (NEW, ~90 LoC)
- `packages/frontend/src/pages/tickets/use-ticket-kanban.ts` (NEW, ~80 LoC — hook for state + optimistic update)
- `packages/frontend/src/pages/tickets/ticket-list.tsx` (EDIT — replace body with `<TicketKanban/>`)

## Dependencies already installed by main thread
`@dnd-kit/core`, `@dnd-kit/sortable` — just import.

## Layout
4 columns, responsive grid. `closed` collapsed by default (show count only, click to expand).

```
[Chưa xử lý: 5]  [Đang xử lý: 2]  [Đã xử lý: 12]  [Đã đóng (30) ▸]
```

## Card contents
- Row 1: **tên KH** + `• SĐT`
- Row 2: `#ext` agent + priority badge (urgent=red, high=orange, medium=teal, low=muted)
- Row 3: subject truncate 2 lines
- Row 4: `createdAt` relative ("2h trước") + icon recording nếu có recordingPath

## Interactions
- Click card → setSelectedId(ticket.id) → opens `TicketDetailDialog` (imported from `./ticket-detail-dialog`, Worker 3's file)
- Drag card to another column → optimistic update local state + `PATCH /tickets/:id { status }`; rollback if error
- When dragging to `resolved` column → show `TicketResolutionDialog` (imported from `./ticket-resolution-dialog`, Worker 3's file) instead of direct PATCH. Dialog returns {resultCode, note} then commits.

## Imports from Worker 3 (contract)
```tsx
import { TicketDetailDialog, type TicketDetailDialogProps } from './ticket-detail-dialog';
import { TicketResolutionDialog } from './ticket-resolution-dialog';
```

## Hook `use-ticket-kanban.ts`
Encapsulate:
- Fetch all tickets (paginated? for MVP: fetch first 200, scroll is column-internal)
- Group by status
- `moveTicket(ticketId, newStatus)` → optimistic mutate + invalidate on error
- `collapseClosed` state

## Filter toolbar (keep existing)
Priority select + search (search by KH name or phone). Remove status filter (now implicit in kanban).

## Done criteria
- Typecheck + `npm run -w @crm/frontend build` passes
- No edit outside listed files
- Report to `plans/260421-1244-ticket-kanban-detail/reports/worker-2-kanban-done.md`
