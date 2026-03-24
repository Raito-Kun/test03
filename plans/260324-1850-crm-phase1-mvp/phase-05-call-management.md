---
phase: 05
title: "Call Management"
status: completed
priority: P1
effort: 4d
depends_on: [04]
---

# Phase 05 — Call Management

## Context Links
- [PRD](../../Guildline/PRD.md) — Sections 4.2.4, 4.3, 6.5-6.6, 6.9, API 7.7, 7.10-7.11
- [Plan Overview](./plan.md)

## Overview
Call logs listing/filtering, recording audio player, disposition codes management, QA annotation CRUD. This phase builds the call history and quality features on top of Phase 04's VoIP integration.

## Key Insights
- Call logs are created by both ESL events (real-time) and CDR webhook (post-call) — upsert by call_uuid
- Dispositions are global (not per-campaign in Phase 1; campaign-level dispositions in Phase 2)
- Recording playback needs waveform-capable audio player in FE (Phase 08) but backend streaming built here
- QA annotations link to call_logs, allow timestamped notes on recordings

## Requirements
**Functional:**
- Call logs: list with pagination, filter (date range, agent, direction, disposition, campaign)
- Call log detail: full info + recording + disposition + QA annotations
- Disposition codes: CRUD (admin/manager), list for agent selection
- Post-call disposition: agent selects disposition during/after wrap-up
- QA annotations: create/update for QA/Leader/Manager roles
- In-call controls: hold, transfer, hangup (via ESL through API)

**Non-functional:**
- Call log queries < 200ms for 50k records (indexed)
- Disposition selection UX: dropdown with keyboard search

## Related Code Files
**Create:**
- `packages/backend/src/routes/call-log-routes.ts`
- `packages/backend/src/routes/disposition-code-routes.ts`
- `packages/backend/src/routes/qa-annotation-routes.ts`
- `packages/backend/src/controllers/call-log-controller.ts`
- `packages/backend/src/controllers/disposition-code-controller.ts`
- `packages/backend/src/controllers/qa-annotation-controller.ts`
- `packages/backend/src/services/call-log-service.ts`
- `packages/backend/src/services/disposition-code-service.ts`
- `packages/backend/src/services/qa-annotation-service.ts`
- `packages/shared/src/validation/call-log-schemas.ts`
- `packages/shared/src/validation/disposition-schemas.ts`
- `packages/shared/src/validation/qa-annotation-schemas.ts`

## Implementation Steps

### 1. Call log endpoints
1. `GET /call-logs` — pagination + filters: date range, user_id, direction, disposition_code_id, campaign_id, contact_id, hangup_cause
2. `GET /call-logs/:id` — full detail including contact info, recording info, disposition, QA annotations
3. RBAC: agents see own calls, leaders see team, manager/QA see all
4. Indexes: call_logs(start_time), call_logs(user_id), call_logs(contact_id)

### 2. In-call control endpoints
1. `POST /calls/hangup` — body: `{ callUuid }` → ESL uuid_kill
2. `POST /calls/hold` — body: `{ callUuid }` → ESL uuid_hold toggle
3. `POST /calls/transfer` — body: `{ callUuid, targetExtension }` → ESL uuid_transfer
4. All validate: caller owns the call (match user_id), call is active (check Redis)

### 3. Disposition code management
1. `GET /disposition-codes` — list, filter by category (telesale/collection/both), active only for agents
2. `POST /disposition-codes` — create (admin/manager)
3. `PATCH /disposition-codes/:id` — update label, category, is_final, requires_callback, sort_order
4. `DELETE /disposition-codes/:id` — soft delete (set is_active=false)

### 4. Post-call disposition
1. `POST /call-logs/:id/disposition` — body: `{ dispositionCodeId, notes }`
2. Agent sets disposition during wrap-up or after call
3. If disposition.requires_callback=true → prompt for follow-up date, create notification
4. If disposition.is_final=true → mark lead/debt status accordingly (optional automation)
5. Update call_logs.disposition_code_id and call_logs.notes

### 5. QA Annotation endpoints
1. `POST /call-logs/:id/qa` — body: `{ score, criteriaScores, comment, timestampNote }`
   - score: 0-100 overall
   - criteriaScores: JSONB `{ greeting: 8, product_knowledge: 7, closing: 9 }`
   - timestampNote: JSONB `[{ time: 45, note: "Good empathy" }, { time: 120, note: "Missed upsell" }]`
2. `PATCH /qa-annotations/:id` — update annotation
3. `GET /qa-annotations` — list with filters (agent, campaign, score range, date range)
4. RBAC: QA/Leader/Manager/Admin can create; agents cannot

## Todo List
- [x] Call log list + detail endpoints with RBAC
- [x] In-call controls (hangup, hold, transfer)
- [x] Disposition code CRUD endpoints
- [x] Post-call disposition endpoint + callback logic
- [x] QA annotation CRUD endpoints
- [x] DB indexes for call_logs performance
- [x] Zod validation schemas

## Success Criteria
- Call logs paginate correctly with all filters
- Agent can set disposition after call
- requires_callback disposition triggers notification
- QA can annotate with scores + timestamped notes
- In-call controls work (verified via ESL)

## Risk Assessment
- Disposition set on call that CDR hasn't arrived yet: call_logs record exists from ESL event (Phase 04), disposition links to it
- QA annotation on call without recording: allow, but flag recording_status

## Security Considerations
- In-call controls validate call ownership (agent can only control own calls)
- QA annotations immutable after 24h (prevent score tampering) — enforce via service logic
- Disposition audit logged
