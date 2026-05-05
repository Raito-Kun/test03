---
phase: 04
title: "Compliance engine — DNC, time window, max attempts"
size: M
status: pending
---

# Phase 04 — Compliance Engine

## Context
- Research: [researcher-03](research/researcher-03-compliance-scheduler.md)

## Overview
- Priority: P2 (blocks scheduler — never dial without compliance layer)
- Status: pending
- Pure-function compliance pipeline invoked pre-originate. Returns `{ ok, reason }`. Never ships without all three gates enforced.

## Key Insights
- Single entry point `canDial(lead, campaign, now)` — testable without infra.
- Skip-reason codes travel to `autocall_calls.skip_reason` so blocked attempts show up in reports.
- Mid-call window close = in-flight calls finish, no new originates. Scheduler handles, engine just reports out_of_window.
- **No holiday gate** (decision #3 — holiday calendar skipped entirely). Time window is just daily local-time range `[window_start, window_end)` in `campaign.timezone`. No `excludeWeekends`, no `excludeDates`.
- **Callback bypasses COOLDOWN** (decision #4). Agent-scheduled `next_eligible_at` is honored as-is; cooldown gate only applies when `next_eligible_at` is NULL and we're computing retry from `last_attempt_at + retry_cooldown_min`. See revised logic below.

## Requirements
**Functional**
- 5 gates in order: DNC → time window → max attempts → retry cooldown/callback-eligibility → pacing cap.
- Short-circuit on first fail.
- Logs to `autocall_calls` row with `skip_reason` and NULL call fields when blocked by pre-originate checks (so analytics can compute DNC hit rate, window skips, etc).
- **Callback override**: if `lead.next_eligible_at IS NOT NULL`, use it as the sole eligibility check (`now >= next_eligible_at` → pass). Skip cooldown calculation entirely. This is the path agent-scheduled callbacks take (decision #4).

**Non-functional**
- `canDial` ≤5ms p99 (DNC lookup dominates → rely on unique index).
- Deterministic — time injected as parameter, tz math via `Intl.DateTimeFormat` / `date-fns-tz`.

## Architecture

```
packages/backend/src/services/
├── autocall-compliance-service.ts         # canDial() + sub-checks
└── (uses autocall-dnc-service.ts, autocall-lead-service.ts)

packages/backend/src/lib/
└── autocall-compliance-rules.ts           # pure functions, no DB
```

```ts
export type SkipReason =
  | 'DNC' | 'OUT_OF_WINDOW' | 'EXHAUSTED' | 'COOLDOWN' | 'CALLBACK_NOT_DUE' | 'PACING';

export interface CanDialResult { ok: true } | { ok: false; reason: SkipReason; meta?: Record<string, unknown> };

canDial(lead, campaign, now, activeCallCount): Promise<CanDialResult>
```
Note: `HOLIDAY` removed (decision #3). `CALLBACK_NOT_DUE` added for leads where `next_eligible_at > now` (callback path, bypasses cooldown calc).

## Related Code Files
**Create**
- `packages/backend/src/services/autocall-compliance-service.ts`
- `packages/backend/src/lib/autocall-compliance-rules.ts` (pure fns)
- `packages/backend/tests/autocall-compliance.test.ts`

**Modify**
- `packages/backend/src/services/autocall-esl-service.ts` — call `canDial` before every originate; record skip row on rejection.

## Implementation Steps
1. Pure rule functions in `autocall-compliance-rules.ts`:
   - `isInTimeWindow(now, tz, start, end): boolean` — no holiday/weekend args
   - `isExhausted(attemptCount, max): boolean`
   - `isInCooldown(lastAttemptAt, cooldownMin, now): boolean` — used only when `next_eligible_at IS NULL`
   - `isCallbackDue(nextEligibleAt, now): boolean` — returns true if `nextEligibleAt <= now`
   - `exceedsPacing(active, cap): boolean`
2. `autocall-compliance-service.ts` wraps pure fns + `autocall-dnc-service.isDnc(phone, clusterId)`.
3. `canDial` gate order:
   - DNC → `OUT_OF_WINDOW` (time window) → `EXHAUSTED` (max attempts) → eligibility branch:
     - if `lead.next_eligible_at !== null` → `isCallbackDue()` ? pass : `CALLBACK_NOT_DUE` (bypasses cooldown entirely, decision #4)
     - else → `isInCooldown()` ? `COOLDOWN` : pass
   - → `PACING` cap
4. Helper `recordSkip(lead, campaign, reason)` writes a row to `autocall_calls` with `skip_reason` + nulls for call fields, increments `attempt_count` ONLY if a real originate happens (skip rows do not count toward max).
5. Wire `autocall-esl-service.originate` (in engine) to call `canDial` before ESL command; if rejected, call `recordSkip` + return `{ skipped: true, reason }` to caller (scheduler handles).
6. Tests — table-driven, cover all 6 reasons + happy path + timezone DST edge + max attempts boundary + **callback-bypass-cooldown scenario** (lead with `last_attempt_at` 10min ago, `cooldown=60min`, `next_eligible_at=now-1min` → must pass).

## Todo List
- [ ] Pure rules module
- [ ] Compliance service with DNC integration
- [ ] canDial orchestrator
- [ ] recordSkip helper
- [ ] Wire into ESL service pre-originate
- [ ] Unit tests table-driven
- [ ] DST edge test (window 8-20 Asia/HCM)
- [ ] Compile check

## Success Criteria
- Unit tests pass all gates.
- Manual: add phone to DNC, trigger dial via test endpoint — call not placed, `autocall_calls` row with `skip_reason=DNC`.
- Window 8-20 with `now=06:00 Asia/HCM` → rejected `OUT_OF_WINDOW`.
- Lead with `attempt_count=3, max=3` → `EXHAUSTED` + lead status auto-flips to `exhausted`.

## Risk Assessment
- Timezone errors: always use IANA string, never offset. Date math via `date-fns-tz`.
- Skip-row explosion: a campaign with 100k DNC-blocked leads generating 100k skip rows daily. Mitigation: de-dup — skip row only if last attempt's `skip_reason` differs or >24h ago.

## Security
- No new permissions needed (uses existing `autocall.campaigns.write` context).

## Next Steps
Unblocks phase 05 (scheduler hooks into `canDial`).
