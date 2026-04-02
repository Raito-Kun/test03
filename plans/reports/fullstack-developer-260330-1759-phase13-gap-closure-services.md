# Phase Implementation Report

## Executed Phase
- Phase: phase-13-gap-closure (4 new backend services)
- Plan: none (direct task)
- Status: completed

## Files Modified
- `packages/backend/src/services/right-party-contact-service.ts` — created (110 lines)
- `packages/backend/src/services/sla-alert-service.ts` — created (145 lines)
- `packages/backend/src/services/campaign-progress-service.ts` — created (72 lines)
- `packages/backend/src/services/guarantor-service.ts` — created (120 lines)

## Tasks Completed
- [x] `right-party-contact-service`: `markRightPartyContact({ callLogId, isRightParty, userId })` stores RPC flag as JSON in `CallLog.notes`; `getRpcStats(filters)` returns totals + per-agent breakdown
- [x] `sla-alert-service`: `getSlaBreaches(query)` + `getSlaSummaryStats(query)` with priority-based thresholds (urgent/high/medium/low), 80% approaching threshold
- [x] `campaign-progress-service`: `getCampaignProgress(campaignId)` + `getAllCampaignProgress(query)` using `Lead.groupBy` for efficiency
- [x] `guarantor-service`: `listGuarantors(debtCaseId?)` + `addGuarantor(input)` + `removeGuarantor(id, debtCaseId?)` using `ContactRelationship` model with `RelationshipType.guarantor` (no `guarantor` field exists on `DebtCase`)
- [x] Aligned all function signatures to match pre-existing route files
- [x] TypeScript compile: zero errors

## Key Design Decisions
- `DebtCase` has no guarantor field — used `ContactRelationship` (type=guarantor) + creates a new `Contact` record per guarantor
- RPC flag stored as JSON in `CallLog.notes` (no dedicated column); JSON parse with fallback for plain-text notes
- SLA thresholds: urgent 1h/4h, high 4h/24h, medium 8h/72h, low 24h/168h
- `removeGuarantor` accepts `string | string[]` for debtCaseId to match Express `req.query` type

## Tests Status
- Type check: pass (0 errors)
- Unit tests: not run (not in scope)

## Issues Encountered
- Pre-existing route files (`guarantor-routes.ts`, `rpc-routes.ts`, `sla-alert-routes.ts`, `campaign-progress-routes.ts`) had mismatched function name expectations vs task spec — resolved by aligning service exports to match routes
- `rpc-routes.ts` uses `req.user!.id` but `TokenPayload` has `userId` — pre-existing bug in route file, not in my service files (route not owned by this task)

## Next Steps
- Route-level bug: `rpc-routes.ts` line 20 uses `req.user!.id` should be `req.user!.userId` — needs fix in route owner's task
- Guarantor contacts created without `createdBy` linkage — acceptable for now per YAGNI

## Unresolved Questions
- Should `removeGuarantor` also delete the guarantor's `Contact` record, or keep it (current: keep, safe default)?
- Should `markRightPartyContact` emit a notification or audit log entry?
