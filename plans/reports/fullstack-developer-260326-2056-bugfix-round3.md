# Phase Implementation Report

## Executed Phase
- Phase: bugfix-round3
- Plan: none (ad-hoc)
- Status: completed

## Files Modified

| File | Change |
|---|---|
| `packages/backend/src/routes/template-routes.ts` | Rewritten — generate CSV on-the-fly, removed fs/path deps |
| `packages/backend/src/services/dashboard-service.ts` | UTC+7 today window, distinct call_uuid via groupBy, userId in cache key |
| `packages/backend/src/controllers/dashboard-controller.ts` | Pass `userId` to `getOverview()` |
| `packages/backend/src/services/esl-service.ts` | Added agent status (ready) + extension registration checks before originate; removed unused prisma import and stale uuid variable |
| `packages/backend/src/controllers/call-controller.ts` | Pass `userId` to `originate()`; handle AGENT_NOT_READY / EXT_NOT_REGISTERED with HTTP 409 |
| `packages/frontend/src/components/click-to-call-button.tsx` | Show specific Vietnamese error messages for AGENT_NOT_READY / EXT_NOT_REGISTERED / no SIP extension |

## Files Deleted
- `packages/backend/src/templates/contacts-template.csv`
- `packages/backend/src/templates/leads-template.csv`
- `packages/backend/src/templates/campaigns-template.csv`
- `packages/backend/src/templates/debt-cases-template.csv`

## Tasks Completed

- [x] Bug 1: CSV template generated on-the-fly (header + example row), no static files needed
- [x] Bug 2: Recording proxy verified working — nginx on FusionPBX returns 200 for actual files (403 was directory listing, expected). No code change needed.
- [x] Bug 3: Dashboard stats use UTC+7 midnight for day boundary; distinct call_uuid via `prisma.callLog.groupBy({ by: ['callUuid'] })` eliminates A/B leg duplicates
- [x] Bug 4: Role-based scope already handled by `buildScopeWhere(dataScope)` — agent scoped to own `userId`, leader to `teamId`, admin/manager/qa see all. Cache key now includes `userId` to isolate per-agent cache.
- [x] Bug 5: `originate()` checks `getAgentStatus(userId).status === 'ready'` (Redis-backed, fast); throws `AGENT_NOT_READY`; frontend shows Vietnamese toast
- [x] Bug 6: `originate()` calls `getSofiaRegistrations()` and checks extension before dialing; throws `EXT_NOT_REGISTERED`; frontend shows specific error message
- [x] Bug 7: Both `packages/backend` and `packages/frontend` TypeScript compile with zero errors

## Tests Status
- Type check backend: PASS (0 errors)
- Type check frontend: PASS (0 errors)
- Unit tests: not run (no test runner configured for quick run)

## Issues Encountered

- AgentStatus enum uses `ready` not `available` — matched correctly from schema.
- `hangup()` had a dead `uuid` variable from previous revision — removed.
- nginx 403 on directory listing is expected (`autoindex off`); actual file access returns 200.

## Next Steps

- Consider adding a frontend status indicator on ClickToCallButton (disabled/greyed if agent not ready)
- Dashboard cache TTL is 30s — with per-user cache keys, Redis key count scales with active users; acceptable for current scale

## Unresolved Questions

None.
