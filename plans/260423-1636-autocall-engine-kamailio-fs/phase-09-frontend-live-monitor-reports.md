---
phase: 09
title: "Frontend: live monitor + reports"
size: M
status: pending
---

# Phase 09 — Live Monitor + Reports

## Context
- KPI schema: [researcher-03](research/researcher-03-compliance-scheduler.md) (§ KPI Schema)
- Phase 05 socket emits; phase 06 CDR writes

## Overview
- Priority: P2
- Status: pending
- Two surfaces. Live monitor = realtime CCU, queue depth, agent table, campaign progress. Reports = historical (answer rate, talk time, agent occupancy, disposition breakdown, list penetration).

## Key Insights
- Live monitor reuses socket channel from phase 05; report charts reuse existing chart component library (`report-chart-service` server-side).
- Start with 4 core reports; more on request. YAGNI.
- Use `autocall.monitor` permission for both surfaces.

## Requirements
**Functional**
- Live monitor page (`/autocall/monitor`):
  - Header tiles: total active calls, idle agents, on-call agents, paused agents, abandoned % (last 15m).
  - Campaign table: name, status, leads remaining, active calls, answer rate (rolling).
  - Agent table: name, state, current call lead, time-in-state, calls-today.
  - Realtime via socket `autocall:monitor:tick` every 2s.
- Reports page (`/autocall/reports`):
  - Filters: date range, campaign(s), agent(s), cluster.
  - Charts: calls per hour, answer rate trend, agent occupancy, disposition pie.
  - Export CSV.

**Non-functional**
- Live monitor supports 50 agents + 10 campaigns visible without lag.
- Reports queries parameterize + indexed; ≤2s for 30-day range.

## Architecture

```
packages/frontend/src/pages/autocall/
├── AutocallMonitorPage.tsx
└── AutocallReportsPage.tsx

packages/frontend/src/pages/autocall/components/
├── MonitorHeaderTiles.tsx
├── MonitorCampaignTable.tsx
├── MonitorAgentTable.tsx
├── ReportFilters.tsx
├── ReportCallsPerHourChart.tsx
├── ReportAnswerRateChart.tsx
├── ReportOccupancyChart.tsx
└── ReportDispositionPie.tsx

packages/backend/src/services/
├── autocall-monitor-service.ts        # aggregates live state
└── autocall-report-service.ts         # SQL-heavy, uses indexes

packages/backend/src/routes/
└── autocall-monitor-routes.ts          # (already exists from phase 03)
```

## Related Code Files
**Create**: pages/components/services above + tests for report queries.

**Modify**: router, sidebar.

## Report SQL Sketches

- **Answer rate (hourly)**: `SELECT date_trunc('hour', started_at) AS ts, COUNT(*) FILTER (WHERE was_bridged) * 1.0 / COUNT(*) FROM autocall_calls WHERE campaign_id = $1 AND started_at BETWEEN $2 AND $3 GROUP BY 1`
- **Agent occupancy**: `SELECT agent_id, SUM(total_on_call_ms)::float / NULLIF(SUM(total_ready_ms+total_on_call_ms+total_wrap_ms),0) FROM autocall_agent_sessions ... GROUP BY 1`
- **Disposition pie**: `SELECT disposition, COUNT(*) FROM autocall_calls WHERE campaign_id = $1 AND disposition IS NOT NULL GROUP BY 1`
- **Calls per hour**: group by hour of day for heatmap.

## Implementation Steps
1. `autocall-monitor-service.getLive(clusterId)` → counts active calls/agents/state from in-memory + DB.
2. Socket emit `autocall:monitor:tick` with payload every 2s.
3. Live monitor page subscribes, renders tiles + tables.
4. `autocall-report-service` with 4 methods above, each parameterized + cached (TTL 60s).
5. Reports page uses same chart lib; export via server CSV.
6. Route permission `autocall.monitor`.

## Todo List
- [ ] Monitor service
- [ ] Monitor socket tick
- [ ] Monitor page + components
- [ ] Report service + SQL
- [ ] Report page + filters + charts
- [ ] CSV export
- [ ] Permission gate
- [ ] Tests on report SQL (snapshot with seeded data)
- [ ] Compile + lint

## Success Criteria
- Monitor shows correct counts while test campaign runs.
- Report for 7-day range returns <2s with 10k `autocall_calls` rows.
- CSV export matches chart data.

## Risk Assessment
- Monitor tick storm on 10 open browser tabs: socket namespace should broadcast once, not per-client query.
- Long-range reports hit planner inefficiency: add `(campaign_id, started_at)` composite index (already in phase 02 schema).

## Security
- `autocall.monitor` required; no PII in aggregate numbers. CSV export redacts lead phone if user lacks `crm.leads.view`.

## Next Steps
Unblocks phase 10 validation (load test measured via monitor).
