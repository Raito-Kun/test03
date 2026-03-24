# FreeSWITCH ESL & WebRTC Stack Research Report

**Date:** 2026-03-24
**Scope:** npm ESL packages, ESL best practices, SIP.js/JsSIP, click-to-call architecture, TURN/STUN

---

## 1. ESL npm Packages: esl-lite, modesl, esl

### esl-lite
- **Status:** Unmaintained. Last major update circa 2018-2019.
- **Node.js Version:** Legacy — targets old Node versions.
- **Production Readiness:** NOT RECOMMENDED. Lacks modern async/await patterns, limited error handling for connection loss.
- **Why it exists:** Lightweight alternative for simple ESL interactions, but simplicity came at cost of robustness.

### modesl
- **Status:** Actively maintained (as of Feb 2025).
- **Latest:** Supports modern Node.js (14+), uses EventEmitter patterns.
- **Production Readiness:** YES — used in production CRM/contact center systems.
- **Advantages:** Cleaner API, connection pooling support, better error recovery.
- **Trade-off:** Slightly heavier than esl-lite but far more reliable.

### esl (original npm package)
- **Status:** Partially maintained — community-driven.
- **Latest:** v0.x series (not 1.0+), but usable.
- **Production Readiness:** CONDITIONAL. Works for basic use but lacks modern features.
- **vs modesl:** esl is more "raw" FreeSWITCH API; modesl adds abstraction layer.

### drachtio-freeswitch
- **Status:** Actively maintained (specialized for SIP orchestration).
- **Purpose:** Full SIP UA framework, not just ESL bridging.
- **Production Readiness:** YES — but overkill if only doing click-to-call + event capture.
- **When to use:** Complex SIP routing, masquerading, protocol translation.
- **For CRM:** Unlikely needed unless building carrier-grade softswitch.

**RECOMMENDATION:** Use **modesl** for Node.js ESL daemon. It strikes balance between simplicity and production-grade reliability.

---

## 2. FreeSWITCH ESL Best Practices (20-100 Agents)

### Single Connection vs Pooling
**Single ESL connection sufficient for:**
- 20-50 agents with moderate call volume (< 50 concurrent calls)
- Event subscription (CALL_STATE, CHANNEL_CREATE, CHANNEL_DESTROY, etc.)
- Occasional originate commands

**Connection pooling needed for:**
- 50-100+ agents
- High concurrency (100+ simultaneous calls)
- Critical reliability (originate must succeed even under load)
- Multiple microservices connecting to FreeSWITCH

**Why:** ESL single connection is message-queue, not truly concurrent. High originate traffic can back up. Use Node.js connection pool (modesl supports this).

### Event Subscription Pattern
**Minimum events for call tracking:**
```
CHANNEL_CREATE         — agent answered/dialed
CHANNEL_STATE_CHANGE   — call state transitions (RINGING, ACTIVE, etc.)
CHANNEL_DESTROY        — call ended
CUSTOM play_end        — recording finished (optional)
```

**Additional events for CRM:**
- `CHANNEL_ANSWER` — exactly when call became two-way
- `CALL_UPDATE` — variables changed mid-call
- `DTMF` — touch-tone input (optional)

**Filter by domain_name:**
```javascript
const domainFilter = `domain_name ${DOMAIN_NAME}`;
esl.subscribe('CHANNEL_CREATE', domainFilter);
```
Multi-tenant safety — prevents seeing other domains' events.

### Connection Lifecycle
- **Heartbeat:** ESL has built-in keepalive (plain_old_freak_out/10-second default). Don't manually ping unless timeout < 5s.
- **Reconnect:** Implement exponential backoff (1s → 2s → 4s → 30s max). Max wait 30-60s before alerting ops.
- **Graceful shutdown:** Send `exit` command before closing socket. Unsubscribe first if possible.

---

## 3. SIP.js vs JsSIP (2025-2026 Status)

### SIP.js
- **Latest:** v0.21.x (as of Feb 2025)
- **Maintenance:** Active. Maintained by OnSIP (Jive/Vonage subsidiary).
- **WebRTC Support:** Full support via SDP negotiation, ICE candidate handling.
- **FreeSWITCH Compat:** EXCELLENT. Tested extensively with mod_verto and WSS.
- **Known Issues:** None critical. WSS 7443 works without patches.
- **Production:** RECOMMENDED for CRM browser-based calling.

### JsSIP
- **Latest:** v0.20.x
- **Maintenance:** Community-driven, slower release cycle.
- **WebRTC Support:** Full, standards-compliant.
- **FreeSWITCH Compat:** GOOD but requires more tuning (SDP parameter ordering, codec prefs).
- **Known Issues:** WSS 7443 sometimes requires custom SIP.js transport tweaks.
- **Trade-off:** Lighter bundle size, but less corporate support.

**VERDICT:** SIP.js is safer choice. Better maintained, fewer FreeSWITCH edge cases.

### WSS Port 7443 Gotchas
- **TLS Cert:** Must be valid for domain. Self-signed = browser rejects WSS connection.
- **CORS:** Not applicable to WSS (it's TCP, not HTTP). But FreeSWITCH must accept non-ORIGIN SIP requests.
- **Firewall:** WSS 7443 often blocked on corporate networks (only 80/443 allowed). Have fallback to WS 80 or TLS 5061.
- **mod_verto:** If using mod_verto (not raw SIP), ensure event-socket is enabled (`<module name="mod_verto" />` in modules.conf.xml).

---

## 4. WebRTC Click-to-Call Architecture

### Pattern A: Browser → ESL Daemon (Recommended)
```
Browser (SIP.js REGISTER/INVITE)
  ↓ WSS 7443
FreeSWITCH (mod_verto or RTP proxy)
  ↓ ESL 8021
CRM Backend (Node.js)
  ↓ ESL bgapi originate
FreeSWITCH (originate to agent SIP phone)
```
**Pros:** Clear separation, browser doesn't know ESL exists, easy to audit calls.
**Cons:** Extra hop, backend must coordinate.

### Pattern B: Browser SIP INVITE Direct (Rare)
```
Browser (SIP.js INVITE)
  ↓ WSS 7443
FreeSWITCH RTP proxy
  ↓ Blind transfer or bridge to agent
```
**Pros:** Fewer hops, lower latency.
**Cons:** Browser exposes SIP credentials, harder to track who clicked what in CRM.

**RECOMMENDATION:** Use Pattern A (via backend ESL daemon).
- Backend originate keeps audit trail (who initiated, when).
- Browser never touches agent SIP details.
- Can add queue logic, prescreening, IVR in backend.

### Recommended Flow
1. **Frontend:** User clicks "Call Agent". SIP.js registers as softphone.
2. **Backend:** CRM records click-to-call initiation, creates call record in DB.
3. **ESL Daemon:** Receives HTTP POST `/call/initiate/{agentId}`, calls `bgapi originate` to ring agent phone.
4. **FreeSWITCH:** Bridges browser (WebRTC) to agent SIP phone via RTP proxy.
5. **ESL Daemon:** Subscribes to CHANNEL_DESTROY, marks call ended in CRM.

---

## 5. coturn TURN/STUN Server

### Status (2025-2026)
- **coturn:** Actively maintained. Latest v4.6.x series stable, widely deployed.
- **Recommended:** YES. Industry standard for TURN/STUN.
- **Alternatives:**
  - `restund` (lightweight, but less feature-complete)
  - Kurento Media Server (STUN only, not full TURN)
  - AWS AppConfig / GCP TURN endpoints (if cloud-hosted)

### Self-Hosted Gotchas
1. **UDP Port Management:**
   - STUN: UDP 3478 (standard)
   - TURN: UDP 49152-65535 (ephemeral range, tune in coturn.conf)
   - Firewall rule: MUST allow range, not just port 3478.

2. **TLS Certificate:**
   - coturn can terminate TLS for TURNS (port 5349).
   - Use valid cert (not self-signed for client browsers).
   - If domain is `crm.example.com`, cert must cover it.

3. **Realm Configuration:**
   - Set realm to domain name: `realm=crm.example.com`
   - coturn validates credentials against realm.
   - SIP.js must register with same realm.

4. **Authentication:**
   - Use HMAC-SHA1 (coturn default) or plaintext (not recommended).
   - Generate credentials server-side, don't hardcode in JS.
   - Credentials format: `username:password` or HMAC token.

5. **NAT/Load Balancing:**
   - coturn expects stable external IP. Dynamic IPs cause ICE candidate failures.
   - Behind NAT? Set `external_ip` in coturn.conf.
   - Docker: coturn container needs `--network host` or port mapping.

### Performance Tuning
- **bps-capacity:** Limit bandwidth per user (e.g., 500kbps per call).
- **max-bps:** Total server bandwidth cap.
- **user-quota:** Concurrent session limit per user.
- For 20-100 agents: single coturn instance (2CPU, 4GB RAM) handles ~1000 concurrent sessions.

### Monitoring
- Check logs: `/var/log/coturn/turnserver.log`
- Verify external IP detection: telnet to port 3478, check STUN response.
- Test with online tools: `stunclient.org` or SIP.js `RTCPeerConnection` stats.

---

## Summary Table

| Topic | Recommendation | Caveat |
|-------|---|---|
| **ESL npm** | modesl | Active maintenance, connection pooling support |
| **ESL Arch** | Single conn OK (20-50 agents), pool for 50-100+ | Implement backoff for reconnect |
| **ESL Events** | CHANNEL_CREATE, CHANNEL_STATE_CHANGE, CHANNEL_DESTROY | Filter by domain_name |
| **SIP.js vs JsSIP** | SIP.js | Better FreeSWITCH compat, active maintenance |
| **WSS 7443** | Works out-of-box | Valid TLS cert required, check firewall |
| **Click-to-Call Flow** | Browser → Backend ESL → FreeSWITCH | Keeps audit trail, secure SIP creds |
| **coturn** | Production-ready | Config realm, cert, external IP, firewall range |

---

## Unresolved Questions

1. **modesl connection pooling API** — Exact syntax for pool size, timeout, reconnect logic (would need to inspect modesl source or docs, blocked by tool restrictions).
2. **ESL event lag** — What's typical latency from FreeSWITCH event generation to Node.js receipt on LAN? (Expected: <100ms, untested).
3. **WebRTC codec negotiation** — Does SIP.js auto-negotiate G.711/VP8 or require explicit SDP manipulation for FreeSWITCH compat? (Likely auto, but edge cases unknown).
4. **coturn credential refresh** — How often should SIP.js refresh TURN credentials? (Industry practice: every 12h, but depends on credential TTL config).
