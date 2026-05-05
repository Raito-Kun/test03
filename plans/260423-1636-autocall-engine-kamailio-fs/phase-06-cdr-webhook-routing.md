---
phase: 06
title: "CDR webhook routing by PbxCluster.type"
size: S
status: pending
---

# Phase 06 — CDR Webhook Routing

## Context
- Research: [researcher-02](research/researcher-02-freeswitch-progressive-cdr.md)
- Existing handler: `packages/backend/src/controllers/webhook-controller.ts` (`handleCdr`)
- Rules: `.claude/rules/pbx-incident-patterns.md`

## Overview
- Priority: P2 (zero-regression gate for existing FusionPBX CDR flow)
- Status: pending
- Extend existing `/api/v1/webhooks/cdr` to split writes by `PbxCluster.type`. `fusionpbx` → `call_logs` (today); `kamailio-fs` → `autocall_calls` + lead state updates. Same endpoint, same auth, same XML shape.

## Key Insights
- Source IP → cluster lookup is ALREADY in place. Add one conditional branch after cluster resolution.
- `fs_uuid` correlates engine-originated calls to incoming CDR. Autocall path must upsert by `fs_uuid` (scheduler inserts initial row, webhook fills in billsec/hangup_cause).
- Custom channel vars `campaign_id`, `lead_id`, `autocall_cluster` from CDR XML `variables/` section map 1:1 to DB fields.

## Requirements
**Functional**
- `POST /api/v1/webhooks/cdr` detects cluster → if `type=fusionpbx` → existing `call_logs` pipeline untouched; if `type=kamailio-fs` → autocall CDR handler.
- Autocall CDR handler:
  - Parse XML, extract custom vars.
  - Upsert `autocall_calls` by `fs_uuid`.
  - Update `autocall_leads.status` (`attempted` on no-answer, `dialing` removed, etc).
  - Increment `attempt_count` ONLY on actual attempt (not skip).
- Dedupe by `fs_uuid` unique constraint.
- `billsec=0` invariant when `answered_at IS NULL` (2026-04-21 rule from pbx-incident-patterns).

**Non-functional**
- Handler ≤100 lines per file (split controller + service).
- Compatible with existing `webhook_logs` raw-payload archive.
- Backfill script replays from `webhook_logs` if autocall rows missing (reuse existing pattern).

## Architecture

```
packages/backend/src/controllers/
└── webhook-controller.ts                   # MODIFIED: branch by cluster type

packages/backend/src/services/
├── call-log-service.ts                     # unchanged (fusionpbx)
└── autocall-cdr-service.ts                 # NEW: parse + upsert autocall_calls + lead updates

packages/backend/src/lib/
└── cdr-merge.ts                            # unchanged (reused — handles billsec invariant)
```

## Related Code Files
**Create**
- `packages/backend/src/services/autocall-cdr-service.ts`
- `packages/backend/tests/autocall-cdr.test.ts` (fixture XML + integration)

**Modify**
- `packages/backend/src/controllers/webhook-controller.ts` — add cluster-type branch (~20 lines)

## Implementation Steps
1. Add `autocall-cdr-service.ts`:
   - `parseCdrXml(raw) → ParsedCdr` (reuse existing parser helpers from `webhook-controller.ts` — extract to `lib/cdr-parser.ts` if not already).
   - Extract `variables.campaign_id`, `variables.lead_id`, `variables.autocall_cluster`, `Channels/Channel/CallerProfile/...`.
   - `upsertAutocallCall(cluster, parsed)`:
     - Find by `fs_uuid` (upsert).
     - Apply `mergeBillsec` + `mergeDuration` from existing `cdr-merge.ts` (reuse).
     - Set `answered_at` from CDR.
     - Set `result` from hangup_cause mapping (`ANSWER=answered`, `NO_ANSWER/ORIGINATOR_CANCEL=no_answer`, `USER_BUSY=busy`, etc).
     - Update `recording_path` from `variables.record_file_path` — stereo file (`-stereo.mp3` suffix, decision #2); no special handling vs mono, existing recording-service contract serves the file as-is.
   - `updateLeadAfterCall(lead, call)`:
     - If agent dispositioned → status from disposition.
     - Else: `attempted` + schedule next retry if attempts < max.
2. Modify `webhook-controller.ts` `handleCdr`:
   ```ts
   const cluster = await resolveClusterByIp(clientIp);   // existing
   if (cluster.type === 'kamailio_fs') {
     await autocallCdrService.handle(cluster, rawBody);
   } else {
     await existingFusionpbxPipeline(cluster, rawBody);  // unchanged
   }
   ```
3. Unit tests with fixture XML from both flavors — verify correct table written, no cross-contamination.
4. Integration test: POST fake autocall CDR → row in `autocall_calls`, lead status updated, no `call_logs` row.
5. Integration test: POST FusionPBX CDR → `call_logs` row, no `autocall_calls` row.

## Todo List
- [ ] Extract CDR parser to shared lib if not already
- [ ] autocall-cdr-service
- [ ] webhook-controller branch
- [ ] Hangup-cause → AutocallCallResult map
- [ ] Lead state update logic
- [ ] Fixture XMLs (both flavors)
- [ ] Unit + integration tests
- [ ] billsec=0 invariant test for unanswered
- [ ] Compile check

## Success Criteria
- Two fixture CDRs → land in correct tables.
- `billsec=0` when `answered_at` null (invariant test green).
- Existing FusionPBX test suite unchanged + passing.
- Replay existing `webhook_logs` dev rows → zero rows land in `autocall_calls` (cluster type check).

## Risk Assessment
| Risk | Mitigation |
|---|---|
| Accidental fusionpbx → autocall cross-write | exhaustive fixture tests both ways |
| Missing custom var (scheduler didn't set campaign_id) | log warn + store row anyway with `skip_reason=MISSING_VAR`, avoid silent loss |
| Lead status flips prematurely | agent disposition wins over webhook-derived status |

## Security
- Whitelist extended to include both FS node IPs for autocall cluster — seed in `PbxCluster.pbx_ip` allow list helper.
- Same rate limiting + audit as existing endpoint.

## Next Steps
Unblocks phase 09 (reports query `autocall_calls`), phase 10 (load test validates webhook throughput).
