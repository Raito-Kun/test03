# Phase 04b Part 2 — Campaigns / Call-Logs / Monitoring Restyle

**Status:** Completed  
**Date:** 2026-04-20

---

## Files Touched

| File | Changes |
|---|---|
| `pages/campaigns/campaign-list.tsx` | SectionHeader replaces PageWrapper h1; STATUS_COLORS → CSS token vars; progress bar colors → CSS token vars; removed unused PageWrapper import |
| `pages/campaigns/campaign-detail.tsx` | Left panel `border rounded-lg` → `DottedCard`; STATUS_COLORS → STATUS_STYLE (CSS vars); Badge statuses → mono span with CSS token colors; breadcrumb text → mono uppercase |
| `pages/call-logs/call-log-list.tsx` | SectionHeader replaces PageWrapper h1; wrapper div replaces PageWrapper |
| `pages/call-logs/call-log-detail.tsx` | All 4 `<Card>` panels → `<DottedCard>`; field labels → `font-mono text-[11px] uppercase tracking-wider`; data values → `font-mono` where appropriate |
| `pages/monitoring/live-dashboard.tsx` | SectionHeader replaces PageWrapper h1; live sweep bar uses CSS token color; active-calls table → DottedCard with dotted row separators; hardcoded `text-rose-500`/`text-slate-*` → token vars |
| `pages/monitoring/agent-status-grid.tsx` | SectionHeader replaces PageWrapper h1; live sweep bar → CSS token; `text-slate-400` → `text-muted-foreground`; wrapper div replaces PageWrapper |
| `pages/monitoring/live-calls.tsx` | SectionHeader + DottedCard replaces PageWrapper; table headers → mono uppercase; status badge → mono span with `var(--color-status-ok)`; PhoneCall color → `var(--color-status-err)` |
| `pages/monitoring/team-stats.tsx` | SectionHeader replaces PageWrapper h1; `StatCard` internal → `DottedCard compact`; `h3` team labels → mono uppercase span; wrapper div replaces PageWrapper |
| `pages/monitoring/agent-status-card.tsx` | STATUS_CONFIG border/bg → border-token classes; `border-slate-200 shadow-sm rounded-xl` → `border-dotted-2 rounded-sm`; status color spans → CSS token vars; ext label → mono uppercase |

---

## Files Skipped (Impact A — auto-inherits, no edits needed)

- `campaign-agents-tab.tsx` — Impact A
- `campaign-contacts-tab.tsx` — Impact A
- `campaign-info-form.tsx` — Impact A
- `campaign-create-dialog.tsx` — Impact A
- `campaign-actions-menu.tsx` — Impact A

---

## Pre-existing Errors Left Alone

None found in target directories. `npx tsc --noEmit` reported **0 errors** both before and after changes.

Note: Phase spec warned about missing `VI.campaign.agentList`, `VI.campaign.addAgent`, `VI.campaign.categories`, `VI.campaign.queues` keys — these were not present as TS errors at time of execution (they may be runtime string lookups rather than typed TS keys). Left untouched per instructions.

---

## TS Verification

```
Before: 0 errors in pages/campaigns|call-logs|monitoring
After:  0 errors in pages/campaigns|call-logs|monitoring
Global: 0 errors total
```

---

## Restyle Rules Applied

1. Page h1 → `SectionHeader label=...` (PageWrapper replaced with plain `<div className="space-y-6">`)
2. `<Card>` → `<DottedCard header="...">`
3. Field labels → `font-mono text-[11px] uppercase tracking-wider text-muted-foreground`
4. Status colors → `var(--color-status-ok|warn|err)` via inline style or `style={{ color }}` pattern
5. Hardcoded `text-slate-*`, `text-green-*`, `bg-green-*` → token equivalents
6. Realtime hooks (refetchInterval, useMutation whisper) preserved exactly
7. Vietnamese labels preserved exactly
8. No functional changes, no new npm deps
