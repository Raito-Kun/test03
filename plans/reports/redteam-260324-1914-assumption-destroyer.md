# Red Team Review: Assumption Destroyer
**Date:** 2026-03-24
**Target:** CRM Omnichannel Phase 1 MVP Plan (9 phases, 33 working days)
**Perspective:** Skeptic — find every unstated dependency, false claim, missing error path, scale/integration assumption

---

## Finding 1: PM2 Cluster Mode Destroys ESL Singleton and setInterval Job

- **Severity:** Critical
- **Location:** Phase 09, section "PM2 configuration" + Phase 04, section "ESL Daemon" + Phase 06, section "Reminder job"
- **Flaw:** Phase 09 specifies PM2 cluster mode with 2 instances. Phase 04 designs a single ESL connection daemon. Phase 06 uses `setInterval` every 5 minutes for the reminder job. Cluster mode spawns independent Node processes. Two processes means two ESL connections subscribing to the same events (duplicate call events, duplicate Socket.IO emissions) and two reminder jobs firing simultaneously (duplicate notifications).
- **Failure scenario:** Agent receives every call event twice via Socket.IO. Call bar shows ringing, then ringing again. Reminder job creates 2 notifications for every due follow-up. Agent status flickers as two processes fight over Redis state from the same ESL events.
- **Evidence:** Phase 09: "cluster mode (2 instances for backend)". Phase 04: "Single ESL connection sufficient for 20-50 agents". Phase 06: "setInterval every 5 minutes". No mention of leader election, singleton process, or job deduplication across cluster instances.
- **Suggested fix:** Either (a) run a dedicated ESL worker process separate from the HTTP cluster, or (b) use PM2 fork mode (1 instance) for MVP, or (c) implement Redis-based leader election so only one instance runs the ESL daemon and cron jobs. This must be decided before Phase 04, not deferred to Phase 09.

---

## Finding 2: Access Token in Memory Dies on Page Refresh — No Recovery Path Specified

- **Severity:** Critical
- **Location:** Phase 02, section "Key Insights" + Phase 08, section "Security Considerations"
- **Flaw:** The plan states "access token stored in memory (not localStorage)" and "survives only current tab." The refresh token is in an httpOnly cookie. But the plan never describes what happens on page refresh or new tab. The Axios interceptor in Phase 08 mentions "401 interceptor: auto-refresh token, retry original request" but does not describe the initial bootstrap — when the app loads fresh with no in-memory token, how does it obtain one?
- **Failure scenario:** Agent refreshes the browser during a call. SPA loads, in-memory token is gone. Every API call returns 401. The 401 interceptor tries to refresh, but the plan does not specify that the app proactively calls `/auth/refresh` on startup before any other request. If the interceptor and initial data fetch race, the user sees a flash of login screen or errors before the token refresh completes. During this gap, the Socket.IO connection also fails (no token in handshake).
- **Evidence:** Phase 08, Step 1.2: "401 interceptor: auto-refresh token, retry original request." No mention of app-boot token initialization. Phase 02 defines the `/auth/refresh` endpoint but never describes a startup flow.
- **Suggested fix:** Phase 08 must explicitly specify: on app boot, call `/auth/refresh` before rendering any protected route. Queue all API requests until the initial refresh completes or fails. If it fails, redirect to login. Document this as a critical UX flow, not just an interceptor side-effect.

---

## Finding 3: Contact Matching by Phone Number Is Ambiguous When Phone Is Not Unique

- **Severity:** High
- **Location:** Phase 03, section "Key Insights" + Phase 04, section "CDR Webhook" step 6
- **Flaw:** Phase 03 explicitly states "contacts.phone is INDEX not UNIQUE (VN customers may share phone)." Phase 04 step 6 says "Match contact by phone number (caller or destination)." When multiple contacts share the same phone number, which one does the CDR attach to? The plan provides no disambiguation strategy.
- **Failure scenario:** Two debt case contacts share the same phone (e.g., guarantor and debtor). Agent calls the number. CDR arrives, matches phone, finds 2 contacts. System either picks the first one (wrong 50% of the time), throws an error, or silently drops the match. Call log shows up on the wrong contact's timeline. QA reviews the wrong account.
- **Evidence:** Phase 04, Step 6.6: "Match contact by phone number (caller or destination)" — no handling of multiple matches. Phase 03: "contacts.phone INDEX not UNIQUE."
- **Suggested fix:** Define disambiguation rules: (1) If agent initiated the call via click-to-call from a specific contact page, use that contact_id from the originate request. (2) For inbound or CDR-only matches with multiple hits, match by the contact currently assigned to the agent. (3) If still ambiguous, leave contact_id null and flag for manual resolution.

---

## Finding 4: 5 Days for Complete SPA Is Fantasy Scheduling

- **Severity:** High
- **Location:** Phase 08, entire phase
- **Flaw:** Phase 08 allocates 5 days for: login page, app layout, sidebar, header, agent status selector, notification bell, reusable data table, audio player with waveform/seek/speed, dashboard page, contact pages (list/detail/form/import/export/timeline), lead pages, debt case pages, call log pages with audio integration, ticket pages with macro integration, call bar with hold/mute/transfer/hangup/disposition/script, Socket.IO integration, inbound call popup, campaign pages, settings pages, and reports pages. That is approximately 15 distinct page types plus 5-6 complex reusable components plus real-time integration.
- **Failure scenario:** By day 3, the data table component and contact pages consume all the time. Call bar, Socket.IO integration, audio player, and inbound call popup are unfinished. These are the differentiating features of the CRM. The team ships a CRUD shell with no real-time call experience.
- **Evidence:** Phase 08 lists 14 todo items. Day-by-day breakdown shows "Day 3: Contact + Lead + Debt pages" — that alone is 6 pages with complex forms, import/export UI, and timeline aggregation. Day 4: "Call logs + Tickets + Call Bar" — the call bar alone (hold, mute, transfer, hangup, disposition, script display, Socket.IO state sync) is a multi-day component.
- **Suggested fix:** Either (a) double the frontend estimate to 10 days, or (b) cut scope: drop waveform audio player (use basic HTML5 audio), drop reports pages (use backend-only for MVP), simplify call bar to basic controls only, drop macro integration from ticket form. Prioritize the call bar and Socket.IO integration over CRUD polish.

---

## Finding 5: setInterval Reminder Job Has No Distributed Lock — Duplicates and Drift

- **Severity:** High
- **Location:** Phase 06, section "Reminder job (cron)" step 5
- **Flaw:** The reminder job runs via `setInterval` every 5 minutes. The risk section mentions "use Redis lock + check existing notification" but this is not in the implementation steps — it is in the risk section as a mitigation thought, not a designed feature. The implementation step 5 says "Track sent reminders to avoid duplicates (add `reminder_sent` flag or check existing notifications)" with an "or" — the plan has not decided which approach to use.
- **Failure scenario:** (1) Without a Redis lock, in cluster mode (see Finding 1), both instances run the job simultaneously, creating double notifications. (2) The `setInterval` approach drifts — Node.js event loop delays can cause intervals to stack or skip. (3) If the server restarts, `setInterval` resets; any in-flight check state is lost. (4) The "reminder_sent flag" approach requires a schema migration that is not mentioned in Phase 01's Prisma schema (no `reminder_sent` column on leads or debt_cases).
- **Evidence:** Phase 06, Step 6.5: "Track sent reminders to avoid duplicates (add `reminder_sent` flag or check existing notifications)" — undecided approach. Phase 01 schema does not mention a `reminder_sent` field.
- **Suggested fix:** Commit to one deduplication strategy in the implementation steps (not risk section). If using `reminder_sent` flag, add it to the Prisma schema in Phase 01. Wrap the entire job in a Redis `SET NX EX` lock to prevent concurrent execution. Consider `node-cron` over raw `setInterval` for more predictable scheduling.

---

## Finding 6: ESL Reconnect During Active Calls Loses In-Flight State

- **Severity:** High
- **Location:** Phase 04, section "Risk Assessment" + section "Call event handler"
- **Flaw:** Phase 04 risk section states "ESL disconnect during active calls: Redis state persists, CDR webhook fills gaps." This assumes CDR webhooks arrive for calls that were in progress when the ESL connection dropped. But the gap between ESL disconnect and reconnect means: (1) no real-time call events reach the frontend, (2) agent status is frozen (shows "on_call" indefinitely or never transitions to "wrap_up"), (3) there is no mechanism to reconcile Redis state with FreeSWITCH actual state after reconnection.
- **Failure scenario:** ESL disconnects for 30 seconds during a network blip. During that time, 3 calls end and 2 new calls start. After reconnect, the plan subscribes to events again but never queries FreeSWITCH for current channel state. Redis still shows 3 "active" calls that already ended. Dashboard shows phantom active calls. Agents appear stuck in "on_call" status until the next CDR webhook arrives (which could be minutes later, or the webhook could also fail).
- **Evidence:** Phase 04, Step 1.3: "Auto-reconnect with exponential backoff." No step for post-reconnect state reconciliation. No `show channels` or `api status` query after reconnect.
- **Suggested fix:** After ESL reconnect, execute `api show channels as json` to get current FreeSWITCH state. Reconcile with Redis: remove calls that no longer exist, add calls that started during the gap. Emit corrective Socket.IO events to the frontend.

---

## Finding 7: No Graceful Degradation When FreeSWITCH/FusionPBX Is Unreachable

- **Severity:** High
- **Location:** Phase 04, entire phase + Phase 08, "Call Bar"
- **Flaw:** The plan treats FreeSWITCH as always-available. There is no design for what the CRM does when ESL connection cannot be established on startup, when FreeSWITCH is down for maintenance, or when the recording server (:8088) is unreachable. The frontend call bar, agent status, and click-to-call are all designed assuming the VoIP layer is operational.
- **Failure scenario:** FusionPBX reboots for an update (common with FusionPBX 5.x upgrades). ESL daemon enters reconnect loop. Agent clicks "Click to Call" — the request hits the API, which tries ESL originate on a dead connection. What happens? The plan says nothing. Does the API return a 503? Does it hang until timeout? Does the frontend show an error? Does the agent status selector still work (it depends on Redis, not ESL directly)? None of this is specified.
- **Evidence:** Phase 04: No error response defined for originate failure. Phase 08: Call bar design assumes active call state always exists. No "VoIP unavailable" UI state mentioned.
- **Suggested fix:** Add a VoIP health status to the backend (ESL connected: yes/no). Expose it in `/api/v1/health` and via Socket.IO. Frontend disables click-to-call when VoIP is down. Originate endpoint returns 503 with clear message. Agent status manual controls (ready/break/offline) must work independently of ESL.

---

## Finding 8: 30-Second Redis Cache on Dashboard Hides Data Scope Bug Until Production

- **Severity:** Medium
- **Location:** Phase 07, section "Dashboard overview endpoint" step 5
- **Flaw:** Dashboard data is cached in Redis for 30 seconds. But the cache key strategy is not defined. If the cache key is just `dashboard:overview`, then the first user to hit the endpoint (say, an admin) populates the cache with admin-scoped data (all agents, all calls). The next user (an agent or team leader) gets the cached admin-scoped response, bypassing RBAC data scoping entirely.
- **Failure scenario:** Manager hits dashboard at t=0, cache populated with all-company stats. At t=15s, an agent hits the same endpoint. Gets the manager's cached data showing stats for all 50 agents and all campaigns — a data scope violation. The agent sees total company call volume, other teams' agent statuses, and debt case counts they should not access.
- **Evidence:** Phase 07, Step 1.5: "Cache in Redis for 30s to avoid repeated aggregation." No mention of cache key incorporating user role, team ID, or user ID. Phase 02 defines data scope middleware that attaches `req.dataScope` — but if the response is served from cache before the service layer runs, the scope is never applied.
- **Suggested fix:** Cache key must include the data scope signature: `dashboard:overview:scope:{role}:{teamId}` at minimum. Or skip caching for the dashboard overview (30s is marginal benefit for an aggregate query that should be fast with proper indexes anyway).

---

## Finding 9: Excel Import "1000 Contacts in <10s" With No Backpressure or Transaction Strategy

- **Severity:** Medium
- **Location:** Phase 03, section "Success Criteria" + section "Import/Export service"
- **Flaw:** The plan claims "Import 1000 contacts from Excel < 10s" and describes "bulk upsert" but does not specify the actual database strategy. Prisma does not have native bulk upsert — `createMany` skips duplicates but cannot update existing records. True upsert requires individual `upsert` calls or raw SQL. 1000 individual Prisma upserts with validation, E.164 normalization, and audit logging per record will not complete in 10 seconds.
- **Failure scenario:** Developer implements 1000 sequential `prisma.contact.upsert()` calls. Each takes ~20ms (validation + DB round trip + audit log insert). Total: 20 seconds minimum, plus memory for the parsed xlsx buffer. If the process dies mid-import at record 500, there is no transaction — 500 contacts are created, 500 are not. The user sees "import failed" but has no idea which records made it. Re-importing creates duplicates (phone is not unique, remember).
- **Evidence:** Phase 03, Step 8.1: "validate rows, skip invalid with error report." No mention of transaction boundaries, batch size, or Prisma's `createMany` limitations around upsert. Success criteria: "Import 1000 contacts from Excel < 10s."
- **Suggested fix:** Use `prisma.$transaction` with batched operations (100 per batch). For true upsert, use `prisma.$executeRaw` with Postgres `INSERT ... ON CONFLICT DO UPDATE`. Define clear transaction boundaries: all-or-nothing per batch, with progress tracking. Adjust the 10s target or specify the hardware assumption.

---

## Finding 10: QA Annotations "Immutable After 24h" Has No Enforcement Mechanism Designed

- **Severity:** Medium
- **Location:** Phase 05, section "Security Considerations"
- **Flaw:** Phase 05 states "QA annotations immutable after 24h (prevent score tampering) — enforce via service logic." But the implementation steps (Section 5, "QA Annotation endpoints") define `PATCH /qa-annotations/:id` with no mention of the 24h check. The "immutability" is mentioned only in the security section, not in the actual implementation steps where the PATCH handler is designed. There is no `created_at` comparison logic described.
- **Failure scenario:** Developer implements the PATCH endpoint per the implementation steps, which say "update annotation" with no time restriction. The 24h rule lives only in a bullet point in the security section. It gets missed. QA scores remain editable forever. A QA supervisor edits annotations months later to inflate their team's quality scores, and there is no audit trail distinction between timely edits and late tampering.
- **Evidence:** Phase 05, Step 5.2: "PATCH /qa-annotations/:id — update annotation." Phase 05, Security: "QA annotations immutable after 24h." The implementation step has no conditional logic.
- **Suggested fix:** Move the 24h immutability rule into the implementation steps for the PATCH endpoint: "If annotation.created_at + 24h < now, return 403 with 'Annotation locked after 24 hours'." Add it to the Zod validation or service layer explicitly.

---

## Summary

| # | Finding | Severity | Phase |
|---|---------|----------|-------|
| 1 | PM2 cluster destroys ESL singleton + cron job | Critical | 04, 06, 09 |
| 2 | No token recovery flow on page refresh | Critical | 02, 08 |
| 3 | Phone-based contact matching ambiguous (non-unique phone) | High | 03, 04 |
| 4 | 5-day frontend estimate is unrealistic | High | 08 |
| 5 | Reminder job has no lock, undecided dedup, missing schema | High | 06, 01 |
| 6 | ESL reconnect loses in-flight state with no reconciliation | High | 04 |
| 7 | No graceful degradation when FreeSWITCH is down | High | 04, 08 |
| 8 | Dashboard Redis cache ignores RBAC data scope in key | Medium | 07 |
| 9 | Excel import lacks transaction strategy + upsert limitation | Medium | 03 |
| 10 | QA 24h immutability rule not in implementation steps | Medium | 05 |

**Critical findings (2)** must be resolved before implementation begins — they represent architectural contradictions that will cause rework.
**High findings (5)** should be addressed in planning, as they will surface as bugs in integration testing at best, or production incidents at worst.
**Medium findings (3)** can be addressed during implementation if explicitly tracked as known gaps.
