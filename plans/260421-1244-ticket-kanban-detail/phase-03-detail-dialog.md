# Phase 03 — Detail Dialog + Waveform + Audit Timeline

## Owner
Worker 3 (fullstack-developer)

## Files (exclusive — all NEW)
- `packages/frontend/src/pages/tickets/ticket-detail-dialog.tsx` (~180 LoC — wrapper + layout)
- `packages/frontend/src/pages/tickets/ticket-detail-customer-panel.tsx` (~120 LoC — left pane: KH info + call info + waveform)
- `packages/frontend/src/pages/tickets/ticket-detail-actions-panel.tsx` (~130 LoC — right pane: C2C + status/priority/category + add note)
- `packages/frontend/src/pages/tickets/ticket-resolution-dialog.tsx` (~100 LoC — popup for resolving: resultCode + note, required)
- `packages/frontend/src/pages/tickets/ticket-audit-timeline.tsx` (~80 LoC — vertical timeline of audit entries)
- `packages/frontend/src/components/wave-audio-player.tsx` (~110 LoC — WaveSurfer wrapper)

## Dependencies already installed
`wavesurfer.js` — import as `import WaveSurfer from 'wavesurfer.js'`.

## Exported interface (Worker 2 consumes)
```tsx
export interface TicketDetailDialogProps {
  ticketId: string | null;  // null = closed
  onClose: () => void;
  onUpdated?: () => void;
}
export function TicketDetailDialog(props: TicketDetailDialogProps): JSX.Element;

// Resolution dialog — triggered from kanban drag-to-resolved OR from actions panel
export interface TicketResolutionDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: (input: { resultCode: string; note: string }) => void | Promise<void>;
}
export function TicketResolutionDialog(props: TicketResolutionDialogProps): JSX.Element;
```

## Layout (dialog ~80% viewport)

```
┌── [Subject] [status badge] [priority] [SLA warn] ───────── [X] ──┐
│                                                                   │
│  ┌─ CUSTOMER PANEL ─────┐  ┌─ ACTIONS PANEL ──────────────┐      │
│  │ KH: tên, SĐT, email  │  │ [📞 GỌI LẠI <SĐT KH>]         │      │
│  │ Địa chỉ, status      │  │                                │      │
│  │ ─────────────────    │  │ Status ▾ Đang xử lý           │      │
│  │ Cuộc gọi gắn:        │  │ Priority ▾                    │      │
│  │  Start/End, dur      │  │ Category ▾                    │      │
│  │  Billsec, SIP code   │  │                                │      │
│  │  [waveform player]   │  │ Ghi chú thêm:                 │      │
│  │ ─────────────────    │  │ [textarea]     [+ Thêm]       │      │
│  │ Agent: ext, team     │  │                                │      │
│  │ Nội dung phiếu       │  │ ───────────────                │      │
│  │ Category + resultCode│  │ Timeline:                     │      │
│  │                      │  │ • 11:00 Raito created         │      │
│  │                      │  │ • 11:05 ext 101 open→progress │      │
│  └──────────────────────┘  └────────────────────────────────┘      │
└───────────────────────────────────────────────────────────────────┘
```

## Key bits

### `wave-audio-player.tsx`
- Props: `url: string`, `height?: number` (default 60)
- useEffect mount WaveSurfer on ref div, destroy on unmount
- Controls: play/pause button + current time / duration label
- Color: `#a78bfa` (violet accent) for waveform, `#c4b5fd` for progress
- Handles: loading state, error state (URL 404), download button

### `ticket-detail-dialog.tsx`
- Fetch `GET /tickets/:id` via TanStack Query when `ticketId` non-null
- Dialog from `@/components/ui/dialog`, class `sm:max-w-[1100px]` for wide
- Layout: 2-col grid `grid-cols-1 md:grid-cols-[1.2fr_1fr]`

### "Gọi lại" button
Reuse `ClickToCallButton` from `@/components/click-to-call-button`. Pass `phone={contact.phone}` `contactId={contact.id}`. Size: `lg` if that prop exists, else wrap in larger container.

### Change status → 'resolved' flow
1. User picks 'resolved' from select → open `TicketResolutionDialog`
2. User enters resultCode (required, select from predefined + freeform) + note (textarea, required)
3. On confirm: `PATCH /tickets/:id { status: 'resolved', resultCode, content }` (backend appends)
4. Close both dialogs, call `onUpdated()`

### Audit timeline
- Displays `ticket.auditLog` array (from backend response)
- Format: `HH:mm dd/MM — <user.fullName> <action>` (action human-ized: create/update/delete; for update, summarize changed keys from `changes` object)
- Vertical list, newest on top, max-height 200px scroll

## Done criteria
- Typecheck + `npm run -w @crm/frontend build` passes
- Waveform plays the recording from ticket.callLog.recordingPath (via existing `/recordings/:callUuid` endpoint — verify URL)
- No edit outside listed files
- Report to `plans/260421-1244-ticket-kanban-detail/reports/worker-3-detail-done.md`
