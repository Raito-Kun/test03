# Phase 02 — Layout Shell (Sidebar + Topbar + Status Bar)

## Context Links
- Plan: [../plan.md](./plan.md)
- Phase 01 (deps): [./phase-01-design-tokens.md](./phase-01-design-tokens.md)
- Gap analysis: [./research/api-gap-analysis.md](./research/api-gap-analysis.md)
- Current shell: `packages/frontend/src/components/layout/{app-layout,sidebar,header}.tsx`

## Overview
- **Priority**: P2 (blocks phase 03 and 04)
- **Status**: pending
- **Effort**: ~1 day
- Restyle the three shell components to match mockup. Behavior (routing, RBAC filters, auth, tabs) preserved bit-for-bit.

## Key Insights
- `sidebar.tsx` is already driven by `SidebarNavGroup` + `roleVisibility` + `FEATURE_ROUTE_MAP` — **do not touch filter logic**. Restyle only `<aside>` container, group labels, active indicator.
- `header.tsx` already hosts ClusterSwitcher, AgentStatusSelector, ExtensionStatusIndicator, NotificationBell, Customer tabs, AI toggle, User menu — all stay. We add breadcrumbs, ⌘K trigger pill, quick-dial inline input, version badge "v2.1.0".
- Mockup bottom status bar is new — mounted in `app-layout.tsx` as a fixed-bottom element sibling of `<main>`. No routing impact.
- Dark mode toggle (if any) is removed; `theme-store.ts` stays but UI toggle is deleted.

## Requirements

### Functional
- Sidebar: same routes, same RBAC; visual = dark indigo `#1e1838`, violet active bar, dotted group separators, item counts **hidden** (see gap analysis).
- Topbar: logo pill "CRM·PLS v2.1.0" + breadcrumbs from route + existing customer tabs + ⌘K pill (opens `AiSearchBar`) + AI Assist button + quick-dial input + cluster/agent/extension/notifications/avatar.
- Status bar: fixed bottom, mono, shows SYS/CPU/LAT/QUEUE/RX-TX/PBX/PAGE/BUILD/TZ/LOCAL. CPU/LAT/QUEUE/RX/TX are mocked (see gap analysis).
- Page content pushes up by status bar height (24px).

### Non-functional
- All files <200 lines. `header.tsx` currently 159 lines — may need split if it grows.
- Keyboard: ⌘K still works globally via existing `AiSearchBar` shortcut.
- Accessibility: preserve ARIA on nav, maintain focus rings.

## Architecture

### Component split
```
app-layout.tsx (orchestrator)
├── <Sidebar />                      (dark indigo, violet accents, item counts hidden)
├── <Topbar />                       (renamed from header.tsx)
│   ├── <LogoPill />                 new, ~20 lines
│   ├── <Breadcrumbs />              new, ~40 lines — reads useLocation, maps via ROUTE_LABELS
│   ├── <CustomerTabs />             extract from current header, ~50 lines
│   ├── <CommandKPill />             new, ~25 lines — triggers AiSearchBar
│   ├── <QuickDialInline />          new, ~50 lines — wraps ClickToCallButton
│   └── <TopbarActions />            AI/cluster/agent/ext/bell/avatar — ~80 lines
└── <OpsStatusBar />                 from phase-01 primitive + wiring
```

### Breadcrumb source
Static map `ROUTE_LABELS: Record<string, string>` in `lib/route-labels.ts` — maps `/contacts` → "Danh sách khách hàng" etc. Dynamic `:id` segments: show customer tab label if available via `useCustomerTabStore`.

### Status bar wiring
```ts
const { isConnected } = useSocket();            // SYS
const buildId = import.meta.env.VITE_BUILD_ID;  // BUILD
const location = useLocation();                 // PAGE
// CPU/LAT/QUEUE/RX/TX — oscillate via setInterval; documented as mock
// PBX — reuse useRegistrationStatus()
```

## Related Code Files

### Modify
- `packages/frontend/src/components/layout/app-layout.tsx` — mount `<OpsStatusBar />`, adjust main padding-bottom, remove any dark-mode toggle, keep rest as-is
- `packages/frontend/src/components/layout/sidebar.tsx` — swap colors only (replace hardcoded `#0d2137`, `#29b6f6`, `rgba(41,182,246,...)` → token vars); no filter changes
- `packages/frontend/src/components/layout/header.tsx` → rename to `topbar.tsx` (update imports) OR keep name and refactor internals

### Create
- `packages/frontend/src/components/layout/logo-pill.tsx`
- `packages/frontend/src/components/layout/breadcrumbs.tsx`
- `packages/frontend/src/components/layout/customer-tabs.tsx` (extract from current header)
- `packages/frontend/src/components/layout/command-k-pill.tsx`
- `packages/frontend/src/components/layout/quick-dial-inline.tsx`
- `packages/frontend/src/components/layout/topbar-actions.tsx`
- `packages/frontend/src/lib/route-labels.ts`

### Delete
- Dark mode toggle UI (if any button exists; keep `theme-store.ts` file untouched).

## Implementation Steps

1. Extract `<CustomerTabs>` from current `header.tsx` into its own file (pure refactor, no behavior change). Commit.
2. Extract `<TopbarActions>` (everything right-side in current header) into its own file. Commit.
3. Create `logo-pill.tsx`, `breadcrumbs.tsx`, `command-k-pill.tsx`, `quick-dial-inline.tsx`. Commit.
4. Create `route-labels.ts` with static map using `VI.nav.*` values.
5. Rewrite `header.tsx` (or rename to `topbar.tsx`) as a composition of the above pieces. Must stay <120 lines.
6. Update `sidebar.tsx`: replace hardcoded hex with `var(--sidebar)`, `var(--sidebar-primary)`, `var(--sidebar-accent)`. Remove inline hex strings. Logo img swap if needed.
7. Mount `<OpsStatusBar>` in `app-layout.tsx`, add `pb-6` to `<main>` to compensate.
8. Wire status bar data sources (Socket connection, buildId, useLocation, registration status).
9. `npm run build` — zero TS errors. Run dev, click through every sidebar item, verify RBAC still hides items.

## Todo List
- [ ] Extract `customer-tabs.tsx`
- [ ] Extract `topbar-actions.tsx`
- [ ] Create `logo-pill.tsx`
- [ ] Create `breadcrumbs.tsx`
- [ ] Create `command-k-pill.tsx`
- [ ] Create `quick-dial-inline.tsx`
- [ ] Create `route-labels.ts`
- [ ] Refactor `header.tsx` composition
- [ ] Restyle `sidebar.tsx` (colors only)
- [ ] Mount `OpsStatusBar` in `app-layout.tsx`
- [ ] Wire status bar data
- [ ] Verify RBAC filter untouched (diff `sidebar.tsx` logic)
- [ ] Build + manual click-through per role

## Success Criteria
- All routes reachable as before; no dead nav item.
- RBAC hiding works identically (verify super_admin sees all, agent sees `/contacts` only).
- Keyboard ⌘K still opens AiSearchBar.
- Quick-dial triggers existing `POST /calls/originate`.
- Status bar visible on every page, not overlapping content.
- Socket disconnect flips status bar `SYS ONLINE` → `OFFLINE`.

## Risk Assessment
- **Risk**: extracting `CustomerTabs` drops a subtle behavior (active tab sync in `app-layout` useEffect).
  - **Mitigation**: pure move of JSX; keep props signature identical; effect stays in `app-layout.tsx`.
- **Risk**: `header.tsx` refactor silently breaks ClusterSwitcher rendering order.
  - **Mitigation**: manual visual diff vs screenshots; each sub-component owns exactly one concern.
- **Risk**: mockup version "v2.1.0" implies versioning tie; we don't have that bump yet.
  - **Mitigation**: read from `package.json` via `import.meta.env.VITE_APP_VERSION` (already available) — show actual version, not literal "2.1.0".

## Security Considerations
- No new endpoints; no new auth surfaces.
- Breadcrumbs never expose IDs as text of PII; use tab label (customer name) which the user can already see.

## Next Steps
- Phase 03 uses new primitives in the dashboard body.
- Phase 04 applies topbar breadcrumbs to every page (requires `route-labels.ts`).
