# Diagnostic Report: Recording Playback + Dashboard Stats
Date: 2026-03-26 | Debugger: ae04359b00a68792e

---

## Executive Summary

| Bug | Root Cause | Severity |
|-----|-----------|----------|
| Recordings not playing | `recording-service.ts` sends full filesystem path as URL segment (double-path 404) | High |
| Dashboard stats show 0 | Frontend `OverviewData` field names don't match API response shape; agents widget also broken | High |

Both bugs require **source code changes** to `packages/backend` and `packages/frontend`. No server config changes needed — nginx on 10.10.101.189:8088 is correctly configured and reachable from 10.10.101.207.

---

## Bug 1: Recordings Not Playing

### Evidence

Nginx error log on 10.10.101.189:
```
open() "/var/lib/freeswitch/recordings/var/lib/freeswitch/recordings/crm/archive/2026/Mar/26/1005_...mp3"
failed (2: No such file or directory)
request: "GET /recordings/%2Fvar%2Flib%2Ffreeswitch%2Frecordings%2Fcrm%2F...mp3"
```

Direct URL test from 10.10.101.207:
- `http://10.10.101.189:8088/recordings/crm/archive/2026/Mar/26/FILE.mp3` → **200 OK** ✓
- `http://10.10.101.189:8088/recordings/%2Fvar%2Flib%...` → **404** ✗

DB recording_path value:
```
/var/lib/freeswitch/recordings/crm/archive/2026/Mar/26/1005_0901239894_26-03-2026_17:28:26.mp3
```

### Root Cause

`recording-service.ts` line 50:
```ts
const safePath = recordingPath.split('/').map((seg) => encodeURIComponent(seg)).join('/');
const fileUrl = `${baseUrl}/${safePath}`;
```

`recordingPath` starts with `/`, so `split('/')` produces `['', 'var', 'lib', ...]`. The empty first segment plus the leading `/` in join reconstructs the full path as encoded segments. The resulting URL is:

```
http://10.10.101.189:8088/recordings//var/lib/freeswitch/recordings/crm/...
```

Since `FUSIONPBX_RECORDING_URL=http://10.10.101.189:8088/recordings` and nginx serves `/recordings/` aliased to `/var/lib/freeswitch/recordings/`, the correct relative path must be just `crm/archive/2026/Mar/26/FILE.mp3` (stripping `/var/lib/freeswitch/recordings/` prefix).

### Required Code Fix

File: `packages/backend/src/services/recording-service.ts`

Replace lines 49–51:
```ts
// Encode each path segment individually — don't encode '/' separators
const safePath = recordingPath.split('/').map((seg) => encodeURIComponent(seg)).join('/');
const fileUrl = `${baseUrl}/${safePath}`;
```

With:
```ts
// Strip the filesystem root that nginx serves; keep only the relative path
const RECORDING_FS_ROOT = '/var/lib/freeswitch/recordings/';
const relativePath = recordingPath.startsWith(RECORDING_FS_ROOT)
  ? recordingPath.slice(RECORDING_FS_ROOT.length)
  : recordingPath.replace(/^\/+/, '');
// Encode each path segment individually — don't encode '/' separators
const safePath = relativePath.split('/').map((seg) => encodeURIComponent(seg)).join('/');
const fileUrl = `${baseUrl}/${safePath}`;
```

This builds: `http://10.10.101.189:8088/recordings/crm/archive/2026/Mar/26/FILE.mp3` → **200 OK** confirmed.

**Optionally** make the root configurable via env var `FUSIONPBX_RECORDING_FS_ROOT=/var/lib/freeswitch/recordings/`.

---

## Bug 2: Dashboard Stats Always 0

### Evidence

API response from `GET /api/v1/dashboard/overview`:
```json
{
  "calls": { "totalToday": 99, "answeredToday": 54, "answerRatePercent": 55 },
  "agents": { "total": 7, "onCall": 0 },
  "leads": { "newToday": 0 },
  "tickets": { "open": 0 },
  "debtCases": { "active": 0 }
}
```

Frontend `OverviewData` interface (dashboard.tsx line 15–23):
```ts
interface OverviewData {
  totalCalls: number;    // ← doesn't exist in response
  answered: number;      // ← doesn't exist
  missed: number;        // ← doesn't exist
  avgDuration: number;   // ← doesn't exist
  activeCalls: number;   // ← doesn't exist
  leadsByStatus?: Record<string, number>;   // ← doesn't exist
  debtsByTier?: Record<string, number>;     // ← doesn't exist
}
```

All stat cards read `overview?.[key] ?? 0` — since none of the keys match, all display 0.

API response from `GET /api/v1/dashboard/agents` (one item):
```json
{
  "id": "...", "fullName": "Super Admin",
  "currentStatus": { "userId": "...", "status": "ready", "updatedAt": "2026-03-26T09:35:39.626Z" }
}
```

Frontend `AgentStatus` interface expects: `{ userId, fullName, status, changedAt }` — all mismatched.

### Root Cause

Frontend and backend types diverged. The backend `dashboard-service.ts` returns a nested structure; the frontend was written expecting a flat structure from an earlier or different API contract.

### Required Code Fix

**Option A (preferred — fix frontend to match API):**

File: `packages/frontend/src/pages/dashboard.tsx`

1. Replace `OverviewData` interface:
```ts
interface OverviewData {
  calls: { totalToday: number; answeredToday: number; answerRatePercent: number };
  agents: { total: number; onCall: number };
  leads: { newToday: number };
  tickets: { open: number };
  debtCases: { active: number };
}
```

2. Update `STAT_CARDS` keys and rendering to use nested paths:
```ts
// Replace key-based lookup with explicit accessors in the card render:
overview?.calls.totalToday ?? 0
overview?.calls.answeredToday ?? 0
// "missed" = totalToday - answeredToday (not in API, derive it)
(overview?.calls.totalToday ?? 0) - (overview?.calls.answeredToday ?? 0)
// "activeCalls" = agents.onCall
overview?.agents.onCall ?? 0
```

3. Replace `AgentStatus` interface:
```ts
interface AgentStatus {
  id: string;
  fullName: string;
  currentStatus: { userId: string; status: string; updatedAt: string };
}
```

4. Fix agent card rendering: `agent.currentStatus.status` instead of `agent.status`, `agent.currentStatus.updatedAt` instead of `agent.changedAt`, `agent.id` instead of `agent.userId`.

5. Remove `avgDuration` stat card (not in API) or add it to backend.

**Option B — fix backend to match frontend's expected flat structure:**

Update `dashboard-service.ts` `getOverview()` to return:
```ts
{
  totalCalls: totalCallsToday,
  answered: answeredCallsToday,
  missed: totalCallsToday - answeredCallsToday,
  avgDuration: 0,  // add avg duration query
  activeCalls: onCallCount,
  leadsByStatus: {},  // add leads-by-status aggregation
  debtsByTier: {},    // add debts-by-tier aggregation
}
```

Option A is simpler — frontend change only, no new DB queries needed.

---

## Timezone Note (Bug 2 — not the root cause but relevant)

Container TZ=Asia/Ho_Chi_Minh. `new Date()` in Node returns UTC. `new Date(y, m, d)` is LOCAL time, so with TZ=Asia/Ho_Chi_Minh, `dayStart` = `2026-03-25T17:00:00.000Z` (UTC). This is correct behavior — today's boundary in ICT (+07:00) is indeed 17:00 UTC previous day. The data is filtered correctly (99 of 113 rows fall today ICT). This is **not** causing the 0 stats — the mismatch is purely the field name divergence.

---

## Unresolved Questions

1. `avgDuration` — backend doesn't compute it; frontend shows it. Should backend add it to the response, or should the frontend remove that card?
2. `leadsByStatus` / `debtsByTier` — backend doesn't return these; the pie/bar charts silently show "no data". Intentional?
3. `missed` calls — backend has no `missed` field; frontend derives it from total - answered but that's inaccurate (unanswered ≠ missed). Should FreeSwitch CDR populate a `disposition` field instead?
4. Should `FUSIONPBX_RECORDING_FS_ROOT` be added as a configurable env var rather than hardcoded string in recording-service.ts?
