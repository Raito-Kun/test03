# Phase 05 — Test & Staged Deploy

## Context Links
- Plan: [../plan.md](./plan.md)
- All prior phases: phase-01 → phase-04
- E2E suite: `e2e/` (crud, crud-full, c2c, rbac-ui, navigation, logo-branding)
- Deploy scripts: `deploy.sh`
- Backup: git tag `backup/pre-ui-redesign-260420`

## Overview
- **Priority**: P2 (gates production)
- **Status**: pending
- **Effort**: ~1 day
- Run existing test suite, add visual regression baseline, deploy to dev server 10.10.101.207, verify rollback path. Production deploy gated on explicit "Deploy to Server PROD" per user memory rule.

## Key Insights
- All redesign work is view-only → existing Playwright E2E tests remain the source of truth for regression. No new functional tests needed.
- Visual regression requires a snapshot baseline — can skip if Playwright run is fast enough to eyeball, but recommended to add via `@playwright/test toHaveScreenshot`.
- Staged rollout: phase-02 + 03 + 04 each independently deployable to dev; full production deploy only after all merged.
- Rollback: revert to tag `backup/pre-ui-redesign-260420` — single `git reset` works because redesign commits are on a dedicated branch.

## Requirements

### Functional
- All existing E2E tests pass on redesigned UI.
- Dev server deploy succeeds via `deploy.sh`.
- Rollback drill succeeds: reset to backup tag, redeploy, observe old UI.
- Production deploy executed **only** on explicit user instruction.

### Non-functional
- Bundle size growth ≤ 60KB gzipped (mono font + primitives combined).
- Lighthouse performance score not below pre-redesign baseline - 5 points.
- No new console errors in production build.

## Architecture (Test Strategy)

### Test layers
| Layer | Tool | Scope |
|---|---|---|
| TS compile | `tsc -b` (part of `npm run build`) | All phases |
| E2E functional | Playwright (`e2e/*.test.ts`) | After phase-02, phase-03, phase-04 |
| Visual regression | Playwright `toHaveScreenshot` | After phase-04 only |
| Manual click-through per role | Human | Pre-deploy gate |
| Load test | Existing `packages/backend/tests` | Backend unchanged — optional |

### Existing E2E tests to run
- `e2e/crud.test.ts` — contact/lead/debt CRUD
- `e2e/crud-full.test.ts` — full flow
- `e2e/c2c.test.ts` — click-to-call
- `e2e/rbac-ui.test.ts` — RBAC visibility (CRITICAL for sidebar restyle)
- `e2e/navigation.test.ts` — route navigation
- `e2e/logo-branding.spec.ts` — logo/branding (will need baseline update for new logo pill)

### Visual regression targets (new)
One screenshot per critical view:
- `/` dashboard (as super_admin)
- `/contacts` list
- `/contacts/:id` detail
- `/campaigns` list
- `/campaigns/:id` detail
- `/call-logs` list
- `/reports` tabs
- `/settings/clusters` list
- `/monitoring` live dashboard
- `/login` (unauthenticated)

## Related Code Files

### Modify
- `e2e/logo-branding.spec.ts` — update brand expectations for new logo pill
- Possibly update selectors in RBAC tests if `data-testid` attributes shifted (audit during phase-04)

### Create
- `e2e/visual-regression.spec.ts` — new file, 10 screenshot checks using `toHaveScreenshot`
- `.playwright-snapshots/` — baseline folder (gitignored snapshots or committed per team preference)

### Delete
- None.

## Implementation Steps

1. After phase-02 merged to dev branch: deploy to 10.10.101.207, manual smoke test layout + RBAC.
2. After phase-03 merged: deploy, manual smoke test dashboard widgets.
3. After phase-04 merged:
   a. Update `logo-branding.spec.ts` expectations.
   b. Add `visual-regression.spec.ts` with 10 screenshot checks.
   c. Generate baseline: `npx playwright test visual-regression --update-snapshots`.
   d. Review baselines vs mockup for fidelity.
4. Run full E2E locally: `npx playwright test` — all green.
5. CI run (GitHub Actions) — all green.
6. Deploy to dev server via `deploy.sh`.
7. Manual click-through per role:
   - super_admin — all pages accessible, cluster switcher visible
   - admin — as super_admin but no cluster switcher
   - manager — monitoring visible, no settings/permissions
   - leader — team-scoped monitoring only
   - qa — reports + call-logs only
   - agent — `/contacts` landing, no dashboard
8. Rollback drill on dev:
   ```bash
   git checkout master
   git reset --hard backup/pre-ui-redesign-260420
   ./deploy.sh   # redeploy
   # verify old UI shows
   git checkout feat/ui-ops-console-redesign   # restore
   ./deploy.sh   # back to new UI
   ```
9. Document rollback outcome in plan.md.
10. Wait for user's explicit "Deploy to Server PROD" before touching 10.10.101.208 (per memory rule).

## Todo List
- [ ] Deploy phase-02 build to dev; smoke test shell
- [ ] Deploy phase-03 build to dev; smoke test dashboard
- [ ] Update `logo-branding.spec.ts`
- [ ] Add `visual-regression.spec.ts` with 10 targets
- [ ] Generate baseline snapshots
- [ ] Run full Playwright suite locally (green)
- [ ] Run CI pipeline (green)
- [ ] Deploy phase-04 build to dev
- [ ] Manual click-through: super_admin
- [ ] Manual click-through: admin
- [ ] Manual click-through: manager
- [ ] Manual click-through: leader
- [ ] Manual click-through: qa
- [ ] Manual click-through: agent
- [ ] Execute rollback drill on dev
- [ ] Document drill in plan
- [ ] Wait for explicit production approval

## Success Criteria
- All Playwright E2E tests pass.
- Visual regression baseline approved against mockup.
- Dev deploy succeeds; every role navigates without error.
- Rollback drill completes in <5 minutes; old UI restored fully.
- Bundle growth ≤ 60KB gzipped (verify via `vite build` report).
- Production deploy executed only after explicit user approval.

## Risk Assessment
- **Risk**: RBAC E2E selectors break because sidebar DOM structure changed slightly.
  - **Mitigation**: phase-02 preserves `data-testid` attributes; grep all E2E selectors before refactor.
- **Risk**: visual regression flakes on font rendering between CI and local.
  - **Mitigation**: pin font via `@fontsource-variable`; lock Playwright browser version.
- **Risk**: rollback loses unrelated commits merged to master during redesign window.
  - **Mitigation**: rollback reverts only frontend; if backend commits merged in parallel, cherry-pick forward post-rollback.
- **Risk**: production deploy performed prematurely.
  - **Mitigation**: memory rule already enforces explicit user command; reinforce in PR description.

## Security Considerations
- No new auth surfaces, no new endpoints.
- Production deploy gate preserved per `.claude/agent-memory/planner/feedback_prod_deployment_rule.md`.

## Next Steps
- Upon user approval: run `deploy.sh` targeting PROD (10.10.101.208) with new branch.
- Open follow-up ticket for backend endpoints flagged in gap analysis:
  - `GET /dashboard/overview?compare=yesterday`
  - `GET /dashboard/call-volume-24h`
  - `GET /dashboard/nav-counts`
  - `GET /system/health`
- Remove MOCK pills from heatmap and delta placeholders once backend endpoints ship.
