# Phase 01 — Design Tokens & Primitives

## Context Links
- Plan: [../plan.md](./plan.md)
- Gap analysis: [./research/api-gap-analysis.md](./research/api-gap-analysis.md)
- Current tokens: `packages/frontend/src/app.css`
- shadcn/ui primitives: `packages/frontend/src/components/ui/`

## Overview
- **Priority**: P2 (blocker for all later phases)
- **Status**: pending
- **Effort**: ~0.5 day
- Establish Ops Console color/typography/shape tokens as CSS variables in existing `app.css`. Add one mono font, dotted border utility, and a tiny primitives set. No component rewrites yet.

## Key Insights
- Tailwind v4 + shadcn/ui already drives all theming via CSS custom properties → token swap is non-breaking if we preserve variable names (`--background`, `--foreground`, `--primary`, `--border`, `--sidebar-*`).
- Existing `pls-blue/green/yellow/red` vars used sparingly; keep as aliases pointing to new violet palette.
- `@fontsource-variable/geist` already installed; adding `@fontsource-variable/jetbrains-mono` is the only new dep.
- Dark mode exists but mockup is light-only → keep `.dark` block untouched (no regression), drop dark toggle UI in phase-02.

## Requirements

### Functional
- New palette applied globally via `:root` vars; existing components inherit automatically.
- Mono font available as `font-mono` utility AND as `--font-mono` var for components that want mono explicitly.
- `.border-dotted-2` utility (2px dotted) for card frames.
- Reusable micro-primitives: `<StatusBar>`, `<DottedCard>`, `<KpiCell>`, `<Sparkline>` (SVG) — each <80 lines.

### Non-functional
- Zero behavior change; visual-only.
- All tokens must pass WCAG AA contrast on cream background.
- Bundle size impact <30KB gzipped (font + primitives).

## Architecture

### Token mapping (old → new)
| Variable | Old | New (Ops Console) |
|---|---|---|
| `--background` | `#f0f6fc` | `#faf9f5` (cream) |
| `--foreground` | `oklch(0.145 0 0)` | `#1e1838` |
| `--card` | `#ffffff` | `#ffffff` (unchanged) |
| `--primary` | `#29b6f6` | `#a78bfa` (violet-400) |
| `--accent` | `#f0f8ff` | `#ede9fe` (violet-100) |
| `--border` | `#cce5f6` | `#d6d3c7` (warm gray) |
| `--sidebar` | `#0d2137` | `#1e1838` (dark indigo) |
| `--sidebar-primary` | `#29b6f6` | `#c4b5fd` (violet-300) |
| `--sidebar-accent` | `rgba(41,182,246,0.15)` | `rgba(196,181,253,0.15)` |
| `--ring` | `#29b6f6` | `#a78bfa` |

### New tokens (additions)
```css
--font-mono: 'JetBrains Mono Variable', ui-monospace, monospace;
--color-status-ok: #10b981;    /* green */
--color-status-warn: #f59e0b;  /* amber */
--color-status-err: #ef4444;   /* red */
--color-dotted: #d6d3c7;
```

### Primitives (new files)

| File | Purpose | Lines budget |
|---|---|---|
| `packages/frontend/src/components/ops/dotted-card.tsx` | Card with 2px dotted border, optional header strip | ~40 |
| `packages/frontend/src/components/ops/kpi-cell.tsx` | Label + big value + sparkline + delta | ~60 |
| `packages/frontend/src/components/ops/sparkline.tsx` | Pure SVG, no deps, accepts `number[]` | ~35 |
| `packages/frontend/src/components/ops/status-bar.tsx` | Bottom fixed DOS-style bar | ~80 |
| `packages/frontend/src/components/ops/section-header.tsx` | Uppercase mono section label with line | ~25 |

## Related Code Files

### Modify
- `packages/frontend/src/app.css` — replace token values, add mono font import, add `@utility border-dotted-2`
- `packages/frontend/package.json` — add `@fontsource-variable/jetbrains-mono`

### Create
- `packages/frontend/src/components/ops/dotted-card.tsx`
- `packages/frontend/src/components/ops/kpi-cell.tsx`
- `packages/frontend/src/components/ops/sparkline.tsx`
- `packages/frontend/src/components/ops/status-bar.tsx`
- `packages/frontend/src/components/ops/section-header.tsx`
- `packages/frontend/src/lib/use-sparkline-buffer.ts` — hook that buffers last N values from a React Query result

### Delete
- None.

## Implementation Steps

1. `npm i @fontsource-variable/jetbrains-mono -w @crm/frontend`
2. Edit `app.css`:
   - add `@import "@fontsource-variable/jetbrains-mono";`
   - update `--font-mono` in `@theme inline`
   - swap `:root` var values per mapping table above
   - keep `.dark` block untouched
   - add `@utility border-dotted-2 { border-width: 2px; border-style: dotted; border-color: var(--color-dotted); }`
3. Create 5 primitives in `components/ops/` — each <80 lines, props-only, no store access.
4. Create `use-sparkline-buffer.ts` — stores last 7 values in a `useRef`, updated on each data change.
5. Run `npm run build` inside `packages/frontend`; fix TS errors if any.
6. Smoke test: run dev, visit `/`, confirm no visual breakage of existing dashboard (colors shift but layout intact).

## Todo List
- [ ] Install JetBrains Mono font package
- [ ] Update `app.css` token values
- [ ] Add `border-dotted-2` utility
- [ ] Create `dotted-card.tsx`
- [ ] Create `sparkline.tsx`
- [ ] Create `kpi-cell.tsx`
- [ ] Create `status-bar.tsx`
- [ ] Create `section-header.tsx`
- [ ] Create `use-sparkline-buffer.ts`
- [ ] `npm run build` — zero TS errors
- [ ] Visual smoke test — existing pages still render

## Success Criteria
- All existing pages render without layout regressions (spacing, overflow).
- Primary violet is applied to buttons, links, focus rings.
- Mono font visibly in use when a dev adds `className="font-mono"`.
- TS build green.
- No console errors.

## Risk Assessment
- **Risk**: shadcn variants reference `--primary-foreground` which may need contrast adjust on violet.
  - **Mitigation**: set `--primary-foreground: #ffffff` (passes AA on `#a78bfa`).
- **Risk**: 3rd-party chart in `recharts` may not pick up new chart colors.
  - **Mitigation**: chart colors already read `--chart-1..5`; just remap those too.
- **Risk**: font loading flash (FOUT).
  - **Mitigation**: `@fontsource-variable` preloads; acceptable.

## Security Considerations
- None — tokens are CSS only.

## Next Steps
- Phase 02 consumes `DottedCard`, `StatusBar`, `SectionHeader` primitives to rebuild layout shell.
- Primitives are independently importable → other phases unblocked.
