---
phase: 08
title: "Frontend: agent workstation + disposition entry"
size: M
status: pending
---

# Phase 08 — Agent Workstation

## Context
- Phase 05 socket events: `autocall:call_ringing/answered/ended`, `autocall:agent_state`
- MicroSIP handles the actual SIP audio; browser just shows info + collects disposition

## Overview
- Priority: P2
- Status: pending
- Single page at `/autocall/agent` for logged-in agents. Shows current call/lead, ready/pause/wrap controls, disposition form on hangup. Does NOT play audio — MicroSIP is the softphone.

## Key Insights
- Agent flow: login → start session → Ready → scheduler dials → MicroSIP rings → answer via MicroSIP → UI shows lead info → hangup via MicroSIP → UI prompts disposition → submit → back to Ready (or Pause).
- No WebRTC/JsSIP — just WebSocket for UI events, browser never handles audio.
- Ready/Pause toggle is in-app; actual SIP state is agent's MicroSIP being registered (handled at Kamailio layer).

## Requirements
**Functional**
- Session start/end (button in header).
- State indicator: Ready / On Call / Wrap / Pause — driven by server socket events.
- While on call: show lead name, phone, campaign, script (if provided), notes field.
- On hangup event: show disposition picker (per-campaign dispositions from phase 07 config) + notes textarea. Submit closes wrap.
- "Request DNC" button → adds lead phone to `autocall_dnc` and marks lead `dnc_blocked`.
- Callback schedule button → sets `next_eligible_at` to a future time + lead status `callback`. **Bypasses campaign cooldown** (decision #4) — agent's explicit commitment is honored. UI shows a note: "This callback will dial at the scheduled time, regardless of retry cooldown."

**Non-functional**
- Socket reconnect with exponential backoff; show "Disconnected" banner.
- State synced on reconnect via `GET /autocall/agent/current-call`.

## Architecture

```
packages/frontend/src/pages/autocall/
└── AutocallAgentWorkstationPage.tsx

packages/frontend/src/pages/autocall/components/
├── AgentStateBadge.tsx
├── AgentReadyPauseToggle.tsx
├── CurrentCallCard.tsx
├── DispositionForm.tsx
├── CallbackScheduler.tsx
└── RequestDncButton.tsx

packages/frontend/src/hooks/
├── use-autocall-agent-socket.ts          # subscribes to socket events
└── use-autocall-agent-state.ts           # combines HTTP + socket into single state store
```

## Related Code Files
**Create**: all above.

**Modify**
- `packages/frontend/src/app.tsx` — route `/autocall/agent` with perm `autocall.agent.work`.
- Sidebar: Agent role sees "Autocall Agent" entry linking to `/autocall/agent` (hidden otherwise).

## Implementation Steps
1. `use-autocall-agent-socket` — subscribes to user-scoped socket namespace, emits store updates.
2. `use-autocall-agent-state` — Zustand store with `{ state, currentCall, lead, campaign }`.
3. `AutocallAgentWorkstationPage` — layout: top bar with state + toggle; center card with current call; right sidebar with disposition form (shown when state=`wrap`).
4. `DispositionForm` — loads campaign dispositions, notes textarea, submit → `POST /agent/dispose`.
5. `CallbackScheduler` — date/time picker in campaign timezone; shows clear note "bypasses retry cooldown". Validates picked time is within next 30 days and inside campaign daily window (client-side preview only; backend re-validates).
6. `RequestDncButton` — confirm modal; POSTs to `/autocall/dnc` + lead update.
7. Reconnect handling with offline banner.
8. Empty state when no active campaign assigned.

## Todo List
- [ ] Socket hook
- [ ] Store
- [ ] Workstation page layout
- [ ] State badge + toggle
- [ ] Current call card
- [ ] Disposition form
- [ ] Callback scheduler
- [ ] DNC button
- [ ] Reconnect + resync
- [ ] Router + perm guard
- [ ] Compile + lint

## Success Criteria
- Agent logs in, clicks Ready → state flips to `ready`.
- Scheduler dials → MicroSIP rings → UI shows lead info within 500ms of bridge event.
- Agent hangs up in MicroSIP → UI shows disposition form within 500ms of hangup event.
- Submit disposition → state flips to `ready` (or pause if agent toggled during wrap).
- Socket drop for 10s → banner shows → on reconnect state resyncs from server.

## Risk Assessment
| Risk | Mitigation |
|---|---|
| UI state drifts from server | Single source of truth = server state via socket events; no optimistic toggles for state transitions |
| Disposition mandatory but agent closes tab | Server-side timeout (2× configured wrap) auto-marks `no_disposition` and returns to ready; alert supervisor |
| MicroSIP off, scheduler still dials | `autocall_agent_sessions.start` checks Kamailio `location` for registration; if not registered, reject session start |

## Security
- `autocall.agent.work` perm required.
- Cannot see other agents' calls.

## Next Steps
Unblocks phase 10 (agent E2E test).
