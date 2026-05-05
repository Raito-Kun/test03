# Worker 2 — Kanban UI Done

## Files Created/Edited

| File | LoC | Action |
|---|---|---|
| `src/pages/tickets/use-ticket-kanban.ts` | 76 | NEW |
| `src/pages/tickets/ticket-card.tsx` | 90 | NEW |
| `src/pages/tickets/ticket-kanban.tsx` | 186 | NEW |
| `src/pages/tickets/ticket-list.tsx` | 96 | EDIT |

## DnD Implementation

Sensors used:
- `PointerSensor` with `activationConstraint: { distance: 5 }` — prevents accidental drags on click; requires 5px pointer movement before drag starts
- `KeyboardSensor` with `sortableKeyboardCoordinates` — accessibility keyboard drag support

Drop targets: each column is a `useDroppable({ id: status })`. Cards use `useSortable({ id: ticket.id })` from `@dnd-kit/sortable`. `DragEndEvent.over.id` is checked against `TICKET_STATUSES` to determine destination column.

Drag-to-resolved flow: optimistic `moveTicket()` runs first (card appears in resolved column), then `TicketResolutionDialog` opens. Cancel = `queryClient.invalidateQueries` to rollback. Confirm = `PATCH /tickets/:id { status, resultCode, content }`.

## Assumptions

1. Backend `/tickets` response shape: `data.data.items[]` with fields `id, contactName, contactPhone, agentExt, priority, status, subject, createdAt, recordingPath?` — mapped to `KanbanTicket` interface.
2. `ticket-detail-dialog.tsx` not yet created by Worker 3 — causes one TS2307 error in `ticket-kanban.tsx` that resolves when Worker 3 delivers their file.
3. `ticket-resolution-dialog.tsx` exists (Worker 3 partial) but has a type error in their own code unrelated to my files.
4. Closed column collapsed by default (`collapseClosed = true`). Clicking header toggles.
5. Status filter removed from toolbar per spec — now implicit from kanban columns. Only priority filter + name/phone search remain.
6. `useDroppable` imported from `@dnd-kit/core` (not sortable) for column drop zones, allowing cards from any column to drop into any column (not just reordering within a column).
