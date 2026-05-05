---
phase: 05
title: "Campaign scheduler + progressive dialer"
size: L
status: pending
---

# Phase 05 — Scheduler + Progressive Dialer

## Context
- Research: [researcher-02](research/researcher-02-freeswitch-progressive-cdr.md), [researcher-03](research/researcher-03-compliance-scheduler.md)

## Overview
- Priority: P2
- Status: pending
- Heartbeat worker that, per active campaign, detects idle agents, dials next lead per `paceNext()`. Progressive = 1 call/idle agent. Pacing hook allows Predictive later without rewrite.

## Key Insights
- **Code lives in `packages/autocall-engine`** (decision #6) — separate PM2 app, NOT `crm-backend`. In-process `setInterval` inside engine is KISS for 300 CCU.
- Agent-idle detection = state machine inside engine + ESL `CHANNEL_HANGUP` events + 30s reconcile with `show channels`. Agent ready/pause transitions arrive via Redis channel `autocall:agent:status` (published by backend agent endpoints).
- `paceNext(campaign, idle, active)` is the single forward-compat hook. Progressive returns `idle - active`; Predictive later multiplies + throttles on abandoned rate.
- **Callback path**: scheduler's lead fetch `ORDER BY priority DESC, next_eligible_at ASC NULLS LAST, last_attempt_at ASC NULLS FIRST` + `WHERE (next_eligible_at IS NULL OR next_eligible_at <= now())`. Compliance `canDial` enforces the exact eligibility check (decision #4).

## Requirements
**Functional**
- One tick per second per engine process.
- For each `is_active=true` campaign in time window, compute pace, fetch next N leads ordered by `(priority DESC, last_attempt_at ASC NULLS FIRST)`.
- For each lead, run `canDial`; if ok → originate via ESL pool (pick least-loaded FS node).
- On `CHANNEL_ANSWER` event, update `autocall_calls.answered_at`, `was_bridged=true`, bind call to agent; emit socket event to agent UI.
- On `CHANNEL_HANGUP` event, update `autocall_calls.ended_at/hangup_cause`, transition agent to `wrap_up` for `wrapSeconds`, then auto-`ready`.
- Reconcile loop (30s): compare in-memory agent state vs `show channels` on each FS node; correct drift; log anomalies.

**Non-functional**
- Tick cost ≤50ms for 10 active campaigns × 50 agents.
- Lead fetch uses `SELECT ... FOR UPDATE SKIP LOCKED` to safely parallelize per campaign.
- Graceful shutdown: stop accepting new originates, wait up to 30s for in-flight, then exit.

## Architecture

```
packages/autocall-engine/src/                  # NOT in backend — separate PM2 app (decision #6)
├── scheduler.ts                               # setInterval(1s) loop, graceful shutdown hook, tick()
├── agent-state.ts                             # in-memory state machine (Map<agentId, State>)
├── event-handler.ts                           # subscribes to FS ESL events + publishes autocall:call:event Redis
├── originate.ts                               # orchestrates canDial + ESL originate + DB updates
├── pacing.ts                                  # paceNext() Progressive impl + Predictive placeholder
└── redis-bus.ts                               # subscribes autocall:agent:status + autocall:campaign:control
```
Compliance module (`autocall-compliance-service.ts`, phase-04) is imported from `@crm/backend` workspace OR duplicated in engine — prefer workspace shared package `@crm/autocall-shared` to avoid duplication.

## Related Code Files
**Create**: all listed above + tests.

**Modify**
- `packages/autocall-engine/src/index.ts` — boot scheduler on engine startup if `FEATURE_AUTOCALL_ENABLED` for any cluster.
- `packages/backend/src/lib/socket-io.ts` — subscribe to Redis `autocall:call:event` published by engine, relay to frontend as `autocall:call_ringing`, `autocall:call_answered`, `autocall:call_ended`, `autocall:agent_state` Socket.IO events.

## ESL Event Subscriptions
- `CHANNEL_CREATE` → link back to `autocall_calls.fs_uuid`
- `CHANNEL_ANSWER` → set `answered_at`, `was_bridged` if bridge leg
- `CHANNEL_BRIDGE` → bind agent ID to call row
- `CHANNEL_HANGUP_COMPLETE` → finalize call (ended_at, hangup_cause, billsec — wait for CDR webhook for authoritative values; event is for realtime UI)
- `DTMF` → optional, forward to agent UI for IVR input scenarios (out of MVP)
- `avmd::beep` → placeholder handler for Predictive AMD later

## Agent State Machine (in-memory)

```
States: offline → ready → on_call → wrap_up → ready
                    └─► pause ─► ready
```

Transitions (backend publishes Redis `autocall:agent:status` on each, engine consumes):
- `POST /api/v1/autocall/agent/session/start` → `offline → ready`
- Scheduler dials → `ready → on_call` (engine-local transition, also published back to backend for UI)
- `CHANNEL_BRIDGE` → confirms `on_call`
- `CHANNEL_HANGUP_COMPLETE` → `on_call → wrap_up`
- `wrap_up` timer OR `POST /agent/wrap-done` → `wrap_up → ready`
- `POST /agent/pause` → `ready → pause`
- `POST /agent/ready` → `pause → ready`

Every transition writes to `autocall_agent_sessions` cumulative counters.

## paceNext Hooks

```ts
// autocall-pacing.ts
export function paceNext(campaign, idleAgents, activeCalls): number {
  if (campaign.dialerMode === 'progressive') {
    return Math.max(0, idleAgents - activeCalls);
  }
  // Predictive (future)
  const base = idleAgents * campaign.pacingMultiplier;
  const throttle = /* abandoned rate check */ 1.0;
  return Math.max(0, Math.floor(base * throttle) - activeCalls);
}
```

## Implementation Steps
1. `autocall-agent-idle-state.ts` — Map + event emitter.
2. `autocall-event-handler-service.ts` — ESL event subscribe on each FS connection; dispatch to state + DB updaters.
3. `autocall-originate-service.ts` — pulls lead, runs canDial, picks FS node (least active), calls ESL, writes `autocall_calls` row with initial state.
4. `autocall-pacing.ts` — paceNext impl + Predictive scaffold with `TODO(predictive)` comments.
5. `autocall-scheduler-service.tick()` — per-campaign loop.
6. `autocall-scheduler-job.ts` — setInterval + SIGTERM handler for graceful shutdown.
7. Reconcile job — separate 30s interval, calls `show channels` on each FS, diffs.
8. Socket emits for realtime UI.
9. Tests — simulated ESL events via mock connection; verify state transitions + idempotent event handling.

## Todo List
- [ ] Agent state machine module
- [ ] ESL event handler service
- [ ] Originate service
- [ ] Pacing module
- [ ] Scheduler tick
- [ ] Scheduler job + graceful shutdown
- [ ] Reconcile job
- [ ] Socket event emits
- [ ] Tests (state, pacing, tick with mocks)
- [ ] Compile check

## Success Criteria
- Campaign with 10 leads + 1 agent (ready): agent gets 1 call at a time, no parallel.
- Agent pauses → scheduler stops dialing that agent.
- Dead FS-01 → all originates route via FS-02 (dispatcher handles SIP; pool picks healthy).
- 30s reconcile corrects drift when a `CHANNEL_HANGUP` event is dropped (simulated).
- Shutdown signal → in-flight completes, no new originates, exits <30s.

## Risk Assessment
| Risk | Mitigation |
|---|---|
| Event loss → stuck `on_call` | 30s reconcile + max wrap timeout (2× configured) auto-resets |
| Thundering herd: 50 agents all ready after shift start | Jitter first tick per campaign by random 0-500ms |
| Lead fetch race across multiple engine instances | `SELECT ... FOR UPDATE SKIP LOCKED` (but MVP = single instance so this is forward-proofing) |
| Carrier CPS breach during ramp | Kamailio `pipelimit` primary, scheduler `pacingCap` secondary |

## Security
- No new perms; uses existing `autocall.agent.work`.
- ESL connection creds already per-cluster in DB.

## Next Steps
Unblocks phase 06 (CDR webhook needs to find `autocall_calls` row by fs_uuid written here), 08 (agent workstation subscribes to socket events), 09 (monitor reads live state).
