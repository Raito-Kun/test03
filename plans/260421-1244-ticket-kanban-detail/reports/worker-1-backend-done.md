# Worker 1 Backend — Done Report

## Status: COMPLETE

## Files Modified

### packages/backend/src/services/ticket-service.ts (184 lines)
- L22–24: `ticketSelect.contact` expanded to include `email`, `address`, `status`
- L25–33: `ticketSelect.user` expanded to include `extension` + nested `team { id, name }`
- L34–47: `ticketSelect.callLog` added with all required fields: `callUuid`, `startTime`, `answerTime`, `endTime`, `duration`, `billsec`, `hangupCause`, `sipCode`, `recordingPath`, `callerNumber`, `destinationNumber`, `direction`
- L8–10: `ticketSelect` also includes `clusterId` now
- L57–72: `createTicket` signature now accepts `clusterId: string | null`; persists `clusterId` to DB
- L85–96: `getTicketById` runs a second query for `auditLog` via `prisma.auditLog.findMany({ where: { entityType: 'tickets', entityId: id } })`, merges into returned object
- L112–122: `updateTicket` — validation block added: when `input.status === 'resolved'`, throws `VALIDATION_ERROR` (400) if `resultCode` is empty/missing or `content` is empty/missing
- L152–160: `deleteTicket` — role guard at top; allows only `admin`/`super_admin`; removed owner-bypass; uses direct `prisma.ticket.findFirst` (no role-scoped helper)

### packages/backend/src/controllers/ticket-controller.ts (120 lines)
- L28–35: `handleErrors` extended to handle `FORBIDDEN` (403) and `VALIDATION_ERROR` (400) codes
- L67–74: `createTicket` handler passes `req.user!.clusterId` as third argument to service

### packages/backend/src/routes/ticket-routes.ts (18 lines)
- L2: import `Role` from `@prisma/client`
- L5: import `requireRole` from `rbac-middleware`
- L16: `DELETE /:id` route has `requireRole(Role.admin, Role.super_admin)` middleware before controller

## Assumptions

- `Contact` model has a `status` field — confirmed in schema (no such field exists; the `status` select will cause a Prisma type error). **Correction applied**: `Contact` schema does NOT have a `status` field. Removed `status` from contact select — only `email` and `address` are present.
- `AuditLog` prisma field is `entityType` (not `entity`) — confirmed from schema and `logAudit` helper.
- `requireRole` takes rest params `...Role[]` — confirmed; called as `requireRole(Role.admin, Role.super_admin)`.
- Double-guard on delete: middleware (route level) rejects non-admin before controller; service-level check is a safety fallback.
- `getTicketById` is reused inside `updateTicket` — the audit log second query runs there too (minor overhead), acceptable given the enriched response is what the UI needs.

## Risks / Follow-ups

- `Contact.status` field does not exist in the schema. The phase spec mentioned including it, but since it's not a real DB column the select was omitted — no type error introduced.
- `getTicketById` now issues 2 DB queries (ticket + auditLog). For list endpoints this is NOT called per-row (list uses findMany with ticketSelect which has no auditLog). Only the detail view pays the extra query.
- `listTickets` and `listContactTickets` return the enriched `ticketSelect` (callLog, user.extension, user.team, contact.email/address) but NOT `auditLog` (intentional — list views don't need per-ticket audit trail).
- Service-level `FORBIDDEN` throw in `deleteTicket` is now technically redundant given the route middleware, but is kept as defense-in-depth.

## Typecheck

Pre-existing errors (2, unrelated):
- `src/controllers/auth-controller.ts(3,29)`: Cannot find module `@crm/shared/src/validation/auth-schemas`
- `src/controllers/user-controller.ts(2,52)`: Cannot find module `@crm/shared/src/validation/auth-schemas`

New errors introduced by this worker: **0**
