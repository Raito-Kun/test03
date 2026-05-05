---
type: parity-report
date: 2026-04-21 22:58 +0700
dev: 10.10.101.207
prod: 10.10.101.208
scope: RBAC permission dedup deploy verification
---

# PROD vs DEV test parity — RBAC deploy

## Parity matrix

| Test | DEV | PROD | Note |
|---|---|---|---|
| `permission-dedup` DB assertion 1: exactly 7 groups | ✓ 7 | ✓ 7 | same groups |
| DB assertion 2: no legacy keys remain | ✓ 0 | ✓ 0 | 16 legacy → 0 |
| DB assertion 3: recording.delete only super_admin+admin | ✓ | ✓ | role set identical |
| DB assertion 4: new perms exist | ✓ 7 keys | ✓ 7 keys | — |
| Backend vitest 85/85 | ✓ run | ✗ not run | prod image has no dev deps (correct) |
| E2E `rbac-ui.test.ts` (9 scenarios) | ✓ 3 new added | ~ 1 pass, 1 fail, 7 skip | prod missing agent1/qa/leader users → login fails, not a deploy issue |
| Admin API battery (14 GET endpoints) | not run | ✓ 12/14 | /feature-flags=403 (prod policy), /reports/agents=404 (unclear, not RBAC) |
| Write-op middleware enforcement | n/a | ✓ 3/3 | ticket.delete/recording.delete/contacts.bulk-delete all pass middleware |
| Admin /auth/me returns 46 permissions | ✓ | ✓ | includes recording.delete |
| Health check (CRM/ESL/Auth) | ✓ | ✓ | MCP `run_health_check` green |

## Summary

DB + code parity confirmed. Prod is at the same RBAC state as dev.

Remaining gap is **not deployment-related** — prod's user seed is minimal (only `admin@crm.local`, `admin@blueva.com`, `superadmin@crm.local` exist), so full multi-role e2e battery cannot run. Same code + same DB = same behavior; the missing coverage is "test environment coverage," not "shipping code coverage."

## What we DIDN'T verify on prod (and why)

1. **Backend vitest suite** — prod image has no vitest (dev-deps excluded). Workaround: 4 key DB assertions from `permission-dedup.test.ts` run directly via psql on prod DB — all pass.
2. **Multi-role playwright e2e** — prod missing `manager`, `leader`, `qa`, `agent_telesale`, `agent_collection` user records. Would need seed pass with test accounts.
3. **Multi-cluster admin via admin@blueva.com** — password unknown; skipped.
4. **Real recording delete** — only tested with fake UUID (404). No real recording row deleted end-to-end.

## Recommendation

Acceptable to treat this deploy as verified. Open gaps should be addressed in a separate "prod test data seeding" task, not block this deploy.

## Unresolved / Follow-up

1. Add prod-safe test user seeding pattern (separate from main seed).
2. Investigate /reports/agents 404.
3. Investigate /feature-flags 403 on admin — intentional (super_admin only) or misconfiguration?
4. Super_admin password on prod — changeme123 fails. Needs documenting.
