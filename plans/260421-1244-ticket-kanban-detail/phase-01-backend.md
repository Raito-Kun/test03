# Phase 01 — Backend enhancements

## Owner
Worker 1 (fullstack-developer)

## Files (exclusive)
- `packages/backend/src/services/ticket-service.ts` (EDIT)
- `packages/backend/src/controllers/ticket-controller.ts` (EDIT)
- `packages/backend/src/routes/ticket-routes.ts` (EDIT — add RBAC middleware on DELETE)

## Tasks

### 1. `createTicket` — set clusterId
```ts
// ticket-service.ts createTicket signature change:
export async function createTicket(input: CreateTicketInput, userId: string, clusterId: string | null, req?: Request)
// ticket.create data: { ..., clusterId: clusterId ?? null }
```
Controller passes `req.user!.clusterId`.

### 2. `getTicketById` — include callLog + audit
Modify `ticketSelect`:
- Add `content` (already there), `callLog` include with fields listed in plan.md API contract
- Add `user.extension`, `user.team`
- Add `contact.email`, `contact.address`, `contact.status`

Add a separate query for audit log (no FK on audit_logs, so manual):
```ts
const audit = await prisma.auditLog.findMany({
  where: { entity: 'tickets', entityId: id },
  orderBy: { createdAt: 'desc' },
  take: 50,
  include: { user: { select: { id: true, fullName: true } } },
});
```
Merge into response as `auditLog` field.

### 3. `updateTicket` — resolution required
When `input.status === 'resolved'`:
- Require `input.resultCode` non-empty (throw VALIDATION_ERROR if missing)
- Require `input.content` non-empty (resolution note)
- Set `resolvedAt = now()`
- Append audit entry via existing `logAudit`

### 4. `deleteTicket` — admin+ only
Add role check at top:
```ts
if (role !== 'admin' && role !== 'super_admin') {
  throw Object.assign(new Error('Forbidden'), { code: 'FORBIDDEN', statusCode: 403 });
}
```
Remove the current owner-self check (agents shouldn't delete at all).

### 5. Route middleware
`ticket-routes.ts` — on `DELETE '/:id'`, add `requireRole(['admin', 'super_admin'])` if helper exists; otherwise leave service-level check.

## Testing contract
- `POST /tickets` with agent role → ticket.clusterId matches user.clusterId
- `GET /tickets/:id` returns callLog + auditLog
- `PATCH /tickets/:id { status: 'resolved' }` without resultCode → 400
- `DELETE /tickets/:id` as agent → 403; as admin → 200

## Typecheck
Run `npx tsc --noEmit` from `packages/backend/` after changes. Existing 2 pre-existing errors on auth-controller/user-controller (shared validation import) are OK — do not attempt to fix them.

## Done criteria
- Typecheck passes (or only pre-existing errors)
- No other file in the repo touched besides the 3 listed
- Report saved to `plans/260421-1244-ticket-kanban-detail/reports/worker-1-backend-done.md` describing: what changed, any assumptions made, any risks
