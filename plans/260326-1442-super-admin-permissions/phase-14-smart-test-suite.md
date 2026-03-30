# Phase 14: Smart Test Suite

## Context Links
- Existing backend tests: `packages/backend/tests/`
- Existing E2E tests: `e2e/`
- Test setup: `packages/backend/tests/setup.ts`
- Test helpers: `packages/backend/tests/helpers.ts`
- Vitest config: `packages/backend/vitest.config.ts`

## Overview
- **Priority**: P2
- **Status**: pending
- **Description**: Write comprehensive, idempotent test cases covering auth, RBAC, C2C, call history, CRUD, reports, and the new permissions/extensions features. Backend via Vitest + supertest, E2E via Playwright.

## Key Insights
- Existing test infra: `setup.ts` (env), `helpers.ts` (token generation, supertest agent)
- Existing tests already cover: basic auth, security, endpoints -- but need expansion for new features
- `helpers.ts` `authHeader(role)` generates JWT with arbitrary role -- need to add super_admin
- Tests must be idempotent: create own data, clean up or use unique IDs
- Backend tests use real DB (per setup.ts DATABASE_URL) -- not mocks

## Requirements

### Functional
- Auth tests: login, logout, refresh, token expiry, invalid credentials, password change
- RBAC tests: each role's access to every protected endpoint (including super_admin)
- Permission tests: CRUD permissions, cache invalidation, requirePermission middleware
- Extension tests: list, assign, unassign, conflict handling
- C2C tests: originate API (mocked ESL), validation errors
- Call history: list with filters, detail, CDR webhook processing
- CRUD tests: contacts, leads, debt-cases, campaigns, tickets (create/read/update/delete per role)
- Reports tests: report endpoints access per role
- E2E tests: login flow, navigation, CRUD workflows, permission UI

### Non-Functional
- All tests pass in CI without manual intervention
- Each test file under 200 lines
- describe/it structure with clear names
- No flaky tests (deterministic data, no timing deps)

## Architecture

### Test Organization
```
packages/backend/tests/
  setup.ts                          (existing)
  helpers.ts                        (existing, extend)
  auth.test.ts                      (existing, extend)
  permissions.test.ts               (NEW)
  extensions.test.ts                (NEW)
  rbac-permissions.test.ts          (NEW - permission-based RBAC)
  c2c.test.ts                       (NEW - click-to-call)
  call-logs.test.ts                 (NEW or extend existing)
  contacts.test.ts                  (NEW or extend existing)
  leads.test.ts                     (NEW or extend existing)
  debt-cases.test.ts                (NEW or extend existing)
  campaigns.test.ts                 (NEW or extend existing)
  tickets.test.ts                   (NEW or extend existing)
  reports.test.ts                   (NEW or extend existing)

e2e/
  global-setup.ts                   (existing)
  helpers.ts                        (existing)
  auth.test.ts                      (existing, extend)
  permission-manager.test.ts        (NEW)
  extension-config.test.ts          (NEW)
  crud.test.ts                      (existing, extend)
```

### Test Data Strategy
- Each test file creates its own test data using API calls or direct Prisma
- Use unique email/phone prefixes per test file to avoid collisions
- Tests clean up created data in `afterAll` or use transactions
- For E2E: seed a known state via API before test suite runs

## Related Code Files

### Files to Create
| File | Purpose |
|------|---------|
| `packages/backend/tests/permissions.test.ts` | Permission CRUD, cache invalidation |
| `packages/backend/tests/extensions.test.ts` | Extension list/assign/unassign |
| `packages/backend/tests/rbac-permissions.test.ts` | Permission-based access control per role |
| `packages/backend/tests/c2c.test.ts` | Click-to-call originate (ESL mocked) |
| `e2e/permission-manager.test.ts` | Permission matrix UI interaction |
| `e2e/extension-config.test.ts` | Extension config page |

### Files to Modify
| File | Change |
|------|--------|
| `packages/backend/tests/helpers.ts` | Add `super_admin` token helper, add permission-related helpers |
| `packages/backend/tests/auth.test.ts` | Extend with super_admin auth tests |
| `e2e/helpers.ts` | Add super_admin login helper |
| Existing `*-comprehensive.test.ts` files | Review and consolidate with new tests (avoid duplication) |

## Implementation Steps

### Step 1: Update Test Helpers
1. Add to `helpers.ts`:
   - `authHeader('super_admin', ...)` support (already works since it takes any string)
   - Helper to create test permission data
   - Helper to seed a test user via Prisma directly

### Step 2: Permission Tests (Backend)
1. Create `permissions.test.ts`:
   ```
   describe('Permission API')
     describe('GET /api/v1/permissions')
       it('returns all permissions with grants for super_admin')
       it('returns 403 for agent roles')
     describe('PUT /api/v1/permissions/role/:role')
       it('updates role permissions for super_admin')
       it('returns 403 for admin (only super_admin can modify)')
       it('validates permission keys')
   ```

### Step 3: RBAC Permission Tests
1. Create `rbac-permissions.test.ts`:
   ```
   describe('Permission-based RBAC')
     for each [endpoint, requiredPermission]:
       it('allows role with permission')
       it('blocks role without permission')
       it('always allows super_admin')
   ```

### Step 4: Extension Tests (Backend)
1. Create `extensions.test.ts`:
   ```
   describe('Extension API')
     describe('GET /api/v1/extensions')
       it('returns extension list for admin')
       it('returns 403 for non-admin')
     describe('PUT /api/v1/extensions/:ext/assign')
       it('assigns extension to user')
       it('handles conflict: clears previous assignment')
       it('unassigns extension with null userId')
       it('validates extension format')
   ```

### Step 5: C2C Tests
1. Create `c2c.test.ts`:
   - Mock ESL connection (jest.mock or vitest.mock)
   - Test originate API: valid request, missing extension, invalid number
   - Test ESL unavailable scenario

### Step 6: Extend CRUD Tests
1. For each entity (contacts, leads, debt-cases, campaigns, tickets):
   ```
   describe('{Entity} CRUD')
     it('creates entity')
     it('lists entities with pagination')
     it('gets entity by id')
     it('updates entity')
     it('deletes entity (admin only)')
     it('respects data scope (agent sees own data only)')
   ```
2. Extend or replace existing `*-comprehensive.test.ts` files -- consolidate, don't duplicate

### Step 7: E2E Tests
1. Create `permission-manager.test.ts`:
   - Login as super_admin
   - Navigate to Settings > Permission Manager
   - Toggle a permission off for a role
   - Save and verify API call
   - Login as that role, verify access blocked

2. Create `extension-config.test.ts`:
   - Login as admin
   - Navigate to Settings > Extension Config
   - Verify extension list renders
   - Reassign extension
   - Verify table updates

### Step 8: CI Integration
1. Ensure `package.json` scripts:
   - `test`: runs Vitest
   - `test:e2e`: runs Playwright
2. All tests must pass with: `npm test` and `npm run test:e2e`

## Todo List
- [ ] Update helpers.ts with new utilities
- [ ] Write permissions.test.ts
- [ ] Write rbac-permissions.test.ts
- [ ] Write extensions.test.ts
- [ ] Write c2c.test.ts
- [ ] Extend/consolidate CRUD tests (contacts, leads, debt-cases, campaigns, tickets)
- [ ] Extend auth tests for super_admin
- [ ] Extend report tests
- [ ] Write E2E permission-manager.test.ts
- [ ] Write E2E extension-config.test.ts
- [ ] Verify all tests pass in CI
- [ ] Review existing *-comprehensive.test.ts -- merge or remove duplicates

## Success Criteria
- `npm test` passes with 0 failures
- `npm run test:e2e` passes with 0 failures
- Every protected endpoint has at least one positive + one negative RBAC test
- Permission toggle changes are verified end-to-end
- Tests are idempotent: can run repeatedly without manual cleanup
- No mocks for DB operations (real DB), ESL mocked only where necessary

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|-----------|
| Existing comprehensive tests conflict with new tests | Medium | Audit existing files first, consolidate |
| E2E tests flaky due to timing | Medium | Use Playwright's auto-waiting, explicit waitFor |
| Test DB state pollution between runs | Medium | Use beforeAll/afterAll cleanup, unique prefixes |
| ESL mock doesn't match real behavior | Low | Test ESL integration separately in staging |

## Security Considerations
- Test tokens use test-only JWT secret
- Test data uses clearly fake emails (@test.com)
- No real credentials in test files
- E2E tests use seed credentials only
