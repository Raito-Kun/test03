# CRM Omnichannel — Gap Analysis

Comparison: PRD (Guildline/PRD.md) + CRM_Full_Document.docx vs Implemented (Final Docs)

## Legend
- ✅ Implemented & working
- ⚠️ Partially implemented
- ❌ Not implemented
- 🔵 Phase 2/3 (planned, not in current scope)

---

## 1. Core CRM (PRD §4.1)

### 1.1 Contacts (§4.1.1)
| Feature | Status | Notes |
|---------|--------|-------|
| CRUD contacts | ✅ | |
| Search by phone, name | ✅ | |
| Import CSV | ✅ | |
| Export Excel/CSV | ✅ | Export button on all 6 list pages |
| Merge duplicate contacts | ✅ | Contact merge dialog implemented |
| Interaction history timeline | ✅ | Call logs linked |
| Custom fields (JSONB) | ✅ | Schema has fields, UI extended in v1.2.0 |
| Tags/segments | ✅ | Schema supports, UI implemented in v1.2.0 |
| Family relationships (người bảo lãnh) | 🔵 | Phase 2 |

### 1.2 Tickets/Interaction Notes (§4.1.2)
| Feature | Status | Notes |
|---------|--------|-------|
| CRUD tickets | ✅ | |
| Ticket linked to contact + call | ✅ | |
| Ticket categories | ✅ | |
| Status pipeline | ✅ | open→in_progress→resolved→closed |
| Priority levels | ✅ | low/medium/high/urgent |
| Macro/Quick Reply templates | ✅ | Macro templates linked to ticket UI in v1.2.0 |

### 1.3 Leads (§4.1.3)
| Feature | Status | Notes |
|---------|--------|-------|
| CRUD leads | ✅ | |
| Status pipeline | ✅ | new→contacted→qualified→proposal→won/lost |
| Lead scoring | ✅ | Rule-based algorithm in lead-scoring-service.ts (v1.2.0) |
| Lead assignment (manual) | ✅ | |
| Lead assignment (round-robin/rule-based) | ✅ | Auto-assign endpoint + UI dialog (v1.2.0) |
| Follow-up scheduler | ✅ | Auto-reminder cron + GET /leads/follow-ups endpoint (v1.2.0) |
| Lead source tracking | ✅ | `source` field enforced in UI (v1.2.0) |
| Import CSV | ✅ | |

### 1.4 Debt Cases (§4.1.4)
| Feature | Status | Notes |
|---------|--------|-------|
| CRUD debt cases | ✅ | |
| Import from file | ✅ | CSV import exists |
| Debt tier classification | ✅ | tier_1 through tier_5 |
| Debt status tracking | ✅ | active→in_progress→promise_to_pay→paid→written_off |
| Escalation rules (auto tier change) | ✅ | Daily cron + manual POST /debt-cases/escalate endpoint (v1.2.0) |
| Promise to Pay + reminder | ✅ | Auto-reminder cron (v1.2.0) |

### 1.5 Campaigns (§4.1.5)
| Feature | Status | Notes |
|---------|--------|-------|
| CRUD campaigns | ✅ | |
| Import leads to campaign | ✅ | |
| Agent assignment (manual) | ✅ | |
| Agent assignment (auto/round-robin) | ✅ | Auto-assign endpoint + round-robin algo (v1.2.0) |
| Campaign progress tracking | ✅ | Real-time progress bar with % completion (v1.2.0) |
| Script display during call | ✅ | Call script panel + auto-display during call (v1.2.0) |
| Disposition codes per campaign | ✅ | |

---

## 2. VoIP & Click-to-Call (PRD §4.2)

### 2.1 Click-to-Call
| Feature | Status | Notes |
|---------|--------|-------|
| C2C via ESL originate (softphone mode) | ✅ | Phase 1 mode working |
| C2C via WebRTC in-browser (SIP.js) | ❌ | Phase 2 — not implemented |
| Agent status validation before call | ✅ | Checks extension registration |
| Call source tagging (C2C/Autocall) | ✅ | `crm_call_source` variable |

### 2.2 In-Call Operations (§4.2.4)
| Feature | Status | Notes |
|---------|--------|-------|
| Hold/Unhold | ✅ | API exists |
| Transfer (blind) | ✅ | API exists |
| Transfer (attended) | ✅ | ESL att_xfer + endpoint (v1.2.0) |
| Hangup | ✅ | |
| Mute/Unmute | ❌ | Requires WebRTC (Phase 2) |
| DTMF | ❌ | Requires WebRTC (Phase 2) |

### 2.3 Inbound Call Popup (§4.2.5)
| Feature | Status | Notes |
|---------|--------|-------|
| Popup on incoming call | ✅ | Component + ESL integration complete |
| Show caller info from contacts | ✅ | Contact lookup + history display (v1.2.0) |
| Call history in popup | ✅ | Recent calls shown in popup (v1.2.0) |
| Accept call from browser | ❌ | Requires WebRTC (Phase 2) |

### 2.4 Agent Status (§4.2.6)
| Feature | Status | Notes |
|---------|--------|-------|
| Online/Offline | ✅ | |
| Sẵn sàng (Ready) | ✅ | |
| Tạm nghỉ (Break) | ✅ | |
| Đàm thoại (On Call) | ✅ | |
| Xử lý sau cuộc gọi (Wrap-up) | ✅ | Auto-timer 30s countdown after hangup (v1.2.0) |
| Đổ chuông (Ringing) | ✅ | Auto-detection from ESL events (v1.2.0) |
| Giữ máy (Hold) | ✅ | Status auto-detection |
| Chuyển máy (Transfer) | ✅ | Status auto-detection |

### 2.5 CDR Processing
| Feature | Status | Notes |
|---------|--------|-------|
| XML CDR webhook receiver | ✅ | |
| CDR deduplication (1 call = 1 row) | ✅ | v8 algorithm |
| Contact auto-linking by phone | ✅ | |
| Agent auto-linking by extension | ✅ | |
| SIP Code/Reason mapping | ✅ | RFC 3261 |
| Error handling + webhook_logs | ✅ | |

---

## 3. Recording (PRD §4.3)

| Feature | Status | Notes |
|---------|--------|-------|
| Audio player in call detail | ✅ | Play/Pause, seek, speed control |
| Recording proxy with RBAC | ✅ | Agent sees own, leader sees team, admin sees all |
| Download single recording | ✅ | Download button exists |
| Bulk download by filter | ✅ | ZIP archive endpoint + checkbox UI (v1.2.0) |
| Waveform display | ❌ | Basic player, no waveform visualization |
| Tua 15s forward/backward | ❌ | Standard seek bar only |
| Speed control (0.5x–2x) | ✅ | Speed selector in player |
| rsync sync from FusionPBX | ✅ | Cron every minute |
| Signed URL (TTL 1h) | ❌ | Direct proxy, no signed URLs |
| Audit log (who listened) | ✅ | Audit logging on recording access |
| QA Annotation at timestamp | ✅ | QA timestamp markers + UI (v1.2.0) |

---

## 4. Monitoring & Supervision (PRD §4.4)

| Feature | Status | Notes |
|---------|--------|-------|
| Dashboard: agents online/calling/ready | ✅ | Real-time agent grid dashboard (v1.2.0) |
| Live call list (agent, KH, duration) | ✅ | Live monitoring page with agent status (v1.2.0) |
| Live call stats (inbound/outbound) | ✅ | Real-time call stats in monitoring dashboard (v1.2.0) |
| Listen (spy on call) | ❌ | Phase 2 |
| Whisper (coach agent) | ❌ | Phase 2 |
| Barge (3-way join) | ❌ | Phase 2 |

---

## 5. Dashboard & KPI (PRD §4.4.3)

### 5.1 Telesale KPIs
| Feature | Status | Notes |
|---------|--------|-------|
| Total calls | ✅ | |
| Contact rate (% answered) | ✅ | Dashboard KPI (v1.2.0) |
| Close rate (% won) | ✅ | Dashboard KPI (v1.2.0) |
| Average talk time | ✅ | |
| Average wrap-up time | ✅ | Wrap-up timer tracking (v1.2.0) |
| Leads contacted/day | ✅ | |

### 5.2 Collection KPIs
| Feature | Status | Notes |
|---------|--------|-------|
| Recovery rate | ✅ | Dashboard KPI (v1.2.0) |
| Amount collected | ✅ | Schema + report tracking |
| PTP rate | ✅ | Dashboard KPI (v1.2.0) |
| Right Party Contact | 🔵 | Phase 2 |
| Calls/day | ✅ | |

---

## 6. AI & Automation (PRD §4.5) — Phase 2/3

| Feature | Status | Notes |
|---------|--------|-------|
| AI Chatbot (Zalo OA, FB, Web) | 🔵 | Phase 3 |
| AI Callbot (auto-dial, NLP) | 🔵 | Phase 3 |
| Speech-to-Text transcription | 🔵 | Phase 2 — `ai_transcript` field ready |
| AI Call Summary | 🔵 | Phase 2 — `ai_summary` field ready |
| Script Compliance detection | 🔵 | Phase 3 |
| Sentiment Analysis | 🔵 | Phase 3 |
| AI Agent Scoring | 🔵 | Phase 3 |
| AI Script Suggestion | 🔵 | Phase 3 |
| Zalo ZNS/SMS auto-notification | 🔵 | Phase 2 |
| Auto-assign lead (round-robin) | ❌ | Should be Phase 1 |
| Auto-escalation debt tier | ❌ | Should be Phase 1 |
| No-code workflow builder | 🔵 | Phase 3 |

---

## 7. Omnichannel (PRD §4.6) — Phase 2/3

| Feature | Status | Notes |
|---------|--------|-------|
| Voice (FusionPBX) | ✅ | Phase 1 complete |
| Zalo OA | 🔵 | Phase 2 |
| Facebook Messenger | 🔵 | Phase 3 |
| SMS | 🔵 | Phase 2 |
| Website Live Chat | 🔵 | Phase 3 |
| Email | 🔵 | Phase 3 |
| Unified inbox | 🔵 | Phase 3 |
| ACD routing | 🔵 | Phase 2 |

---

## 8. Reports & Export (PRD §4.7)

| Feature | Status | Notes |
|---------|--------|-------|
| Call reports (by day/agent/campaign) | ✅ | |
| Telesale funnel report | ✅ | Contact funnel |
| Collection aging report | ✅ | Debt case list with tiers |
| SLA report (response time) | ✅ | First response + resolution time tracking (v1.2.0) |
| Export Excel/CSV | ✅ | Export button on all list pages (v1.2.0) |
| Scheduled reports (email) | 🔵 | Phase 2 |

---

## 9. Security (PRD §5.1)

| Feature | Status | Notes |
|---------|--------|-------|
| CORS whitelist | ✅ | |
| Rate limiting (60 req/min) | ✅ | |
| C2C rate limiting (10 req/min) | ✅ | |
| Webhook IP whitelist + Basic Auth | ✅ | |
| Input sanitization (Zod + Prisma) | ✅ | |
| HTTPS (TLS 1.2+) | ✅ | |
| JWT (15min access, 7d refresh) | ✅ | |
| Password bcrypt | ✅ | |

---

## Summary: Phase 1 Feature Status (v1.2.0 Complete)

### Critical Features (✅ All Implemented)
1. ✅ **Lead scoring logic** — Rule-based algorithm in lead-scoring-service.ts
2. ✅ **Auto-assign leads** (round-robin) — Auto-assign endpoint + round-robin algo
3. ✅ **Auto-escalation debt tier** — Daily cron + manual endpoint
4. ✅ **Follow-up reminders** — Enhanced cron job + GET /leads/follow-ups
5. ✅ **Script display during call** — Call script service + panel UI
6. ✅ **Contact merge** — Merge dialog implemented
7. ✅ **Export Excel UI** — Export button on all 6 list pages
8. ✅ **Live call monitoring dashboard** — Real-time agent grid
9. ✅ **QA annotation at timestamp** — QA timestamp service + UI markers
10. ✅ **Bulk recording download** — ZIP archive endpoint + checkbox UI
11. ✅ **Attended transfer** — ESL att_xfer + endpoint
12. ✅ **SLA reporting** — First response + resolution time tracking + report endpoint
13. ✅ **Wrap-up auto-timer** — 30s countdown after hangup
14. ✅ **Dashboard KPIs** — Contact rate, close rate, PTP rate, recovery rate, wrap-up avg
15. ✅ **Tags/segments UI** — On contacts
16. ✅ **Macro templates in ticket UI** — Linked to ticket UI
17. ✅ **Inbound call popup improvements** — Call history + ticket count
18. ✅ **Campaign progress bar** — Real-time % completion
19. ✅ **Lead source tracking UI** — Source field enforced
20. ✅ **Agent status auto-detection** — From ESL events

### Phase 2 (planned, not yet started)
1. WebRTC in-browser calling (SIP.js)
2. AI transcription (speech-to-text)
3. AI call summary
4. Zalo OA / SMS integration
5. Listen/Whisper/Barge (call supervision)
6. Scheduled email reports
7. Waveform audio player

### Phase 3 (future)
1. AI Chatbot / Callbot
2. Sentiment analysis
3. Omnichannel (FB, Web chat, Email)
4. No-code workflow builder
5. Mobile app
6. Right Party Contact detection
