# Red Team Review: Failure Mode Analysis

**Reviewer:** Failure Mode Analyst (Murphy's Law perspective)
**Date:** 2026-03-24
**Plan:** CRM Omnichannel Phase 1 MVP (260324-1850)

---

## Finding 1: PM2 Cluster Mode Destroys ESL Singleton + Socket.IO State

- **Severity:** Critical
- **Location:** Phase 09, section "PM2 configuration" + Phase 04, section "ESL Daemon"
- **Flaw:** PM2 cluster mode (2 instances) forks two Node.js processes. Each process will independently create an ESL connection to FreeSWITCH and a separate Socket.IO server instance. ESL events arrive on a random worker. Socket.IO clients connect to a random worker. The worker that receives the ESL event is almost certainly not the worker holding the user's Socket.IO connection.
- **Failure scenario:** Agent makes a click-to-call. Worker 1 handles the HTTP request and sends the ESL originate. FreeSWITCH sends CHANNEL_ANSWER back — Worker 2's ESL connection receives it. Worker 2 tries to emit `call:answered` via Socket.IO, but the agent's socket is on Worker 1. The agent never sees the call answered. Redis active call state is written by Worker 2 but Worker 1's in-memory state is stale. Duplicate ESL event subscriptions cause double-processing of CDR events. Agent status gets split-brained between workers.
- **Evidence:** Phase 09 line 102: "cluster mode (2 instances)" / Phase 04 line 22: "Backend: Express + Prisma + ESL daemon + Socket.IO on single Node process" — the plan explicitly designed for single-process but deploys as multi-process.
- **Suggested fix:** Either (a) use PM2 fork mode (1 instance) with `--watch` for restarts, or (b) if clustering is required, extract the ESL daemon into a separate dedicated process that publishes events to Redis Pub/Sub, and configure Socket.IO with `@socket.io/redis-adapter` so events route cross-worker. This is a non-trivial architectural change that the plan completely ignores.

---

## Finding 2: Refresh Token Rotation Race Condition — "Atomic" Handwave

- **Severity:** Critical
- **Location:** Phase 02, section "Risk Assessment" line 147
- **Flaw:** The plan identifies the token rotation race condition (two parallel refresh requests) but the mitigation is "Redis atomic operations" with zero implementation detail. There is no specification of which atomic operation, no pseudocode, no mention of Lua scripting or WATCH/MULTI, no mention of what happens to the second request.
- **Failure scenario:** User's browser has two tabs. Both tabs' Axios interceptors detect a 401 simultaneously and fire `POST /auth/refresh` with the same refresh token. Request A arrives first, rotates the token, invalidates the old one. Request B arrives milliseconds later with the now-invalidated token. If the check is not truly atomic (read-then-delete), Request B could also read the token before A deletes it — both succeed, producing two valid refresh tokens. Alternatively, if the check IS strict, Request B fails with 401, the tab logs the user out, and the user loses their session in one tab while the other continues working.
- **Evidence:** "Token rotation race condition: two parallel refresh requests could both succeed. Mitigate with Redis atomic operations." — no implementation detail whatsoever.
- **Suggested fix:** Specify a concrete pattern: (1) Use Redis `GETDEL` or a Lua script that atomically reads and deletes the refresh token, (2) On the second request failing, return a specific error code (e.g., `token_already_rotated`) that the frontend handles by retrying with the new token from the first response, or (3) Implement a short grace period (5-10s) where the old token still maps to the new one.

---

## Finding 3: ESL Disconnect Leaves Zombie Calls in Redis — No Cleanup Strategy

- **Severity:** High
- **Location:** Phase 04, section "Risk Assessment" line 186
- **Flaw:** The plan states "Redis state persists, CDR webhook fills gaps" when ESL disconnects. But CDR webhooks only fire AFTER the call ends. If FreeSWITCH crashes entirely (not just ESL disconnect), CDR may never arrive. If ESL reconnects, it has no mechanism to reconcile Redis state with actual FreeSWITCH state. There is no TTL on `call:{uuid}` keys. There is no periodic sweep to detect orphaned calls.
- **Failure scenario:** ESL disconnects during 5 active calls. Redis has 5 `call:{uuid}` entries. FreeSWITCH restarts and those calls are gone, but CDR webhook was not configured to fire on crash (xml_cdr only fires on CHANNEL_HANGUP_COMPLETE, which doesn't happen on crash). Redis entries persist forever. Dashboard shows 5 phantom active calls. Agents show perpetual `on_call` status. New calls from those agents may be blocked because the system thinks they're already on a call. The agent status never transitions out of `on_call` because no CHANNEL_HANGUP_COMPLETE ever arrives.
- **Evidence:** Phase 04 line 101: "Track active calls in Redis: `call:{uuid}` → {agentId, contactPhone, direction, state, startTime}" — no TTL mentioned. Phase 04 line 186: "CDR webhook fills gaps" — CDR doesn't fire on crash.
- **Suggested fix:** (1) Add TTL to `call:{uuid}` keys (e.g., 4 hours max call duration), (2) On ESL reconnect, query FreeSWITCH `show calls` via ESL to reconcile Redis state, (3) Add a periodic sweep job (every 60s) that checks for calls older than max-expected-duration and cleans them up, updating agent status accordingly.

---

## Finding 4: setInterval Reminder Job Is Not Distributed — Runs on Every PM2 Instance

- **Severity:** High
- **Location:** Phase 06, section "Reminder job (cron)" line 93 + Phase 09 PM2 cluster
- **Flaw:** `setInterval` runs in every Node.js process. With PM2 cluster mode (2 instances), the reminder job runs twice every 5 minutes. The plan mentions "Redis lock" for duplicate prevention but gives no implementation detail. Even without PM2 clustering, `setInterval` drifts, has no persistence across restarts, and silently fails if the callback throws.
- **Failure scenario:** Both PM2 workers fire the reminder job at the same time. Both query for leads with upcoming follow-ups. Both find the same 50 leads. If the Redis lock is not implemented correctly (which is likely given zero detail), both create notifications. 50 agents each receive 2 identical reminder notifications. If this runs for a day (288 cycles), the noise makes the notification system useless — agents start ignoring all notifications.
- **Evidence:** Phase 06 line 93: "Run every 5 minutes via `setInterval` (simple for MVP; Bull queue for Phase 2)" / line 116: "use Redis lock + check existing notification" — no lock implementation detail.
- **Suggested fix:** Use `node-cron` with a Redis-based distributed lock (e.g., `redlock` library) with specific TTL and retry config. Or use a single-leader election pattern where only one process runs cron jobs. Alternatively, since the plan already has Redis, use a simple `SET key NX EX 300` pattern and document the exact key and TTL.

---

## Finding 5: CDR Webhook Has No Retry or Dead Letter Mechanism

- **Severity:** High
- **Location:** Phase 04, section "CDR Webhook" step 6, lines 139-147
- **Flaw:** The CDR webhook stores failed payloads in `webhook_logs` with `status=failed` but has no retry mechanism. If the CRM backend is down when FusionPBX sends the CDR, the POST fails at the HTTP level — it never reaches the application to be logged. FusionPBX's xml_cdr HTTP POST does not retry by default. Those CDRs are lost forever.
- **Failure scenario:** CRM backend restarts (deployment, crash, PM2 restart). During the ~5-10 seconds of downtime, 3 calls complete and FusionPBX sends 3 CDR webhooks. All 3 receive connection refused. FusionPBX does not retry. Those 3 calls have no CDR in the database. The call_logs entries created by ESL events exist but lack duration, billsec, hangup_cause, and recording_path. These calls appear as phantom incomplete calls in the system permanently.
- **Evidence:** Phase 04 line 146: "Handle errors: store in webhook_logs with status=failed" — this only handles application-level parse errors, not network-level delivery failures.
- **Suggested fix:** (1) Configure FusionPBX xml_cdr to write to filesystem AND HTTP POST (belt and suspenders), (2) Add a CDR reconciliation job that periodically checks for call_logs missing CDR data (no end_time, no duration) older than 30 minutes and queries FusionPBX filesystem for the CDR files, (3) Document the FusionPBX xml_cdr retry configuration requirements in the deployment checklist.

---

## Finding 6: Recording Proxy Is an Unauthenticated SSRF Vector

- **Severity:** High
- **Location:** Phase 04, section "Recording proxy" step 7, lines 149-154
- **Flaw:** The recording proxy takes a `call_log_id`, looks up the `recording_path` from the database, then proxies a request to `http://FUSIONPBX_IP:8088/recordings/{domain}/{file}`. If `recording_path` is stored from untrusted CDR webhook data (xml_cdr from FusionPBX), and the CDR is spoofed or FusionPBX is compromised, the recording_path could contain path traversal sequences or point to arbitrary internal resources.
- **Failure scenario:** An attacker who can send a crafted CDR webhook (e.g., if IP whitelist is bypassed or FusionPBX is compromised) inserts a recording_path like `../../../../etc/passwd` or `../../fusionpbx/resources/config.php`. The CRM backend constructs a proxy URL like `http://FUSIONPBX_IP:8088/recordings/domain/../../../../etc/passwd` and fetches it, returning the contents to the authenticated CRM user. This is a Server-Side Request Forgery allowing file read from the FusionPBX server.
- **Evidence:** Phase 04 line 151: "Proxy request to `http://FUSIONPBX_IP:8088/recordings/{domain}/{file}`" — no path sanitization mentioned. CDR webhook is the source of recording_path.
- **Suggested fix:** (1) Sanitize recording_path on CDR ingestion: strip path traversal, validate it matches expected pattern (UUID-based filename, .wav/.mp3 extension), (2) Use `path.basename()` to extract only the filename, (3) Construct the proxy URL from a whitelist of allowed path components, never by string concatenation with user-influenced data.

---

## Finding 7: Access Token in Memory Only — Every Page Refresh Logs User Out

- **Severity:** High
- **Location:** Phase 08, section "Security Considerations" line 217 + Phase 02 line 20
- **Flaw:** "Access token stored in memory only (not localStorage) — survives only current tab." The refresh token is in an httpOnly cookie. But the plan's Axios interceptor (Phase 08, step 1.2) attaches the access token to requests. On page refresh, the Zustand store resets, access token is gone. The app must call `/auth/refresh` before any API call. This is not mentioned anywhere in the plan.
- **Failure scenario:** Agent is mid-call, accidentally hits F5 or browser refreshes due to an extension. The page reloads. Zustand store is empty — no access token, no user info. The app renders the login page. The call bar disappears. The agent panics, thinks they're disconnected. If the auto-refresh logic on app init is not implemented (and it's not specified), the agent has to manually re-login. Their active call continues on FreeSWITCH but the UI shows nothing. They cannot hangup, hold, or transfer because the call bar is gone.
- **Evidence:** Phase 08 line 217: "Access token stored in memory only" / Phase 08 step 1.3: "Create auth store (Zustand): user, login/logout, isAuthenticated" — no mention of init-time token refresh or session recovery.
- **Suggested fix:** Add an explicit app initialization step: on mount, check if refresh cookie exists (it's httpOnly so can't read it — just call `/auth/refresh` unconditionally), get new access token, hydrate auth store. Show a loading spinner during this. Document this flow explicitly in Phase 08. Also consider persisting the active call UUID in sessionStorage so the call bar can recover after refresh.

---

## Finding 8: No Database Migration Rollback Strategy

- **Severity:** Medium
- **Location:** Phase 01, section "Prisma schema" step 5 + Phase 09 "Docker production setup"
- **Flaw:** The plan creates all 18 tables in a single initial migration. There is no mention of migration rollback strategy, no discussion of how to handle failed migrations in production, and no mention of `prisma migrate deploy` vs `prisma migrate dev` in production. Phase 09's Docker setup has no migration step in the deployment pipeline.
- **Failure scenario:** After going to production, a Phase 2 migration modifies the call_logs table (adding a column). The migration partially applies, then fails mid-way (e.g., out of disk space on index creation). The database is now in an inconsistent state — the column exists but the index doesn't. Prisma refuses to run further migrations because the state doesn't match. There is no documented rollback procedure. The team has to manually fix the database schema while the application is down.
- **Evidence:** Phase 01 line 107: "Run `npx prisma migrate dev --name init`" — dev command only. Phase 09 Docker setup lines 89-99: no `prisma migrate deploy` step in Dockerfile or compose.
- **Suggested fix:** (1) Add `prisma migrate deploy` as an entrypoint step in the backend Dockerfile or a pre-start script, (2) Document rollback procedures for Prisma migrations (manual SQL rollback since Prisma doesn't support automatic rollback), (3) Consider adding a health check that verifies schema version matches expected version.

---

## Finding 9: Socket.IO Token Refresh on Reconnect — Chicken-and-Egg Problem

- **Severity:** Medium
- **Location:** Phase 08, section "Socket.IO Integration" step 11.1 + Phase 08 "Risk Assessment" line 213
- **Flaw:** Socket.IO authenticates with JWT on connection handshake. The plan says "Socket.IO reconnection with token refresh." But if the access token has expired (15min TTL), Socket.IO cannot reconnect because the handshake JWT is invalid. The refresh flow requires an HTTP call to `/auth/refresh`, but Socket.IO's reconnection is automatic and there's no hook to inject a fresh token into the handshake before the reconnection attempt.
- **Failure scenario:** Agent is on the dashboard for 20 minutes without any HTTP requests. Access token expires at 15 minutes. Socket.IO disconnects (e.g., brief network blip at minute 18). Socket.IO auto-reconnects with the expired token in handshake.auth. Server rejects the connection — 401. Socket.IO retries with the same expired token. Infinite reconnection loop. Dashboard freezes — no real-time agent status updates, no notifications. Agent is unaware until they try to navigate.
- **Evidence:** Phase 08 line 213: "Socket.IO reconnection: auto-reconnect with token refresh" — no implementation detail on HOW the token is refreshed before reconnection.
- **Suggested fix:** Implement a custom Socket.IO reconnection strategy: (1) On `connect_error` with auth failure, pause auto-reconnect, (2) Call `/auth/refresh` via HTTP to get a new access token, (3) Update the socket's `auth` option with the new token, (4) Manually trigger reconnect. This needs to be specified as an explicit implementation step, not a one-line risk note.

---

## Finding 10: Dual-Source Call Logs (ESL + CDR) Create a Timing Window for Data Corruption

- **Severity:** Medium
- **Location:** Phase 04 step 5 + Phase 05 section "Post-call disposition" step 4
- **Flaw:** Call logs are created by ESL events (real-time, partial data) and then upserted by CDR webhook (post-call, complete data). The plan allows agents to set dispositions during wrap-up (Phase 05 step 4.2). The CDR webhook also upserts the same call_log record. If the CDR upsert overwrites the disposition fields, the agent's disposition is lost.
- **Failure scenario:** Agent finishes a call. ESL CHANNEL_HANGUP_COMPLETE fires. Agent enters wrap-up, selects disposition "qualified" and adds notes. The `call_logs` record is updated with `disposition_code_id` and `notes`. 5 seconds later, CDR webhook fires. The upsert on `call_uuid` updates the record with CDR data (duration, billsec, hangup_cause, recording_path). If the upsert is a naive `UPDATE SET` on all CDR fields, AND if the CDR payload includes null/empty disposition fields (because FusionPBX doesn't know about CRM dispositions), the agent's disposition and notes are overwritten with null.
- **Evidence:** Phase 04 line 143: "Upsert call_logs by call_uuid (may already exist from ESL event)" / Phase 05 line 74: "POST /call-logs/:id/disposition" — no mention of protecting disposition fields from CDR overwrite.
- **Suggested fix:** The CDR webhook upsert must explicitly exclude CRM-owned fields (disposition_code_id, notes, qa_annotation fields) from the UPDATE clause. Use Prisma's `update` with only CDR-sourced fields: `{ duration, billsec, hangup_cause, recording_path, end_time }`. Document which fields are CDR-owned vs CRM-owned.
