---
title: "FreeSWITCH Progressive Dialing, Recording, CDR for Autocall"
topic: freeswitch-progressive-dialer
audience: planner
created: 2026-04-23
---

# Researcher 02 — FreeSWITCH Progressive + Recording + CDR

## Scope
Per-node FS config, ESL originate pattern, recording + CDR handoff to CRM. 2x FS nodes, 150 CCU each.

## ESL Client Choice

| Library | Status | Verdict |
|---|---|---|
| `modesl` (SignalWire upstream) | official C binding, Node.js port | stale wrapper, works |
| `esl` (shimaore) | active, ~7 years, used in telco | **recommended** — promise-based, clean API |
| `esl-lite` | minimal, newer | viable but smaller community |
| `node-esl` (englercj) | popular but last updated 2022 | ok, falling behind |

Go with `shimaore/esl` — matches project's async/await style.

Reuse existing `packages/backend/src/lib/esl-daemon.ts` pattern but spawn a **new daemon per FS node** (FS-01, FS-02) inside the autocall-engine service. Do NOT share with the existing FusionPBX ESL daemon — different cluster, different credentials, different event streams.

## Originate Pattern (Progressive — 1 call per idle agent)

```js
// agent idle event arrives → pick next lead → originate
const dialString = [
  `{origination_uuid=${callUuid}`,
  `origination_caller_id_number=${campaign.callerId}`,
  `origination_caller_id_name=${campaign.campaignName}`,
  `campaign_id=${campaign.id}`,          // custom var → lands in CDR
  `lead_id=${lead.id}`,                  // custom var → lands in CDR
  `autocall_cluster=${cluster.id}`,      // webhook routing discriminator
  `execute_on_answer='record_session \${recordings_dir}/\${uuid}.mp3'`,
  `hangup_after_bridge=true`,
  `ignore_early_media=true`,
  `originate_timeout=30}`,
  `sofia/gateway/${campaign.trunkGateway}/${lead.phone}`,
  `&bridge(user/${agent.extension}@${sipDomain})`,    // bridge to agent on answer
].join('');

await conn.bgapi(`originate ${dialString}`);
```

**Critical:** B-leg is customer, A-leg bridges to agent AFTER customer answers. `ignore_early_media=true` prevents false connect on ringback. `originate_timeout=30` caps no-answer wait.

Alternative pattern: originate to agent first, then bridge to customer — but that wastes agent time on ring-and-hope. Progressive = customer-first is correct.

## Agent-Idle Detection

Three options evaluated:

| Option | Pro | Con |
|---|---|---|
| A. Poll Kamailio `location` table | no FS dependency | just registration, not call state |
| B. ESL `show channels` every 1s | always fresh | polling pressure, race |
| C. **App state machine** (agent clicks Ready/Busy, ChannelHangup events flip state) | **deterministic, matches CRM agent-status pattern** | needs reliable event pipeline |

**Pick C.** Reuse existing `agent_status` table semantics. Autocall-engine subscribes to FS `CHANNEL_HANGUP` events → flips agent from `on_call` → `wrap_up` → `ready` (after N seconds configurable per campaign). Ready-event triggers `findNextLead()`.

Belt-and-braces: every 30s reconcile app state vs `show channels` on both FS nodes. Fixes any lost events.

## Recording

- Mono, mp3, 16 kHz — matches existing FusionPBX recording convention for UI playback.
- Path: `/var/lib/freeswitch/recordings/autocall/<campaign_id>/<YYYY>/<MM>/<DD>/<uuid>.mp3`
- Owner: **`www-data:www-data`** (FS runs as `www-data`). If rsync/backfill changes owner to `root`, recording silently fails — known 2026-04-20 incident (`.claude/rules/pbx-incident-patterns.md`). Document in runbook.
- Cleanup: cron deletes >90 days (configurable per campaign via `retention_days`).
- Serving: reuse existing `packages/backend/src/services/recording-service.ts` — add new cluster type branch that constructs URL from `PbxCluster.recordingUrlPrefix`.

## CDR Webhook

- `mod_xml_cdr` posts to CRM `/api/v1/webhooks/cdr` on each hangup.
- Config: `/etc/freeswitch/autoload_configs/xml_cdr.conf.xml`, `url=http://<crm-host>/api/v1/webhooks/cdr`, `log-http-and-disk=true` (MANDATORY — else FusionPBX/autocall UI would be stale; 2026-04-20 incident).
- Both FS nodes post independently. Existing webhook handler already dedupes by UUID.
- **Routing change required:** CRM webhook today infers cluster from source IP (`pbx_ip`). Keep that logic, then BRANCH on `PbxCluster.type`:
  - `type=fusionpbx` → write to `call_logs` (existing path)
  - `type=kamailio-fs` → write to `autocall_calls` + update `autocall_leads.last_attempt_at/status`
- Custom channel vars (`campaign_id`, `lead_id`, `autocall_cluster`) travel in CDR XML under `variables/`. Parse them to populate autocall-specific fields.

## Progressive → Predictive Forward Compatibility

Design `CampaignScheduler` to expose a `paceNext(campaign)` hook. Progressive impl: `if (idleAgents > 0) dial(1)`. Predictive impl later: `dial(idleAgents × paceMultiplier)` with AMD + abandoned-rate throttling.

AMD hook: `mod_avmd` detects answering machines. On B-leg answer, FS fires `avmd::beep` event → if machine → drop (log disposition `AMD_MACHINE`); if human → proceed to bridge. Out of MVP scope but wire up event listeners with no-op handlers now so later enablement is config-only.

## Capacity Per FS Node

- 150 CCU with mono mp3 recording: CPU ~30%, disk IOPS ~50/s writes.
- 2x nodes active-active = 300 CCU ceiling.
- Kamailio dispatcher health-pings FS via OPTIONS; if one dies, 100% → other node until recovery.
- **Do NOT overload a single node** — monitor `fs_cli -x 'show channels count'` and alert when >180/node.

## File Layout (FS node)
```
/etc/freeswitch/
├── autoload_configs/
│   ├── xml_cdr.conf.xml          # url → CRM; log-http-and-disk=true
│   ├── event_socket.conf.xml     # ESL on 8021, password per cluster
│   └── acl.conf.xml              # only allow Kamailio IPs on internal profile
├── sip_profiles/
│   ├── internal.xml              # bound to Kamailio-facing IP, no auth (trusted peer)
│   └── external.xml              # carrier trunk definition with digest auth
├── dialplan/
│   └── autocall.xml              # minimal: only park/bridge, all logic from ESL
└── vars.xml                      # recordings_dir=/var/lib/freeswitch/recordings/autocall
```

## Unresolved
- Stereo recording (agent L, customer R) vs mono — user preference? Current CRM recordings are mono; keep mono unless QA demands split.
- MP3 quality: 32 kbps vs 64 kbps? 32 kbps = ~240 MB per 1000 hours, good enough for speech.

## Sources
- [FreeSWITCH Event Socket Library docs](https://developer.signalwire.com/freeswitch/FreeSWITCH-Explained/Client-and-Developer-Interfaces/Event-Socket-Library/)
- [FreeSWITCH ESL Example Clients](https://developer.signalwire.com/freeswitch/FreeSWITCH-Explained/Introduction/Event-System/ESL-Example-Clients_27591923/)
- [shimaore/esl Node.js client](https://github.com/shimaore/esl)
- [Ecosmob: FreeSWITCH Dialers scalability](https://www.ecosmob.com/blog/freeswitch-dialers-outbound-scalability-voip-providers/)
- [Medium: Real-Time FreeSWITCH Event Handling with Node.js](https://medium.com/@jogikrunal9477/real-time-freeswitch-event-handling-esl-with-node-js-no-python-needed-5934bbe4a75e)
- Internal: `.claude/rules/pbx-incident-patterns.md` (2026-04-20 chown incident, log-http-and-disk gotcha)
