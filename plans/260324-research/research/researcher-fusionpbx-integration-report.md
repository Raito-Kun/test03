# FusionPBX + CRM Integration — Technical Research Report
Date: 2026-03-24 | FreeSWITCH 1.10.x compatible

---

## 1. Click-to-Call API

### Methods Available (ranked by simplicity)

#### A. mod_xml_rpc (HTTP/XML-RPC)
Module must be loaded: `mod_xml_rpc` (disabled by default in FusionPBX).

Endpoint: `http://username:password@{host}:8080/RPC2`

Originate via HTTP:
```
POST /RPC2
Method: freeswitch.api
Params: ["originate", "{origination_caller_id_number=AGENT_EXT}sofia/internal/AGENT_EXT &transfer(DEST_NUMBER XML default)"]
```

Click-to-call pattern (agent-first):
```
originate {ignore_early_media=true,effective_caller_id_number=CLI}sofia/internal/AGENT_EXT@domain XML default &transfer(DEST XML default)
```
This rings the agent first; when they pick up, it bridges to destination — the standard CRM click-to-call flow.

**Security risk:** HTTP basic auth in URL. Mitigate: nginx reverse proxy with token auth + bind 8080 to localhost only.

#### B. ESL (Event Socket Layer) — preferred for production
TCP connection to FreeSWITCH port **8021**, then:
```
auth ClueCon
bgapi originate {caller_id=...}sofia/internal/1001 &transfer(05xxxxxxx XML default)
```
`bgapi` returns a `Job-UUID` immediately; result comes back async as `BACKGROUND_JOB` event.

Languages with ESL libs: Node.js (`esl`, `esl-lite`), PHP (`rtckit/php-esl`), Python (`greenswitch`), Ruby, Perl, .NET.

#### C. FusionPBX REST API
FusionPBX exposes its own API layer. Calls can be triggered via authenticated HTTP calls to the FusionPBX web app using session tokens. Less documented than direct ESL/XML-RPC but avoids raw socket management.

#### D. loopback dialplan (FusionPBX native)
FusionPBX has a built-in `click_to_call` module using:
```
originate loopback/AGENT/default/XML &transfer(DEST XML default)
```
Accessible via FusionPBX's internal PHP call to `fs_cli`.

---

## 2. WebRTC Integration

### Two Approaches

#### Approach A: SIP over WebSocket (SIP/WSS) — recommended
FreeSWITCH internal SIP profile listens on:
- `ws://host:5066` — WebSocket (dev only)
- `wss://host:7443` — WebSocket Secure (production, required by browsers)

**Required FreeSWITCH modules:** `mod_sofia`, `mod_opus` (audio codec), `mod_rtc` (DTLS-SRTP media)

**SIP profile change** in `internal.xml`:
```xml
<param name="ws-binding" value=":5066"/>
<param name="wss-binding" value=":7443"/>
```

**SSL:** Must be valid (non-self-signed) certs — browsers reject WebRTC with self-signed.

**JS Libraries:**
- **SIP.js** (preferred) — maintained, clean API, FusionPBX community uses it
- **JsSIP** — SIP.js is a fork of this; both work
- **SaraPhone** — open-source softphone built on SIP.js, FusionPBX-ready, includes BLF/hold/mute

#### Approach B: mod_verto (Verto protocol)
JSON-RPC over WSS, not SIP. Port default: **8082** (configurable in `verto.conf.xml`).

```xml
<param name="bind-local" value="0.0.0.0:8082" secure="true"/>
<param name="secure-combined" value="/etc/freeswitch/tls/wss.pem"/>
```

Required modules: `mod_verto`, `mod_rtc`, `mod_opus`

JS client: `verto-client` (FreeSWITCH GitHub). Simpler than SIP for pure WebRTC but less ecosystem support.

**Verdict for CRM:** SIP/WSS + SIP.js is more portable and widely supported. Verto is tighter FS integration but vendor-locked JS client.

---

## 3. Event Socket Layer (ESL) for Real-Time Events

### Setup

`mod_event_socket` config (`event_socket.conf.xml`):
```xml
<param name="listen-ip" value="127.0.0.1"/>
<param name="listen-port" value="8021"/>
<param name="password" value="your-strong-password"/>
<param name="apply-inbound-acl" value="loopback.auto"/>
```

**Never expose 8021 to internet.** Use SSH tunnel or bind to internal network only.

### Inbound Connection Flow (CRM connects to FS)
```
TCP connect → 8021
← Content-Type: auth/request
→ auth <password>\n\n
← Content-Type: command/reply  Reply-Text: +OK accepted
→ event plain CHANNEL_CREATE CHANNEL_ANSWER CHANNEL_HANGUP CHANNEL_BRIDGE RECORD_STOP
← stream of events as key:value headers
```

### Key Events for CRM
| Event | Trigger | Key Headers |
|---|---|---|
| `CHANNEL_CREATE` | Call initiated | `Caller-Caller-ID-Number`, `Unique-ID`, `variable_domain_name` |
| `CHANNEL_ANSWER` | Call answered | `Unique-ID`, `Answer-State` |
| `CHANNEL_BRIDGE` | Two channels connected | `variable_bridge_uuid` |
| `CHANNEL_HANGUP` | Call ended | `Hangup-Cause`, `variable_billsec` |
| `CHANNEL_HANGUP_COMPLETE` | Post-hangup CDR data | `variable_duration`, `variable_record_path` |
| `RECORD_STOP` | Recording file written | `Record-File-Path` |
| `BACKGROUND_JOB` | bgapi result | `Job-UUID`, response body |

### Filtering (reduce noise)
```
filter Caller-Context default
filter variable_domain_name yourdomain.com
```

### Node.js Example
```js
const esl = require('esl');
const conn = esl.createClient({ host: '127.0.0.1', port: 8021, password: 'ClueCon' });
conn.on('CHANNEL_ANSWER', (evt) => {
  const uuid = evt.getHeader('Unique-ID');
  const callerNum = evt.getHeader('Caller-Caller-ID-Number');
  // Update CRM call record
});
conn.connect();
```

---

## 4. Call Recordings API

### File Storage
- Source install: `/usr/local/freeswitch/recordings/{domain}/archive/YYYY/MM/DD/`
- Package install: `/var/lib/freeswitch/recordings/{domain}/archive/YYYY/MM/DD/`

File format: typically `.wav` or `.mp3` depending on dialplan config. Named by UUID or timestamp.

### CDR Database (PostgreSQL)

Main table: `v_xml_cdr` in `fusionpbx` database.

Key columns:
```sql
xml_cdr_uuid       -- PK, links to recording filename
domain_uuid        -- tenant identifier
extension_uuid
start_stamp        -- call start datetime
answer_stamp
end_stamp
duration           -- total seconds
billsec            -- billed/connected seconds
hangup_cause
caller_id_name
caller_id_number
destination_number
record_path        -- full filesystem path to recording file
record_name        -- filename only
```

Query recordings:
```sql
SELECT xml_cdr_uuid, caller_id_number, destination_number,
       start_stamp, billsec, record_path, record_name, hangup_cause
FROM v_xml_cdr
WHERE domain_name = 'yourdomain.com'
  AND start_stamp >= NOW() - INTERVAL '24 hours'
  AND record_path IS NOT NULL
ORDER BY start_stamp DESC;
```

CDR import: cron job runs `/app/xml_cdr/v_xml_cdr_import.php` every minute — ~1 min lag after call ends before CDR is queryable.

FusionPBX exposes recordings via its web interface; for CRM, query DB directly or use `record_path` to serve file from filesystem.

---

## 5. CRM + FusionPBX Production Best Practices

### Architecture Pattern
```
CRM App
  ├── ESL Service (Node.js/Python daemon) → port 8021 (internal network only)
  │     Listens: CHANNEL_ANSWER, CHANNEL_HANGUP, BACKGROUND_JOB
  │     Publishes: WebSocket or Redis pub/sub → CRM frontend
  ├── Click-to-Call endpoint → ESL bgapi originate (NOT XML-RPC — avoid HTTP basic auth)
  ├── Recording access → direct DB query + file serve via authenticated endpoint
  └── WebRTC softphone (optional) → SIP.js → WSS:7443
```

### Security
- Bind 8021 to `127.0.0.1` or internal VLAN only
- Change default ESL password from `ClueCon`
- Use ACL (`apply-inbound-acl`) to whitelist CRM server IP
- Serve recordings through authenticated CRM API — never expose `/recordings/` directly
- XML-RPC (8080): disable if not used; if used, put behind nginx with token validation

### Reliability
- Use `bgapi` not `api` for originate (non-blocking, won't hang ESL connection)
- Reconnect ESL on disconnect with exponential backoff
- CDR has ~1 min lag — do NOT query DB immediately on `CHANNEL_HANGUP`; wait for `CHANNEL_HANGUP_COMPLETE` or poll after 90s
- Multi-tenant FusionPBX: always filter events by `variable_domain_name` to avoid cross-tenant leakage

### Real-World Integration References
- Bitrix24 + FusionPBX: uses ESL daemon in Docker, mod_curl for webhooks
- AmoCRM + FreeSWITCH: ESL listener → HTTP webhooks to CRM
- Salesforce + FusionPBX: CTI adapter via Open CTI framework + ESL backend

### Recommended Stack for CRM
| Component | Recommendation |
|---|---|
| Click-to-call trigger | ESL `bgapi originate` via Node.js service |
| Real-time events | ESL inbound, events relayed via WebSocket to browser |
| WebRTC softphone | SIP.js + SIP/WSS (port 7443) |
| Recording access | PostgreSQL `v_xml_cdr` + authenticated file endpoint |
| CDR sync | Poll `v_xml_cdr` or listen for `CHANNEL_HANGUP_COMPLETE` |

---

## Unresolved Questions
1. FusionPBX version in use — v4.x vs v5.x has schema differences in `v_xml_cdr`
2. Multi-tenant requirement? Domain isolation strategy for ESL event filtering needs confirmation
3. Recording retention policy — affects whether DB path or S3/archive URL is the canonical reference
4. Is the FreeSWITCH server on same host as CRM or separate? (affects ESL network security model)

---

## Sources
- [mod_event_socket — FreeSWITCH Docs](https://developer.signalwire.com/freeswitch/FreeSWITCH-Explained/Modules/mod_event_socket_1048924/)
- [FreeSWITCH XML-RPC](https://developer.signalwire.com/freeswitch/FreeSWITCH-Explained/Configuration/FreeSWITCH-XML-RPC_13173038/)
- [mod_verto — FreeSWITCH Docs](https://developer.signalwire.com/freeswitch/FreeSWITCH-Explained/Modules/mod_verto_3964934/)
- [FusionPBX CDR Docs](https://docs.fusionpbx.com/en/latest/applications/call_detail_record.html)
- [FusionPBX WebRTC Docs](https://docs.fusionpbx.com/en/latest/applications_optional/webrtc.html)
- [Originating calls in FreeSWITCH — Nick vs Networking](https://nickvsnetworking.com/originating-calls-in-freeswitch/)
- [Node.js ESL — shimaore/esl](https://github.com/shimaore/esl)
- [PHP ESL — rtckit/php-esl](https://github.com/rtckit/php-esl)
- [SaraPhone — SIP.js + FusionPBX](https://github.com/gmaruzz/saraphone)
- [Bitrix24-FusionPBX daemon](https://github.com/igorolhovskiy/bitrix24-fusion-daemon)
- [FreeSWITCH-AmoCRM integration](https://github.com/ProVitSer/freeswitch-amocrm)
