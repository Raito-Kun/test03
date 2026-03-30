# Phase 12: Phase 2 Features — Telesale + CSKH

## ⛔ CRITICAL RULE — READ BEFORE ANY CODE CHANGE

```
DO NOT modify any existing working code/features.
All Phase 2 features must be built as NEW additions only.

- New database tables/columns only (no modifying existing ones)
- New API endpoints only (no modifying existing ones)
- New UI components only (no modifying existing pages)
- If integration with existing feature needed → use hooks/events/composition pattern
- Before any code change: run tests. If passing → DO NOT TOUCH that file
- Exception: adding imports/routes in index files (append only, never modify existing lines)
- This rule applies to ALL future phases
```

---

## Brainstorm Decisions (2026-03-27)

### Script Panel — 3 Types
- **Script cố định**: 1 default script for all calls
- **Script theo campaign**: each campaign has its own script (uses existing `campaign.script` field)
- **Script theo sản phẩm/dịch vụ**: script tied to product/service tag
- Auto-detect priority: campaign script → product script → default script
- Script editor: rich text, support `{customer_name}`, `{agent_name}`, `{product}` variables
- Disposition codes at end of each script section

### Auto-assign Leads — 3 Formats
- **Round-robin**: even distribution among agents
- **Workload-based**: assign to agent with fewest active leads
- **Skill-based**: match lead product interest to agent skill tags
- Config per campaign: choose which format
- Manager can override any auto-assignment

### Live Call Monitoring — 2 Features
- **Dashboard**: real-time table (agent, customer, duration, campaign)
- **Whisper**: manager speaks to agent only (customer cannot hear)
- Implementation: FusionPBX ESL `uuid_broadcast` or `eavesdrop` with whisper flag
- No barge needed for now

---

## Overview

| # | Feature | Priority | Effort | New Files |
|---|---------|----------|--------|-----------|
| 1 | Export Excel (all list pages) | High | 1.5d | 3 |
| 2 | Auto-assign leads (3 formats) | High | 2d | 4 |
| 3 | Script panel (3 types) | High | 2.5d | 6 |
| 4 | Merge duplicate contacts | Medium | 2d | 4 |
| 5 | Live call monitoring + whisper | Medium | 2.5d | 5 |
| 6 | QA annotation at timestamp | Low | 1.5d | 2 |
| **Total** | | | **~12 days** | **24 files** |

---

## Feature 1: Script hiển thị trong lúc gọi

### User Stories
- **TS-SCRIPT-01**: As an agent, when I make a C2C call, I want to see the campaign script on screen so I follow the correct talking points
- **TS-SCRIPT-02**: As a manager, I want to create/edit scripts per campaign so agents follow standardized messaging
- **TS-SCRIPT-03**: As an agent, I want the script to auto-display when a call connects (not before ringing)

### Technical Approach

**Reads (never modifies)**:
- `packages/backend/prisma/schema.prisma` → Campaign model already has `script: String?` field
- `packages/backend/src/services/call-log-service.ts` → reads call log data
- `packages/frontend/src/components/layout/call-bar.tsx` → existing call bar UI

**New Files**:
| File | Purpose |
|------|---------|
| `packages/frontend/src/components/call-script-panel.tsx` | Floating panel that shows script when call is active |
| `packages/frontend/src/hooks/use-active-call-script.ts` | Hook to fetch campaign script for active call's campaign |
| `packages/backend/src/routes/script-routes.ts` | `GET /api/v1/scripts/active-call` — returns script for agent's current active call |
| `packages/backend/src/controllers/script-controller.ts` | Controller for script endpoint |

**How it works**:
1. When agent makes C2C call, `call-bar.tsx` shows call status (existing behavior — NOT modified)
2. NEW `call-script-panel.tsx` component is rendered alongside call-bar (composed, not inserted into it)
3. Panel queries `GET /api/v1/scripts/active-call` which:
   - Finds agent's most recent active call_log (by userId, last 60s)
   - Looks up the call_log's campaignId
   - Returns campaign.script content
4. Panel displays as a slide-out drawer on the right side
5. Panel auto-hides when call ends (billsec stops updating)

**Integration pattern**: Render `<CallScriptPanel />` in `app.tsx` as a sibling to existing layout, NOT inside call-bar. It reads call state from Zustand store (existing `useAgentStatusStore`).

**Estimated effort**: 2 days

---

## Feature 2: Auto-assign leads (round-robin)

### User Stories
- **TS-ASSIGN-01**: As a manager, when I import leads to a campaign, I want them auto-distributed equally among assigned agents
- **TS-ASSIGN-02**: As a manager, I want to choose assignment mode: manual or round-robin
- **TS-ASSIGN-03**: As an agent, I want to see only leads assigned to me in my lead list (existing behavior via data scoping)

### Technical Approach

**Reads (never modifies)**:
- `packages/backend/prisma/schema.prisma` → Lead model has `assignedTo` field
- `packages/backend/src/services/lead-import-service.ts` → existing import logic
- `packages/frontend/src/components/import-button.tsx` → existing import UI

**New Files**:
| File | Purpose |
|------|---------|
| `packages/backend/src/services/lead-assignment-service.ts` | Round-robin logic: distribute leads among team agents |
| `packages/backend/src/routes/assignment-routes.ts` | `POST /api/v1/assignments/round-robin` — trigger auto-assign |
| `packages/frontend/src/components/auto-assign-dialog.tsx` | Dialog: select campaign + team → trigger round-robin |

**New DB column** (migration, append only):
```sql
ALTER TABLE campaigns ADD COLUMN assignment_mode VARCHAR DEFAULT 'manual';
-- Values: 'manual', 'round_robin'
```

**How it works**:
1. Manager opens campaign detail → clicks "Phân bổ tự động" button (NEW button, appended to existing page actions)
2. `auto-assign-dialog.tsx` opens → shows team agents + unassigned lead count
3. On confirm → `POST /api/v1/assignments/round-robin` with `{ campaignId, teamId }`
4. Backend `lead-assignment-service.ts`:
   - Fetches all unassigned leads for campaign (`assignedTo IS NULL`)
   - Fetches active agents in team
   - Round-robin: lead[0]→agent[0], lead[1]→agent[1], ... lead[n]→agent[n%agentCount]
   - Bulk update `UPDATE leads SET assigned_to = $agentId WHERE id IN ($leadIds)`
5. Returns assignment summary: `{ total: 150, perAgent: { "Agent A": 50, "Agent B": 50, "Agent C": 50 } }`

**Integration pattern**: Add `<AutoAssignButton />` as an action button in campaign detail page via composition (new component rendered in actions area).

**Estimated effort**: 1.5 days

---

## Feature 3: Merge duplicate contacts

### User Stories
- **MERGE-01**: As an agent, when I see duplicate contacts (same phone), I want to merge them into one record
- **MERGE-02**: As a manager, I want to see a list of potential duplicates for review
- **MERGE-03**: After merge, all linked records (leads, debt cases, call logs, tickets) must point to the surviving contact

### Technical Approach

**Reads (never modifies)**:
- `packages/backend/prisma/schema.prisma` → Contact model + relations
- `packages/backend/src/services/call-log-service.ts` → reads contactId
- `packages/frontend/src/pages/contacts/contact-list.tsx` → existing list

**New Files**:
| File | Purpose |
|------|---------|
| `packages/backend/src/services/contact-merge-service.ts` | Find duplicates + merge logic |
| `packages/backend/src/routes/contact-merge-routes.ts` | `GET /duplicates`, `POST /merge` |
| `packages/backend/src/controllers/contact-merge-controller.ts` | Controller |
| `packages/frontend/src/pages/contacts/contact-merge-dialog.tsx` | Side-by-side merge UI |

**How it works**:
1. `GET /api/v1/contacts/duplicates` — finds contacts sharing same phone number
   - SQL: `SELECT phone, COUNT(*) FROM contacts GROUP BY phone HAVING COUNT(*) > 1`
   - Returns groups of duplicate contacts with all their data
2. `POST /api/v1/contacts/merge` with `{ keepId, mergeIds: [...] }`
   - Transaction:
     - Move all leads from mergeIds → keepId: `UPDATE leads SET contact_id = $keepId WHERE contact_id IN ($mergeIds)`
     - Move all debt_cases: same pattern
     - Move all call_logs: same pattern
     - Move all tickets: same pattern
     - Copy over any non-null fields from merged contacts to surviving contact (phone_alt, email, etc.)
     - Soft-delete merged contacts: `UPDATE contacts SET status = 'merged' WHERE id IN ($mergeIds)`
3. `contact-merge-dialog.tsx`:
   - Shows two contacts side-by-side
   - User picks which contact to keep (primary)
   - Shows preview of what will be merged (X leads, Y calls, Z tickets)
   - Confirm → POST merge

**Integration pattern**: Add "Gộp trùng" button to contact list page toolbar (new component appended to toolbar area). Dialog is a standalone component.

**Estimated effort**: 2 days

---

## Feature 4: Live call monitoring dashboard

### User Stories
- **MON-01**: As a manager, I want to see all agents' current status (online, on-call, break) in real-time
- **MON-02**: As a manager, I want to see active calls with caller, destination, duration (ticking timer)
- **MON-03**: As a leader, I want to see only my team's agents

### Technical Approach

**Reads (never modifies)**:
- `packages/backend/src/services/esl-service.ts` → ESL connection for FreeSWITCH queries
- `packages/backend/src/services/agent-status-service.ts` → existing agent status logic
- `packages/frontend/src/stores/agent-status-store.ts` → existing store

**New Files**:
| File | Purpose |
|------|---------|
| `packages/backend/src/routes/monitoring-routes.ts` | `GET /api/v1/monitoring/agents`, `GET /api/v1/monitoring/active-calls` |
| `packages/backend/src/controllers/monitoring-controller.ts` | Controller |
| `packages/backend/src/services/monitoring-service.ts` | Query ESL for active channels + agent registrations |
| `packages/frontend/src/pages/monitoring/live-dashboard.tsx` | Real-time monitoring page |

**How it works**:
1. `GET /api/v1/monitoring/agents` — returns all agents with current status
   - Reads from users table (sipExtension) + Redis agent status cache
   - Checks FreeSWITCH registration via ESL `sofia status profile internal reg`
   - Returns: `[{ agent, extension, status, registrationStatus }]`
2. `GET /api/v1/monitoring/active-calls` — returns currently active calls
   - ESL command: `show channels` → parse active channels
   - Returns: `[{ callUuid, callerNumber, destNumber, duration, agentName }]`
3. Frontend polls every 5 seconds (or uses Socket.IO for push updates)
4. Page shows:
   - Agent grid: colored cards (green=ready, red=on-call, yellow=break, gray=offline)
   - Active calls table: agent, customer, duration (ticking), direction
   - Summary stats: X online, Y on-call, Z on-break

**Integration pattern**: New page added to router (`/monitoring`). New sidebar menu item. Reads existing stores but doesn't modify them.

**Data scoping**: Manager sees all agents. Leader sees only their team (filtered by teamId).

**Estimated effort**: 2 days

---

## Feature 5: Export Excel (all list pages)

### User Stories
- **EXP-01**: As a manager, I want to export the current filtered view of any list page to Excel
- **EXP-02**: Export should respect current search/filter/date range
- **EXP-03**: Agent permission `export_excel` controls access

### Technical Approach

**Reads (never modifies)**:
- All existing list endpoints (`GET /contacts`, `GET /leads`, etc.) — reads their query params
- `packages/frontend/src/pages/*/\*-list.tsx` — existing list pages (reads filter state)

**New Files**:
| File | Purpose |
|------|---------|
| `packages/backend/src/services/export-service.ts` | Generic Excel export using `exceljs` library |
| `packages/backend/src/routes/export-routes.ts` | `GET /api/v1/export/:entity` — streams Excel file |
| `packages/frontend/src/components/export-button.tsx` | Reusable export button component |

**New dependency**: `exceljs` (npm install)

**How it works**:
1. `ExportButton` component placed in each list page's toolbar area (composition)
2. On click → `GET /api/v1/export/contacts?search=...&status=...&dateFrom=...` (same filters as list)
3. Backend `export-service.ts`:
   - Reuses existing Prisma queries (calls existing service functions, reads only)
   - Fetches ALL matching records (no pagination limit)
   - Creates Excel workbook with `exceljs`
   - Streams as `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
4. Entities supported: `contacts`, `leads`, `debt-cases`, `call-logs`, `tickets`, `campaigns`
5. Permission check: `requirePermission('export_excel')`

**Column definitions per entity**:
- Contacts: fullName, phone, phoneAlt, email, address, source, createdAt
- Leads: contact.fullName, contact.phone, status, campaign.name, assignedTo.fullName, score, createdAt
- Call Logs: callerNumber, destinationNumber, direction, duration, billsec, hangupCause, sipCode, startTime
- (etc.)

**Integration pattern**: `<ExportButton entity="contacts" filters={currentFilters} />` dropped into each list page's action area. No modification to existing list page logic.

**Estimated effort**: 1.5 days

---

## Feature 6: QA Annotation at Timestamp

### User Stories
- **QA-TS-01**: As QA reviewer, while listening to a recording, I want to click a timestamp to add a note at that exact point
- **QA-TS-02**: As QA reviewer, I want to see all timestamp annotations as markers on the audio timeline
- **QA-TS-03**: As a manager, I want to click an annotation marker and jump to that point in the recording

### Technical Approach

**Reads (never modifies)**:
- `packages/backend/prisma/schema.prisma` → QaAnnotation model already has `timestampNote: Json?` field
- `packages/frontend/src/components/audio-player.tsx` → existing audio player
- `packages/frontend/src/pages/call-logs/call-log-detail.tsx` → existing detail page

**Existing schema** (already supports this — no migration needed):
```prisma
model QaAnnotation {
  timestampNote  Json?  @map("timestamp_note") @db.JsonB
  // Format: [{ time: 45.2, note: "Agent didn't greet", severity: "warning" }, ...]
}
```

**New Files**:
| File | Purpose |
|------|---------|
| `packages/frontend/src/components/qa-timestamp-annotations.tsx` | Annotation markers on timeline + add annotation form |
| `packages/backend/src/routes/qa-timestamp-routes.ts` | `POST /api/v1/qa-annotations/:id/timestamps`, `GET /api/v1/qa-annotations/:callLogId/timestamps` |

**How it works**:
1. `qa-timestamp-annotations.tsx` renders alongside existing audio player (composition)
2. While playing recording, QA clicks "Ghi chú tại đây" button
3. Component captures current playback time → opens mini form (note text + severity)
4. Saves via `POST /api/v1/qa-annotations/:id/timestamps` with `{ time: 45.2, note: "...", severity: "warning" }`
5. Backend appends to existing `timestampNote` JSONB array
6. Annotations render as colored dots on a timeline bar below the audio player
7. Clicking a dot seeks the audio to that timestamp

**Integration pattern**: `<QaTimestampAnnotations callLogId={id} audioRef={playerRef} />` rendered as sibling below the audio player in call-log-detail. Reads player state via ref, doesn't modify the player component.

**Estimated effort**: 1.5 days

---

## Implementation Order

```
Week 1:
  Day 1-2: Feature 5 (Export Excel) — highest ROI, simplest
  Day 3-4: Feature 2 (Auto-assign leads) — high priority for managers
  Day 5:   Feature 1 start (Call script panel)

Week 2:
  Day 1:   Feature 1 finish (Call script panel)
  Day 2-3: Feature 3 (Merge duplicate contacts)
  Day 4-5: Feature 4 (Live call monitoring dashboard)

Week 3:
  Day 1-2: Feature 6 (QA timestamp annotations)
  Day 3:   Integration testing + bug fixes
  Day 4:   Deploy + verify
```

---

## File Inventory (20 new files, 0 modified)

### Backend (12 new files)
```
packages/backend/src/controllers/script-controller.ts        (NEW)
packages/backend/src/controllers/contact-merge-controller.ts  (NEW)
packages/backend/src/controllers/monitoring-controller.ts     (NEW)
packages/backend/src/routes/script-routes.ts                  (NEW)
packages/backend/src/routes/assignment-routes.ts              (NEW)
packages/backend/src/routes/contact-merge-routes.ts           (NEW)
packages/backend/src/routes/monitoring-routes.ts              (NEW)
packages/backend/src/routes/export-routes.ts                  (NEW)
packages/backend/src/routes/qa-timestamp-routes.ts            (NEW)
packages/backend/src/services/lead-assignment-service.ts      (NEW)
packages/backend/src/services/contact-merge-service.ts        (NEW)
packages/backend/src/services/export-service.ts               (NEW)
packages/backend/src/services/monitoring-service.ts           (NEW)
```

### Frontend (7 new files)
```
packages/frontend/src/components/call-script-panel.tsx        (NEW)
packages/frontend/src/components/auto-assign-dialog.tsx       (NEW)
packages/frontend/src/components/export-button.tsx            (NEW)
packages/frontend/src/components/qa-timestamp-annotations.tsx (NEW)
packages/frontend/src/hooks/use-active-call-script.ts         (NEW)
packages/frontend/src/pages/contacts/contact-merge-dialog.tsx (NEW)
packages/frontend/src/pages/monitoring/live-dashboard.tsx     (NEW)
```

### Database (1 migration)
```
ALTER TABLE campaigns ADD COLUMN assignment_mode VARCHAR DEFAULT 'manual';
```

---

## Pre-implementation Checklist

- [ ] Run full test suite — all must pass before any Phase 2 work
- [ ] Snapshot current git state (`git tag v1.1.1-pre-phase2`)
- [ ] Install `exceljs` dependency
- [ ] Create database migration for `assignment_mode` column
- [ ] Register new routes in `packages/backend/src/index.ts` (append only)
- [ ] Add new page to router in `packages/frontend/src/app.tsx` (append only)
- [ ] Add monitoring menu item to sidebar (append only)
