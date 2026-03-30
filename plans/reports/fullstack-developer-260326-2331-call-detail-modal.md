# Phase Implementation Report

### Executed Phase
- Phase: call-detail-modal (ad-hoc bugfix)
- Plan: none
- Status: completed

### Files Modified
- `packages/frontend/src/pages/call-logs/call-log-detail.tsx` — 200 lines (refactored + exported `CallLogDetailContent`)
- `packages/frontend/src/pages/call-logs/call-log-list.tsx` — 143 lines (Dialog modal, removed `useNavigate` for row click)

### Tasks Completed
- [x] Bug 1: `call-log-list.tsx` row click now sets `selectedCallId` state instead of navigating
- [x] Bug 1: `Dialog` (max-w-4xl, max-h-[85vh], overflow-y-auto, centered) renders `CallLogDetailContent`
- [x] Bug 1: `CallLogDetailContent` exported from detail page; `CallLogDetailPage` (direct URL) still works as fallback
- [x] Bug 1: `onClose` prop on `CallLogDetailContent` — closes dialog (or navigates back on full page)
- [x] Bug 1+API: Fixed `calleeNumber` → `destinationNumber` in `CallLogDetail` interface and all render sites
- [x] Bug 2: Disposition label: shows `call.dispositionCode?.label` (Vietnamese) first, falls back to `call.disposition` (raw code). Removed hardcoded raw `{call.disposition}` badge
- [x] Bug 3: `recordingUrl` prepends `window.location.origin` when relative path (not starting with `http`)
- [x] Bug 3: "Tải về" download button (`<a href download>`) added next to AudioPlayer
- [x] List page: Mic icon for rows with recordings already present — verified, no change needed

### Tests Status
- Type check frontend: pass (no output = clean)
- Type check backend: pass (no output = clean)
- Unit tests: not run (no test suite for frontend components)

### Issues Encountered
None. `dialog.tsx` shadcn component confirmed present at `packages/frontend/src/components/ui/dialog.tsx`.

### Next Steps
- None required. Direct URL `/call-logs/:id` still functional via `CallLogDetailPage` wrapper.
