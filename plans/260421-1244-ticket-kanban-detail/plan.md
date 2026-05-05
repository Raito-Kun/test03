---
title: "Ticket Kanban Board + Detail Dialog"
description: "Chuyển ticket list thành Kanban 4 cột với DnD, detail dialog có waveform player + click-to-call"
status: in_progress
priority: P2
effort: 1d
branch: feat/ui-ops-console-redesign
created: 2026-04-21
---

# Ticket Kanban + Detail — Plan Overview

Thay `ticket-list` table hiện tại bằng Kanban 4 cột (Chưa xử lý / Đang xử lý / Đã xử lý / Đã đóng). Click card mở detail dialog hiển thị đầy đủ thông tin cuộc gọi gắn với ticket + nút "Gọi lại" → C2C số KH.

## UX quy ước

- Card hiện: tên KH + SĐT + ext agent + priority badge + subject truncate + time relative
- Cột `closed` collapsed mặc định
- Drag-drop đổi status → optimistic update, rollback on error
- "Đã xử lý" **bắt buộc** nhập `resultCode` + resolution note trước khi save
- Detail dialog: 2 pane (thông tin trái, hành động phải), waveform player cho recording, audit timeline

## RBAC bổ sung

- **Xóa ticket:** `admin` trở lên (`admin`, `super_admin`). Agent/leader/manager/qa không xóa được.
- Hiện tại `deleteTicket` (ticket-service.ts:132) chưa kiểm tra role — cần siết.

## Phases

| # | File | Owner | Deliverable |
|---|---|---|---|
| 01 | [phase-01-backend.md](./phase-01-backend.md) | Worker 1 | ticket-service nâng cấp: clusterId, resolution required, delete admin-only, audit timeline endpoint |
| 02 | [phase-02-kanban-ui.md](./phase-02-kanban-ui.md) | Worker 2 | Kanban board + card + DnD + optimistic update |
| 03 | [phase-03-detail-dialog.md](./phase-03-detail-dialog.md) | Worker 3 | Detail dialog + waveform + click-to-call + audit timeline view |
| 04 | [phase-04-test-deploy-docs.md](./phase-04-test-deploy-docs.md) | Worker 4 | Plan docs + e2e + docs/rules/skills update |

## API contract (pin để 4 workers không đụng)

**`GET /tickets/:id` response (enhanced):**
```ts
{
  id, subject, content, status, priority, resultCode, slaBreached,
  firstResponseAt, resolvedAt, createdAt, updatedAt,
  contact: { id, fullName, phone, email, address, status },
  user: { id, fullName, extension, team: {id,name} },
  category: { id, name } | null,
  callLog: {
    id, callUuid, direction, startTime, answerTime, endTime,
    duration, billsec, hangupCause, sipCode, recordingPath,
    callerNumber, destinationNumber
  } | null,
  auditLog: [
    { id, action, changes, createdAt, user: {id, fullName} }
  ]
}
```

**`PATCH /tickets/:id`** (đã có) — khi `status='resolved'` bắt buộc body phải có `resultCode` (non-empty) và `content` (resolution note append vào content).

**`DELETE /tickets/:id`** — middleware `requireRole('admin','super_admin')` thêm vào route.

## File ownership matrix (KHÔNG overlap)

| Worker | Files (exclusive) |
|---|---|
| 1 (backend) | `packages/backend/src/services/ticket-service.ts`, `packages/backend/src/controllers/ticket-controller.ts`, `packages/backend/src/routes/ticket-routes.ts` |
| 2 (kanban) | `packages/frontend/src/pages/tickets/ticket-kanban.tsx` (new), `packages/frontend/src/pages/tickets/ticket-card.tsx` (new), `packages/frontend/src/pages/tickets/use-ticket-kanban.ts` (new), `packages/frontend/src/pages/tickets/ticket-list.tsx` (edit — replace body) |
| 3 (detail) | `packages/frontend/src/pages/tickets/ticket-detail-dialog.tsx` (new), `packages/frontend/src/pages/tickets/ticket-detail-customer-panel.tsx` (new), `packages/frontend/src/pages/tickets/ticket-detail-actions-panel.tsx` (new), `packages/frontend/src/pages/tickets/ticket-resolution-dialog.tsx` (new), `packages/frontend/src/pages/tickets/ticket-audit-timeline.tsx` (new), `packages/frontend/src/components/wave-audio-player.tsx` (new) |
| 4 (test+docs) | `plans/260421-1244-ticket-kanban-detail/*.md`, `docs/project-changelog.md`, `docs/development-roadmap.md`, `docs/codebase-summary.md`, `docs/system-architecture.md`, `.claude/rules/pbx-incident-patterns.md`, `.claude/skills/crm-permission/SKILL.md`, `e2e/ticket-kanban.spec.ts` (new) |

## Dependencies (cài trước khi workers chạy)

- `@dnd-kit/core`, `@dnd-kit/sortable` (Kanban)
- `wavesurfer.js` (recording player)

## Component interface contract (tránh coupling)

Worker 2 consume từ Worker 3:
```tsx
// ticket-detail-dialog.tsx exports:
export interface TicketDetailDialogProps {
  ticketId: string | null;  // null = closed
  onClose: () => void;
  onUpdated?: () => void;   // called after status/priority/content changes
}
export function TicketDetailDialog(props: TicketDetailDialogProps): JSX.Element;
```

Worker 2 code:
```tsx
import { TicketDetailDialog } from './ticket-detail-dialog';
const [selectedId, setSelectedId] = useState<string | null>(null);
// ...
<TicketDetailDialog ticketId={selectedId} onClose={() => setSelectedId(null)} onUpdated={refetch} />
```

## Rollback

Branch hiện tại là `feat/ui-ops-console-redesign`. Nếu fail: revert tickets commits, giữ SIP presence fix.
