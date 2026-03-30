# Phase 13 Implementation Report — Extension Mapping Config

## Executed Phase
- Phase: 13 — Extension Mapping Config
- Plan: none (ad-hoc task)
- Status: completed

## Files Modified

| File | Change |
|---|---|
| `packages/backend/src/services/esl-service.ts` | Added `sendApi()` (private) + exported `getSofiaRegistrations()` |
| `packages/backend/src/index.ts` | Registered `/api/v1/extensions` route |
| `packages/frontend/src/app.tsx` | Added lazy import + route `/settings/extensions` |
| `packages/frontend/src/pages/settings/settings-page.tsx` | Added admin-only "Cấu hình máy nhánh" card with Link |
| `packages/frontend/src/components/layout/sidebar.tsx` | Added `Phone` icon import, `Máy nhánh` nav item, admin-only role visibility |

## Files Created

| File | Purpose |
|---|---|
| `packages/backend/src/services/extension-service.ts` | `listExtensions()` merges DB + sofia regs; `assignExtension()` clears old + sets new |
| `packages/backend/src/controllers/extension-controller.ts` | GET + PUT /:ext/assign handlers |
| `packages/backend/src/routes/extension-routes.ts` | Router with authMiddleware + requireRole('admin','super_admin') |
| `packages/frontend/src/pages/settings/extension-config.tsx` | Table with status badges, Select dropdown per row, X unassign button |

## Tasks Completed

- [x] `sendApi()` added to esl-service.ts
- [x] `getSofiaRegistrations()` parses `sofia status profile internal reg` pipe-delimited output
- [x] Extension service: list (1001-1010 base + any registered/assigned extras), assign
- [x] Extension controller: GET `/` + PUT `/:ext/assign` with validation
- [x] Extension routes: admin/super_admin only, auth-protected
- [x] Route registered in backend index.ts
- [x] Frontend page: Vietnamese labels, status badges (green/red/gray), Select + X unassign
- [x] app.tsx: lazy import + `/settings/extensions` route
- [x] settings-page.tsx: admin-only card with Link to extensions page
- [x] sidebar.tsx: `Máy nhánh` nav item, admin-only visibility

## Tests Status
- Backend typecheck: pass (0 errors)
- Frontend typecheck: pass (0 errors)
- Unit tests: not run (no new test files required by spec)

## Issues Encountered
- Express `req.params` typed as `string | string[]` — fixed with `String(req.params.ext ?? '')`.

## Design Notes
- Extension pool: 1001–1010 hardcoded as base; any extra from sofia regs or DB assignments also included.
- Sofia registrations polled live on each GET request; frontend auto-refreshes every 30s.
- Unassign via Select "— Không gán —" or X button both call PUT with `userId: null`.
- `getSofiaRegistrations()` returns empty Map on ESL error (graceful degradation — status shows "Unknown").

## Next Steps
- No blockers. Extensions feature is self-contained.
- Optional: add WebSocket push to update registration status in real time.
