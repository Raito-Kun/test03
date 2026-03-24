# Brainstorm Report — PRD Review & Improvements

**Date:** 2026-03-24
**Type:** PRD Review
**File:** `Guildline/PRD.md`

## Problem Statement
Review PRD v2.0 for CRM Omnichannel Telesale & Collection. Identify gaps, inconsistencies, missing elements before implementation.

## Review Score: 7.5/10 → 9/10 (after fixes)

## Issues Found & Fixed

### P0 Critical (5 issues — ALL FIXED)
1. **Phase 1 over-scoped** — WebRTC moved to Phase 2. Phase 1 = Softphone mode only
2. **5 missing DB tables** — Added: audit_logs, notifications, contact_relationships, webhook_logs, agent_status_logs
3. **contacts.phone UNIQUE** — Changed to INDEX (VN KH may share phone numbers)
4. **disposition FK type wrong** — Changed VARCHAR → UUID FK
5. **3 more tables added** — tickets, ticket_categories, macros, campaign_disposition_codes

### P1 Should-fix (4 issues — ALL FIXED)
6. **Missing API endpoints** — Added: Teams, Agent Status, Tickets, Disposition Codes, QA Annotations, Notifications, Macros (7 new endpoint groups)
7. **Phiếu ghi system missing** — Added tickets + ticket_categories tables + API
8. **TURN/STUN missing from tech stack** — Added coturn for Phase 2 WebRTC
9. **Security specs missing** — Added: CORS, rate limiting, webhook IP whitelist, input sanitization, JWT rotation policy

### P2 Nice-to-have (3 issues — ALL FIXED)
10. **QA role missing** — Added 6th role "qa" to RBAC matrix + users.role enum
11. **UI wireframe missing** — Added Agent Workspace wireframe with Call Bar, Sidebar, Inbound Popup
12. **Macro/quick reply missing** — Added macros table + API

## Summary of Changes
- RBAC: 5 → 6 roles (added QA)
- DB: 9 → 18 tables (+9 new)
- API: ~30 → ~55 endpoints (+25 new, 7 new groups)
- Phase 1: Removed WebRTC (moved to Phase 2)
- Phase 2: Added WebRTC, campaign dispositions, macros
- Added: Security specs, pagination convention, UI wireframe
- Added: Phiếu ghi (tickets) feature section

## Remaining Considerations
- Data migration strategy from legacy systems (if any)
- Detailed wireframes for Manager Dashboard (Phase 2)
- AI provider selection and cost estimation (Phase 3)
- FusionPBX version confirmation (v4 vs v5)
- Recording format (.wav vs .mp3) — dialplan config
