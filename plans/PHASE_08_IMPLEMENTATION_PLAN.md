# Phase 08 — Frontend UI Implementation Plan

**Status:** In-Progress (scaffolding complete, full implementation pending)
**Priority:** P1 — Blocks Phase 09 (testing/security)
**Effort:** 7 working days
**Deadline:** Critical path to MVP completion

---

## Quick Status Check

All backend APIs ready (Phases 01-07 completed). Frontend Vite scaffold complete. No blockers—ready to build UI immediately.

---

## Work Breakdown (Recommended Priority Order)

### TIER 1: Foundation (Day 1-2) — CRITICAL PATH
These must be done first; all other pages depend on them.

- [ ] API client (services/api-client.ts): Axios + JWT interceptor + auto-refresh on 401
- [ ] Auth store (Zustand): user state, login/logout, isAuthenticated
- [ ] Login page: email/password form → POST /auth/login
- [ ] Protected route wrapper: bootstrap token on page load, redirect to login if fail
- [ ] App layout skeleton: sidebar nav + header + outlet
- [ ] Vietnamese text constants (lib/vi-text.ts)
- [ ] Error code → Vietnamese mapping (lib/error-messages.ts)

**Expected:** Auth flow fully working. Any user can login with seed credentials (admin@crm.local / changeme123).

---

### TIER 2: Core Agent Pages (Day 2-4) — HIGH PRIORITY
Agent's main workflow—dashboard, contacts, calls, tickets.

- [ ] Dashboard page: call stats cards + agent status grid + lead/debt summary
- [ ] Contact list page: data table with search/filter, import button
- [ ] Contact detail page: tabs (info, tickets, calls, timeline)
- [ ] Reusable data table component (pagination, sort, filter, row actions)
- [ ] Call log list page: date range picker, disposition/agent/direction filters
- [ ] Call log detail page: info + audio player (HTML5 native)
- [ ] Ticket list page: status/priority/category filters
- [ ] Ticket create/edit modal: macro integration (text autofill)

**Expected:** Agent can view/search all data, create tickets, hear recordings.

---

### TIER 3: Supporting Pages (Day 4-5)
Required for full workflow, lower priority than TIER 1-2.

- [ ] Lead list + detail pages: status pipeline view, follow-up scheduler
- [ ] Debt case list + detail pages: tier/DPD summary, PTP modal
- [ ] Campaign list + basic detail page
- [ ] Settings page: profile view/edit, password change
- [ ] Reports pages: call report, telesale report, collection report (render from API)

---

### TIER 4: Real-Time & Polish (Day 5-7)
Higher complexity, lower immediate impact.

- [ ] Socket.IO integration: connect on login, handle call/agent status events
- [ ] Call bar (floating bottom): appear during active calls, hold/transfer/hangup buttons
- [ ] Notification bell: unread count badge, dropdown with recent notifications
- [ ] Inbound call popup: overlay when ringing (Socket.IO call:ringing)
- [ ] Agent status selector: dropdown in header (Ready/Break/Offline)
- [ ] Real-time agent status grid: auto-update via Socket.IO

---

## Critical Implementation Notes

### Token Bootstrap on Page Load (RED TEAM #7)
```
App.tsx:
1. On mount, call POST /auth/refresh (httpOnly cookie sent auto)
2. If success → store access token in memory, proceed to protected routes
3. If fail → redirect to /login
4. Show spinner while bootstrap in progress
```
**Why:** Handles page refresh (F5) without losing session.

### Audio Player (RED TEAM #15)
Use **native HTML5 `<audio>` element**—no custom waveform rendering in MVP.
```tsx
<audio controls>
  <source src={recordingUrl} type="audio/wav" />
</audio>
```
Add speed control dropdown (0.5x - 2x) via CSS + JavaScript wrapper.

### Error Handling
API errors: English codes + Vietnamese display via error mapping.
```tsx
const errorMap = {
  INVALID_CREDENTIALS: "Email hoặc mật khẩu không đúng",
  FORBIDDEN: "Bạn không có quyền truy cập",
  NOT_FOUND: "Không tìm thấy",
};
```

### Data Scope RBAC in UI
Don't bypass API—RBAC enforced server-side. UI just hides buttons user can't access.
```tsx
{/* Show edit/delete buttons only if user.role in ['admin', 'manager', 'leader'] */}
{hasEditPermission && <button>Sửa</button>}
```

---

## File Structure Reference

```
packages/frontend/src/
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx
│   │   ├── header.tsx
│   │   └── app-layout.tsx
│   ├── data-table.tsx
│   ├── audio-player.tsx
│   └── ...
├── pages/
│   ├── login.tsx
│   ├── dashboard.tsx
│   ├── contacts/
│   ├── leads/
│   ├── debt-cases/
│   ├── call-logs/
│   ├── tickets/
│   ├── campaigns/
│   ├── reports/
│   └── settings/
├── services/
│   ├── api-client.ts
│   ├── auth-api.ts
│   ├── contact-api.ts
│   └── ...
├── stores/
│   ├── auth-store.ts
│   ├── call-store.ts
│   └── ...
├── lib/
│   ├── vi-text.ts
│   ├── error-messages.ts
│   └── utils.ts
└── App.tsx
```

---

## Validation Checklist

Before marking Phase 08 complete:
- [ ] Login → valid JWT stored in memory + refresh cookie set
- [ ] F5 page reload → token bootstrapped, user auto-logged in
- [ ] Logout → tokens cleared, redirect to login
- [ ] Dashboard loads with real call stats from API
- [ ] Contact list queries API with filters
- [ ] Call log detail plays recording with seek/play/pause
- [ ] Ticket form includes macro selection + content autofill
- [ ] Socket.IO connection logs success (check browser console)
- [ ] Agent status changes reflected on dashboard (via Socket.IO)
- [ ] Notification bell shows unread count + new notifications in real-time

---

## Known Constraints

- **No embedded WebRTC softphone:** Agents use external SIP client
- **No import/export Excel:** Phase 2 feature
- **No custom waveform rendering:** Use native HTML5 audio only
- **Light theme only:** No dark mode in Phase 1
- **Vietnamese UI only:** No i18n framework

---

## URGENT: Completion Is Critical

**Phase 08 blocks Phase 09 (testing/security).** Phase 09 is short but essential for MVP readiness. Complete Phase 08 on time to keep overall schedule.

**Once Phase 08 done:** Team can immediately start Phase 09 integration tests + deployment prep.

---

## API Ready Status

✅ All backend endpoints implemented and tested
✅ JWT auth + RBAC + data scope active
✅ WebSocket (Socket.IO) ready for real-time features
✅ Database seeded with test data
✅ Middleware (CORS, rate limit, error handling) in place

**Frontend can build against live API with confidence.**

