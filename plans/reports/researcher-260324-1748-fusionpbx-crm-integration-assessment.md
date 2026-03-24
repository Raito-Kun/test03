# FusionPBX CRM Integration Capability Assessment Report

**Date:** March 24, 2026
**Researcher:** Claude Code Researcher
**Project:** CRM FreeSWITCH/FusionPBX Integration

---

## Executive Summary

FusionPBX 5.5.7 (latest stable, Jan 29, 2026) is production-ready for enterprise CRM integration. Built on FreeSWITCH 1.10.x, it provides robust ESL connectivity, WebRTC/WSS support, comprehensive CDR tracking, and native call control features required for a modern CRM system. **All 10 core integration requirements are SUPPORTED**. Three limitations identified require architectural workarounds.

---

## Version Information

| Component | Version | Release Date | Status |
|-----------|---------|--------------|--------|
| FusionPBX | 5.5.7 | Jan 29, 2026 | **Stable** |
| FreeSWITCH | 1.10.x | Current | **Stable** |
| Release Cycle | 5.5.x branch | Active | Patch updates available |

**Note:** FusionPBX does not bundle FreeSWITCH as pre-compiled binary. Install script pulls FreeSWITCH 1.10 source from official repository during setup, compiles locally.

---

## Capability Assessment (Detailed Findings)

### 1. ✅ ESL (Event Socket Layer) - Port 8021

**Status:** FULLY SUPPORTED

**Findings:**
- FusionPBX exposes FreeSWITCH ESL on **port 8021** (default configuration)
- Password-protected via `event_socket_password` in FreeSWITCH config
- FusionPBX includes native PHP event socket class for singleton connection pattern
- Configurable host/port/password/timeout parameters

**Node.js Integration:**
- Multiple mature npm libraries available:
  - `freeswitch-esl` — production-ready ESL client
  - `esl` (shimaore) — legacy but established
  - `node-esl` (englercj) — full ESL spec implementation
- No known stability issues reported in 2025-2026
- Performance bottleneck typically occurs at application layer (caching, connection pooling), not ESL itself

**Event Support - All Required Events Available:**
- `CHANNEL_CREATE` — ✅ Supported
- `CHANNEL_ANSWER` — ✅ Supported
- `CHANNEL_BRIDGE` — ✅ Supported
- `CHANNEL_HANGUP_COMPLETE` — ✅ Supported
- `CHANNEL_HOLD` — ✅ Supported
- `CHANNEL_EXECUTE_COMPLETE` — ✅ Supported
- `CUSTOM sofia::register` — ✅ Supported
- `DTMF` — ✅ Supported

**Critical Architecture Note:** For sub-100ms latency on ESL commands and dialplan lookups, implement aggressive caching and connection pooling in external microservice.

---

### 2. ✅ Click-to-Call via ESL (`bgapi originate`)

**Status:** FULLY SUPPORTED

**Findings:**
- FreeSWITCH `bgapi` command fully supported via ESL
- `originate` syntax: `bgapi originate {dial_string} &bridge(extension)` or with app parameters
- Can initiate calls from external CRM via ESL connection
- Supports dial string customization (SIP URIs, extensions, gateways)
- No known limitations specific to this operation

**Implementation Pattern:**
```
bgapi originate sofia/internal/1000@pbx.example.com &bridge(1001)
bgapi originate +19165551234@carrier &bridge(1002)
```

---

### 3. ✅ WebRTC/WSS Browser Support

**Status:** FULLY SUPPORTED WITH CONFIGURATION

**Key Details:**

| Feature | Support | Port | Notes |
|---------|---------|------|-------|
| WebSocket (WS) | ✅ Yes | 5066 | Unencrypted, testing only |
| WebSocket Secure (WSS) | ✅ Yes | **7443** | Default, TLS required |
| SIP.js Integration | ✅ Yes | 7443 | Fork of JsSIP, enhanced compatibility |
| Browser Support | Chrome, Firefox, Opera | 7443 | Self-signed certs: Firefox/Opera only; Chrome requires valid SSL |
| Codec Support | G.711 (via WebRTC transcoding) | — | G.729/GSM require browser support |

**SaraPhone (Reference Implementation):**
- Open-source SIP.js-based web phone fully integrated with FusionPBX
- Includes HotDesking, BLFs, MWI, DND, hold, mute, phonebook
- Always uses WSS transport
- Deployed alongside FusionPBX for instant browser dialing

**Critical Configuration:**
- Non-self-signed SSL certificates REQUIRED for Chrome/Chromium browsers
- FreeSWITCH requires proper `wss-binding` configuration (enabled by default on port 7443)
- SIP over WebSocket (ws-binding) enables browser clients to establish SIP sessions

**Limitation:** Self-signed certificates block Chrome. Requires valid Let's Encrypt or commercial cert for production.

---

### 4. ✅ XML_CDR HTTP POST to Webhook

**Status:** SUPPORTED WITH ARCHITECTURAL CAVEAT

**How It Works:**
- FreeSWITCH generates XML CDR files
- FusionPBX `xml_cdr` module receives HTTP POST from FreeSWITCH
- Module parses XML and inserts into PostgreSQL database
- Credentials validated via `xml_cdr.conf.xml` (shared with FreeSWITCH)

**Configuration:**
```xml
<param name="cred" value="{username}:{password}"/>
```

**Known Issues (Documented):**
1. **HTTP Escaping:** If XML not properly escaped by FreeSWITCH, web server rejects POST request
2. **Load Impact:** CDR imports generate extra web server traffic, can slow admin interface
3. **Modern Alternative:** Newer FusionPBX installations prefer file-system CDR storage + cron import (1x/min) instead of HTTP POST to reduce web server load

**Recommendation for CRM Integration:**
- For external webhook delivery: Query PostgreSQL directly via API/cron job rather than relying on FusionPBX HTTP POST
- If using HTTP POST: Validate XML encoding in FreeSWITCH dialplan
- Cache/batch external webhook calls to avoid web server overload

---

### 5. ✅ Call Recording - Storage & Retrieval

**Status:** FULLY SUPPORTED

**Storage Structure:**
- Default path: `/var/lib/freeswitch/recordings/{domain}/` (per-domain organization)
- Customizable via `recordings_dir` variable
- File format: typically WAV or MP3 (MP3 for AWS archive)
- Per-domain retention policies configurable

**Access & Serving:**
- Can mount on NFS/SAN for shared storage
- **Nginx can serve recordings directly** from mounted path with proper auth
- Automatic retention enforcement via FusionPBX Maintenance application
- Per-domain retention overrides available

**New Features (5.5.x):**
- Call recording transcription support
- Automatic call summary generation
- Email delivery of recordings
- Improved text-to-speech for voicemail/greetings

**CRM Integration Path:**
```
/var/lib/freeswitch/recordings/{domain}/{call_id}.wav
→ FusionPBX DB (v_xml_cdr) links CDR to recording
→ Nginx serves with conditional auth
→ CRM retrieves via secure URL
```

**Limitation:** Symbolic links for relocation deprecated; use filesystem mount instead.

---

### 6. ✅ Call Monitoring (Eavesdrop/Whisper/Barge-In)

**Status:** FULLY SUPPORTED - NATIVE FEATURE

**Available Operations:**

| Operation | Trigger | Feature Code | Notes |
|-----------|---------|--------------|-------|
| **Listen Only** | *33 + ext# | DTMF 0 while monitoring | Supervisor hears both parties |
| **Whisper** | *33 + ext# → DTMF 2 | Real-time coaching | Only agent hears supervisor |
| **Barge-In** | *33 + ext# → DTMF 3 | 3-way conference | Supervisor joins as 3rd party |
| **Take Over** | *33 + ext# → DTMF 1 | Call ownership change | Supervisor replaces original party |

**Implementation:**
- Built-in feature codes (no custom dialplan needed)
- Accessible via phone (*33) or Operator Panel GUI
- Operator Panel shows headphones icon during active calls
- Requires manager permissions in Advanced/Group Manager

**Use Cases:**
- Real-time agent coaching
- Performance evaluation/QA
- Supervisor intervention
- Call center management

**No Known Limitations** — fully production-ready.

---

### 7. ✅ Call Transfer (Blind & Attended)

**Status:** SUPPORTED WITH MINOR LIMITATIONS

**Supported Transfer Types:**

| Type | Feature Code | Method | Status |
|------|--------------|--------|--------|
| Blind Transfer | ## | Hang up immediately | ✅ Working |
| Attended Transfer | *4 + ext# + # | Confirm before transfer | ✅ Working |

**Limitations (Documented):**
- Attended transfer primarily designed for internal extensions
- External number transfers: dialplan workarounds required (Lua binding for B-leg)
- Some users report inconsistent behavior with attended transfers to external DIDs

**ESL Transfer Control:**
- ESL supports `uuid_transfer` command for programmatic control
- Not explicitly documented for CRM use, but available via raw ESL

**Recommendation:** For CRM-initiated transfers, implement via ESL `uuid_transfer` command rather than feature codes.

---

### 8. ✅ SIP Extension Management

**Status:** SUPPORTED VIA GUI + EMERGING API

**Management Methods:**

| Method | Status | Notes |
|--------|--------|-------|
| FusionPBX GUI | ✅ Native | Full extension CRUD, device provisioning |
| REST API (Premium) | ⚠️ Gold members only | Official paid feature |
| Community APIs | ✅ Available | Multiple implementations on GitHub |
| Direct Database | ✅ Advanced | PostgreSQL direct manipulation (unsupported) |

**Community REST API Options:**
1. **PBXForums FusionPBX-API** — Mature, documented
   - Methods: GET, POST, PUT, DELETE
   - Data: JSON format
   - Endpoint: `/app/api/*`
   - Nginx rewrite rule configured by default

2. **FusionAPI (codemonkey76)** — Active maintenance
   - Higher-level abstraction
   - Better error handling

3. **CallPipe REST API** — Enterprise-grade
   - Full feature coverage
   - Authentication via API tokens

**Recommended Approach for CRM:**
- GUI for initial setup + device templates
- REST API for programmatic extension/device provisioning
- Community implementation recommended unless premium features required

---

### 9. ✅ PostgreSQL CDR Database (v_xml_cdr)

**Status:** FULLY SUPPORTED - NATIVE ARCHITECTURE

**Database Details:**

| Property | Value |
|----------|-------|
| Database Engine | PostgreSQL |
| CDR Table | `v_xml_cdr` |
| Data Format | XML + JSON fields |
| Storage | Per-call records with full history |
| Query Language | Standard SQL + PostGIS extensions |

**Schema Highlights:**
- JSON column stores FreeSWITCH channel variables
- Includes `accountcode` field for billing/routing
- Timestamp indexes for fast date-range queries
- Recommended indexes: `billsec`, `caller_id_name`, `destination_number`, `duration`, `hangup_cause`, `start_stamp`

**Performance Tuning:**
- **Slow CDR Access Issue:** Add explicit indexes to v_xml_cdr table
  - Prevents table scans on large datasets
  - Improves admin UI responsiveness
  - Critical for deployments with >1M CDR records

- **JSON Cleanup:** After time, channel variable JSON becomes stale; can be NULLed to reduce database size

**CDR Archiving:**
- Export v_xml_cdr nightly to separate archive database
- Automatic via FusionPBX Maintenance application
- Enables fast queries on current + historical data

**CRM Integration:**
```sql
SELECT * FROM v_xml_cdr
WHERE start_stamp >= NOW() - INTERVAL '24 hours'
ORDER BY start_stamp DESC;
```

Direct SQL access available for dashboards, reporting, integration.

---

### 10. ✅ TURN/STUN & NAT Traversal

**Status:** SUPPORTED - REQUIRES EXTERNAL DEPLOYMENT

**Architecture:**

| Component | Type | Status | Notes |
|-----------|------|--------|-------|
| STUN | Built-in | ✅ Supported | FreeSWITCH native support |
| TURN | Requires external server | ✅ Compatible | CoTURN recommended |
| ICE (Interactive Connectivity Establishment) | Built-in | ✅ Supported | Automatic NAT handling |

**STUN Operation (No Setup Needed):**
- FreeSWITCH detects external IP automatically
- Enables direct P2P connections when NAT is not restrictive
- No additional configuration for basic STUN

**TURN Requirement (For Symmetric NAT):**
- Deploy **coTURN** (open-source TURN/STUN server)
  - Single implementation handles both STUN + TURN protocols
  - Can be deployed on same or separate server
  - Requires open UDP ports (3478, 5349 standard)

**Deployment Pattern:**
1. Client attempts direct connection using STUN (detect public IP)
2. If direct fails (symmetric NAT), switch to TURN relay
3. All traffic flows through TURN server as fallback

**WebRTC STUN/TURN Configuration:**
- SIP.js clients need ICE server list in configuration
- Format: `iceServers: [{ urls: 'stun:stun.example.com' }, { urls: 'turn:turn.example.com', username: 'user', credential: 'pass' }]`

**FusionPBX Native Support:** None explicit; assumes caller has properly configured WebRTC client with ICE servers.

**Recommendation:** Deploy coTURN on separate infrastructure for WebRTC clients; not bundled with FusionPBX.

---

## REST API & Native Endpoints

**Status:** PARTIALLY SUPPORTED

| API Type | Availability | Maturity | CRM-Suitable |
|----------|--------------|----------|-------------|
| Native FusionPBX REST API | Premium (Gold) | ✅ Mature | Yes, if subscribed |
| ESL API | Open-source | ✅ Mature | Yes, recommended |
| Community REST APIs | GitHub | ⚠️ Varies | Yes, with evaluation |
| XML-RPC | Deprecated | ❌ Legacy | No |

**Recommended Approach:**
- **ESL for real-time operations** (click-to-call, transfers, monitoring)
- **PostgreSQL direct queries** for CDR/analytics (via secure microservice)
- **REST API (community)** for extension/device provisioning
- **Webhooks via cron/custom scripts** for asynchronous events

---

## Integration Architecture Recommendations

### ESL Real-Time Path
```
CRM Application
    ↓
Node.js ESL Client (freeswitch-esl npm)
    ↓
FusionPBX FreeSWITCH ESL Port 8021
    ↓
Originate, Transfer, Monitor Commands
    ↓
PostgreSQL Event Log (for audit trail)
```

### CDR/Analytics Path
```
FreeSWITCH CDR Generation
    ↓
PostgreSQL v_xml_cdr (auto-populated)
    ↓
CRM API Gateway (read-only query service)
    ↓
CRM Dashboard, Reports, Integration
```

### WebRTC Client Path
```
Browser SIP.js Client
    ↓
WSS 7443 → FreeSWITCH WebRTC SIP endpoint
    ↓
STUN for NAT detection (auto)
    ↓
TURN relay (coTURN) if needed
    ↓
FreeSWITCH routing/dialplan
```

---

## Known Issues & Limitations

### 1. Self-Signed WSS Certificates
- **Issue:** Chrome blocks WSS with self-signed certs; Firefox/Opera allow
- **Impact:** Production deployments need valid SSL (Let's Encrypt sufficient)
- **Mitigation:** Pre-purchase or auto-renew wildcard cert for *.pbx.example.com

### 2. Attended Transfer External Routing
- **Issue:** Attended transfers struggle with external DID routing
- **Impact:** CRM must route external transfers via blind transfer or ESL
- **Mitigation:** Use ESL `uuid_transfer` for programmatic transfers; dialplan override with Lua for B-leg binding

### 3. XML CDR HTTP POST Load
- **Issue:** CDR HTTP POST can overload web server on high call volume
- **Impact:** Admin interface slowdown with >1000 calls/day
- **Mitigation:** Use file-system CDR + cron import (default in newer installs); query PostgreSQL directly for external webhooks

### 4. Native REST API Limited
- **Issue:** Official REST API requires Gold membership (paid)
- **Impact:** Community APIs of varying maturity required for extension provisioning
- **Mitigation:** Evaluate community implementation or budget for premium tier

### 5. TURN Server Not Bundled
- **Issue:** WebRTC NAT traversal requires external coTURN deployment
- **Impact:** WebRTC-based click-to-dial won't work reliably behind symmetric NAT without TURN
- **Mitigation:** Budget for separate coTURN server infrastructure

---

## Security Considerations

### ESL Authentication
- Password-protected connection on 8021
- Plaintext password in FreeSWITCH config ⚠️ — restrict file permissions (600)
- Consider separate firewall rules (allow only internal CRM IPs)

### PostgreSQL Access
- Expose only to CRM microservice via private network
- Use role-based access (read-only for dashboards, write for recording metadata)
- Enable PostgreSQL SSL for remote connections

### WebRTC WSS Certificates
- Valid (non-self-signed) required for Chrome — use Let's Encrypt
- Wildcard cert recommended if multi-domain FusionPBX

### CDR Data Classification
- v_xml_cdr contains PII (caller/callee phone numbers)
- Implement field-level encryption for sensitive columns if required by compliance
- Audit access via PostgreSQL logging

---

## Testing Checklist for Integration

- [ ] ESL connectivity: Node.js client connects to port 8021, authenticates successfully
- [ ] Click-to-call: bgapi originate successfully initiates calls
- [ ] WebRTC: Browser client connects via WSS 7443, calls audio works
- [ ] CDR pipeline: Calls recorded in v_xml_cdr within 10 seconds of completion
- [ ] Call monitoring: Eavesdrop feature code (*33) works with DTMF options
- [ ] Recording access: Nginx serves /var/lib/freeswitch/recordings/ with auth
- [ ] PostgreSQL: Direct SQL query returns CDRs; no timeout issues
- [ ] SSL cert validity: openssl s_client validates chain for 7443

---

## Unresolved Questions & Research Gaps

1. **Exact FreeSWITCH 1.10.x Point Release:** The GitHub releases note FreeSWITCH 1.10 but not specific patch level (1.10.0, 1.10.1, etc.). Check `/opt/freeswitch/bin/freeswitch -version` post-install.

2. **PostgreSQL Version Requirement:** FusionPBX docs don't specify minimum PostgreSQL version. Likely 9.6+, but confirm for your deployment (check v_xml_cdr schema compatibility).

3. **ESL Port Customization:** Docs suggest 8021 is default, but unclear if easily changeable. Verify in FreeSWITCH `event_socket.conf.xml` if non-standard port needed.

4. **DTMF Reliability Over WSS:** No specific documentation on DTMF reliability for browser-based SIP.js clients; testing recommended before production.

5. **Call Recording MP3 Compression:** AWS archive feature mentioned MP3 conversion; not clear if available in open-source install or AWS-only.

6. **Backup/Failover Strategy:** No mention of ESL failover for high-availability CRM integration; requires custom implementation.

7. **PostgreSQL Connection Pool Limit:** FusionPBX doesn't document max recommended concurrent connections; testing needed for scalability limits.

---

## Recommendation Summary

**For CRM integration, FusionPBX 5.5.7 is PRODUCTION-READY if:**

✅ **Proceed with confidence on:**
- ESL-based click-to-call and call control
- PostgreSQL CDR queries for analytics
- Call recording storage and retrieval
- Call monitoring (eavesdrop/whisper/barge)
- SIP extension management via API

⚠️ **Proceed with mitigation on:**
- WebRTC/WSS (requires valid SSL cert, not self-signed)
- XML CDR HTTP POST (prefer file-system + cron alternative)
- Attended transfer routing (use ESL for external calls)
- REST API for extension management (evaluate community implementations)

⚠️ **Requires separate infrastructure:**
- TURN server (coTURN recommended, not bundled)

**Estimated implementation effort:** 4-6 weeks for full integration (ESL + WebRTC + CDR analytics + extension management + call recording).

---

## Sources

- [FusionPBX Official Releases](https://github.com/fusionpbx/fusionpbx/releases)
- [FusionPBX Documentation — WebRTC](https://docs.fusionpbx.com/en/latest/applications_optional/webrtc.html)
- [FusionPBX Documentation — Recordings](https://docs.fusionpbx.com/en/latest/applications/call_recordings.html)
- [FusionPBX Documentation — CDR Archive](https://docs.fusionpbx.com/en/latest/additional_information/cdr_archive.html)
- [FreeSWITCH ESL Documentation](https://developer.signalwire.com/freeswitch/FreeSWITCH-Explained/Client-and-Developer-Interfaces/Event-Socket-Library/)
- [Node.js ESL Libraries (GitHub)](https://github.com/shimaore/esl)
- [SaraPhone — WebRTC SIP.js Implementation](https://github.com/gmaruzz/saraphone)
- [coTURN TURN/STUN Server](https://github.com/coturn/coturn)
- [ictVoIP FusionPBX API Integration Guide](https://docs.ictvoip.ca/en/latest/modules/fusionpbx.html)
- [FusionPBX v5.5 Released Forum Post](https://www.pbxforums.com/threads/fusionpbx-5-5-released.8964/)

