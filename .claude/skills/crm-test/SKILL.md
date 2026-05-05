---
name: crm-test
description: Run CRM test suites — Vitest for backend unit and integration, Playwright for end-to-end browser flows. Scope by feature or file, triage failures, never skip to pass.
version: 1.0.0
argument-hint: "[backend|e2e] [pattern]"
---

# CRM Test Skill

Run and triage the CRM test suites. Two layers: Vitest on the backend, Playwright across the full stack.

## When to Use

- Verifying a change before commit or push
- Reproducing a reported failure
- Scoping a run to one feature, file, or test name
- Measuring coverage for a service layer

## Command Map

| Intent | Command |
|---|---|
| Backend full suite | `npm test` in `packages/backend` |
| Backend single file | `npx vitest run tests/<file>.test.ts` |
| Backend by test name | `npx vitest run -t "<substring>"` |
| Coverage | `npm run test:coverage` |
| E2E full | `npx playwright test` |
| E2E single file | `npx playwright test e2e/<file>.test.ts` |
| E2E by name | `npx playwright test -g "<substring>"` |
| Debug E2E | `npx playwright test --debug <file>` |
| Last report | `npx playwright show-report` |

## Scoping Map

Before running the full suite, scope to the feature area — saves minutes, keeps signal-to-noise high.

| Area | Start here |
|---|---|
| Auth | backend `auth*.test.ts` + E2E `auth*.test.ts` |
| Contacts | backend `contacts.test.ts` + E2E `crud*.test.ts`, `contact-import-wizard.test.ts` |
| VoIP / click-to-call | backend `calls.test.ts` + E2E `c2c.test.ts` |
| RBAC | backend `permissions.test.ts` + E2E `rbac-ui.test.ts` |
| Extensions | backend `extensions.test.ts` + E2E `extensions.test.ts` |

## Triage

1. Read the failure output — assertion first, stack second
2. Decide: test bug, code regression, or flake
3. Flakes must be reproduced three times before stabilizing; do not retry-to-pass
4. Re-run the scoped set until clean before reporting done

## No-Skip Rule

Never mark a failing test `.skip`/`.todo` to green a pipeline. If a test must pause, get explicit user approval and open a follow-up.

## Coverage Target

Project target is ≥80% for service and middleware layers. Focus extra attention on auth, RBAC, data-scope, permission cache, and ESL daemon paths.

## Reference

- Vitest config: `packages/backend/vitest.config.ts`
- Playwright config: `playwright.config.ts`
- Test helpers: `packages/backend/tests/helpers.ts`
- Related skills: `crm-backend-feature` (add tests with new features), `crm-deploy` (smoke after deploy)
