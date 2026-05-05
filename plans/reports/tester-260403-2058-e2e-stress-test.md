# E2E Stress Test Report - 2026-04-03

## Summary
- **Total Tests**: 129
- **Passed**: 30 ✅
- **Failed**: 14 ❌
- **Flaky**: 14 (pass on retry)
- **Skipped**: 71 ⏭️ (blocked by earlier failures)
- **Pass Rate**: 23.3% (30/129)
- **Success Rate with Retries**: 44 of expected (flaky + passed)
- **Execution Time**: 9.0 minutes
- **Workers**: 4 parallel

## Test Results by Category

### Authentication Tests
- ✅ `auth.test.ts` - login as admin (13.3s)
- ✅ `auth.test.ts` - login with wrong password (5.3s)
- ✅ `auth.test.ts` - login as manager (5.0s)
- 🟡 `auth.test.ts` - login as agent_telesale (FLAKY - passes on retry)
- ❌ `auth-full.test.ts` - all roles can log in and see dashboard (55.7s → 56.4s retry)

### Contact/CRUD Tests
- ✅ `crud-full.test.ts` - contacts page loads with table (20.3s)
- 🟡 `crud.test.ts` - contacts page loads (FLAKY - passes on retry)
- ❌ `crud-full.test.ts` - leads page loads with table or list (31.4s → 30.5s retry)
- ❌ `crud.test.ts` - create a new contact (retry #1, 30.5s)
- 🟡 `data-allocation.spec.ts` - leader logs in/navigates to contacts (FLAKY)

### Click-to-Call (C2C) Tests
- ❌ `c2c.test.ts` - contact list C2C button (17.7s → 31.1s retry)
- ⏭️ Remaining C2C tests skipped due to first failure

### Reports Tests
- ❌ `reports-full.test.ts` - reports page loads (test timeout in beforeEach)
- ❌ `reports-full.test.ts` - telesale report tab exists (blocked)
- ❌ `reports.test.ts` - Export button works (30000ms exceeded)

### RBAC/Permissions Tests
- 🟡 `permission-matrix.spec.ts` - navigate to permissions (FLAKY)
- 🟡 `permissions.test.ts` - access permissions page (FLAKY)
- ❌ `permissions.test.ts` - super_admin toggles permission and saves
- ❌ `rbac-pages.test.ts` - agent_collection access validation
- ❌ `rbac-ui.test.ts` - agent_telesale settings validation (test timeout)
- ❌ `rbac-data-scope.spec.ts` - leader sees contacts (blocked)

### UI/Navigation Tests
- 🟡 `navigation.test.ts` - page / loads with title (FLAKY)
- ❌ `navigation.test.ts` - page /contacts loads (blocked)
- 🟡 `logo-branding.spec.ts` - sidebar shows logo (FLAKY)

### Extensions Tests
- ✅ `extensions.test.ts` - access settings page (7.8s)
- ✅ `extensions.test.ts` - admin access (6.4s)
- 🟡 `extensions.test.ts` - extension list displays numbers (FLAKY)
- ❌ `extensions.test.ts` - extension status badges (test timeout, 30.4s)

### Error Scenario Tests
- ✅ `error-scenarios.test.ts` - invalid phone validation (16.0s)
- ✅ `error-scenarios.test.ts` - duplicate contact handled (8.6s)
- 🟡 `error-scenarios.test.ts` - network error message (FLAKY)
- ❌ `error-scenarios.test.ts` - form validation without required fields (30.4s)

### Data Allocation Tests
- 🟡 `data-allocation.spec.ts` - leader logs in (FLAKY)
- ❌ `data-allocation.spec.ts` - contacts list checkboxes (retry #1, 30.5s)

## Failed Tests Analysis

### Critical Pattern: Login Timeouts (8 failures)
**Root Cause**: Multiple concurrent test workers (4 parallel) hammering login endpoint → server rate limiting or session management overload
- Login button becomes "not stable" (fluttering DOM re-renders)
- Tests timeout waiting for click to succeed (30s max)
- Browser/context closes mid-login attempt

**Tests Affected**:
- `auth-full.test.ts` - all roles login
- `crud-full.test.ts` - leads page (login timeout)
- `error-scenarios.test.ts` - form validation (login timeout)
- `extensions.test.ts` - extension badges (login timeout)
- `navigation.test.ts` - page / loads (login timeout)
- `logo-branding.spec.ts` - sidebar logo (login timeout)
- `permission-matrix.spec.ts` - clicking group (login timeout)
- `rbac-ui.test.ts` - agent_telesale settings (login timeout)

### C2C API Timeout (1 failure)
**Test**: `c2c.test.ts` - contact list C2C button
**Error**: `page.waitForRequest: Timeout 5000ms exceeded while waiting for event "request"`
**Root Cause**: C2C API endpoint `/calls/originate` not responding within 5s
- Possible issue: PBX/ESL integration not running or slow to respond
- Server may be rate-limiting API calls
- Network latency to PBX cluster

### Report Page Timeout (1 failure)
**Test**: `reports-full.test.ts` - reports page loads
**Error**: `beforeEach hook timeout - button[type="submit"] not stable`
**Root Cause**: Same as login timeouts — DOM instability during concurrent login attempts

### Permission Save Failure (1 failure)
**Test**: `permissions.test.ts` - super_admin toggles permission
**Root Cause**: Unknown (logs truncated) — likely login or state issue

### Page Load Timeouts (2 failures)
**Tests**: 
- `navigation.test.ts` - /contacts page
- `data-allocation.spec.ts` - checkboxes multi-select
**Root Cause**: Login failures cascade → tests can't reach target pages

## Flaky Tests (Pass on Retry)

14 tests are flaky — they fail first run but pass on retry:

**Login-related flakiness**:
- `auth.test.ts` - agent_telesale login
- `data-allocation.spec.ts` - leader login/navigate
- `permission-matrix.spec.ts` - navigate to permissions
- `permissions.test.ts` - access permissions page

**Page navigation flakiness**:
- `crud.test.ts` - contacts page loads
- `navigation.test.ts` - page / loads
- `logo-branding.spec.ts` - sidebar shows logo
- `rbac-data-scope.spec.ts` - leader sees contacts / agent sees leads
- `rbac-pages.test.ts` - manager access to pages

**Data/UI flakiness**:
- `error-scenarios.test.ts` - network error message
- `extensions.test.ts` - extension list displays
- `logo-branding.spec.ts` - sidebar shows logo

**Pattern**: All pass on retry — indicates race conditions in login, DOM readiness, or server-side session handling under load.

## Root Cause Summary

### Primary Issue: Stress Test Overload (4 parallel workers)
- Server not configured for concurrent testing at 4x parallelism
- Login endpoint has race condition or synchronization bug
- Button element DOM fluttering (visibility/stability checks failing)
- Session/cookie management issues when multiple users log in simultaneously

### Secondary Issue: Rate Limiting
- Server may be rate-limiting API calls (login, originate)
- No backoff/retry in login helper beyond 3 attempts with 5s waits
- 4 workers × 129 tests = significant load spike

### Tertiary Issue: C2C Integration
- `/calls/originate` API endpoint slow or not responding
- PBX cluster may not be running
- ESL configuration not loaded or inactive cluster selected

### Quaternary Issue: Test Isolation
- Tests use `serial` mode (one-by-one) in several suites → slow execution
- Some tests appear to have interdependencies or shared state
- 71 tests skipped because earlier tests fail in the same describe block

## Performance Metrics

**Test Execution**:
- Fastest pass: 2.5s (logo validation)
- Slowest pass: 42.0s (auth full retry)
- Average timeout: 30.0s+ (many tests hitting hard limit)
- Total time: 9.0 minutes for 30 passes + 14 failures + 71 blocked

**Stress Test Verdict**: 
- ❌ **FAILED** — Cannot sustain 4 parallel workers
- Tests timeout rather than complete
- DOM instability under concurrent load
- Rate limiting likely triggered

## Recommendations

### Immediate (Critical)
1. **Reduce worker parallelism**: Run with `--workers=1` or `--workers=2` to validate if issue is load-related
   - This will determine if flakiness is concurrency bug vs server stability issue
   
2. **Increase test timeout**: Raise from 30s to 60s globally
   - Many tests timeout waiting for login — may just need more time under stress
   
3. **Fix login instability**: 
   - Investigate why button element becomes "not stable" during concurrent logins
   - Add explicit waits for DOM settlling before clicking submit
   - Check for animation/transition CSS that causes re-renders

4. **Check PBX/ESL status**:
   - Verify `esld` or PBX integration service is running
   - Test `/calls/originate` endpoint manually from same environment
   - Review active cluster configuration in admin panel

### Short-term (1-2 days)
5. **Add test isolation helpers**:
   - Clear cookies/localStorage between tests
   - Add randomized delays (jitter) between login attempts to reduce thundering herd
   - Implement exponential backoff in login helper

6. **Unblock skipped tests**:
   - Many tests are skipped because earlier tests fail within same describe block
   - Consider converting `describe.serial` to `describe` for tests that don't have state dependencies
   - Add explicit cleanup in afterEach hooks

7. **Monitor server logs**:
   - Run tests while tailing backend logs to see rate limit/error patterns
   - Check for HTTP 429 (too many requests) responses
   - Verify session/token expiration issues

### Medium-term (Sprint work)
8. **Implement proper test fixtures**:
   - Use `test.beforeAll()` for shared auth token (reuse across tests)
   - Reduce redundant login calls
   - Set up dedicated test data/users that won't conflict

9. **Add request retry logic**:
   - Implement exponential backoff for flaky API endpoints
   - Add circuit breaker for rate-limited endpoints
   - Timeout should fail gracefully, not hang

10. **Parallelize wisely**:
   - Run independent test suites in parallel, not individual tests
   - Group tests by feature (auth, crud, reports) and run each suite serially
   - Use worker pooling for different test environments

11. **Performance baseline**:
   - Document expected test execution time under normal load (1-2 workers)
   - Set performance budgets (target: <5 min for full suite with 1 worker)
   - Monitor trends over time

### Test Quality
12. **Review helper functions**:
   - `helpers.ts` login function has issues — review retries, waits, stability checks
   - Add diagnostic logging for timeout scenarios
   - Consider using Playwright built-in retry mechanisms instead of custom loops

13. **Validate test data**:
   - Ensure login credentials are correct for all roles tested
   - Verify test database has required data (contacts, leads, reports, etc.)
   - Check that test data isn't stale or corrupted

## Next Steps

1. **Run tests with reduced workers**: `npm test -- --workers=1 --reporter=list` → see if pass rate improves
2. **Check server status**: Verify backend is responsive, check logs for rate limit/error messages
3. **Verify C2C integration**: Manually test `/calls/originate` endpoint or check PBX/ESL status
4. **Review login helper**: Debug why button element becomes unstable during concurrent access
5. **Increase timeout and retest**: Bump timeout to 60s, run with 1-2 workers to get baseline

## Unresolved Questions

- Is the server rate-limiting? (need access to backend logs)
- What causes the login button to become "not stable"? (need DOM inspection during test)
- Is PBX/ESL integration running? (need server status check)
- Are there shared resources or session conflicts between concurrent tests? (need backend session review)
- Why are 71 tests skipped? (are describe.serial blocks preventing independent tests from running?)
