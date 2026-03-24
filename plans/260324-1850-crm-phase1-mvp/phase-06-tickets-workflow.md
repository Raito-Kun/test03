---
phase: 06
title: "Tickets & Workflow"
status: completed
priority: P1
effort: 3d
depends_on: [03]
---

# Phase 06 — Tickets & Workflow (Phieu ghi, Notifications)

## Context Links
- [PRD](../../Guildline/PRD.md) — Sections 4.1.2, 6.10-6.12, 6.15, API 7.9, 7.12-7.13
- [Plan Overview](./plan.md)

## Overview
Ticket (Phieu ghi) CRUD linked to contacts and calls. Ticket categories management. Macros (quick reply templates). Notification system for follow-up reminders, PTP due dates, system alerts. Notification delivery via Socket.IO real-time + API polling.

## Key Insights
- Every agent interaction with a customer should create a ticket (Phieu ghi)
- Tickets link to contact (required) and optionally to a call_log
- Ticket categories are hierarchical (parent_id for tree structure)
- Macros help agents fill ticket content quickly from templates
- Notifications are created by system events (follow-up due, PTP due, campaign assigned, recording failed)
- Real-time notifications via Socket.IO `notification:new` event

## Requirements
**Functional:**
- Ticket CRUD: create with contact/call link, categorize, set priority/status
- Ticket categories: CRUD with parent-child hierarchy
- Macros: CRUD, global vs personal, filter by category
- List tickets by contact (`GET /contacts/:id/tickets`)
- Notification list with read/unread, mark as read, mark all read
- Auto-create notifications: follow-up reminders, PTP due, system alerts
- Real-time notification push via Socket.IO

**Non-functional:**
- Notification creation async (don't block main request)

## Related Code Files
**Create:**
- `packages/backend/src/routes/ticket-routes.ts`
- `packages/backend/src/routes/ticket-category-routes.ts`
- `packages/backend/src/routes/macro-routes.ts`
- `packages/backend/src/routes/notification-routes.ts`
- `packages/backend/src/controllers/ticket-controller.ts`
- `packages/backend/src/controllers/ticket-category-controller.ts`
- `packages/backend/src/controllers/macro-controller.ts`
- `packages/backend/src/controllers/notification-controller.ts`
- `packages/backend/src/services/ticket-service.ts`
- `packages/backend/src/services/ticket-category-service.ts`
- `packages/backend/src/services/macro-service.ts`
- `packages/backend/src/services/notification-service.ts`
- `packages/backend/src/jobs/reminder-job.ts`
- `packages/shared/src/validation/ticket-schemas.ts`
- `packages/shared/src/validation/notification-schemas.ts`

## Implementation Steps

### 1. Ticket category management
1. `GET /ticket-categories` — list all (flat or tree structure)
2. `POST /ticket-categories` — create (admin/manager), optional parent_id
3. `PATCH /ticket-categories/:id` — update name, parent, sort_order, is_active
4. Tree response: `{ id, name, children: [...] }` built from flat DB query

### 2. Ticket CRUD
1. `GET /tickets` — pagination, filter by status/priority/category/user_id/contact_id/date range
2. `POST /tickets` — body: `{ contactId, callLogId?, categoryId, subject, content, resultCode, priority }`
   - Auto-set user_id from auth, status=open
3. `PATCH /tickets/:id` — update status, content, result_code
4. `GET /contacts/:id/tickets` — tickets for a contact (used in contact timeline)
5. RBAC: agents see own tickets, leaders see team, managers see all

### 3. Macro management
1. `GET /macros` — list, filter by category, include global + own personal
2. `POST /macros` — create (is_global requires admin/manager; personal by any agent)
3. `PATCH /macros/:id` — update content, category, shortcut
4. `DELETE /macros/:id` — deactivate
5. Agent usage: select macro → content auto-fills ticket content field

### 4. Notification system
1. `GET /notifications` — paginated, ordered by created_at desc, filter by is_read
2. `PATCH /notifications/:id/read` — mark single as read
3. `PATCH /notifications/read-all` — mark all as read for current user
4. Unread count: `GET /notifications?count_only=true` or include in /auth/me response

### 5. Notification creation service
1. `createNotification(userId, type, title, message, referenceType?, referenceId?)`
2. After create: push via Socket.IO to `user:{userId}` room
3. Types: follow_up_reminder, ptp_due, system_alert, campaign_assigned, recording_failed

### 6. Reminder job (cron)
1. Run every 5 minutes via `setInterval` (simple for MVP; Bull queue for Phase 2)
2. Check leads where next_follow_up <= now + 15min AND no reminder sent
3. Check debt_cases where promise_date = today AND no reminder sent
4. Create notification for each matched record
5. Track sent reminders to avoid duplicates (add `reminder_sent` flag or check existing notifications)

## Todo List
- [x] Ticket category CRUD (hierarchical)
- [x] Ticket CRUD with contact/call linking
- [x] Macro CRUD (global + personal)
- [x] Notification list/read endpoints
- [x] Notification creation service + Socket.IO push
- [x] Reminder cron job (follow-up + PTP due)
- [x] Zod validation schemas

## Success Criteria
- Agent creates ticket linked to contact and call
- Ticket categories display as tree
- Macros auto-fill ticket content
- Notifications appear in real-time via Socket.IO
- Reminder job creates notifications for due follow-ups and PTP dates

## Risk Assessment
- Reminder job creating duplicate notifications: use Redis lock + check existing notification for same reference_id + type within 24h
- Hierarchical categories deep nesting: limit to 3 levels max

## Security Considerations
- Personal macros visible only to creator
- Notification content doesn't leak sensitive data in Socket.IO payload (just type + title, detail fetched via API)
- Audit log for ticket create/update
