# Phase Implementation Report

### Executed Phase
- Phase: schema-jobs-tickets
- Plan: none (ad-hoc task)
- Status: completed

### Files Modified

| File | Change |
|------|--------|
| `packages/backend/prisma/schema.prisma` | Added SLA fields to Ticket, wrapUpDuration+createdAt to AgentStatusLog, timestamp+category to QaAnnotation, debt_escalated+sla_breach to NotificationType enum |
| `packages/backend/prisma/migrations/20260328000000_add_sla_and_qa_fields/migration.sql` | New migration SQL for all schema additions |
| `packages/backend/src/services/ticket-service.ts` | Added SLA tracking logic (firstResponseAt, resolvedAt, slaBreached) + sla_breach notification |
| `packages/backend/src/services/macro-service.ts` | Added `applyMacro()` function |
| `packages/backend/src/controllers/macro-controller.ts` | Added `applyMacro` handler with Zod validation |
| `packages/backend/src/routes/macro-routes.ts` | Registered `POST /macros/apply` |
| `packages/backend/src/jobs/debt-escalation-job.ts` | New file — daily DPD calculation + tier escalation + notifications |
| `packages/backend/src/index.ts` | Registered `startDebtEscalationJob()` |

### Tasks Completed

- [x] Schema: added `firstResponseAt`, `resolvedAt`, `slaBreached` to Ticket
- [x] Schema: added `wrapUpDuration` and `createdAt` to AgentStatusLog
- [x] Schema: added `timestamp`, `category` to QaAnnotation
- [x] Schema: added `debt_escalated`, `sla_breach` to NotificationType enum
- [x] Schema: verified Lead already has `score Int @default(0)` — no change needed
- [x] Schema: verified Contact already has `ContactRelationship` relations — no change needed
- [x] Migration SQL created: `20260328000000_add_sla_and_qa_fields`
- [x] Prisma client regenerated successfully
- [x] Ticket SLA: firstResponseAt set on open→in_progress transition
- [x] Ticket SLA: resolvedAt set on →resolved transition
- [x] Ticket SLA: slaBreached=true + sla_breach notification if first response > 4h
- [x] Macro apply: `POST /macros/apply` appends macro content to ticket, optionally sets status/priority
- [x] Debt escalation job: daily DPD recalculation from dueDate, auto-tier assignment, debt_escalated notification on tier change
- [x] Job registered in index.ts

### Tests Status
- Type check: pass (0 errors in owned files)
- Pre-existing errors in non-owned files: `dashboard-service.ts` (id in _avg aggregate), `recording-service.ts` (archiver types), `qa-timestamp-routes.ts` (JsonB type) — all existed before this task

### Issues Encountered

- `AgentStatusLog` was missing `createdAt` field but `dashboard-service.ts` (not owned) referenced it. Added `createdAt DateTime @default(now()) @map("created_at")` to schema to fix the compile error without touching the non-owned file.
- Pre-existing compile errors in `recording-service.ts` and `qa-timestamp-routes.ts` are outside scope.

### Next Steps

- Run `npx prisma migrate deploy` (or `migrate dev`) against the actual DB to apply the migration
- The `recording-service.ts` archiver type issue: `npm i --save-dev @types/archiver`
- The `dashboard-service.ts` `_avg: { id }` issue needs fixing in that service's owner scope
