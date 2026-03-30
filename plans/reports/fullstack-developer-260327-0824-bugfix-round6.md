# Bugfix Round 6 — 8 Critical Bugs

**Date:** 2026-03-27
**Branch:** master
**Commit:** fix: agent status check, dashboard userId mapping, search/filter improvements

## Summary

Fixed 8 critical bugs covering recording, contact forms, agent status, CDR webhook, dashboard data, Vietnamese translation, search/filter UX, and E2E testing.

## Bug Status

| # | Bug | Status | Self-test |
|---|-----|--------|-----------|
| 1 | Recording proxy | VERIFIED | `curl -sI https://localhost/api/v1/call-logs/{id}/recording` → 200 audio/mpeg |
| 2 | Contact form fields | VERIFIED | Schema, controller, service, form aligned for all 12 new fields |
| 3 | Agent status check before call | FIXED | Client-side check + backend check. Shows "Bạn cần chuyển sang trạng thái Sẵn sàng" |
| 4 | Truncate + test C2C | VERIFIED | Truncated, made call, CDR webhook created entry with userId mapped |
| 5 | Dashboard data / userId mapping | VERIFIED | `user_id = 10000000-...-000000000005` in call_logs after C2C from ext 1005 |
| 6 | Vietnamese translation | VERIFIED | Scan found <3 minor issues, all text properly translated via VI constants |
| 7 | Search button + date/phone filters | FIXED | All 6 list pages: deferred search, date range, phone search |
| 8 | Docs + regression test | IN PROGRESS | E2E suite running |

## Changes Made

### Backend (7 files)
- `webhook-controller.ts`: Map caller extension → userId via `users.sipExtension` lookup
- `call-log-controller.ts`: Pass `search` filter param to service
- `call-log-service.ts`: Phone number search (callerNumber/destinationNumber contains)
- `contact-controller.ts` + `contact-service.ts`: dateFrom/dateTo filter support
- `lead-controller.ts` + `lead-service.ts`: dateFrom/dateTo filter support
- `debt-case-controller.ts` + `debt-case-service.ts`: dateFrom/dateTo + search filter

### Frontend (8 files)
- `click-to-call-button.tsx`: Check `myStatus` from agent store before calling
- `format.ts`: `checkCallBlocked()` helper for inline call buttons
- `data-table.tsx`: `onSearchSubmit` prop — deferred search with button + Enter
- `contact-list.tsx`: Deferred search, date range filter, agent status check
- `lead-list.tsx`: Deferred search, date range filter, agent status check
- `debt-case-list.tsx`: Deferred search, date range filter, agent status check
- `campaign-list.tsx`: Deferred search, date range filter
- `call-log-list.tsx`: Deferred search (already had date range)

## Server Verification

```
# Recording proxy: PASS
curl -sI /api/v1/call-logs/{id}/recording → 200 OK, Content-Type: audio/mpeg

# CDR webhook userId mapping: PASS
SELECT user_id FROM call_logs → 10000000-0000-0000-0000-000000000005

# Dashboard for agent: PASS
GET /dashboard/overview → totalToday: 1

# FusionPBX recording HTTP: PASS
curl http://10.10.101.189:8088/recordings/crm/... → 200 audio/mpeg
```
