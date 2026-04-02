# CRM Omnichannel — Function & Feature Reference

## 1. Authentication & Authorization

| Function | Endpoint | Description |
|----------|----------|-------------|
| Login | `POST /auth/login` | Email/password → JWT access + refresh tokens |
| Refresh | `POST /auth/refresh` | Refresh token → new access token |
| Logout | `POST /auth/logout` | Invalidate refresh token |
| Change Password | `POST /auth/change-password` | Update user password |

**Roles**: super_admin, admin, manager, leader, qa, agent_telesale, agent_collection

**Permissions** (13 keys): view_reports, make_calls, export_excel, view_recordings, manage_campaigns, manage_users, manage_permissions, manage_extensions, view_dashboard, manage_tickets, manage_debt_cases, manage_leads, manage_contacts

## 2. Contact Management

| Function | Endpoint | Description |
|----------|----------|-------------|
| List | `GET /contacts` | Paginated list with search/filter |
| Detail | `GET /contacts/:id` | Full contact with relationships |
| Create | `POST /contacts` | New contact |
| Update | `PATCH /contacts/:id` | Update fields |
| Delete | `DELETE /contacts/:id` | Soft delete |
| Import CSV | `POST /contacts/import` | Bulk import from CSV |
| Merge | `POST /contacts/merge` | Merge duplicate contacts |

**Custom Fields**: Tags, segments, custom JSON fields all supported. Extended in v1.2.0.

## 3. Lead Management

| Function | Endpoint | Description |
|----------|----------|-------------|
| List | `GET /leads` | Paginated with status filter |
| Detail | `GET /leads/:id` | Full lead with contact link |
| Create | `POST /leads` | New lead |
| Update | `PATCH /leads/:id` | Update fields + status transition |
| Delete | `DELETE /leads/:id` | Soft delete |
| Import CSV | `POST /leads/import` | Bulk import |
| Score Lead | `POST /leads/score` | Recalculate lead score |
| Auto-Assign | `POST /leads/assign` | Round-robin assignment to users |
| Follow-ups | `GET /leads/follow-ups` | Get leads due for follow-up |

**Status Pipeline**: new → contacted → qualified → proposal → won / lost

**Lead Scoring**: Rule-based on qualification, engagement, conversion likelihood. Auto-updated on status changes.

## 4. Debt Case Management

| Function | Endpoint | Description |
|----------|----------|-------------|
| List | `GET /debt-cases` | Paginated with tier/status filter |
| Detail | `GET /debt-cases/:id` | Full case with payment history |
| Create | `POST /debt-cases` | New debt case |
| Update | `PATCH /debt-cases/:id` | Update fields |
| Escalate Tier | `POST /debt-cases/escalate` | Manual tier escalation |

**Tiers**: tier_1, tier_2, tier_3, tier_4, tier_5

**Auto-Escalation**: Daily cron escalates tier based on days overdue. Manual endpoint allows instant escalation by manager.

## 5. VoIP & Call Management

### 5.1 Click-to-Call (C2C)

| Function | Endpoint | Description |
|----------|----------|-------------|
| Originate | `POST /calls/originate` | Ring agent phone → bridge to customer |
| Hangup | `POST /calls/hangup` | End active call |
| Hold | `POST /calls/hold` | Put call on hold |
| Transfer (Blind) | `POST /calls/transfer` | Transfer to another extension |
| Transfer (Attended) | `POST /calls/attended-transfer` | Warm transfer (agent consults first) |

**C2C Flow**:
```
CRM API → ESL originate → FreeSWITCH rings agent (Eyebeam)
→ agent answers → loopback bridge → outbound route → customer phone
```

**Call Source Tagging**: ESL sets `crm_call_source=c2c` variable. Future: `autocall`, `manual`, `inbound`

### 5.2 CDR Webhook

| Function | Endpoint | Description |
|----------|----------|-------------|
| CDR Reception | `POST /webhooks/cdr` | Receive XML CDR from FreeSWITCH |

**CDR Deduplication (v8)**:
- FusionPBX sends 2-4 CDR legs per call with different UUIDs
- Legs with destination: use `other_loopback_leg_uuid` as canonical UUID
- Legs without destination: time-window search (60s) by caller/dest
- Skip `sofia/internal/*` legs (inflated billsec)
- Skip orphan legs (no dest, no match)
- Result: 1 physical call = exactly 1 row in `call_logs`

**SIP Code Derivation** (when CDR has no sipCode):

| hangupCause | → sipCode |
|-------------|-----------|
| ORIGINATOR_CANCEL | 487 |
| NO_ANSWER | 480 |
| USER_BUSY | 486 |
| CALL_REJECTED | 403 |
| UNALLOCATED_NUMBER | 404 |
| NORMAL_CLEARING (billsec>0) | 200 |

### 5.3 Call History

| Function | Endpoint | Description |
|----------|----------|-------------|
| List | `GET /call-logs` | Paginated with filters |
| Detail | `GET /call-logs/:id` | Full call detail |
| Recording | `GET /call-logs/:id/recording` | Stream recording audio |
| Bulk Download | `POST /call-logs/bulk-download` | ZIP archive of filtered recordings |

**Call Log Columns**:

| Column | Source | Description |
|--------|--------|-------------|
| Hướng | direction | Gọi ra / Gọi vào |
| Số gọi | callerNumber | Agent extension |
| Số nhận | destinationNumber | Customer phone |
| Nhân viên | user.fullName | Agent name |
| Thời lượng | duration | Total ring + talk (seconds) |
| Thời gian nói | billsec | Talk time only (from external trunk) |
| Ghi âm | recordingStatus | Mic icon if available |
| Kết quả | sipCode → VI map | Vietnamese result (see mapping below) |
| SIP Code | sipCode | Raw SIP response code |
| SIP Reason | sipCode → EN map | Human-readable SIP reason |
| Phân loại | notes (crm_call_source) | C2C, Auto Call, Thủ công, Gọi vào |

### 5.4 SIP Code Mapping Tables

**Kết quả (Vietnamese)**:

| SIP Code | Display |
|----------|---------|
| 200 | Thành công |
| 486 | Máy bận |
| 487 | Hủy |
| 480 | Không trả lời |
| 404 | Số không tồn tại |
| 403 | Từ chối cuộc gọi |
| 408 | Hết thời gian |
| 500 | Lỗi server |
| 503 | Dịch vụ không khả dụng |
| (none) | Falls back to hangupCause mapping |

**SIP Reason (English)**:

| SIP Code | Display |
|----------|---------|
| 200 | Answer |
| 486 | Busy |
| 487 | Request Terminated |
| 480 | No Answer |
| 404 | Not Found |
| 403 | Forbidden |
| 408 | Request Timeout |
| 500 | Internal Server Error |
| 503 | Service Unavailable |
| (unmapped) | SIP Error (raw_value) |

**HangupCause Fallback** (when no SIP Code):

| hangupCause | Kết quả | SIP Reason |
|-------------|---------|------------|
| NORMAL_CLEARING | Thành công | Answer |
| ORIGINATOR_CANCEL | Hủy | Request Terminated |
| NO_ANSWER | Không trả lời | No Answer |
| USER_BUSY | Máy bận | Busy |
| CALL_REJECTED | Từ chối cuộc gọi | — |
| UNALLOCATED_NUMBER | Số không tồn tại | — |
| RECOVERY_ON_TIMER_EXPIRE | Hết thời gian | — |
| SUBSCRIBER_ABSENT | Thuê bao không liên lạc được | — |
| NORMAL_TEMPORARY_FAILURE | Lỗi tạm thời | — |

### 5.5 Recording

- **Sync**: rsync cron (every minute) from FusionPBX to CRM server
- **Storage**: `/opt/crm/recordings/crm/archive/YYYY/Mon/DD/`
- **Playback**: Local file served first, fallback to upstream FusionPBX proxy
- **Format**: MP3 (FusionPBX default)

### 5.6 Agent Status & Extensions

| Function | Endpoint | Description |
|----------|----------|-------------|
| List Extensions | `GET /extensions` | All extensions with registration status |
| Assign Extension | `PUT /extensions/:ext/assign` | Reassign to agent |

## 6. Campaign Management

| Function | Endpoint | Description |
|----------|----------|-------------|
| List | `GET /campaigns` | Paginated with status/type filter |
| Detail | `GET /campaigns/:id` | Campaign with leads |
| Create | `POST /campaigns` | New campaign |
| Update | `PATCH /campaigns/:id` | Update fields |
| Import | `POST /campaigns/import` | Bulk import leads to campaign |

**Types**: telesale, collection, survey, inbound
**Statuses**: draft, active, paused, completed, archived

## 7. Support Ticketing

| Function | Endpoint | Description |
|----------|----------|-------------|
| List | `GET /tickets` | Paginated with status/priority filter |
| Detail | `GET /tickets/:id` | Full ticket with comments |
| Create | `POST /tickets` | New ticket |
| Update | `PATCH /tickets/:id` | Update status/assignment |
| Categories | `GET /ticket-categories` | List categories |

**Statuses**: open, in_progress, resolved, closed
**Priorities**: low, medium, high, urgent

## 8. Dashboard & Reports

| Function | Endpoint | Description |
|----------|----------|-------------|
| Dashboard | `GET /dashboard` | KPI summary with contact/close/PTP/recovery rates |
| Agent Performance | `GET /reports/agent-performance` | Talk time, call count, wrap-up avg |
| Campaign ROI | `GET /reports/campaign-roi` | Cost per lead, conversion |
| Contact Funnel | `GET /reports/contact-funnel` | Lead conversion pipeline |
| SLA Report | `GET /reports/sla` | First response & resolution time by agent/team |
| Live Monitoring | `GET /monitoring/live` | Real-time agent grid with current calls |

## 9. Permission Management

| Function | Endpoint | Description |
|----------|----------|-------------|
| List Permissions | `GET /permissions` | All permission keys |
| Update Role | `PUT /permissions/role/:role` | Set role permissions |
| My Permissions | `GET /permissions/user` | Current user's permissions |

## 10. User & Team Management

| Function | Endpoint | Description |
|----------|----------|-------------|
| List Users | `GET /users` | All users with roles |
| Update User | `PATCH /users/:id` | Update role/team/extension |
| List Teams | `GET /teams` | All teams |
| CRUD Teams | `POST/PATCH/DELETE /teams` | Team management |

## 11. Call Scripts

| Function | Endpoint | Description |
|----------|----------|-------------|
| List | `GET /scripts` | All scripts |
| Detail | `GET /scripts/:id` | Full script with variables |
| Create | `POST /scripts` | New call script template |
| Update | `PATCH /scripts/:id` | Update script content |
| Delete | `DELETE /scripts/:id` | Delete script |
| Active Scripts | `GET /scripts/active` | Scripts for active campaign |
| Default Scripts | `GET /scripts/default` | Default script templates |
| Current Call | `GET /scripts/active-call` | Script for current call context |

**Features**: Variable substitution ({{contact.name}}, {{lead.status}}), auto-display during call, per-campaign templates.

## 12. QA & Annotations

| Function | Endpoint | Description |
|----------|----------|-------------|
| Create Timestamp | `POST /qa-timestamps` | Add annotation at timestamp |
| List Timestamps | `GET /qa-timestamps/:callLogId` | All annotations for call |
| Delete Timestamp | `DELETE /qa-timestamps/:id` | Remove annotation |

**Features**: Mark specific moments in recording for QA review, timestamp-based markers in player UI.

## 13. Macro Templates

| Function | Endpoint | Description |
|----------|----------|-------------|
| Apply Macro | `POST /macros/apply` | Substitute variables & insert template text |

**Usage**: Quick-reply presets for tickets, variable substitution, linked to ticket UI.

## 14. Export

| Function | Endpoint | Description |
|----------|----------|-------------|
| Export Entity | `GET /export/:entity` | Download paginated data as Excel |

**Entities**: contacts, leads, debt-cases, call-logs, campaigns, tickets

**Features**: Filters applied to export, RBAC-scoped data, direct browser download.
