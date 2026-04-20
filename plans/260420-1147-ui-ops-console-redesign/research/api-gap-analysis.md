# API Gap Analysis — Ops Console Mockup

Maps every widget in the mockup to an existing backend endpoint. Flags gaps and proposes resolution: **mock** (realistic fake data in FE) or **defer** (backend phase later).

## Matrix

| # | Widget (mockup) | Existing API | Status | Resolution |
|---|---|---|---|---|
| 1 | Top bar: user / cluster / agent status | `/auth/me`, `/cluster/active`, `/agent-status/*` | OK | reuse |
| 2 | Top bar: ⌘K global search | `/ai/search` (AiSearchBar) | OK | reuse |
| 3 | Top bar: AI Assist panel | `/ai/*` | OK | reuse |
| 4 | Top bar: "Gọi nhanh" quick-dial | `POST /calls/originate` | OK | reuse via `ClickToCallButton` |
| 5 | Sidebar: nav item counts (e.g. "1.240") | **none** — lists exist but no count header | GAP | **defer**; hide counts in v1, add `GET /dashboard/nav-counts` later |
| 6 | KPI cards (6): total/answered/missed/on-call/avg-duration/uptime | `GET /dashboard/overview` returns first 5 | PARTIAL | `uptime` missing → **mock** constant `99.97%` (health endpoint future) |
| 7 | KPI sparklines | **none** | GAP | **mock** client-side: derive from last 7 refetches of overview (in-memory buffer) |
| 8 | KPI deltas "+12.4% vs HÔM QUA" | **none** | GAP | **defer**; UI shows `—`. Backend: `GET /dashboard/overview?compare=yesterday` (follow-up) |
| 9 | Rate cards (4): liên hệ / chốt / PTP / thu hồi | `/dashboard/overview` → `answerRatePercent`, `closeRatePercent`, `ptpRatePercent`, `recoveryRatePercent` | OK | reuse |
| 10 | Session code header ("SESS-XXXXX") | **none** | GAP | **mock** client-side using `crypto.randomUUID().slice(0,5).toUpperCase()` on mount |
| 11 | LIVE / REFRESH / EXPORT / THÊM buttons | REFRESH = refetch, EXPORT = `/export/*`, THÊM = nav | OK | reuse |
| 12 | Hoạt động hệ thống (live log) | Socket.IO events (call-update, agent-status, ticket-created, etc.) | OK | reuse — subscribe and buffer last 50 events to in-memory ring; no new API |
| 13 | Trạng thái agents (table) | `GET /dashboard/agents` + socket | OK | reuse, restyle |
| 14 | Gọi nhanh eyebeam dialer | `POST /calls/originate` + existing SIP.js store | OK | cosmetic wrapper over `ClickToCallButton`; no backend change |
| 15 | 24h call volume heatmap | **none** | GAP | **defer** primary; **mock** fallback. Proposed contract (follow-up phase):<br>`GET /dashboard/call-volume-24h`<br>Response: `{ data: Array<{ hour: 0..23, total: number, answered: number, missed: number }> }`<br>Scope: current cluster + user's data scope<br>Source: aggregate `CallLog` by `startedAt` bucket |
| 16 | Bottom status bar: SYS/CPU/LAT/QUEUE/RX-TX/PBX/PAGE/BUILD/TZ/LOCAL | **none** for CPU/LAT/QUEUE/RX/TX | GAP | **mock** most; real values where cheap:<br>• `BUILD` = `import.meta.env.VITE_BUILD_ID` (already injected)<br>• `TZ` / `LOCAL` = `Intl.DateTimeFormat().resolvedOptions()`<br>• `PAGE` = `useLocation().pathname`<br>• `PBX` = derive from `/pbx/registration-status` (already exists)<br>• `SYS ONLINE` = Socket.IO connection state<br>• `CPU` / `LAT` / `QUEUE` / `RX/TX` = **mock** oscillating values; real values require host metrics endpoint (**defer**) |

## Summary

| Resolution | Count | Notes |
|---|---|---|
| Reuse existing API | 8 | No change |
| Mock client-side | 6 | Sparklines, session code, uptime, CPU/LAT/QUEUE/RX-TX, heatmap-fallback, nav counts (hidden) |
| Defer to backend follow-up | 3 | KPI deltas, 24h heatmap, nav counts |

## Proposed follow-up backend phase (post-redesign)

Single small PR, 4 new endpoints, all read-only:

1. `GET /dashboard/overview?compare=yesterday` — add optional `compareTo` query, return diff % on each metric
2. `GET /dashboard/call-volume-24h` — hourly aggregation (see contract above)
3. `GET /dashboard/nav-counts` — `{ contacts, leads, debtCases, tickets, campaigns, callLogs }`
4. `GET /system/health` — `{ uptimeSeconds, pbxReachable, esLatencyMs, queueDepth }` for status bar

All endpoints: authMiddleware + applyDataScope; no new controllers needed beyond `dashboard-controller.ts` extension.

## Unresolved questions

- Sparkline window: last 7 refetches (3.5 min @ 30s) or persist 24h in localStorage?
- Nav counts: show `0` during v1 or hide entirely? (Plan: hide to avoid misleading UX)
- Status bar CPU/LAT mocks: acceptable permanently, or block phase-05 approval on real backend?
