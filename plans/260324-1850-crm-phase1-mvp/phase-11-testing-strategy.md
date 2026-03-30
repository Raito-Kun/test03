# Phase 11: Comprehensive Testing Strategy

## Context Links
- Plan: [plan.md](./plan.md)
- Phase 09 (testing foundation): [phase-09-testing-security.md](./phase-09-testing-security.md)
- Code standards: [../../docs/code-standards.md](../../docs/code-standards.md)

## Overview
- **Priority**: HIGH
- **Status**: In Progress
- **Description**: Comprehensive test suite covering ALL user actions across Auth, CRUD, RBAC, VoIP, MCP tools

## Test Infrastructure
- **Backend API tests**: Vitest + Supertest (existing)
- **E2E UI tests**: Playwright (existing)
- **MCP tests**: Vitest (new)
- **Target**: 100% action coverage across all 6 roles

---

## Test Categories & Coverage Matrix

### 1. AUTH (12 tests)
| # | Test | Type | File |
|---|------|------|------|
| 1 | Login success - admin | API+E2E | auth-comprehensive.test.ts |
| 2 | Login success - manager | API+E2E | auth-comprehensive.test.ts |
| 3 | Login success - qa | API+E2E | auth-comprehensive.test.ts |
| 4 | Login success - leader | API+E2E | auth-comprehensive.test.ts |
| 5 | Login success - agent_telesale | API+E2E | auth-comprehensive.test.ts |
| 6 | Login success - agent_collection | API+E2E | auth-comprehensive.test.ts |
| 7 | Login fail - wrong password | API+E2E | auth-comprehensive.test.ts |
| 8 | Login fail - nonexistent user | API | auth-comprehensive.test.ts |
| 9 | Logout clears session | API+E2E | auth-comprehensive.test.ts |
| 10 | Token refresh works | API | auth-comprehensive.test.ts |
| 11 | Expired token rejected | API | auth-comprehensive.test.ts |
| 12 | Rate limiting after repeated fails | API | auth-comprehensive.test.ts |

### 2. CONTACTS - Danh bạ (14 tests)
| # | Test | Type | File |
|---|------|------|------|
| 1 | List contacts (paginated) | API | contacts-comprehensive.test.ts |
| 2 | Create contact with valid data | API+E2E | contacts-comprehensive.test.ts |
| 3 | Get contact by ID | API | contacts-comprehensive.test.ts |
| 4 | Update contact | API | contacts-comprehensive.test.ts |
| 5 | Delete contact (admin/manager only) | API | contacts-comprehensive.test.ts |
| 6 | Delete contact blocked for agents | API | contacts-comprehensive.test.ts |
| 7 | Import CSV/Excel valid file | API | contacts-comprehensive.test.ts |
| 8 | Import invalid file rejected | API | contacts-comprehensive.test.ts |
| 9 | Export contacts to Excel | API | contacts-comprehensive.test.ts |
| 10 | Search by name/phone/email | API+E2E | contacts-comprehensive.test.ts |
| 11 | Filter by label/source | API | contacts-comprehensive.test.ts |
| 12 | Create contact validation (missing fields) | API | contacts-comprehensive.test.ts |
| 13 | Contact timeline endpoint | API | contacts-comprehensive.test.ts |
| 14 | Click-to-call from contact | E2E | e2e/contacts-full.test.ts |

### 3. LEADS - Khách hàng tiềm năng (10 tests)
| # | Test | Type | File |
|---|------|------|------|
| 1 | List leads (paginated) | API | leads-comprehensive.test.ts |
| 2 | Create lead | API+E2E | leads-comprehensive.test.ts |
| 3 | Update lead | API | leads-comprehensive.test.ts |
| 4 | Change lead status | API | leads-comprehensive.test.ts |
| 5 | Assign lead to agent | API | leads-comprehensive.test.ts |
| 6 | Search leads | API+E2E | leads-comprehensive.test.ts |
| 7 | Filter leads by status | API | leads-comprehensive.test.ts |
| 8 | Create lead validation | API | leads-comprehensive.test.ts |
| 9 | Data scope - agent sees own leads only | API | leads-comprehensive.test.ts |
| 10 | Click-to-call from lead | E2E | e2e/leads-full.test.ts |

### 4. DEBT CASES - Công nợ (9 tests)
| # | Test | Type | File |
|---|------|------|------|
| 1 | List debt cases | API | debt-cases-comprehensive.test.ts |
| 2 | Create debt case | API | debt-cases-comprehensive.test.ts |
| 3 | Update debt case | API | debt-cases-comprehensive.test.ts |
| 4 | Change debt status | API | debt-cases-comprehensive.test.ts |
| 5 | Record promise-to-pay | API | debt-cases-comprehensive.test.ts |
| 6 | Filter by DPD tier | API | debt-cases-comprehensive.test.ts |
| 7 | Search debt cases | API | debt-cases-comprehensive.test.ts |
| 8 | Agent sees own cases only | API | debt-cases-comprehensive.test.ts |
| 9 | Debt case validation | API | debt-cases-comprehensive.test.ts |

### 5. CALL LOGS - Lịch sử cuộc gọi (10 tests)
| # | Test | Type | File |
|---|------|------|------|
| 1 | List call logs | API+E2E | call-logs-comprehensive.test.ts |
| 2 | Get call log detail | API | call-logs-comprehensive.test.ts |
| 3 | Filter by date range (UTC+7) | API | call-logs-comprehensive.test.ts |
| 4 | Filter by direction (inbound/outbound) | API | call-logs-comprehensive.test.ts |
| 5 | Search by phone number | API | call-logs-comprehensive.test.ts |
| 6 | Get recording URL | API | call-logs-comprehensive.test.ts |
| 7 | Manual call log creation | API | call-logs-comprehensive.test.ts |
| 8 | Set disposition on call | API | call-logs-comprehensive.test.ts |
| 9 | QA annotation on call | API | call-logs-comprehensive.test.ts |
| 10 | Agent sees own calls only | API | call-logs-comprehensive.test.ts |

### 6. CAMPAIGNS - Chiến dịch (7 tests)
| # | Test | Type | File |
|---|------|------|------|
| 1 | List campaigns | API+E2E | campaigns-comprehensive.test.ts |
| 2 | Create campaign (admin/manager) | API | campaigns-comprehensive.test.ts |
| 3 | Update campaign | API | campaigns-comprehensive.test.ts |
| 4 | Agent blocked from creating | API | campaigns-comprehensive.test.ts |
| 5 | Campaign page loads with data | E2E | e2e/campaigns-full.test.ts |
| 6 | Campaign validation | API | campaigns-comprehensive.test.ts |
| 7 | Campaign type filter | API | campaigns-comprehensive.test.ts |

### 7. TICKETS - Phiếu ghi (8 tests)
| # | Test | Type | File |
|---|------|------|------|
| 1 | List tickets | API+E2E | tickets-comprehensive.test.ts |
| 2 | Create ticket | API | tickets-comprehensive.test.ts |
| 3 | Get ticket detail | API | tickets-comprehensive.test.ts |
| 4 | Update ticket | API | tickets-comprehensive.test.ts |
| 5 | Delete ticket | API | tickets-comprehensive.test.ts |
| 6 | Change ticket status | API | tickets-comprehensive.test.ts |
| 7 | Ticket validation | API | tickets-comprehensive.test.ts |
| 8 | Ticket page CRUD flow | E2E | e2e/tickets-full.test.ts |

### 8. REPORTS - Báo cáo (7 tests)
| # | Test | Type | File |
|---|------|------|------|
| 1 | Get call report | API | reports-comprehensive.test.ts |
| 2 | Get telesale report | API | reports-comprehensive.test.ts |
| 3 | Get collection report | API | reports-comprehensive.test.ts |
| 4 | Reports blocked for agents | API | reports-comprehensive.test.ts |
| 5 | Date filter accuracy | API | reports-comprehensive.test.ts |
| 6 | Reports page loads 3 tabs | E2E | e2e/reports-full.test.ts |
| 7 | Dashboard overview endpoint | API | reports-comprehensive.test.ts |

### 9. SETTINGS - Cài đặt (5 tests)
| # | Test | Type | File |
|---|------|------|------|
| 1 | Get current user profile | API | settings-comprehensive.test.ts |
| 2 | Update profile | API | settings-comprehensive.test.ts |
| 3 | User management - list users (admin) | API | settings-comprehensive.test.ts |
| 4 | User management - create user (admin) | API | settings-comprehensive.test.ts |
| 5 | User management blocked for agents | API | settings-comprehensive.test.ts |

### 10. RBAC - Phân quyền (15 tests)
| # | Test | Type | File |
|---|------|------|------|
| 1 | Agent sees own contacts only | API | rbac-comprehensive.test.ts |
| 2 | Agent sees own leads only | API | rbac-comprehensive.test.ts |
| 3 | Agent sees own call logs only | API | rbac-comprehensive.test.ts |
| 4 | Manager sees all agents in team | API | rbac-comprehensive.test.ts |
| 5 | Admin sees all data | API | rbac-comprehensive.test.ts |
| 6 | QA cannot delete contacts | API | rbac-comprehensive.test.ts |
| 7 | QA cannot delete tickets | API | rbac-comprehensive.test.ts |
| 8 | Agent blocked from user management | API+E2E | rbac-comprehensive.test.ts |
| 9 | Agent blocked from campaigns | API | rbac-comprehensive.test.ts |
| 10 | Agent blocked from reports | API | rbac-comprehensive.test.ts |
| 11 | Leader sees team data | API | rbac-comprehensive.test.ts |
| 12 | QA can view annotations | API | rbac-comprehensive.test.ts |
| 13 | QA can create annotations | API | rbac-comprehensive.test.ts |
| 14 | Manager can view users | API | rbac-comprehensive.test.ts |
| 15 | Manager blocked from creating users | API | rbac-comprehensive.test.ts |

### 11. MCP TOOLS (8 tests)
| # | Test | Type | File |
|---|------|------|------|
| 1 | run_health_check returns status | API | mcp-tools.test.ts |
| 2 | click_to_call initiates call | API | mcp-tools.test.ts |
| 3 | get_call_logs returns data | API | mcp-tools.test.ts |
| 4 | get_agent_status shows agents | API | mcp-tools.test.ts |
| 5 | get_reports returns report | API | mcp-tools.test.ts |
| 6 | check_permissions - all 6 roles | API | mcp-tools.test.ts |
| 7 | get_recordings returns list | API | mcp-tools.test.ts |
| 8 | stress_test runs Playwright | API | mcp-tools.test.ts |

---

## Total Test Count: 105 tests
- Backend API (Vitest): ~90 tests
- E2E UI (Playwright): ~15 tests
- MCP Tools: ~8 tests (via HTTP calls)

## Implementation Files

### Backend Tests (packages/backend/tests/)
- `auth-comprehensive.test.ts` — 12 tests
- `contacts-comprehensive.test.ts` — 14 tests
- `leads-comprehensive.test.ts` — 10 tests
- `debt-cases-comprehensive.test.ts` — 9 tests
- `call-logs-comprehensive.test.ts` — 10 tests
- `campaigns-comprehensive.test.ts` — 7 tests
- `tickets-comprehensive.test.ts` — 8 tests
- `reports-comprehensive.test.ts` — 7 tests
- `settings-comprehensive.test.ts` — 5 tests
- `rbac-comprehensive.test.ts` — 15 tests

### E2E Tests (e2e/)
- `auth-full.test.ts` — Login all 6 roles, logout, wrong password
- `crud-full.test.ts` — CRUD for contacts, leads, tickets
- `rbac-ui.test.ts` — Agent can't access settings/user management
- `reports-full.test.ts` — Reports page tabs

### MCP Tests (packages/mcp-server/tests/)
- `mcp-tools.test.ts` — All 8 MCP tools

## Success Criteria
- [ ] All 105 tests written and passing
- [ ] Every user action has at least 1 test
- [ ] All 6 roles tested for RBAC
- [ ] Final report generated with pass/fail count per category

## Risk Assessment
- DB may not be available during CI → tests use `expect([200, 500])` pattern
- FusionPBX ESL may be down → MCP click_to_call test allows connection errors
- Rate limiting may interfere → tests add retry logic with delays
