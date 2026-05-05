---
type: deploy-report
date: 2026-04-21 19:27 +0700
target: 10.10.101.207 (dev)
branch: feat/ui-ops-console-redesign
---

# Call Logs UX Refresh + CDR Billsec Invariant + Ticket Ext Search

## Scope

1. Call History column semantics corrected (Lý do SIP → English short labels; Phân loại strict 4-type; new Trạng thái column with inline edit + audit).
2. Disposition edit audit trail — new DB fields + enhanced audit payload.
3. CDR merge billsec invariant — unanswered calls forced to `billsec=0` at merge time; legacy rows backfilled.
4. Ticket Kanban card: creator ext label clearer; search also matches ext.
5. Disposition filter added to call-logs toolbar.

## Changes

### DB
- Migration `20260421183000_add_disposition_set_by` — +2 cols on `call_logs` (`disposition_set_by_user_id`, `disposition_set_at`), FK to users.
- Backfill: 61 rows where `answer_time IS NULL AND billsec > 0` → reset to 0.

### Backend
- `packages/backend/prisma/schema.prisma` — named User relations (`CallLogAgent`, `CallLogDispositionSetBy`).
- `packages/backend/src/services/disposition-code-service.ts` — `setCallDisposition` populates who/when, audit payload upgraded to `{field, previous, next, reason}`, no longer overwrites `notes`.
- `packages/backend/src/services/call-log-service.ts` — list select exposes `dispositionSetBy` + `dispositionSetAt`, `callType` filter accepts `callbot`, manual catch-all excludes `callbot`.
- `packages/backend/src/controllers/call-log-controller.ts` — `callType` union extended.
- `packages/backend/src/lib/cdr-merge.ts` — invariant `if (!answerTime) return 0`.
- `packages/backend/tests/cdr-merge.test.ts` — updated expectation: `answerTime=null` → billsec=0.

### Frontend
- `packages/frontend/src/pages/call-logs/call-log-list.tsx`
  - Lý do SIP → `Answered`/`Busy`/`No answer`/`Cancelled`/`Rejected`/`Voicemail`/...
  - Phân loại column strict 4-type (Manual/Click2call/Autocall/Callbot), removed disposition-leak.
  - Trạng thái column new — inline shadcn Select dropdown; tooltip "Cập nhật bởi X lúc Y".
  - Disposition filter dropdown in toolbar.
  - Phân loại filter dropdown: +Callbot option.
- `packages/frontend/src/pages/tickets/ticket-card.tsx` — `#{ext}` → `Tạo: #{ext}` + tooltip.
- `packages/frontend/src/pages/tickets/use-ticket-kanban.ts` — filter matches `agentExt`.
- `packages/frontend/src/pages/tickets/ticket-list.tsx` — placeholder `Tìm KH / SĐT / Ext...`.

### Docs + skills
- `docs/project-changelog.md` — v1.3.10 entry.
- `.claude/rules/pbx-incident-patterns.md` — new 2026-04-21 (pm) billsec-leak entry + Symptom-table row.
- `.claude/skills/crm-pbx-cluster/SKILL.md` — CDR Leg Semantics section now documents the invariant.

## Verification

- `npx vitest run tests/cdr-merge.test.ts` — 7/7 pass.
- Backend + frontend `tsc --noEmit` — clean.
- Dev containers up: backend (healthy), frontend (up), postgres + redis (healthy).
- DB check: `SELECT COUNT(*) FROM call_logs WHERE answer_time IS NULL AND billsec > 0` → 0 rows.
- `\d call_logs` confirms new cols + FK.

## Rules preserved

- SIP sub-reason stays English (memory rule `feedback_sip_reasons_english.md`).
- Disposition VI label only shown in "Trạng thái" column; top-level "Kết quả" remains VI.

## Unresolved

1. RBAC on disposition edit — currently any authenticated user with call-logs access can change any row's Trạng thái. Should it be restricted to row owner + leader/admin? (flagged earlier, no answer yet)
2. `GET /call-logs/:id/audit` endpoint — not exposed. To view full change history, need to SQL `audit_logs` table directly.
3. PROD deploy — gated on explicit `"Deploy to Server PROD"` phrase; pending user confirmation.
