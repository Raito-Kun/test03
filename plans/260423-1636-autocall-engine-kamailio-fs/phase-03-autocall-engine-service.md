---
phase: 03
title: "Autocall-engine PM2 app + ESL clients + Kamailio subscriber sync"
size: L
status: pending
---

# Phase 03 — Autocall-engine PM2 App + Subscriber Sync

## Context
- Research: [researcher-02](research/researcher-02-freeswitch-progressive-cdr.md)
- Rules: `.claude/skills/crm-backend-feature/SKILL.md`
- Existing PM2 config: `ecosystem.config.js` — `crm-backend` is **singleton fork** (FusionPBX ESL daemon + Socket.IO sticky sessions)

## Overview
- Priority: P2
- Status: pending
- **DECISION LOCKED (#6): autocall-engine = separate PM2 app `crm-autocall-engine`.** Stuffing a 300-CCU ESL daemon into the existing singleton backend risks regressing click2call/inbound. Split binary, IPC via Redis pub/sub (same Redis already used for RBAC cache).
- REST endpoints (campaigns, leads, dispositions, DNC, agent ops) stay in `crm-backend` — engine handles only runtime (ESL, scheduler, state machine, originates).
- New: **Kamailio subscriber sync service** (in `crm-backend`, not engine) that auto-INSERT/UPDATE/DELETE `kamailio.subscriber` rows when agents are assigned/revoked `autocall.agent.work` permission (decision #1).

## Key Insights
- `crm-backend` stays singleton fork — do not touch exec_mode. Add a 2nd app entry with own `instances: 1`, own memory limit, own log files.
- `crm-autocall-engine` shares Prisma client source via workspace import (`@crm/db` or equivalent). Same DB connection pool pattern.
- Kamailio subscriber table has known schema: `(id, username, domain, password, ha1, ha1b, email_address, rpid)`. `ha1 = MD5(username:domain:password)`. Use `KAMAILIO_DB_URL` (separate Postgres connection, read+write).
- Deployment still single command: `pm2 start ecosystem.config.js`. Reload specific app: `pm2 reload crm-autocall-engine` (does NOT restart `crm-backend`).

## Requirements
**Functional — `crm-backend` (REST)**
- CRUD: campaigns, leads (incl CSV upload), dispositions, DNC.
- Agent ops endpoints: start/end session, set ready/pause/wrap, fetch current lead, submit disposition, schedule callback, request DNC.
- Admin: list agent SIP credentials (username + plaintext password visible ONCE on creation + regenerate button).
- Health: `GET /api/v1/autocall/health` proxies to engine via Redis request/reply.

**Functional — `crm-autocall-engine` (runtime)**
- Maintain ESL connections to each FS node (`AutocallEslPool`).
- Subscribe Redis channels `autocall:agent:status`, `autocall:campaign:control`, `autocall:dnc:invalidate`.
- Publish Redis channel `autocall:call:event` on ESL call lifecycle events.
- Run scheduler (phase-05 adds the actual scheduler code into this process).
- Health endpoint on `localhost:4100` (loopback only) — backend health proxies to it.

**Functional — Kamailio subscriber sync (in `crm-backend`)**
- Hook: after `UserRole` or `UserPermission` change → if user gains/loses `autocall.agent.work` → sync.
- On grant: INSERT/UPDATE `kamailio.subscriber(username=agent_sip_username, domain=<cluster.sip_domain>, password=<generated or user-provided>, ha1=MD5(u:d:p))`.
- On revoke / user deactivate: DELETE row.
- On password rotate (admin clicks "Regenerate"): UPDATE password + ha1.
- Username convention: `agent_<user.id_short>` OR user-chosen extension (unique per cluster domain).
- Cluster domain from `PbxCluster.sip_domain` (already exists in schema).

**Non-functional**
- All REST routes gated by `FEATURE_AUTOCALL_ENABLED` + permission middleware.
- CSV upload streamed (not buffered) — 100k row lead lists plausible.
- Phone normalization to E.164 on every write path.
- Redis pub/sub message loss tolerance: engine must tolerate missed `autocall:agent:status` via reconcile loop (phase-05).

## Architecture

### PM2 config (ecosystem.config.js — modify)
```js
module.exports = {
  apps: [
    { name: 'crm-backend', /* existing singleton fork — unchanged */ },
    {
      name: 'crm-autocall-engine',
      script: 'packages/autocall-engine/dist/index.js',
      exec_mode: 'fork',
      instances: 1,            // future: N instances need Redis-coordinated lead locking (phase-05 SKIP LOCKED ready)
      autorestart: true,
      max_memory_restart: '1G',
      env_production: { NODE_ENV: 'production', ENGINE_PORT: 4100 },
      error_file: 'logs/autocall-error.log',
      out_file: 'logs/autocall-out.log',
    },
  ],
};
```

### Directory layout
```
packages/backend/src/
├── controllers/autocall-*-controller.ts         (5 files: campaign, lead, disposition, dnc, agent)
├── services/autocall-*-service.ts               (6: campaign, lead, lead-import, disposition, dnc, agent-session)
├── services/kamailio-subscriber-sync-service.ts (NEW — subscriber sync)
├── lib/autocall-phone.ts                        (E.164 normalize)
├── lib/autocall-redis-bus.ts                    (pub/sub helper, channel name constants)
└── routes/autocall-*-routes.ts                  (5 files)

packages/autocall-engine/                        (NEW package)
├── package.json                                 (depends on @crm/db, @crm/shared, ioredis, modesl)
├── tsconfig.json
├── src/
│   ├── index.ts                                 (entry: connect DB + Redis + ESL pool, start scheduler)
│   ├── esl-pool.ts                              (one Connection per FS node, auto-reconnect)
│   ├── redis-bus.ts                             (subscribe + publish helpers — mirrors backend lib)
│   ├── scheduler.ts                             (phase-05 code lives here)
│   ├── agent-state.ts                           (phase-05)
│   ├── event-handler.ts                         (phase-05 — ESL→Redis publish)
│   ├── originate.ts                             (phase-05)
│   ├── pacing.ts                                (phase-05)
│   └── health.ts                                (loopback :4100)
└── tests/
```
Each file ≤200 lines.

## Redis channel constants (shared via `@crm/shared`)
```ts
export const AUTOCALL_CHANNELS = {
  AGENT_STATUS: 'autocall:agent:status',      // backend → engine
  CALL_EVENT: 'autocall:call:event',          // engine → backend (Socket.IO relay)
  CAMPAIGN_CONTROL: 'autocall:campaign:control', // backend → engine
  DNC_INVALIDATE: 'autocall:dnc:invalidate',  // backend → engine
} as const;
```

## API Contract (unchanged from prior draft — hosted by `crm-backend`)

| Method | Path | Perm |
|---|---|---|
| GET/POST | `/api/v1/autocall/campaigns` | `autocall.campaigns.read/write` |
| GET/PATCH/DELETE | `/api/v1/autocall/campaigns/:id` | per verb |
| POST | `/api/v1/autocall/campaigns/:id/leads/import` (multipart) | `autocall.leads.upload` |
| GET | `/api/v1/autocall/campaigns/:id/leads` | `autocall.campaigns.read` |
| GET/POST/DELETE | `/api/v1/autocall/campaigns/:id/dispositions` | `autocall.disposition.configure` |
| GET/POST/DELETE | `/api/v1/autocall/dnc` | `autocall.dnc.manage` |
| POST | `/api/v1/autocall/agent/session/{start,end}` | `autocall.agent.work` |
| POST | `/api/v1/autocall/agent/{ready,pause,wrap-done,dispose,callback,request-dnc}` | `autocall.agent.work` |
| GET | `/api/v1/autocall/agent/current-call` | `autocall.agent.work` |
| GET | `/api/v1/autocall/monitor/live` | `autocall.monitor` |
| GET | `/api/v1/autocall/health` | `autocall.monitor` |
| GET | `/api/v1/autocall/admin/agent-sip-creds` | `autocall.campaigns.write` (admin-level only) |
| POST | `/api/v1/autocall/admin/agent-sip-creds/:userId/regenerate` | same |

## Implementation Steps
1. Scaffold `packages/autocall-engine` with package.json + tsconfig; wire workspace imports to `@crm/db`, `@crm/shared`.
2. `packages/backend/src/lib/autocall-redis-bus.ts` + engine mirror — thin ioredis wrappers. Confirm `REDIS_URL` already used (grep existing RBAC cache code); reuse same connection pattern.
3. Update `ecosystem.config.js` — add `crm-autocall-engine` entry.
4. Zod DTOs for every endpoint body + query.
5. `autocall-phone.ts` — E.164 normalize (VN prefix `+84` default, configurable per cluster).
6. `kamailio-subscriber-sync-service.ts`:
   - Exports `syncAgentSipCreds(userId)`, `revokeAgentSipCreds(userId)`, `regeneratePassword(userId)`.
   - Hooked from role/permission mutation endpoints + user deactivate flow.
   - Uses separate `KAMAILIO_DB_URL` Prisma client (generated from a secondary schema or raw `pg` — prefer raw pg for a 4-column table).
   - Generates random 16-char password; stores plaintext ONLY in response to admin create/regenerate API call (never persisted plaintext in CRM DB; stored as `ha1` only, same as Kamailio).
7. `autocall-campaign-service.ts` — CRUD with cluster-scope. Include `timezone`, `window_start`, `window_end` validation (no holiday fields).
8. `autocall-lead-service.ts` + `autocall-lead-import-service.ts` — CSV parse stream via `csv-parse`, batch insert 500 rows, skip invalid phones, report `{imported, skipped, duplicates}`.
9. `autocall-disposition-service.ts` — CRUD within campaign scope.
10. `autocall-dnc-service.ts` — CRUD + bulk import; unique violation → idempotent success; on mutation publish `autocall:dnc:invalidate`.
11. `autocall-agent-session-service.ts` — session lifecycle + cumulative ms counters; publishes `autocall:agent:status` on ready/pause/wrap transitions.
12. **Engine** `packages/autocall-engine/src/esl-pool.ts` — N ESL connections keyed by fsNodeId; auto-reconnect with debounce 5s + exponential backoff.
13. **Engine** `packages/autocall-engine/src/index.ts` — boot order: connect Prisma → connect Redis (sub + pub) → connect ESL pool → bind health port 4100 → log ready.
14. Mount routes in backend `index.ts`, apply middleware chain: `auth → checkFeatureEnabled('autocall') → applyDataScope → requirePermission → handler`.
15. Audit log on all mutations.
16. `/api/v1/autocall/health` in backend → HTTP GET to `http://localhost:4100/health` (engine on same host for MVP; externalize later).
17. Admin UI endpoint for SIP creds (phase-07 surfaces UI).

## Todo List
- [ ] Scaffold `packages/autocall-engine` package
- [ ] Redis bus lib (backend + engine mirrors)
- [ ] `ecosystem.config.js` add second app
- [ ] Zod DTOs
- [ ] Phone normalize util
- [ ] Kamailio subscriber sync service + secondary DB client
- [ ] Hook sync into role/perm mutations + user deactivate
- [ ] Campaign/lead/disposition/DNC CRUD (backend)
- [ ] Agent session service (publishes agent status events)
- [ ] ESL pool (engine)
- [ ] Engine entry point + health :4100
- [ ] Backend health proxy
- [ ] Route mounts + middleware chain
- [ ] Audit logs
- [ ] Admin SIP creds endpoints
- [ ] Compile check both packages

## Success Criteria
- `pm2 start ecosystem.config.js` boots both apps; `pm2 list` shows 2 online.
- `pm2 reload crm-autocall-engine` restarts engine only; `crm-backend` PID unchanged.
- `curl POST /api/v1/autocall/campaigns` creates row with cluster scope; unauthorized roles get 403.
- Assign `autocall.agent.work` to user X → row appears in `kamailio.subscriber` with matching domain + valid ha1.
- Revoke perm → subscriber row deleted.
- Admin regenerate → password+ha1 rotated, response shows plaintext once.
- CSV of 10k phones imports <30s.
- `GET /api/v1/autocall/health` returns `{ engine: ok, fsNodes: [...] }` via Redis proxy.
- Compile: `npm run build` clean in both packages.
- Redis pub/sub manual test: publish `autocall:agent:status` payload → engine logs receipt.

## Risk Assessment
| Risk | Mitigation |
|---|---|
| Second PM2 app competes with backend for CPU at 300 CCU | `max_memory_restart: 1G`, separate log files, monitor. Engine is I/O-bound (ESL events + Redis) so CPU should stay low. |
| Redis becomes SPOF for IPC | Both backend and engine already depend on Redis (RBAC cache); adding 4 channels is additive. If Redis down, backend already degraded. |
| Kamailio subscriber sync race (user revoked + re-granted rapidly) | Serialize per-userId via in-memory mutex; last-write-wins on ha1 field. |
| Subscriber table diverges from CRM (manual `kamctl add`) | Nightly reconcile job compares `kamailio.subscriber` vs CRM users with `autocall.agent.work`; alert on drift. |
| ESL reconnect storm on FS restart | Debounce 5s + exponential backoff, cap 60s. |

## Security
- Plaintext SIP password NEVER persisted in CRM DB; only `ha1` (same as Kamailio). Plaintext returned once on create/regenerate and shown in UI for agent to copy into MicroSIP.
- Phone numbers logged at INFO not in error stack traces (PII).
- CSV upload size cap 10 MB; reject `content-type` mismatch.
- DNC routes super_admin+admin+manager only.
- Engine health port 4100 bound to `127.0.0.1` only; no external exposure.
- Redis channel payloads contain IDs, not raw PII (phone numbers resolved via DB lookup in each process).

## Next Steps
Unblocks phase 04 (compliance uses service layer), 05 (scheduler lives in engine package), 07 (FE consumes APIs + admin SIP creds UI), 10 (deploy commands reference two PM2 apps).
