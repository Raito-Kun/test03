# Phase 04 — Pages Migration

## Context Links
- Plan: [../plan.md](./plan.md)
- Phase 01 primitives: [./phase-01-design-tokens.md](./phase-01-design-tokens.md)
- Phase 02 shell: [./phase-02-layout-shell.md](./phase-02-layout-shell.md)

## Overview
- **Priority**: P2
- **Status**: pending
- **Effort**: ~2 days (can parallelize across 2 devs by page group)
- Apply tokens + primitives to every page. No business logic touched. Goal: visual consistency, not feature changes.

## Key Insights
- Tokens (phase-01) already auto-apply via CSS vars — 80% of pages will look correct with zero edits.
- Focus of this phase: replace hardcoded hex strings (e.g., `#29b6f6`, `bg-blue-500`) with semantic tokens; swap `<Card>` for `<DottedCard>` where mockup demands dotted frame; upgrade section headers to mono uppercase.
- Data tables (`data-table.tsx`) are the highest-impact single component — restyle once, all lists inherit.
- Detail dialogs (contact-detail-dialog, contact-merge-dialog, etc.) = lowest priority; ship with inherited tokens only.

## Requirements

### Functional
- Every page preserves: data fetch, mutations, permissions, navigation, tab sync.
- No route changes, no URL changes.
- Every page renders under the new shell (topbar + sidebar + status bar) without layout break.

### Non-functional
- Files stay <200 lines; split if a page hits limit.
- Lighthouse performance ≥ pre-migration.

## Page Migration Matrix

Legend: **A** = tokens-only (auto-applied); **B** = minor (swap `<Card>` → `<DottedCard>`, restyle headers); **C** = major (custom layout redesign).

### Top-level pages

| Page | File | Impact | Notes |
|---|---|---|---|
| Login | `pages/login.tsx` | B | Swap gradient to violet; add mono accent to form title; preserve auth flow |
| Dashboard | `pages/dashboard.tsx` | — | Rebuilt in **phase-03** |

### Contacts (CRM — Danh sách KH)

| Page | File | Impact | Notes |
|---|---|---|---|
| List | `pages/contacts/contact-list.tsx` | B | Data-table restyle propagates; header uses `SectionHeader` |
| Detail | `pages/contacts/contact-detail.tsx` | B | Wrap panels in `DottedCard` |
| Detail dialog | `pages/contacts/contact-detail-dialog.tsx` | A | Inherits |
| Form | `pages/contacts/contact-form.tsx` | A | Inherits |
| Merge dialog | `pages/contacts/contact-merge-dialog.tsx` | A | Inherits |
| Call history tab | `pages/contacts/call-history-tab.tsx` | B | Data-table restyle |
| Import wizard (3 files) | `contact-import-*` | A | Inherits |

### Leads (Nhóm khách hàng)

| Page | File | Impact | Notes |
|---|---|---|---|
| List | `pages/leads/lead-list.tsx` | B | Data-table + `SectionHeader` |
| Detail | `pages/leads/lead-detail.tsx` | B | `DottedCard` wrap |
| Form | `pages/leads/lead-form.tsx` | A | Inherits |

### Debt Cases (Công nợ)

| Page | File | Impact | Notes |
|---|---|---|---|
| List | `pages/debt-cases/debt-case-list.tsx` | B | Data-table restyle |
| Detail | `pages/debt-cases/debt-case-detail.tsx` | B | `DottedCard` wrap; check `CollectionKpiCards` uses new tokens |

### Campaigns (Chiến dịch)

| Page | File | Impact | Notes |
|---|---|---|---|
| List | `pages/campaigns/campaign-list.tsx` | B | Data-table restyle |
| Detail | `pages/campaigns/campaign-detail.tsx` | B | Tabs restyle; progress bars use violet token |
| Agents tab | `pages/campaigns/campaign-agents-tab.tsx` | A | Inherits |
| Contacts tab | `pages/campaigns/campaign-contacts-tab.tsx` | A | Inherits |
| Info form | `pages/campaigns/campaign-info-form.tsx` | A | Inherits |
| Create dialog | `pages/campaigns/campaign-create-dialog.tsx` | A | Inherits |
| Actions menu | `pages/campaigns/campaign-actions-menu.tsx` | A | Inherits |

### Call center (Tổng đài)

| Page | File | Impact | Notes |
|---|---|---|---|
| Call log list | `pages/call-logs/call-log-list.tsx` | B | Data-table; status badges use tokens |
| Call log detail | `pages/call-logs/call-log-detail.tsx` | B | Waveform panel + QA annotations in `DottedCard` |
| Extension config | `pages/settings/extension-config.tsx` | B | Restyle form; preserve PBX logic |

### Support (Hỗ trợ)

| Page | File | Impact | Notes |
|---|---|---|---|
| Ticket list | `pages/tickets/ticket-list.tsx` | B | Data-table |
| Ticket detail | `pages/tickets/ticket-detail.tsx` | B | `DottedCard` panels |
| Ticket form | `pages/tickets/ticket-form.tsx` | A | Inherits |
| Reports | `pages/reports/reports-page.tsx` | B | Tabs restyle |
| Report filters | `pages/reports/report-filters.tsx` | A | Inherits |
| Report summary tab | `pages/reports/report-summary-tab.tsx` | B | KPI cards → `KpiCell` where shape matches |
| Report detail tab | `pages/reports/report-detail-tab.tsx` | A | Inherits |
| Report charts tab | `pages/reports/report-charts-tab.tsx` | B | Chart colors from tokens (already `--chart-1..5`) |
| Report export button | `pages/reports/report-export-button.tsx` | A | Inherits |

### System (Hệ thống)

| Page | File | Impact | Notes |
|---|---|---|---|
| Settings root | `pages/settings/settings-page.tsx` | B | Section headers to mono |
| Permission manager | `pages/settings/permission-manager.tsx` | B | Matrix table styling |
| Team management | `pages/settings/team-management.tsx` | B | Data-table |
| Account management (2 files) | `account-management*.tsx` | B | Data-table |
| Account dialogs (3 files) | `account-create/edit/password-dialog.tsx` | A | Inherits |
| Account import dialog | `account-import-dialog.tsx` | A | Inherits |
| Cluster management | `pages/settings/cluster-management.tsx` | B | Cluster cards → `DottedCard` |
| Cluster detail form | `pages/settings/cluster-detail-form.tsx` | A | Inherits |
| Cluster discover result | `pages/settings/cluster-discover-result.tsx` | A | Inherits |
| Cluster dialplan picker | `pages/settings/cluster-dialplan-picker.tsx` | A | Inherits |
| Cluster network scan | `pages/settings/cluster-network-scan.tsx` | A | Inherits |
| Cluster preflight tab | `pages/settings/cluster-preflight-tab.tsx` | A | Inherits |
| Cluster feature flags tab | `pages/settings/cluster-feature-flags-tab.tsx` | A | Inherits |
| Cluster field help | `pages/settings/cluster-field-help.tsx` | A | Inherits |

### Monitoring (live)

| Page | File | Impact | Notes |
|---|---|---|---|
| Live dashboard | `pages/monitoring/live-dashboard.tsx` | B | Similar layout to Tổng quan; reuse `KpiStrip` subset |
| Live calls | `pages/monitoring/live-calls.tsx` | B | Data-table; live row flash uses violet |
| Agent status grid | `pages/monitoring/agent-status-grid.tsx` | B | Grid cards → `DottedCard` |
| Team stats | `pages/monitoring/team-stats.tsx` | B | KPI row; chart colors from tokens |
| Agent status card (internal) | `pages/monitoring/agent-status-card.tsx` | B | Restyle status dot + mono labels |

### Shared components to restyle (affects many pages)

| Component | File | Impact |
|---|---|---|
| Data table | `components/data-table/data-table.tsx` | **B — HIGH LEVERAGE** |
| Collection KPI cards | `components/collection-kpi-cards.tsx` | B |
| SLA dashboard widget | `components/sla-dashboard-widget.tsx` | B |
| Campaign progress bar | `components/campaign-progress-bar.tsx` | B |
| Waveform player | `components/waveform-player.tsx` | A |
| Audio player | `components/audio-player.tsx` | A |
| QA timestamp annotations | `components/qa-timestamp-annotations.tsx` | A |
| Page wrapper | `components/page-wrapper.tsx` | B — add mono page title |
| Cluster banner | `components/cluster-banner.tsx` | A |
| Monitoring components (4 files) | `components/monitoring/*.tsx` | B |

## Related Code Files

### Modify (B-impact, order of execution)
1. `components/data-table/data-table.tsx` (highest leverage)
2. `components/page-wrapper.tsx`
3. `components/collection-kpi-cards.tsx`, `sla-dashboard-widget.tsx`, `campaign-progress-bar.tsx`
4. `pages/login.tsx`
5. List pages (contacts, leads, debt, campaigns, call-logs, tickets) — detail pages follow
6. Settings pages
7. Monitoring pages

### Create
- None (reusing phase-01 primitives).

### Delete
- None.

## Implementation Steps

1. Restyle `data-table.tsx` — dotted row separators, mono column headers, token-based hover.
2. Restyle `page-wrapper.tsx` — apply `SectionHeader` pattern.
3. Walk B-impact pages in order, commit one group per PR for easy review/rollback.
4. For each page: diff against mockup-aligned style guide; replace hardcoded hex; no logic touched.
5. After each commit: `npm run build` + smoke dev.
6. Visual check: login, contacts list, contact detail, campaigns list, reports, cluster management, live-dashboard — most-trafficked paths.

## Todo List
- [ ] Restyle `data-table.tsx` (HIGH LEVERAGE)
- [ ] Restyle `page-wrapper.tsx`
- [ ] Restyle shared widgets (KPI cards, SLA, progress bar)
- [ ] Migrate `login.tsx`
- [ ] Migrate contacts pages (list, detail, call-history-tab)
- [ ] Migrate leads pages
- [ ] Migrate debt-cases pages
- [ ] Migrate campaigns pages
- [ ] Migrate call-logs pages
- [ ] Migrate tickets pages
- [ ] Migrate reports pages
- [ ] Migrate settings pages (settings, permissions, teams, accounts)
- [ ] Migrate cluster pages
- [ ] Migrate monitoring pages
- [ ] Manual click-through per role (agent, supervisor, admin, super_admin)

## Success Criteria
- Every page loads without console errors.
- Mutations (create/edit/delete) work as before — verified on contacts, leads, tickets, campaigns.
- RBAC behavior unchanged — verified by logging in as agent vs supervisor.
- Data tables sort/filter/paginate identically.
- No regression in Playwright tests in `e2e/` (existing tests).

## Risk Assessment
- **Risk**: accidental logic edit during visual pass.
  - **Mitigation**: review PR diffs filtered to `*.tsx` JSX only; no hook/store/service edits allowed in this phase.
- **Risk**: data-table restyle breaks column width calculations.
  - **Mitigation**: test on widest table (contacts list with filters) and narrowest (team list).
- **Risk**: file drift over 200 lines during restyle.
  - **Mitigation**: if >200, split immediately; do not defer.

## Security Considerations
- None — view-only changes.

## Next Steps
- Phase 05 runs full test suite + staged deploy.
