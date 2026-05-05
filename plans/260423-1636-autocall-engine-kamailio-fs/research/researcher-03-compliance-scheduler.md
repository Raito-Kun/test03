---
title: "Compliance Engine + Campaign Scheduler Design"
topic: compliance-scheduler-progressive
audience: planner
created: 2026-04-23
---

# Researcher 03 — Compliance + Scheduler

## Scope
Pre-dial gatekeeping (DNC, time window, max attempts) + progressive pacing orchestration. Report KPIs bakeable day 1.

## Lead State Machine

```
new
  │
  ├─▶ attempt scheduled ──▶ dialing ──┬─▶ answered ─▶ agent_wrap ─▶ dispositioned
  │                                    │                                 │
  │                                    │                                 ├─▶ completed
  │                                    │                                 ├─▶ callback_scheduled
  │                                    │                                 └─▶ retry_queued
  │                                    │
  │                                    ├─▶ no_answer ─▶ retry_queued (if attempts < max)
  │                                    │             └─▶ exhausted
  │                                    ├─▶ busy ─────▶ retry_queued
  │                                    ├─▶ cancel ───▶ retry_queued
  │                                    ├─▶ congestion ▶ retry_queued (short cooldown)
  │                                    └─▶ failed    ─▶ retry_queued (long cooldown)
  │
  ├─▶ dnc_blocked (terminal)
  └─▶ out_of_window (transient — re-eligible next window)
```

Terminal states: `completed`, `dnc_blocked`, `exhausted`.

Each attempt lands one row in `autocall_calls`. `autocall_leads.status` reflects the latest.

## Compliance Pipeline (Pre-Originate)

Run IN ORDER before every ESL originate. Fail-fast. Each check logs reason to `autocall_calls.disposition` when it blocks.

```ts
async function canDial(lead, campaign, now): Promise<CanDialResult> {
  // 1. DNC check
  if (await isDnc(lead.phone, campaign.clusterId)) return { ok: false, reason: 'DNC' };

  // 2. Time window (tenant local TZ)
  const local = inCampaignTz(now, campaign.timezone);
  if (local.hour < campaign.windowStart || local.hour >= campaign.windowEnd) {
    return { ok: false, reason: 'OUT_OF_WINDOW' };
  }

  // 3. Max attempts
  if (lead.attemptCount >= campaign.maxAttempts) {
    await markExhausted(lead); return { ok: false, reason: 'EXHAUSTED' };
  }

  // 4. Retry cooldown
  if (lead.lastAttemptAt && minutesSince(lead.lastAttemptAt) < campaign.retryCooldownMin) {
    return { ok: false, reason: 'COOLDOWN' };
  }

  // 5. Per-campaign pacing cap (Progressive = idle agents; Predictive later = pace × idle)
  if (activeCalls(campaign) >= pacingCap(campaign)) return { ok: false, reason: 'PACING' };

  return { ok: true };
}
```

### DNC Lookup
- Table `autocall_dnc`: `{ id, clusterId, phoneE164, source, notes, createdAt }`
- Unique index `(clusterId, phoneE164)` — sub-ms lookup at 300 CCU.
- Normalize phone to E.164 on insert AND lookup (utility in `packages/shared`).
- Sources: `manual`, `do-not-call-request` (customer request during call), `regulatory` (external import), `bounce` (invalid number auto-added after N failures — optional).
- No national DNC registry in Vietnam — per-tenant only. Note this in UX.

### Time Window
- Per-campaign `timezone` (IANA string, default `Asia/Ho_Chi_Minh`), `windowStart` + `windowEnd` (0-23).
- Optional `excludeWeekends: boolean`, `excludeDates: Date[]` for holidays.
- Mid-call window close: **let in-flight calls finish**. Scheduler just stops issuing new originates.
- Surface "next window opens at HH:MM" in the live monitor UI.

## Scheduler

### Choice: BullMQ vs node-cron vs setInterval
Check monorepo:

- If BullMQ already present → reuse (Redis already deployed for permission cache).
- If not, `node-cron` is too coarse (min granularity = minute). `setInterval(checkQueue, 1000)` inside one service instance is simplest and matches existing `sip-presence-job.ts` pattern.

**Recommend `setInterval`-based worker co-located in autocall-engine service** at MVP. Single-process, stateful in-memory queue backed by DB on every tick. Pros: no new infra, deterministic. Cons: no horizontal scale — but 300 CCU single-process is fine (orchestration CPU cost is tiny; FS does the heavy lifting).

Plan hook: encapsulate as `CampaignWorker` class so it can be swapped to BullMQ worker later without API changes.

### Main Loop (pseudocode)
```
every 1 second:
  for each active campaign:
    if !withinTimeWindow(campaign): continue
    idleAgents = countIdleAgents(campaign)
    activeCalls = countActiveCalls(campaign)
    paceTarget = paceNext(campaign, idleAgents, activeCalls)   // hook point
    if paceTarget <= 0: continue
    leads = fetchNextLeads(campaign, paceTarget)               // ORDER BY priority, last_attempt_at
    for lead in leads:
      gate = canDial(lead, campaign, now)
      if !gate.ok: recordSkip(lead, gate.reason); continue
      originate(lead, campaign)
```

### Progressive `paceNext`
```ts
paceNext = (c, idle, active) => Math.max(0, idle - active);
```

### Predictive `paceNext` (future)
```ts
paceNext = (c, idle, active) => {
  const base = idle * c.paceMultiplier;
  const throttle = abandonedRate(c) > 0.03 ? 0.5 : 1.0;     // TCPA-style 3% abandoned ceiling
  return Math.floor(base * throttle) - active;
};
```

## Agent Session Tracking

Table `autocall_agent_sessions`:
```
{ id, agentId (userId), campaignId, clusterId,
  loginAt, logoutAt,
  totalReadyMs, totalOnCallMs, totalWrapMs, totalPauseMs,
  callsHandled, callsAnswered }
```
Updated incrementally on state transitions. Single row per agent-per-campaign-per-login-session. Supports productivity reports (occupancy %, calls/hour, avg handle time).

## KPI Schema (Bakeable Day 1)

Per-attempt `autocall_calls` row fields needed for reports even if not surfaced at MVP:
- `startedAt`, `answeredAt`, `endedAt`, `billsec`, `duration`
- `hangupCause` (SIP), `disposition` (agent-entered), `amdResult` (null at MVP)
- `agentId`, `campaignId`, `leadId`, `clusterId`
- `recordingPath`, `fsUuid`
- `wrapSeconds` (time between hangup and next-ready)

Derivable metrics: answer rate, abandoned rate, avg talk time, avg wrap, agent occupancy, contacts/hour, attempts per contact, list penetration.

## Unresolved
- Abandoned-call definition once Predictive lands: standard = customer answered but no agent bridged within 2s. Need explicit event tag on ESL originate failure paths. Can add `wasBridged: boolean` column now to future-proof.
- Callback scheduling UX: agent enters "call me back at 2pm tomorrow" — does this override `retryCooldownMin`? Recommend yes (explicit user intent > generic pacing rule).
- Holiday calendar source: per-tenant manual list vs country-wide auto-import. Manual-first MVP.

## Sources
- [Vonage: Preview vs Progressive vs Predictive](https://www.vonage.com/resources/articles/what-is-the-difference-between-preview-progressive-and-predictive-diallers/)
- [Voiso: Types of Outbound Dialers](https://voiso.com/articles/types-of-outbound-dialers-breakdown/)
- [NiCE: Outbound Dialer Optimization](https://www.nice.com/info/outbound-dialer-optimization)
- [Platform28: TCPA Compliant Predictive Dialer](https://www.platform28.com/predictive-dialer)
- [DNC.com: Predictive Dialer TCPA](https://www.dnc.com/index.php/blog/what-predictive-dialer-tcpa)
- [Emitrr: Predictive Dialer vs Auto Dialer](https://emitrr.com/blog/predictive-dialer-vs-auto-dialer/)
