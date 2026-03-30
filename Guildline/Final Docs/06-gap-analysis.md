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
| Export Excel/CSV | ⚠️ | Permission exists but export UI not verified |
| Merge duplicate contacts | ❌ | Dedup by phone not implemented |
| Interaction history timeline | ✅ | Call logs linked |
| Custom fields (JSONB) | ⚠️ | Schema has fields, UI limited |
| Tags/segments | ⚠️ | Schema supports, UI not implemented |
| Family relationships (người bảo lãnh) | ❌ | |

### 1.2 Tickets/Interaction Notes (§4.1.2)
| Feature | Status | Notes |
|---------|--------|-------|
| CRUD tickets | ✅ | |
| Ticket linked to contact + call | ✅ | |
| Ticket categories | ✅ | |
| Status pipeline | ✅ | open→in_progress→resolved→closed |
| Priority levels | ✅ | low/medium/high/urgent |
| Macro/Quick Reply templates | ⚠️ | Template system exists, not linked to ticket UI |

### 1.3 Leads (§4.1.3)
| Feature | Status | Notes |
|---------|--------|-------|
| CRUD leads | ✅ | |
| Status pipeline | ✅ | new→contacted→qualified→proposal→won/lost |
| Lead scoring | ❌ | Schema has `score` field but no scoring logic |
| Lead assignment (manual) | ✅ | |
| Lead assignment (round-robin/rule-based) | ❌ | |
| Follow-up scheduler | ⚠️ | `next_follow_up` field exists, no auto-reminder |
| Lead source tracking | ⚠️ | `source` field exists, not enforced in UI |
| Import CSV | ✅ | |

### 1.4 Debt Cases (§4.1.4)
| Feature | Status | Notes |
|---------|--------|-------|
| CRUD debt cases | ✅ | |
| Import from file | ⚠️ | CSV import exists |
| Debt tier classification | ✅ | tier_1 through tier_5 |
| Debt status tracking | ✅ | active→in_progress→promise_to_pay→paid→written_off |
| Escalation rules (auto tier change) | ❌ | |
| Promise to Pay + reminder | ⚠️ | `promise_date` field exists, no auto-reminder |

### 1.5 Campaigns (§4.1.5)
| Feature | Status | Notes |
|---------|--------|-------|
| CRUD campaigns | ✅ | |
| Import leads to campaign | ✅ | |
| Agent assignment (manual) | ✅ | |
| Agent assignment (auto/round-robin) | ❌ | |
| Campaign progress tracking | ⚠️ | Basic stats, no real-time progress bar |
| Script display during call | ❌ | |
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
| Transfer (attended) | ❌ | |
| Hangup | ✅ | |
| Mute/Unmute | ❌ | Requires WebRTC (Phase 2) |
| DTMF | ❌ | Requires WebRTC (Phase 2) |

### 2.3 Inbound Call Popup (§4.2.5)
| Feature | Status | Notes |
|---------|--------|-------|
| Popup on incoming call | ⚠️ | Component exists, ESL event integration partial |
| Show caller info from contacts | ⚠️ | Contact lookup exists |
| Call history in popup | ❌ | |
| Accept call from browser | ❌ | Requires WebRTC (Phase 2) |

### 2.4 Agent Status (§4.2.6)
| Feature | Status | Notes |
|---------|--------|-------|
| Online/Offline | ✅ | |
| Sẵn sàng (Ready) | ✅ | |
| Tạm nghỉ (Break) | ✅ | |
| Đàm thoại (On Call) | ✅ | |
| Xử lý sau cuộc gọi (Wrap-up) | ⚠️ | Status exists, no auto-timer |
| Đổ chuông (Ringing) | ⚠️ | Status exists, no auto-detection from ESL |
| Giữ máy (Hold) | ⚠️ | Status exists |
| Chuyển máy (Transfer) | ⚠️ | Status exists |

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
| Bulk download by filter | ❌ | |
| Waveform display | ❌ | Basic player, no waveform visualization |
| Tua 15s forward/backward | ❌ | Standard seek bar only |
| Speed control (0.5x–2x) | ✅ | Speed selector in player |
| rsync sync from FusionPBX | ✅ | Cron every minute |
| Signed URL (TTL 1h) | ❌ | Direct proxy, no signed URLs |
| Audit log (who listened) | ✅ | Audit logging on recording access |
| QA Annotation at timestamp | ⚠️ | QA scoring exists, timestamp annotation not implemented |

---

## 4. Monitoring & Supervision (PRD §4.4)

| Feature | Status | Notes |
|---------|--------|-------|
| Dashboard: agents online/calling/ready | ⚠️ | Basic dashboard, no real-time agent grid |
| Live call list (agent, KH, duration) | ❌ | |
| Live call stats (inbound/outbound) | ⚠️ | Dashboard has call stats, not truly real-time |
| Listen (spy on call) | ❌ | |
| Whisper (coach agent) | ❌ | |
| Barge (3-way join) | ❌ | |

---

## 5. Dashboard & KPI (PRD §4.4.3)

### 5.1 Telesale KPIs
| Feature | Status | Notes |
|---------|--------|-------|
| Total calls | ✅ | |
| Contact rate (% answered) | ⚠️ | Can be derived from data |
| Close rate (% won) | ⚠️ | Can be derived |
| Average talk time | ✅ | |
| Average wrap-up time | ❌ | No wrap-up tracking |
| Leads contacted/day | ✅ | |

### 5.2 Collection KPIs
| Feature | Status | Notes |
|---------|--------|-------|
| Recovery rate | ⚠️ | Can be derived |
| Amount collected | ⚠️ | Schema supports |
| PTP rate | ❌ | |
| Right Party Contact | ❌ | |
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
| Collection aging report | ⚠️ | Debt case list with tiers |
| SLA report (response time) | ❌ | |
| Export Excel/CSV | ⚠️ | Permission exists, UI partial |
| Scheduled reports (email) | ❌ | |

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

## Summary: Missing Features (Phase 1 Scope)

### Critical (should be in Phase 1 MVP)
1. **Auto-dialer / Power dialer** — PRD originally excluded this but C2C is the only call mode
2. **Lead scoring logic** — Schema ready, no scoring algorithm
3. **Auto-assign leads** (round-robin) — PRD §4.1.5 lists this as Phase 1
4. **Auto-escalation debt tier** — PRD §4.1.4 lists this as core
5. **Follow-up reminders** — `next_follow_up` field exists, no notification trigger
6. **Script display during call** — PRD §4.1.5 lists this as core campaign feature

### Important (improves UX significantly)
7. **Merge duplicate contacts** — Dedup by phone
8. **Bulk recording download** — Manager/QA workflow
9. **Waveform audio player** — Better QA review experience
10. **Live call monitoring dashboard** — Real-time agent activity grid
11. **Export Excel** — UI button for all list pages
12. **QA annotation at timestamp** — Mark specific moments in recording
13. **Attended transfer** — Agent introduces before transferring
14. **SLA reporting** — First response + resolution time tracking

### Phase 2 (planned, not yet started)
15. WebRTC in-browser calling (SIP.js)
16. AI transcription (speech-to-text)
17. AI call summary
18. Zalo OA / SMS integration
19. Listen/Whisper/Barge (call supervision)
20. Scheduled email reports
21. Auto-assign campaigns (round-robin)

### Phase 3 (future)
22. AI Chatbot / Callbot
23. Sentiment analysis
24. Omnichannel (FB, Web chat, Email)
25. No-code workflow builder
26. Mobile app
