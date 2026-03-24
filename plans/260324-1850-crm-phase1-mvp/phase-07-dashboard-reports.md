---
phase: 07
title: "Dashboard & Reports"
status: completed
priority: P2
effort: 3d
depends_on: [04, 05]
---

# Phase 07 — Dashboard & Reports

## Context Links
- [PRD](../../Guildline/PRD.md) — Sections 4.4.1, 4.4.3, 4.7, API 7.15
- [Plan Overview](./plan.md)

## Overview
Basic dashboard with real-time agent statuses, call statistics, and KPI summaries. Agent overview for managers. Simple reports endpoints. Import/export already handled in Phase 03.

## Key Insights
- Dashboard is real-time for agent statuses (via Socket.IO) and near-real-time for call stats (poll/refresh)
- Phase 1 dashboard = basic overview. Full KPI charts and detailed reports in Phase 2
- Agent status grid is the most critical real-time component for managers
- Aggregate queries on call_logs for stats; use Redis cache for frequently accessed counts

## Requirements
**Functional:**
- Dashboard overview: today's call counts (total, answered, missed), active calls count, online agent count
- Agent status grid: all agents with current status (ready/break/on_call/etc.), live updated
- Basic call report: calls grouped by day/agent, with direction and disposition breakdown
- Basic telesale report: leads by status, conversion counts
- Basic collection report: debt cases by status/tier, PTP counts
- All reports respect RBAC (agents see own, leaders see team, managers see all)

**Non-functional:**
- Dashboard loads < 500ms
- Agent status updates < 1s latency

## Related Code Files
**Create:**
- `packages/backend/src/routes/dashboard-routes.ts`
- `packages/backend/src/routes/report-routes.ts`
- `packages/backend/src/controllers/dashboard-controller.ts`
- `packages/backend/src/controllers/report-controller.ts`
- `packages/backend/src/services/dashboard-service.ts`
- `packages/backend/src/services/report-service.ts`

## Implementation Steps

### 1. Dashboard overview endpoint
1. `GET /dashboard/overview` — returns:
   ```json
   {
     "today": {
       "totalCalls": 150,
       "answeredCalls": 120,
       "missedCalls": 30,
       "avgDuration": 185,
       "activeCalls": 8
     },
     "agents": {
       "online": 15,
       "ready": 8,
       "onCall": 5,
       "break": 2,
       "wrapUp": 0
     },
     "leads": { "new": 20, "contacted": 45, "qualified": 12, "won": 3 },
     "debtCases": { "active": 50, "inProgress": 30, "promiseToPay": 15, "paid": 8 }
   }
   ```
2. Call stats: aggregate query on call_logs WHERE start_time >= today
3. Agent stats: read from Redis cache (agent_status:{userId})
4. Lead/debt stats: count queries with group by status
5. **[RED TEAM #14]** Cache in Redis for 30s. Cache key MUST include role + teamId to respect RBAC scope: `dashboard:overview:{role}:{teamId}`. Different roles see different aggregates — never serve one role's cached data to another.

### 2. Agent status dashboard
1. `GET /dashboard/agents` — returns all agents with current status, last status change time
2. Data source: Redis agent_status cache (populated by Phase 04)
3. Real-time updates: Socket.IO `agent:status_change` events (already implemented in Phase 04)
4. For leaders: filter by own team only

### 3. Call report
1. `GET /reports/calls` — query params: date_from, date_to, group_by (day/agent/direction)
2. SQL aggregation: COUNT, SUM(duration), SUM(billsec), grouped by requested dimension
3. Disposition breakdown: count per disposition_code within date range
4. RBAC: scope to own/team/all calls

### 4. Telesale report
1. `GET /reports/telesale` — query params: date_from, date_to, campaign_id
2. Lead funnel: count leads by status within period
3. Conversion rate: won / (won + lost)
4. Contacted rate: (contacted + qualified + proposal + won + lost) / total
5. Per-agent breakdown if manager

### 5. Collection report
1. `GET /reports/collection` — query params: date_from, date_to, campaign_id
2. Recovery rate: SUM(paid amounts) / SUM(original amounts)
3. PTP rate: count(promise_to_pay) / total contacted
4. Aging distribution: count by tier
5. Per-agent breakdown if manager

## Todo List
- [x] Dashboard overview endpoint (call stats, agent counts, lead/debt summary)
- [x] Agent status dashboard endpoint (all agents + current status)
- [x] Call report endpoint (grouped aggregation)
- [x] Telesale report endpoint (lead funnel + conversion)
- [x] Collection report endpoint (recovery + PTP + aging)
- [x] Redis caching for dashboard data (30s TTL)

## Success Criteria
- Dashboard loads with correct counts
- Agent statuses reflect real-time state
- Reports aggregate correctly with date range filters
- RBAC scoping works on all report endpoints

## Risk Assessment
- Large call_logs table slowing aggregation: add composite index (start_time, user_id, direction)
- Redis cache stale data: 30s TTL is acceptable for dashboard

## Security Considerations
- Reports respect data scope (agents never see other agents' stats unless leader/manager)
- No PII in dashboard aggregates (counts only, no individual records)
