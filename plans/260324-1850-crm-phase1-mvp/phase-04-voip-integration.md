---
phase: 04
title: "VoIP Integration"
status: completed
priority: P1
effort: 7d
depends_on: [02]
---

# Phase 04 — VoIP Integration (ESL + CDR Webhook)

## Context Links
- [PRD](../../Guildline/PRD.md) — Sections 4.2, 8.1-8.6
- [ESL Research](../../plans/reports/researcher-260324-1736-freeswitch-esl-webrtc-stack.md) — modesl recommended
- [FusionPBX Assessment](../../plans/reports/researcher-260324-1748-fusionpbx-crm-integration-assessment.md) — ESL port 8021, xml_cdr, recordings
- [Plan Overview](./plan.md)

## Overview
ESL daemon connects to FreeSWITCH via modesl, handles click-to-call originate, subscribes to call events, pushes real-time updates via Socket.IO. CDR webhook receives xml_cdr POST from FusionPBX. Recording proxy streams audio files with RBAC.

## Key Insights (from research)
- **modesl** is recommended ESL client — EventEmitter-based, connection pooling, active maintenance
- Single ESL connection sufficient for 20-50 agents; implement pooling for 50-100+
- ESL events to subscribe: CHANNEL_CREATE, CHANNEL_ANSWER, CHANNEL_BRIDGE, CHANNEL_HANGUP_COMPLETE, CHANNEL_HOLD
- Filter events by `domain_name` for multi-tenant safety
- Reconnect with exponential backoff: 1s → 2s → 4s → 30s max
- xml_cdr: prefer file-system + cron for high volume, but HTTP POST OK for <1000 calls/day
- Recordings served by Nginx on FusionPBX :8088 (CRM IP whitelisted)
- <!-- Updated: Validation Session 3 - External softphone confirmed for MVP, WebRTC deferred to Phase 2 -->
- Click-to-Call flow: CRM API → ESL bgapi originate → Agent's external softphone (FusionPBX web softphone or desktop SIP client) rings → Bridge to destination. CRM does NOT embed WebRTC — agents use separate SIP client.

## Requirements
**Functional:**
- ESL daemon connects to FreeSWITCH, auto-reconnects on disconnect
- Click-to-Call: POST /calls/originate → ESL bgapi originate → softphone rings → bridge
- Call events pushed to frontend via Socket.IO in real-time
- CDR webhook: POST /webhooks/cdr receives xml_cdr, parses, stores call_logs
- Recording proxy: GET /call-logs/:id/recording streams audio with RBAC
- Agent status management: manual set (ready/break/offline) + auto-set (ringing/on_call/wrap_up)

**Non-functional:**
- ESL event latency < 100ms to Socket.IO
- CDR webhook processes < 2s per record
- Recording streaming with range request support (seek in audio player)

## Architecture

```
┌──────────────┐     Socket.IO      ┌──────────────────┐
│   Frontend   │◄──────────────────►│   Backend        │
│   (React)    │                    │   (Express)      │
└──────────────┘                    │                  │
                                    │  ┌────────────┐  │
     POST /calls/originate ────────►│  │ Call       │  │
                                    │  │ Controller │  │
                                    │  └─────┬──────┘  │
                                    │        │         │
                                    │  ┌─────▼──────┐  │
                                    │  │ ESL        │  │
     POST /webhooks/cdr ──────────►│  │ Daemon     │  │
                                    │  │ (modesl)   │  │
                                    │  └─────┬──────┘  │
                                    └────────┼─────────┘
                                             │ ESL :8021
                                    ┌────────▼─────────┐
                                    │ FusionPBX        │
                                    │ FreeSWITCH 1.10  │
                                    │ Recordings :8088 │
                                    └──────────────────┘
```

## Related Code Files
**Create:**
- `packages/backend/src/lib/esl-daemon.ts` — ESL connection manager
- `packages/backend/src/lib/socket-io.ts` — Socket.IO setup + auth
- `packages/backend/src/routes/call-routes.ts`
- `packages/backend/src/routes/webhook-routes.ts`
- `packages/backend/src/routes/agent-status-routes.ts`
- `packages/backend/src/controllers/call-controller.ts`
- `packages/backend/src/controllers/webhook-controller.ts`
- `packages/backend/src/controllers/agent-status-controller.ts`
- `packages/backend/src/services/call-service.ts`
- `packages/backend/src/services/esl-service.ts`
- `packages/backend/src/services/webhook-service.ts`
- `packages/backend/src/services/agent-status-service.ts`
- `packages/backend/src/services/recording-service.ts`
- `packages/shared/src/types/call-types.ts`
- `packages/shared/src/types/socket-events.ts`

## Implementation Steps

### 1. ESL Daemon (`lib/esl-daemon.ts`)
1. Initialize modesl connection to FreeSWITCH ESL (host, port, password from env)
2. Implement connection lifecycle:
   - Connect on app start
   - Heartbeat monitoring
   - Auto-reconnect with exponential backoff (1s → 2s → 4s → 30s max)
   - Graceful shutdown: send `exit` before closing
3. Subscribe to events: `CHANNEL_CREATE`, `CHANNEL_ANSWER`, `CHANNEL_BRIDGE`, `CHANNEL_HANGUP_COMPLETE`, `CHANNEL_HOLD`
4. Filter by domain_name: `event.getHeader('variable_domain_name')`
5. Emit events to internal EventEmitter for service layer consumption
6. Track active calls in Redis: `call:{uuid}` → {agentId, contactPhone, direction, state, startTime}

### 2. Socket.IO setup (`lib/socket-io.ts`)
1. Attach Socket.IO to Express HTTP server
2. Auth middleware: verify JWT on connection (token in handshake auth)
3. Join user to room: `user:{userId}` and `team:{teamId}`
4. Define event channels:
   - `call:ringing` — to specific agent
   - `call:answered` — to specific agent
   - `call:ended` — to specific agent
   - `call:status_change` — to managers (all active calls)
   - `agent:status_change` — broadcast agent status to team/managers
   - `notification:new` — to specific user

### 3. ESL Service (`services/esl-service.ts`)
1. **[RED TEAM #2 — CRITICAL]** Create `sanitizeEslInput(value: string)` utility:
   - Strict regex whitelist: phone numbers = `/^\+?[0-9]{1,15}$/`, extensions = `/^[0-9]{3,6}$/`
   - Reject ANY input containing: `\n`, `\r`, `{`, `}`, `&`, `'`, `"`, `;`, `|`
   - Use this for ALL user-supplied values before ESL command interpolation
2. `originate(agentExtension, destinationNumber, callerId)` — sanitize ALL inputs, then build originate string
   - Format: `bgapi originate {origination_caller_id_number=XXX}sofia/internal/${agentExt}@${domain} &bridge(sofia/gateway/${gateway}/${dest})`
   - Returns call UUID
3. `hangup(callUuid)` — sanitize UUID, `bgapi uuid_kill ${uuid}`
4. `hold(callUuid)` — sanitize UUID, `bgapi uuid_hold ${uuid}`
5. `transfer(callUuid, targetExtension)` — sanitize both, `bgapi uuid_transfer ${uuid} ${target}`

### 4. Call event handler
1. On CHANNEL_CREATE: match agent by caller_id/callee, update Redis, emit `call:ringing` via Socket.IO
2. On CHANNEL_ANSWER: emit `call:answered`, auto-set agent status → `on_call`
3. On CHANNEL_BRIDGE: log bridge event
4. On CHANNEL_HANGUP_COMPLETE: emit `call:ended`, auto-set agent status → `wrap_up` (10s timer), clean Redis
5. On CHANNEL_HOLD: emit `call:hold`, update agent status → `hold`

### 5. Click-to-Call endpoint
1. `POST /calls/originate` — body: `{ contactId, phoneNumber }`
2. Validations: user authenticated, agent status = `ready`, phone valid, rate limit (10/min)
3. Create call_logs record (direction: outbound, status: initiating)
4. Call ESL originate
5. Return call UUID to frontend
6. Update call_logs on events (answer_time, end_time, duration, hangup_cause)

### 6. CDR Webhook
1. `POST /webhooks/cdr` — receives xml_cdr from FusionPBX
2. **[RED TEAM #6]** Security: IP whitelist using `req.ip` (NOT `req.headers['x-forwarded-for']`). Configure `app.set('trust proxy', 1)` (trust only Nginx hop). + Basic Auth header check.
3. **[RED TEAM #10]** Parse XML body using `fast-xml-parser` with XXE prevention: `processEntities: false`, `allowBooleanAttributes: false`, `htmlEntities: false`. Validate parsed structure matches expected CDR schema before processing.
4. Extract: call_uuid, caller_number, destination_number, start/answer/end timestamps, duration, billsec, hangup_cause, recording_path
5. Upsert call_logs by call_uuid (may already exist from ESL event)
6. <!-- Updated: Validation Session 3 - normalizePhone for CDR matching -->
   Match contact by phone number using `normalizePhone()` from Phase 03's `phone-utils.ts`. Normalize both CDR number and DB numbers at query time (phones stored as-entered).
7. Store raw payload in webhook_logs
8. Handle errors: store in webhook_logs with status=failed

### 7. Recording proxy
1. `GET /call-logs/:id/recording` — RBAC checked + data scope applied [RED TEAM #8]
2. Fetch recording_path from call_logs record
3. **[RED TEAM #9]** Validate recording_path: strict regex `/^[a-zA-Z0-9_\-\/]+\.(wav|mp3)$/`, reject `..` sequences. Use `path.resolve()` and verify result stays within recordings base directory. Only allow .wav and .mp3 extensions.
4. Proxy request to `http://FUSIONPBX_IP:8088/recordings/{domain}/{sanitized_file}`
5. Support Range headers for audio seeking
6. Set Content-Type: audio/wav or audio/mpeg
7. Log audit: play_recording action

### 8. Agent status management
1. `PUT /agents/status` — manual: ready, break (with reason), offline
2. `GET /agents/status` — current agent's status
3. `GET /agents/statuses` — all agents (manager+)
4. Auto-transitions via ESL events: ringing, on_call, hold, wrap_up
5. Log all transitions in agent_status_logs (started_at, ended_at, duration)
6. Cache current status in Redis: `agent_status:{userId}` → {status, since}
7. Broadcast status changes via Socket.IO to team/managers

## Todo List
- [x] ESL daemon with modesl — connect, subscribe, reconnect
- [x] Socket.IO setup with JWT auth
- [x] ESL service — originate, hangup, hold, transfer
- [x] Call event handler — map ESL events to Socket.IO + DB
- [x] Click-to-Call endpoint with validation + rate limit
- [x] CDR webhook — XML parse, upsert call_logs, match contact
- [x] Recording proxy with Range support + RBAC
- [x] Agent status: manual set + auto-transitions + logging
- [x] Redis state: active calls + agent statuses
- [x] Socket.IO event definitions + room management

## Success Criteria
- ESL daemon connects, receives events, auto-reconnects
- Click-to-Call: agent's softphone rings, call bridges to destination
- Frontend receives real-time call state updates via Socket.IO
- CDR webhook receives POST, call_logs populated correctly
- Recording streams with seek support
- Agent status auto-transitions on call events

## Risk Assessment
- ESL disconnect during active calls: Redis state persists, CDR webhook fills gaps
- xml_cdr malformed XML: robust parsing with try/catch, store raw in webhook_logs for retry
- Recording file not found: return 404, set recording_status=failed, alert
- FusionPBX IP changes: env var, no hardcoding

## Security Considerations
- ESL password in env, never logged
- **[RED TEAM #2]** ESL command injection prevention: all user inputs sanitized via strict regex whitelist before interpolation into ESL commands
- **[RED TEAM #6]** Webhook: IP whitelist via `req.ip` with `trust proxy=1` + Basic Auth — double security. Never trust X-Forwarded-For directly.
- **[RED TEAM #10]** XXE prevention: fast-xml-parser configured with `processEntities: false`
- **[RED TEAM #9]** Recording proxy: path traversal prevention via strict regex + path.resolve validation
- Recording proxy: never expose FusionPBX URL to frontend
- Socket.IO: JWT auth on every connection. Periodically re-verify token (every 5min) on long-lived connections to catch deactivated users.
- Rate limit Click-to-Call: 10/min per user (prevent FreeSWITCH flood)
