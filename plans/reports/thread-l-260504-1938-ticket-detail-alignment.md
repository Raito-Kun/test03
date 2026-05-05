# Thread L — Ticket Detail M3 Lavender Alignment

**Date:** 2026-05-04  
**Status:** DONE

## Files Modified

- `pages/tickets/ticket-detail.tsx` — full page redesign: breadcrumb, mono `#TK-XXXX` header, status pill + priority dot, 8/4 grid with 3-tab strip (Chi tiết / Bình luận / Lịch sử), right rail with customer panel + audit timeline
- `pages/tickets/ticket-detail-dialog.tsx` — sticky dialog header with mono ref + status pill + priority dot; two-column body unchanged; `border-dashed` dividers throughout
- `pages/tickets/ticket-detail-actions-panel.tsx` — stacked action card (Giải quyết filled violet / Phân công lại / Chuyển sang / Thêm ghi chú) with dashed dividers; delete button uses `border-dashed`; note textarea with `border-dashed`
- `pages/tickets/ticket-detail-customer-panel.tsx` — avatar + name card with dashed border + accent tint; phone/email mono; recent-calls mini-list (3 rows, status pill, mono duration); "Xem hồ sơ →" violet footer link; linked call-log section preserved; `recentCalls` prop added (optional, backward-compat)
- `pages/tickets/ticket-audit-timeline.tsx` — vertical timeline with 24px circle nodes (icon per action type), dashed connector `border-l border-dashed border-border`, mono timestamps right-aligned, soft tint bg per action (violet/amber/green/blue/red)
- `pages/tickets/ticket-form.tsx` — section groups with dashed dividers, `FieldLabel` mono uppercase helper, 42px inputs, priority select with leading colored dot, Cancel (outline dashed) + Save (filled violet)
- `pages/tickets/ticket-resolution-dialog.tsx` — title "Đóng phiếu ghi #TK-XXXX" via `ticketCode` prop, mono uppercase field labels, dashed borders, Hủy (outline dashed) + Đóng phiếu (filled violet)

## TSC Result

3 pre-existing errors in `src/pages/settings/cluster-detail-form.tsx` (`cn` not imported) — outside file ownership, present before this work. **Zero new errors** in owned files.

## Data Wiring Preserved

- All mutations (`statusMutation`, `macroMutation`, `updateMutation`, `deleteMutation`, `noteMutation`, `dispositionMutation`) intact
- All Zod-adjacent validation (resolution dialog `validate()`) intact
- DnD logic untouched (owned by ticket-card / use-ticket-kanban)
- `TicketResolutionDialog.onConfirm` signature unchanged; added optional `ticketCode` prop (backward-compat)
- `TicketDetailCustomerPanel` added optional `recentCalls` prop (backward-compat)

## Concerns

- `ticket-detail.tsx` renders `TicketDetailCustomerPanel` from right rail only (no callLog passed — full-page detail API response may not include it; callLog is available in the dialog path which always fetches `TicketFull`)
- `auditLog` field on `TicketDetail` type in `ticket-detail.tsx` is optional (`auditLog?`) — API may not return it on the GET /tickets/:id endpoint used by the full-page route; if absent, timeline rail is hidden gracefully
