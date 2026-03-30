---
title: "Phase 13 — Gap Closure & Feature Completion"
status: in_progress
priority: P1
created: 2026-03-30
---

# Phase 13 — Gap Closure & Feature Completion

## Rule: NEW FILES ONLY — do not modify existing working code

## Group A — Frontend New Components (Agent 1)
1. **Waveform audio player** — `packages/frontend/src/components/waveform-player.tsx` (wavesurfer.js)
2. **Campaign progress bar** — `packages/frontend/src/components/campaign-progress-bar.tsx`
3. **Tags/segments editor** — `packages/frontend/src/components/tags-editor.tsx`
4. **Family relationships panel** — `packages/frontend/src/components/family-relationships-panel.tsx` (người bảo lãnh)

## Group B — Frontend Feature Pages (Agent 2)
5. **QA timestamp annotations** — wire into call detail: `packages/frontend/src/components/qa-annotation-inline.tsx`
6. **Inbound call popup enhanced** — `packages/frontend/src/components/inbound-call-history-panel.tsx` (full call history + ticket count)
7. **Collection KPI cards** — `packages/frontend/src/components/collection-kpi-cards.tsx` (PTP rate, RPC, recovery, wrap-up avg)
8. **SLA dashboard widget** — `packages/frontend/src/components/sla-dashboard-widget.tsx`

## Group C — Backend New Services (Agent 3)
9. **Right Party Contact tracking** — `packages/backend/src/services/right-party-contact-service.ts`
10. **SLA alert service** — `packages/backend/src/services/sla-alert-service.ts` (breach notification)
11. **Campaign progress service** — `packages/backend/src/services/campaign-progress-service.ts` (real-time % calc)
12. **Family/guarantor service** — `packages/backend/src/services/guarantor-service.ts` + route

## Group D — Backend Routes & Integration (Agent 4)
13. **Guarantor routes** — `packages/backend/src/routes/guarantor-routes.ts`
14. **Campaign progress route** — `packages/backend/src/routes/campaign-progress-routes.ts`
15. **RPC tracking route** — `packages/backend/src/routes/rpc-routes.ts`
16. **SLA alert route** — `packages/backend/src/routes/sla-alert-routes.ts`
17. **Wire new routes into index.ts** — register all new routes (minimal change to existing)

## Success Criteria
- [ ] Waveform player renders waveform with wavesurfer.js
- [ ] Campaign list shows progress bar per campaign
- [ ] Tags editor works on contact detail
- [ ] Family relationships CRUD for debt contacts
- [ ] QA annotations visible in call detail page
- [ ] Collection KPI cards on dashboard
- [ ] SLA widget shows breach alerts
- [ ] Right Party Contact metric tracked
- [ ] All new routes registered and responding
- [ ] TypeScript compiles with no errors

## Dependencies
- wavesurfer.js npm package needed
- Existing Prisma schema already has guarantor field on DebtCase
- Existing dashboard-service already computes PTP/recovery rates
