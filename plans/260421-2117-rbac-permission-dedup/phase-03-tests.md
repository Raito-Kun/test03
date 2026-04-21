# Phase 03 — Tests + TC updates

**Stream C** · Priority: P1 · Status: Pending

## Overview

Update existing tests to new keys, add coverage for new permission + enforcement fixes. 100% green required.

## Files to modify

### Backend vitest
- `packages/backend/tests/v120-features-comprehensive.test.ts` (lines 281, 766, 777) — replace `export_excel` → `report.export`
- Any other test referencing legacy keys — grep and update
- **NEW** `packages/backend/tests/permission-dedup.test.ts`:
  - Assert seed produces exactly 7 groups
  - Assert migration.sql is idempotent (run twice, same result)
  - Assert `recording.delete` present and granted to super_admin+admin only
  - Assert `ticket.delete` middleware rejects agent/leader calls to DELETE /tickets/:id

### E2E playwright
- `e2e/rbac-ui.test.ts` — add scenario: super_admin opens /permissions → sees 7 groups, not 12+
- `e2e/rbac-ui.test.ts` — super_admin deletes recording successfully; agent gets 403
- `e2e/crud-full.test.ts` — ensure no regression on existing RBAC flows

## Implementation steps

1. Grep `packages/backend/tests` + `e2e/` for legacy keys; update literals
2. Write `permission-dedup.test.ts` with 4 assertions above
3. Add RBAC playwright scenarios
4. Run: `npm --workspace packages/backend test -- permission-dedup`
5. Run: `npm --workspace packages/backend test` (full suite)
6. Run: `npm run test:e2e -- rbac-ui crud-full`
7. Fix any failures (do NOT skip tests)

## Todo

- [ ] Update legacy key refs in existing tests
- [ ] Write permission-dedup.test.ts
- [ ] Add 2 playwright RBAC scenarios
- [ ] Backend unit + integration tests green
- [ ] E2E green

## Success criteria

- All pre-existing tests pass with zero skip/xfail
- New permission-dedup test covers 4 assertions
- E2E confirms UI shows 7 groups only

## Dependencies

- Blocked by: Phase 01 + Phase 02
- Unblocks: Phase 09 review
