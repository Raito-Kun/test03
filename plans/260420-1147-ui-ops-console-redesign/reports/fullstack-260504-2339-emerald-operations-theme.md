---
title: "Emerald Operations theme + UI polishing pass"
date: 2026-05-04
worker: fullstack
plan: 260420-1147-ui-ops-console-redesign
status: DONE
deploy: dev (10.10.101.207) only
commits: uncommitted (working tree dirty)
---

# Emerald Operations theme + post-redesign UI polishing

Add-on micro-iteration on top of merged UI Ops Console redesign (phases 01-04). No backend contract changes besides one new chart aggregator.

## Scope

1. Theme migration: M3 lavender → Emerald Operations (CSS vars only, page files migrated for hardcoded hex)
2. Monitoring tab/select fix + active-status filter
3. Debt cases KPI: drop hardcoded mocks, compute from items
4. Reports page: 2×2 KPI grid + delta badge + hourly chart with waves + Vietnamese disposition labels
5. Call logs: inline audio popover on Mic icon (replaces detail dialog flow)
6. Login: Raito logo + disable browser autofill suggestions

## Theme tokens (`packages/frontend/src/app.css`)

```css
:root {
  --background: #f8f9ff;        /* gray-blue tint */
  --card: #ffffff;              /* pure white */
  --primary: #10B981;           /* emerald */
  --primary-foreground: #ffffff;
  --accent: #d1fae5;            /* emerald-100 */
  --accent-foreground: #065f46; /* emerald-800 */
  --border: #d1d5db;            /* slate-300 */
  --ring: #10B981;
  --radius: 0.5rem;             /* 8px */
  --pls-blue: #6ee7b7;          /* legacy alias → emerald-300 */
  --chart-1..5: emerald-led palette;
  --font-sans: 'Inter Variable', 'Geist Variable', sans-serif;
  --font-data: 'Space Grotesk Variable', ...;
  --sidebar: #ffffff;
  --sidebar-primary: #10B981;
  --sidebar-accent: #d1fae5;
}
```

Bulk regex on 8 page files: `bg-[#5434ae]→bg-primary`, `text-[#5434ae]→text-primary`, `bg-[#e8deff]→bg-accent`, `border-[#cdbdff]→border-accent`, `border-[#cac4d5]→border-border`. CSS-var-driven shadcn components adapt automatically.

## Page-level changes

### Monitoring (`pages/monitoring/{live-dashboard,agent-status-grid}.tsx`)
- Replaced non-clickable buttons with `<Link>` + `useLocation` matching for tabs.
- Inline-rendered Select labels: Base UI doesn't auto-resolve `<SelectValue />` → `<span>{LABELS[value]}</span>` inside SelectTrigger. Pattern reused from `call-log-list.tsx`.
- Added `'active'` filter value (excludes OFFLINE) separated from `'all'`. Default boot is `'active'` — fixed bug where "Đang hoạt động" showed OFFLINE agents.

### Debt cases (`pages/debt-cases/debt-case-list.tsx`)
```ts
const totalDebt = items.reduce((s, r) => s + (r.totalAmount ?? 0), 0);
const overdueDebt = items.reduce((s, r) =>
  s + (r.dpd > 0 ? (r.totalAmount - (r.paidAmount ?? 0)) : 0), 0);
const collected = items.reduce((s, r) => s + (r.paidAmount ?? 0), 0);
const recoveryRate = totalDebt > 0 ? (collected / totalDebt) * 100 : 0;
```
Fallback `—` when `items.length === 0`. Removed hardcoded `2.45 tỷ` etc.

### Reports (`pages/reports/reports-page.tsx` + backend `services/report-chart-service.ts`)
- 2×2 KPI grid (`grid-cols-1 gap-4 md:grid-cols-2`).
- Previous-period query computes previous date range = same length, ending day before from. Used for `%delta` badge: `Math.round(((kpi.totalCalls - prevTotal) / prevTotal) * 100)`.
- Backend hourly aggregator initializes 24 buckets at zero and bumps `byHour[log.startTime.getHours()].total/answered/missed`. Returns `Object.values(byHour).sort((a,b) => a.hour - b.hour)`.
- Frontend chart switched to hourly with `interval={2}`, tooltip `formatHourTick(h) → formatHourTick(h+1)`. Chart now has waves (no more single-bar flat).
- HANGUP_CAUSE_VI map for Vietnamese labels in PieChart tooltip.
- PIE_COLORS: `['#10B981', '#6ee7b7', '#9ca3af', '#d1d5db']`.
- Donut center % overlay: absolute-positioned div over `<PieChart>`.

### Inline audio popover (`pages/call-logs/call-log-list.tsx`, `components/audio-player.tsx`)
- Click Mic icon → Popover with inline `<AudioPlayer>`. URL `/api/v1/call-logs/${row.id}/recording?token=${getAccessToken()}`.
- Direction-aware extraction (matches table CALLER/DESTINATION column convention):
```ts
const externalNum = row.direction === 'inbound' ? row.callerNumber : (row.destinationNumber || '');
const agentExt = row.direction === 'inbound' ? (row.destinationNumber || '') : row.callerNumber;
const arrow = row.direction === 'inbound' ? '→' : '←';
// Header: {externalNum} {arrow} Ext {agentExt}
```
- Player refactored to vertical stack: progress bar with custom thumb, time row tabular numbers, controls row rounded-full filled-primary play button (h-9) + speed selector with mono "TỐC ĐỘ" label.

### Login (`pages/login.tsx`)
- Replaced Database icon with `raito.png` (`h-20 w-20` in card with dashed border + `h-10 w-10` in sidebar).
- Removed placeholders, added `autoComplete="off"` on form + `name="email-no-fill"` / `name="password-no-fill"` to bypass browser autofill suggestions.

## Encoding gotcha (recovered)

PowerShell `Set-Content -Encoding UTF8` writes BOM and corrupts UTF-8 Vietnamese diacritics ("Thành công" → "ThÃ nh cÃ´ng"). First bulk-replace attempt mangled multiple page files. Recovery:
1. Pulled correct files from dev server via `pscp -hostkey "..." -pw "..."` (still had pre-corruption copy).
2. Re-ran bulk replace using `[System.IO.File]::ReadAllText/WriteAllText` with `[System.Text.UTF8Encoding]::new($false)` (no BOM). Diacritics preserved.

Saved as memory: see `feedback_skill_field_naming.md` and adjacent feedback memories.

## Verification

- `tsc -b` clean for both backend and frontend.
- Playwright screenshot of login (`login-emerald.png`) confirms emerald theme rendering: gray-blue background, pure white card, emerald button + top stripe + focus ring + Active Cluster pill dot.
- Visual smoke pass: dashboard, monitoring (3 tabs clickable, Select labels render correctly, OFFLINE hidden under "active"), debt list KPIs computed live, reports hourly chart with waves, inline audio popover plays from token URL, login shows logo, no autofill prompt.

## Files Changed

Frontend:
- `packages/frontend/src/app.css` — Emerald Operations `:root` + dark-mode tokens preserved.
- `packages/frontend/src/pages/monitoring/{live-dashboard,agent-status-grid}.tsx`
- `packages/frontend/src/pages/debt-cases/debt-case-list.tsx`
- `packages/frontend/src/pages/reports/reports-page.tsx`
- `packages/frontend/src/pages/call-logs/call-log-list.tsx`
- `packages/frontend/src/components/audio-player.tsx`
- `packages/frontend/src/pages/login.tsx`
- 8 page files bulk-migrated for hardcoded color hex → CSS var classes.

Backend:
- `packages/backend/src/services/report-chart-service.ts` — added `callsByHour` aggregator (24 buckets, hour-of-day).

Assets:
- `packages/frontend/public/raito.png` (or wherever logo lives — referenced from login.tsx).

## Deploy

- Dev `10.10.101.207`: rsync source → `docker compose -f docker-compose.prod.yml build frontend backend && up -d`. Frontend rebuilt from source inside container (Dockerfile copies + builds — must push source, not `dist/`). Health 200, smoke pass.
- Prod `10.10.101.208`: NOT deployed. Gated by `feedback_prod_deployment_rule.md` literal phrase.

## Open items

- Commit + push working tree (P0 in `Current status/status.md`).
- Phase 05 of UI Ops Console plan still pending: E2E Playwright + visual regression baseline + staged deploy + rollback drill.
- Followup: review `wave-audio-player.tsx` and any remaining pages for stray hardcoded lavender hex (most adapt via CSS vars but spot-check before final commit).

## Status

**Status:** DONE
**Summary:** Emerald Operations palette + 5 page-level polish fixes (monitoring/debt/reports/call-logs/login) deployed dev, tsc clean, Playwright login screenshot verified.
**Concerns:** Working tree dirty 545+ files needs split-commit before cutting autocall branch.
