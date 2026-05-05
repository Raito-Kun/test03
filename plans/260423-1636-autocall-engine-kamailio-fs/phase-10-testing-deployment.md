---
phase: 10
title: "Testing + deployment + load test"
size: L
status: pending
---

# Phase 10 — Testing, Deployment, Load Test

## Context
- Rules: `.claude/skills/crm-test/SKILL.md`, `.claude/skills/crm-deploy/SKILL.md`

## Overview
- Priority: P2 (gate to user-acceptance)
- Status: pending
- Three tracks. (1) Automated tests (unit + integration + e2e). (2) Dev deployment to CRM dev host. (3) Load test ramp 10 → 100 → 300 CCU with mock trunk. Prod deploy only on explicit user approval.

## Key Insights
- Load test with real carrier would rack up charges + blow trunk CPS. Use mock SIP trunk (FreeSWITCH "echo test" endpoint on separate VM, or `sipp` generating carrier-side INVITE responses).
- Do not enable feature flag globally — only on one test cluster until load test passes.
- `feedback_prod_deployment_rule`: never deploy to prod without "Deploy to Server PROD".

## Requirements
**Functional test coverage**
- Unit: compliance rules, pacing, phone normalization, state machine.
- Integration: CDR webhook routing (both cluster types), originate happy path with mock ESL, disposition submit.
- E2E (Playwright): super admin creates campaign + uploads leads + enables it → 2 test agents (softphone registered to dev Kamailio) → scheduler dials → agents answer via MicroSIP → disposition submit → call row appears with correct result.

**Load test**
- Ramp: 10 CCU (5 min) → 50 CCU (10 min) → 100 CCU (10 min) → 200 CCU (10 min) → 300 CCU (15 min).
- Metrics: answer rate, avg bridge latency, abandoned rate, FS CPU, Kamailio CPU, recording disk writes/s, webhook POST rate to CRM.
- Pass: <1% failed originates, <2s p95 bridge latency, FS/Kamailio CPU <70%, zero unhandled exceptions in CRM logs.

## Architecture

```
packages/backend/tests/
├── autocall-compliance.test.ts      # phase 04
├── autocall-pacing.test.ts          # phase 05
├── autocall-state-machine.test.ts   # phase 05
├── autocall-cdr.test.ts             # phase 06
└── autocall-originate-flow.test.ts  # end-to-end with mock ESL

packages/frontend/tests/e2e/
└── autocall-flow.spec.ts

load/
├── sipp-scenario-carrier-mock.xml
├── ramp.sh                          # orchestrates CCU ramp
└── report-template.md
```

## Related Code Files
**Create**: test + load files above.

**Modify**: `ecosystem.config.js` (PM2) — **already modified in phase-03** to add `crm-autocall-engine` as 2nd app (decision #6). Phase-10 just validates deploy flow.

## Implementation Steps
1. Unit tests for every phase 04/05/06 module.
2. Integration tests using dev DB + mocked ESL pool.
3. Playwright E2E script — headless where possible; MicroSIP session via CLI or test softphone (or simulate via second sipp).
4. Provision 4th VM as carrier mock (sipp + answer script + simulated durations).
5. Write `ramp.sh` scheduling target CCU via sipp + orchestrating FS originate rates.
6. Run ramp; capture metrics (Prometheus if available, or log scraping).
7. Tune: if FS CPU hits 70% at 150 CCU, revisit codec/recording (mp3 is lighter than wav; confirm).
8. Write `report-template.md` with pass/fail verdict + graphs.
9. Dev deploy: build both packages (`npm run build -w packages/backend && npm run build -w packages/autocall-engine`), push, run migration on dev DB, `pm2 reload ecosystem.config.js` (starts both apps or reloads changes). Enable flag for one dev cluster, smoke test both apps:
   - `pm2 list` shows `crm-backend` + `crm-autocall-engine` both `online`.
   - `pm2 logs crm-autocall-engine --lines 50` shows ESL connected + Redis subscribed.
   - `pm2 reload crm-autocall-engine` alone should NOT bounce `crm-backend` (verify PID unchanged).
10. Prod deploy (GATED): only on user saying "Deploy to Server PROD". Cluster-level flag OFF until explicitly enabled per tenant. Same two-app reload pattern.

## Todo List
- [ ] Unit tests (compliance, pacing, state, phone, **callback-bypass-cooldown**)
- [ ] Integration tests (CDR routing, originate mock, **kamailio.subscriber sync on perm grant/revoke**, **Redis pub/sub between backend↔engine**)
- [ ] E2E Playwright (happy path incl agent SIP creds regenerate + MicroSIP register)
- [ ] E2E (DNC block, out-of-window, max attempts, callback override)
- [ ] Stereo recording check: decode a sample recording; verify 2 channels, agent audio on L, customer on R
- [ ] Carrier mock VM + sipp scenario
- [ ] ramp.sh
- [ ] Load test 10→300 CCU (monitor BOTH PM2 apps — backend + engine)
- [ ] Metrics captured + report
- [ ] Dev deploy smoke test (two-app pattern, isolated reload verified)
- [ ] Prod runbook + rollback script (rollback engine ≠ rollback backend)
- [ ] Update `Current status/status.md` per session-boot rule
- [ ] Update `docs/project-changelog.md`

## Success Criteria
- All tests green.
- Load test pass criteria met.
- Dev smoke: 5 test leads dial through end-to-end with recording + CDR + report data.
- Runbook doc ready for prod rollout.

## Risk Assessment
| Risk | Mitigation |
|---|---|
| Load test reveals bottleneck at 200 CCU | Scale plan: add 3rd FS node (dispatcher already supports) |
| Recording disk fills mid-test | Cleanup cron + alert at 70% |
| MicroSIP test not reproducible | Document exact version + config; consider Linphone CLI as alternative |
| Prod rollback not tested | Migration reversal script dry-run on dev snapshot |

## Security
- Rotate ESL passwords before first prod enable.
- Verify Kamailio `subscriber` table uses hashed `ha1` not plaintext.
- Firewall: close 8021/ESL to everything except CRM backend IP.

## Next Steps
Post-release: capture first-week metrics, identify Predictive readiness (abandoned rate + occupancy).
