---
title: "Autocall Engine (Kamailio + FreeSWITCH) — MVP Progressive Dialer"
description: "New outbound dialer cluster on dedicated Kamailio+FS stack, 100-300 CCU, progressive pacing, compliance-gated."
status: pending
priority: P2
effort: XL (10 phases, mix of S/M/L)
branch: feat/autocall-engine-kamailio-fs (to create from master when infra phase begins)
tags: [autocall, kamailio, freeswitch, outbound-dialer, compliance, progressive, new-cluster]
created: 2026-04-23
---

# Autocall Engine — Kamailio + FreeSWITCH MVP

## Goal
Dedicated outbound dialer cluster (NOT FusionPBX) with 100-300 CCU, progressive pacing, per-tenant compliance (DNC/time-window/max-attempts), reusing CRM auth/RBAC/recording infra. Predictive mode + AMD slot-in later without rewrite.

## Architecture (one-liner)
MicroSIP agents → Kamailio (registrar+dispatcher) → 2x FreeSWITCH (active-active, ESL-driven) → single carrier SIP trunk. Autocall-engine runs as a **separate PM2 app** in the same monorepo, talks to `crm-backend` via Redis pub/sub, enforces compliance, writes `autocall_*` tables, and CDR webhooks route by `PbxCluster.type`.

## Decisions Locked (2026-04-23)

| # | Decision | One-liner rationale |
|---|---|---|
| 1 | **SIP provisioning: CRM auto-syncs to `kamailio.subscriber`** | Admin assigns `autocall.agent.work` perm → backend INSERT/UPDATE ha1 row; creds shown in CRM UI for MicroSIP paste. Deactivation deletes row. |
| 2 | **Recording format: stereo** (agent=L, customer=R) | Set `RECORD_STEREO=true` in FS recording config; `-stereo.{wav,mp3}` filename suffix. QA can mute one side for noise isolation. |
| 3 | **Holiday calendar: skipped** | Time window is per-campaign daily local-time range only (e.g. 08:00–20:00 `Asia/Ho_Chi_Minh`). No holiday table, no per-date override. Simpler schema. |
| 4 | **Callback bypasses cooldown** | Agent-scheduled callback sets `autocall_leads.next_eligible_at` directly, ignores `campaign.retry_cooldown_min`. Honor the explicit commitment. |
| 5 | **Shared subnet `10.10.101.x`** | No new subnet. Kamailio = `10.10.101.210`, FS-1 = `.211`, FS-2 = `.212` (subject to allocation check). Carrier must whitelist the two FS IPs. |
| 6 | **ESL daemon = separate PM2 app `crm-autocall-engine`** | `crm-backend` is singleton fork (FusionPBX ESL + Socket.IO sticky). Stuffing a 300-CCU ESL daemon there risks click2call regression. Split binary + Redis pub/sub IPC. |

## Redis pub/sub channels (between `crm-backend` ↔ `crm-autocall-engine`)

| Channel | Direction | Payload | Purpose |
|---|---|---|---|
| `autocall:agent:status` | backend → engine | `{ agentId, campaignId, state: ready\|pause\|on_call\|wrap, ts }` | Agent toggles ready/pause in UI → backend publishes; engine updates in-memory state machine. |
| `autocall:call:event` | engine → backend | `{ callId, fsUuid, event: ringing\|answered\|bridged\|ended, agentId, leadId, ts }` | Engine emits lifecycle events from ESL; backend relays via Socket.IO to frontend. |
| `autocall:campaign:control` | backend → engine | `{ campaignId, action: start\|pause\|stop }` | Supervisor start/pause campaign from UI. |
| `autocall:dnc:invalidate` | backend → engine | `{ clusterId, phoneE164 }` | Force engine to drop any cached DNC miss for phone. |

Naming convention follows existing `rbac:*` prefix pattern already used for RBAC cache invalidation. Confirm exact Redis client helper before implementation (phase 03).

## Research
- [Kamailio architecture](research/researcher-01-kamailio-architecture.md)
- [FreeSWITCH progressive + recording + CDR](research/researcher-02-freeswitch-progressive-cdr.md)
- [Compliance engine + scheduler](research/researcher-03-compliance-scheduler.md)

## Phases

| # | Phase | Size | Status | Depends on |
|---|---|---|---|---|
| 01 | [Infra: Kamailio + FreeSWITCH setup](phase-01-infra-kamailio-freeswitch-setup.md) | L | pending | — |
| 02 | [Database schema (6 `autocall_*` tables + `PbxCluster.type`)](phase-02-database-schema.md) | M | pending | — |
| 03 | [Autocall-engine PM2 app scaffold + ESL clients + Kamailio subscriber sync](phase-03-autocall-engine-service.md) | L | pending | 02 |
| 04 | [Compliance engine (DNC + time window + max attempts)](phase-04-compliance-engine.md) | M | pending | 02, 03 |
| 05 | [Campaign scheduler + progressive dialer](phase-05-campaign-scheduler-progressive-dialer.md) | L | pending | 01, 03, 04 |
| 06 | [CDR webhook routing by cluster type](phase-06-cdr-webhook-routing.md) | S | pending | 02 |
| 07 | [Frontend: campaign management + agent SIP creds UI + lead upload](phase-07-frontend-campaign-management.md) | M | pending | 03 |
| 08 | [Frontend: agent workstation + disposition](phase-08-frontend-agent-workstation.md) | M | pending | 05, 07 |
| 09 | [Frontend: live monitor + reports](phase-09-frontend-live-monitor-reports.md) | M | pending | 05, 06 |
| 10 | [Testing + deployment + load test](phase-10-testing-deployment.md) | L | pending | all |

## Cross-cutting constraints
- **Feature flag:** `FEATURE_AUTOCALL_ENABLED` cluster-scoped (follow `crm-feature-flag` skill). Default OFF.
- **RBAC keys:** `autocall.campaigns.{read,write,delete}`, `autocall.leads.upload`, `autocall.agent.work`, `autocall.monitor`, `autocall.dnc.manage`, `autocall.disposition.configure` (follow `crm-permission` skill).
- **Multi-tenancy:** every `autocall_*` table has `cluster_id` FK + dataScope filtering.
- **Recording UX parity:** autocall recordings downloadable via existing recording-service contract.
- **Zero regression risk on FusionPBX:** autocall is additive — new cluster type `kamailio-fs`; existing paths keep `type=fusionpbx` default.

## Key risks (top 3)
1. **CDR webhook routing bug** — mis-routes autocall CDRs to `call_logs` (or vice versa) on day one. Mitigation: `PbxCluster.type` branch + integration test with fixture XML of both shapes.
2. **Agent-idle state drift** — lost ESL events leave agents stuck in `on_call`. Mitigation: 30s reconcile loop vs `show channels`.
3. **Carrier CPS breach** — uncapped originate at 300 CCU ramp can trip trunk limits. Mitigation: `pipelimit` in Kamailio + `pacingCap` in scheduler; load test before prod.

## Deployment posture
- Dev first on a 3-VM sandbox (1 Kamailio + 2 FS) connected to CRM dev (`10.10.101.207`).
- Production rollout gated behind explicit user approval (per `feedback_prod_deployment_rule`).
- No mixing with existing FusionPBX hosts (`10.10.101.206/208`).
