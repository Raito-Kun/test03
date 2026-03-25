---
phase: 09
title: "Integration Testing & Security Hardening"
status: completed
priority: P1
effort: 3d
depends_on: [08]
notes: "Completed 2026-03-25"
---

# Phase 09 — Integration Testing & Security Hardening

## Context Links
- [PRD](../../Guildline/PRD.md) — Section 5.1 (Security), Section 10 (NFRs)
- [Plan Overview](./plan.md)

## Overview
End-to-end testing of all flows, security hardening (CORS, helmet, rate limiting verification), Docker Compose production config, PM2 process management, Winston logging review. Final checklist before deployment.

## Key Insights
- Phase 1 DoD: click-to-call works, CDR received, recordings play, tickets work, dashboard shows data
- Security: CORS whitelist, rate limiting, webhook IP whitelist + Basic Auth, input validation, HTTPS
- Testing: focus on integration tests (API level), not unit tests for every function (YAGNI for MVP)
- Docker Compose: add CRM backend/frontend as services alongside postgres/redis

## Requirements
**Functional:**
- All API endpoints tested with correct RBAC
- Click-to-call end-to-end flow verified
- CDR webhook processing verified
- Recording playback verified
- Frontend flows: login → navigate → call → disposition → ticket

**Non-functional:**
- CORS blocks unauthorized origins
- Rate limiting enforced
- Webhook rejects unauthorized IPs/credentials
- No sensitive data in logs
- Error responses don't leak stack traces in production

## Related Code Files
**Create:**
- `packages/backend/src/middleware/error-handler.ts` (review/harden)
- `packages/backend/src/middleware/cors-config.ts`
- `packages/backend/src/middleware/security-headers.ts`
- `packages/backend/tests/` — integration test files
- `docker-compose.prod.yml`
- `packages/backend/ecosystem.config.js` (PM2)
- `packages/backend/Dockerfile`
- `packages/frontend/Dockerfile`
- `packages/frontend/nginx.conf` (serve static + proxy API)

## Implementation Steps

### 1. Security hardening
1. **CORS**: whitelist frontend domain only, configurable via env. **[RED TEAM #6]** Configure `app.set('trust proxy', 1)` — trust only one Nginx hop for correct `req.ip` resolution.
2. **Helmet**: default security headers + HSTS in production
3. **Rate limiting verification**: confirm 60/min global, 10/min login, 10/min click-to-call
4. **Error handler**: production mode returns generic error message, no stack traces
5. **Input validation**: verify all endpoints have Zod validation
6. **SQL injection**: verify Prisma parameterized queries (no raw SQL)
7. **Webhook security**: verify IP whitelist + Basic Auth on /webhooks/cdr
8. **Password hashing**: verify bcrypt salt rounds = 12
9. **JWT rotation**: verify refresh token invalidation on use

### 2. Logging review
1. Winston config: file + console transports, log levels (error, warn, info, debug)
2. Request logging: method, path, status, duration (no body logging in production)
3. Error logging: full stack trace to file, sanitized response to client
4. Audit log: verify all CUD operations logged
5. Sensitive data: ensure passwords, tokens, ESL password never logged

### 3. Integration tests (backend)
1. Test framework: Vitest (fast, TypeScript native)
2. Test database: separate test DB, migrations applied before tests
3. Test categories:
   - Auth flow: login, refresh, logout, expired token
   - RBAC: admin can create users, agent cannot
   - Data scope: agent sees own, leader sees team, manager sees all
   - **[RED TEAM #8]** IDOR tests: agent A cannot GET/PATCH/DELETE agent B's contacts/leads/debt_cases/tickets by ID
   - Contact CRUD: create, read, update, delete, import, export
   - Lead CRUD + status transitions
   - Debt Case CRUD + PTP
   - Call log retrieval + disposition
   - Ticket CRUD + notification creation
   - Webhook CDR processing
   - Rate limiting
4. Each test file: ~50-100 lines, focused on one endpoint group
5. Test helpers: createTestUser, generateTestToken, cleanupTestData

### 4. Docker production setup
<!-- Updated: Validation Session 2 - Separate servers, private network to FusionPBX -->
1. `packages/backend/Dockerfile` — multi-stage: build TS → run compiled JS
2. `packages/frontend/Dockerfile` — multi-stage: build Vite → serve with Nginx
3. `packages/frontend/nginx.conf` — serve static files, proxy /api to backend
4. `docker-compose.prod.yml` (CRM server only — FusionPBX runs on separate server):
   - postgres:15 with volume
   - redis:7
   - backend (Node.js) — connects to FusionPBX ESL via private network IP
   - frontend (Nginx)
   - Network: internal (postgres, redis) + external (frontend, backend)
5. Environment: `.env.production` template — ESL_HOST points to FusionPBX private IP
6. Nginx config: proxy recording requests to FusionPBX private IP:8088

### 5. PM2 configuration
1. **[RED TEAM #1 — CRITICAL]** `ecosystem.config.js`: **fork mode (1 instance)**, NOT cluster mode. ESL daemon is a singleton (one connection to FreeSWITCH). Socket.IO requires sticky sessions. Reminder cron job would duplicate across workers. Cluster mode breaks all three.
2. Auto-restart on crash
3. Log rotation
4. Memory limit restart (512MB)
5. If horizontal scaling is needed later: extract ESL daemon + cron into a separate worker process, use Redis adapter for Socket.IO, then cluster the HTTP-only process.

### 6. End-to-end verification
1. Spin up full stack via Docker Compose
2. Login as admin → create users, teams, disposition codes
3. Login as agent → view contacts, click-to-call (mock ESL if no FreeSWITCH available)
4. Verify CDR webhook → call_logs populated
5. Verify recording playback
6. Create ticket linked to contact + call
7. Dashboard shows stats
8. Notifications appear for follow-up reminders

## Todo List
- [x] Security middleware review (CORS, helmet, rate limiting)
- [x] Error handler hardening (no stack traces in prod)
- [x] Logging setup (Winston, audit, no sensitive data)
- [x] Integration test setup (Vitest, test DB)
- [x] Auth flow tests
- [x] RBAC + data scope tests
- [x] CRUD endpoint tests (contacts, leads, debt cases, tickets)
- [x] Webhook CDR test
- [x] Docker production files (backend, frontend, compose)
- [x] PM2 config
- [x] End-to-end smoke test

## Success Criteria
- All integration tests pass
- Security headers present (check with curl)
- Rate limiting blocks after threshold
- Webhook rejects unauthorized requests
- Docker Compose builds and runs full stack
- E2E flow: login → call → disposition → ticket → dashboard — all work

## Risk Assessment
- ESL integration test without real FreeSWITCH: mock modesl for unit tests, mark ESL tests as integration-only
- Docker build time: multi-stage builds keep images small, use .dockerignore

## Security Considerations
- Production .env not committed to git
- Docker images don't contain .env or node_modules dev dependencies
- Nginx frontend serves HTTPS (cert via reverse proxy in production)
- Database only accessible within Docker internal network
