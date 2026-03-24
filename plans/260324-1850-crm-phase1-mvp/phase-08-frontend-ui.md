---
phase: 08
title: "Frontend UI"
status: in-progress
priority: P1
effort: 7d
depends_on: [02, 03, 04, 05, 06, 07]
---

# Phase 08 — Frontend UI

## Context Links
- [PRD](../../Guildline/PRD.md) — Section 7 (Wireframe), all feature sections
- [Plan Overview](./plan.md)

## Overview
<!-- Updated: Validation Session 2 - Incremental build, Vietnamese UI, by-layer dev split -->
Complete React SPA: login, sidebar layout, agent workspace, all CRUD screens, call bar, real-time updates. Uses shadcn/ui components, Tailwind CSS, React Query for data fetching, Zustand for client state, Socket.IO for real-time.

**Build Strategy:** Incremental — UI pages built as each backend phase completes (not all-at-once after backend).
**UI Language:** Vietnamese — all labels, menus, messages, placeholders in Vietnamese. No i18n framework.
**Error Handling:** API returns English error codes. Frontend maps codes to Vietnamese display text via error mapping utility.

**Current Status:** Basic scaffolding done (Vite + React + Tailwind + shadcn setup, placeholder App.tsx). Full page implementation PENDING.

## Key Insights
- Agent workspace = single page, no navigation during calls
- Call Bar fixed at bottom, visible only during active call
- Sidebar navigation: Dashboard, Contacts, Leads, Debt Cases, Call Logs, Campaigns, Tickets, Reports, Settings
- Data tables with pagination, filtering, sorting (reusable component)
- Audio player for recordings: waveform, play/pause, seek, speed control (0.5x-2x)
- Socket.IO handles: call events, agent status updates, notifications

## Requirements
**Functional:**
- Login page with JWT auth
- Layout: sidebar + header + main content
- Dashboard page with overview stats + agent status grid
- Contacts: list (data table), detail (tabs: info, tickets, calls, timeline), create/edit modal
- Leads: list + pipeline view, detail, create/edit
- Debt Cases: list, detail, PTP modal
- Call Logs: list with filters, detail with audio player + disposition + QA
- Campaigns: list, detail (basic for Phase 1)
- Tickets: list, create/edit with macro integration
- Call Bar: floating bottom bar during calls (hold, mute, transfer, hangup, disposition, script)
- Agent status selector in header
- Notification bell with dropdown (unread count badge)
- Settings: basic profile, password change

**Non-functional:**
- Responsive (desktop-first, works on tablet)
- First load < 3s
- Accessible (keyboard nav, ARIA labels)

## Architecture

```
src/
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx
│   │   ├── header.tsx
│   │   ├── app-layout.tsx
│   │   └── call-bar.tsx
│   ├── ui/               # shadcn/ui components
│   ├── data-table/        # reusable data table with pagination/filter/sort
│   ├── audio-player.tsx   # recording player with waveform
│   ├── notification-bell.tsx
│   └── agent-status-badge.tsx
├── pages/
│   ├── login.tsx
│   ├── dashboard.tsx
│   ├── contacts/
│   │   ├── contact-list.tsx
│   │   ├── contact-detail.tsx
│   │   └── contact-form.tsx
│   ├── leads/
│   ├── debt-cases/
│   ├── call-logs/
│   ├── campaigns/
│   ├── tickets/
│   ├── reports/
│   └── settings/
├── hooks/
│   ├── use-auth.ts
│   ├── use-socket.ts
│   ├── use-call.ts
│   └── use-notifications.ts
├── services/
│   ├── api-client.ts      # Axios instance with JWT interceptor
│   ├── auth-api.ts
│   ├── contact-api.ts
│   ├── lead-api.ts
│   ├── debt-case-api.ts
│   ├── call-api.ts
│   ├── ticket-api.ts
│   └── ...
├── stores/
│   ├── auth-store.ts      # Zustand: user, tokens
│   ├── call-store.ts      # Zustand: active call state
│   └── agent-status-store.ts
├── types/
└── lib/
    ├── socket.ts          # Socket.IO client
    └── utils.ts
```

## Implementation Steps

### 1. Foundation (Day 1)
<!-- Updated: Validation Session 2 - Vietnamese UI text, error code mapping -->
1. Install shadcn/ui, configure themes (light only per deferral list)
2. Create `lib/vi-text.ts` — Vietnamese UI text constants (labels, menus, buttons, placeholders)
3. Create `lib/error-messages.ts` — map API error codes to Vietnamese display text
4. Create API client (`services/api-client.ts`): Axios instance with:
   - Base URL from env
   - JWT access token interceptor (attach to Authorization header)
   - 401 interceptor: auto-refresh token, retry original request
   - Response error handling
3. Create auth store (Zustand): user, login/logout, isAuthenticated
4. **[RED TEAM #7]** Token bootstrap on page load: before rendering protected routes, call `POST /auth/refresh` (httpOnly cookie sent automatically). If successful, store new access token in memory and proceed. If fails (no cookie / expired), redirect to login. This handles F5/tab reopen without losing session.
5. Create login page with email/password form
6. Create protected route wrapper: shows loading spinner while bootstrap runs, redirects to login if bootstrap fails
6. Create app layout: sidebar + header + `<Outlet />`

### 2. Layout & Navigation (Day 1-2)
1. Sidebar: nav items with icons (lucide-react), collapsible, active state
2. Header: search bar (global), agent status selector dropdown, notification bell, user menu
3. Agent status selector: dropdown with status options (Ready, Break, Offline), visual indicator (color dot)
4. Notification bell: badge with unread count, dropdown panel with recent notifications

### 3. Reusable Components (Day 2)
1. Data table component: columns config, server-side pagination, sort, filter inputs, row actions
2. Page wrapper: title, breadcrumbs, action buttons
3. Confirm dialog, form modals (shadcn Dialog/Sheet)
4. **[RED TEAM #15]** Audio player: native HTML5 `<audio>` element with speed dropdown (0.5x-2x). No custom waveform rendering in MVP — use browser native controls + minimal styled wrapper.
5. Phone number display + click-to-call button component

### 4. Dashboard Page (Day 2)
1. Overview cards: total calls, answered, missed, avg duration, active calls
2. Agent status grid: card per agent showing name, status badge, duration in status
3. Lead summary: mini funnel (counts per status)
4. Debt summary: counts by tier
5. Auto-refresh: React Query refetch every 30s + Socket.IO for agent statuses

### 5. Contact Pages (Day 3)
1. Contact list: data table with search (phone, name), filter (tags, source), import/export buttons
2. Contact detail: header (name, phone, click-to-call), tabs:
   - Info tab: all fields, edit mode
   - Tickets tab: ticket list for contact
   - Calls tab: call history for contact with audio player
   - Timeline tab: all interactions chronologically
3. Contact form: create/edit modal with field validation
4. Import: file upload dialog → progress → result (success/error counts)
5. Export: trigger download with current filters

### 6. Lead Pages (Day 3)
1. Lead list: data table with status filter (pipeline stages), campaign filter
2. Lead detail: info + linked contact + follow-up scheduler
3. Lead form: create/edit, select contact, set status, score, notes

### 7. Debt Case Pages (Day 3-4)
1. Debt case list: data table with tier/status/dpd filters
2. Debt case detail: amounts, status, history, linked contact
3. PTP modal: record promise_date + promise_amount

### 8. Call Log Pages (Day 4)
1. Call log list: data table with date range picker, direction/disposition/agent filters
2. Call log detail: call info, recording player, disposition (if not set), QA annotations
3. Audio player integration: embedded in call detail, with seek, speed control
4. QA annotation form (for QA/Leader/Manager roles): score, criteria, timestamped notes

### 9. Ticket Pages (Day 4)
1. Ticket list: data table with status/priority/category filters
2. Ticket form: select contact (search), select category (tree), select macro (auto-fill content), set priority
3. Ticket detail: view + update status

### 10. Call Bar (Day 4-5)
1. Fixed bottom bar, conditionally rendered when active call exists
2. Shows: contact name/phone, call duration timer, call state
3. Buttons: Hold (toggle), Mute (local), Transfer (modal to select agent), Hangup
4. Disposition selector: dropdown, shown during/after call
5. Script display: campaign script text (if call linked to campaign)
6. State from `call-store` (Zustand), updated via Socket.IO events

### 11. Socket.IO Integration (Day 5)
1. Connect on login, disconnect on logout
2. Handle events: call:ringing, call:answered, call:ended → update call-store
3. Handle: agent:status_change → update agent-status-store (dashboard)
4. Handle: notification:new → show toast + update notification count
5. Inbound call popup: overlay component when call:ringing with direction=inbound

### 12. Campaign & Settings Pages (Day 5)
1. Campaign list + basic detail (name, status, script, dates)
2. Settings: profile view/edit, password change form
3. Reports pages: basic tables rendering report endpoint data

## Todo List
- [ ] API client with JWT interceptor + auto-refresh
- [ ] Auth store + login page + protected routes
- [ ] App layout (sidebar, header, agent status, notifications)
- [ ] Reusable data table component
- [ ] Dashboard page (stats + agent grid)
- [ ] Contact pages (list, detail, form, import/export)
- [ ] Lead pages (list, detail, form)
- [ ] Debt case pages (list, detail, PTP)
- [ ] Call log pages (list, detail, audio player)
- [ ] Ticket pages (list, form, macro integration)
- [ ] Call bar (floating, call controls, disposition)
- [ ] Socket.IO integration (call events, notifications)
- [ ] Inbound call popup
- [ ] Campaign + Settings + Reports pages

**NOTE: Import/Export Excel for contacts was deferred — Phase 03 CRUD complete but import/export not yet implemented.**

## Success Criteria
- Login → Dashboard → navigate all pages without errors
- Click-to-call from contact page triggers call, call bar appears
- Real-time: agent status changes reflect on dashboard
- Recording plays with seek and speed control
- Disposition selectable during wrap-up
- Notifications appear in real-time

## Risk Assessment
- Audio player browser compatibility: use HTML5 Audio API, works in all modern browsers
- Socket.IO reconnection: auto-reconnect with token refresh
- Large data tables: server-side pagination prevents memory issues

## Security Considerations
- Access token stored in memory only (not localStorage) — survives only current tab
- Refresh token in httpOnly cookie
- API client strips sensitive fields before displaying
- RBAC reflected in UI: hide buttons/menu items user can't access
