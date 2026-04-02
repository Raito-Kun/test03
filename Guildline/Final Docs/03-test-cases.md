# CRM Omnichannel — Test Cases

## Phase 01: Infrastructure

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| 1.1 | `npm install` runs without errors | All dependencies installed | ✓ |
| 1.2 | `npm run dev` starts backend on port 4000 | Health check returns OK | ✓ |
| 1.3 | Database migrations run successfully | All tables created | ✓ |
| 1.4 | Redis connection established | Cache operations work | ✓ |

## Phase 02: Auth & CRUD

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| 2.1 | Login with valid credentials | Returns accessToken + refreshToken | ✓ |
| 2.2 | Login with invalid password | Returns 401 UNAUTHORIZED | ✓ |
| 2.3 | Refresh token rotation | Old refresh token invalidated, new pair issued | ✓ |
| 2.4 | Access protected route without token | Returns 401 | ✓ |
| 2.5 | Agent can only see own records | Data scoping filters by userId | ✓ |
| 2.6 | Manager sees team records | Data scoping filters by teamId | ✓ |
| 2.7 | Admin sees all records | No data scoping applied | ✓ |
| 2.8 | CRUD Contact: create, read, update, delete | All operations succeed | ✓ |
| 2.9 | CRUD Lead: create, read, update, delete | All operations succeed | ✓ |
| 2.10 | CRUD DebtCase: create, read, update | All operations succeed | ✓ |
| 2.11 | CRUD Campaign: create, read, update | All operations succeed | ✓ |
| 2.12 | Pagination with limit/offset | Returns correct page + total count | ✓ |
| 2.13 | Zod validation rejects invalid input | Returns 400 with validation errors | ✓ |

## Phase 03: CRM Features

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| 3.1 | Link contact to lead | Relationship created | ✓ |
| 3.2 | Lead status pipeline transition | new → contacted → qualified → won | ✓ |
| 3.3 | Activity timeline shows chronological events | Sorted by date DESC | ✓ |
| 3.4 | Macro template variable substitution | Variables replaced correctly | ✓ |

## Phase 04: VoIP Integration

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| 4.1 | ESL connects to FreeSWITCH | Connection established on port 8021 | ✓ |
| 4.2 | C2C originate call | Agent phone rings, then bridges to customer | ✓ |
| 4.3 | C2C with unregistered extension | Returns 409 EXT_NOT_REGISTERED | ✓ |
| 4.4 | CDR webhook receives XML | Webhook log created with status=received | ✓ |
| 4.5 | CDR webhook Basic Auth validation | Rejects invalid credentials (401) | ✓ |
| 4.6 | CDR webhook IP whitelist | Rejects non-whitelisted IP (403) | ✓ |

## Phase 05: Call History & QA

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| 5.1 | Call log list with pagination | Returns data array + meta.total | ✓ |
| 5.2 | Filter call logs by direction | Only inbound/outbound returned | ✓ |
| 5.3 | Filter call logs by date range | Only calls within range returned | ✓ |
| 5.4 | Filter call logs by hangupCause | Correct results filtered | ✓ |
| 5.5 | Recording proxy returns audio | HTTP 200, Content-Type: audio/mpeg | ✓ |
| 5.6 | Recording for non-existent call | HTTP 404 | ✓ |
| 5.7 | QA annotation with score | Score 1-10 saved and retrievable | ✓ |

## Phase 06: Ticketing

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| 6.1 | Create ticket | Ticket created with status=open | ✓ |
| 6.2 | Update ticket status | open → in_progress → resolved → closed | ✓ |
| 6.3 | Ticket priority levels | low, medium, high, urgent accepted | ✓ |
| 6.4 | Add comment to ticket | Comment saved and returned in detail | ✓ |

## Phase 07: Dashboard & Analytics

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| 7.1 | Dashboard KPIs load | Returns call count, lead count, etc. | ✓ |
| 7.2 | Agent performance report | Returns talk time, call count per agent | ✓ |
| 7.3 | Dashboard loads within 2 seconds | Response time < 2s | ✓ |

## Phase 08: Frontend UI

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| 8.1 | Login page submits credentials | Redirects to dashboard on success | ✓ |
| 8.2 | All 14 pages render without errors | No console errors, all data loads | ✓ |
| 8.3 | Data table pagination works | Page navigation updates results | ✓ |
| 8.4 | Form validation shows errors | Inline error messages displayed | ✓ |
| 8.5 | Toast notifications on CRUD operations | Success/error toasts shown | ✓ |

## Phase 09: Production

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| 9.1 | Docker build succeeds | Backend + frontend images built | ✓ |
| 9.2 | Docker compose starts all services | postgres, redis, backend, frontend healthy | ✓ |
| 9.3 | Nginx reverse proxy routes API calls | /api/* proxied to backend:4000 | ✓ |
| 9.4 | SSL/TLS termination | HTTPS on port 443 | ✓ |
| 9.5 | 49 unit/integration tests pass | All green | ✓ |

## Phase 10: Permissions

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| 10.1 | super_admin has all permissions | All 13 permissions granted | ✓ |
| 10.2 | Permission matrix toggle | Admin can toggle permissions for roles | ✓ |
| 10.3 | Permission cache invalidation | Changes apply within 5 minutes | ✓ |
| 10.4 | Agent without make_calls permission | C2C button hidden, API returns 403 | ✓ |

## Phase 11: Extension Mapping

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| 11.1 | Extension list shows registration status | Registered/Unregistered shown | ✓ |
| 11.2 | Reassign extension to different agent | DB updated, UI refreshed | ✓ |
| 11.3 | ESL unavailable graceful fallback | Shows "Unknown" status, no crash | ✓ |

## v1.1.1: CDR Dedup + SIP + i18n

### CDR Deduplication

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| C.1 | 1 outbound call → call_logs | Exactly 1 row created | ✓ |
| C.2 | Caller = agent extension (1005) | callerNumber = "1005" | ✓ |
| C.3 | Destination = customer phone | destinationNumber = "0901239894" | ✓ |
| C.4 | Duration = total ring + talk | Matches actual call length | ✓ |
| C.5 | Billsec = talk time only | Matches recording length, NOT inflated | ✓ |
| C.6 | sofia/internal/* legs skipped | Webhook log shows "Skipped agent SIP leg" | ✓ |
| C.7 | Orphan legs (no dest, no match) skipped | Webhook log shows "Skipped orphan leg" | ✓ |
| C.8 | Recording status = available | When billsec > 0 and recording path exists | ✓ |
| C.9 | Contact auto-linked | contactId populated if phone matches | ✓ |
| C.10 | Agent auto-linked | userId populated by extension match | ✓ |

### SIP Code Mapping

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| S.1 | Successful call (SIP 200) | Kết quả = "Thành công", Reason = "Answer" | ✓ |
| S.2 | Busy (SIP 486) | Kết quả = "Máy bận", Reason = "Busy" | ✓ |
| S.3 | Cancelled by agent (SIP 487) | Kết quả = "Hủy", Reason = "Request Terminated" | ✓ |
| S.4 | No answer (SIP 480) | Kết quả = "Không trả lời", Reason = "No Answer" | ✓ |
| S.5 | Server error (SIP 500) | Kết quả = "Lỗi server", Reason = "Internal Server Error" | ✓ |
| S.6 | No SIP code + ORIGINATOR_CANCEL | sipCode derived as 487 | ✓ |
| S.7 | No SIP code + NO_ANSWER | sipCode derived as 480 | ✓ |
| S.8 | Conflicting hangupCause + sipCode | sipCode wins for display | ✓ |

## Phase 12: Lead Scoring & Auto-Assignment

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| 12.1 | Lead score calculated on create | Score = sum of qualification + engagement + likelihood | ✓ |
| 12.2 | Auto-assign leads to user | Leads distributed round-robin | ✓ |
| 12.3 | Auto-assign leads to team | Team members receive evenly | ✓ |
| 12.4 | Auto-assign respects max capacity | Avoids overloading one agent | ✓ |
| 12.5 | Follow-up reminder cron triggers | Notifications sent at scheduled time | ✓ |
| 12.6 | GET /leads/follow-ups returns due leads | Only future_follow_up <= NOW returned | ✓ |

## Phase 13: Contact Merge & Export

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| 13.1 | Merge duplicate contacts | History consolidated, related records updated | ✓ |
| 13.2 | Merge by phone number | Dedup finds duplicates correctly | ✓ |
| 13.3 | Export contacts to Excel | File downloads with all visible columns | ✓ |
| 13.4 | Export with filters applied | Only filtered records included | ✓ |
| 13.5 | Export respects RBAC | Agent sees only own/team records | ✓ |
| 13.6 | Tags/segments UI on contact | Tags editable, saved to contact.tags | ✓ |

## Phase 14: Call Script Management

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| 14.1 | Create call script template | Script saved with variables | ✓ |
| 14.2 | Script variables substituted | {{contact.name}} → actual name | ✓ |
| 14.3 | Script displays during call | Panel auto-opens when call connected | ✓ |
| 14.4 | GET /scripts/active-call returns correct script | Based on campaign context | ✓ |
| 14.5 | Macro templates apply to tickets | Template text inserted with variable substitution | ✓ |

## Phase 15: Monitoring & QA Timestamps

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| 15.1 | Live monitoring dashboard loads | Real-time agent grid displayed | ✓ |
| 15.2 | Agent status auto-updates from ESL | Ringing → on_call → wrap-up transitions | ✓ |
| 15.3 | Wrap-up auto-timer counts down | 30s displayed, auto-transition after timeout | ✓ |
| 15.4 | Inbound call popup shows recent history | Last 5 calls with customer displayed | ✓ |
| 15.5 | Inbound call popup shows ticket count | Associated tickets listed | ✓ |
| 15.6 | QA timestamp annotation created | Marker at specific time saved | ✓ |
| 15.7 | QA timestamp markers displayed in player | Clickable markers in timeline | ✓ |
| 15.8 | Bulk recording download creates ZIP | All selected recordings included with metadata CSV | ✓ |
| 15.9 | Campaign progress bar updates | % completion = (assigned + contacted + won) / total | ✓ |
| 15.10 | Attended transfer (warm transfer) | Agent consults before transferring | ✓ |
| 15.11 | Auto-escalation debt tier | Daily cron escalates overdue cases | ✓ |
| 15.12 | SLA report calculates times | First response & resolution time per agent | ✓ |

## Phase 16: Integration & End-to-End

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| 16.1 | Full call lifecycle with script | Click-to-call → script display → call end → wrap-up timer | ✓ |
| 16.2 | Lead to contact to debt case flow | Relationships maintained throughout | ✓ |
| 16.3 | Campaign management with auto-assign | Import → assign → progress tracking → completion | ✓ |
| 16.4 | Export after bulk operations | All changes reflected in export | ✓ |
| 16.5 | Dashboard KPIs reflect all updates | Contact/close/PTP/recovery rates accurate | ✓ |
| 16.6 | RBAC enforced on all new endpoints | Agents see own data, managers see team | ✓ |
| 16.7 | Real-time monitoring during active calls | Dashboard updates as calls connect/end | ✓ |
| S.9 | SIP fields written once (first leg wins) | Later legs don't overwrite sipCode | ✓ |

### Vietnamese Localization

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| V.1 | Direction filter default | Shows "Tất cả hướng" (not "all") | ✓ |
| V.2 | Select "Gọi ra" then reset | Shows "Tất cả hướng" after reset | ✓ |
| V.3 | Result filter shows Vietnamese | "Thành công", "Máy bận", etc. | ✓ |
| V.4 | All list pages: lead, ticket, campaign, debt | Dropdowns show Vietnamese text | ✓ |

### Call Source Tagging

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| T.1 | C2C call → Phân loại column | Shows "C2C" | ✓ |
| T.2 | crm_call_source variable in CDR | Stored in notes field | ✓ |
| T.3 | No call source → Phân loại | Shows "—" | ✓ |

### Recording

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| R.1 | rsync cron runs every minute | New recordings synced | ✓ |
| R.2 | Recording API returns audio | HTTP 200, Content-Type: audio/mpeg | ✓ |
| R.3 | Audio player in call detail | Plays recording with duration display | ✓ |
| R.4 | Local file served first | Faster than upstream proxy | ✓ |

### Nginx & Deploy

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| N.1 | index.html no-cache headers | Cache-Control: no-cache, no-store | ✓ |
| N.2 | JS assets immutable cache | Cache-Control: public, immutable (1yr) | ✓ |
| N.3 | Hard refresh loads new code | New JS chunks fetched after deploy | ✓ |
