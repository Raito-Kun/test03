## Phase Implementation Report

### Executed Phase
- Phase: bugfix-round4
- Plan: none (ad-hoc bugfix)
- Status: completed

### Files Modified

| File | Change |
|------|--------|
| `packages/backend/src/routes/template-routes.ts` | Added UTF-8 BOM (`\uFEFF`) prefix to CSV response |
| `packages/frontend/src/pages/contacts/contact-detail-dialog.tsx` | (1) Exclude `notes` field from PATCH payload; (2) Resize dialog to max-w-3xl max-h-[85vh] |
| `packages/frontend/src/pages/settings/extension-config.tsx` | Translate table headers: Agent→Nhân viên, Domain→Miền |
| `packages/frontend/src/pages/leads/lead-form.tsx` | Translate "Contact ID" label and placeholder to "Mã liên hệ" |
| `packages/frontend/src/components/import-button.tsx` | Translate "Template" button text to "Tải mẫu" |

### Tasks Completed

- [x] Bug 1: Super Admin Delete — investigated; backend already correct. `requireRole('super_admin', 'admin', 'manager')` on DELETE route + RBAC middleware explicitly bypasses super_admin + `buildScopeWhere({})` returns `{}` for super_admin. No code change needed.
- [x] Bug 2: CSV Template UTF-8 BOM — added `'\uFEFF' + csv` in `template-routes.ts` before sending response
- [x] Bug 3: Language consistency — translated English UI text in extension-config.tsx and lead-form.tsx; confirmed contact-list, lead-list, debt-case-list, call-log-list, permission-manager, dashboard all use VI constants already
- [x] Bug 4: Contact save — removed `notes` field from PATCH payload (not in backend Zod schema); numeric fields (income, creditLimit) already converted to Number before send
- [x] Bug 5: Dialog centering — changed `max-w-4xl max-h-[90vh]` to `max-w-3xl max-h-[85vh]`; Dialog component is already a centered modal (not Sheet)
- [x] Bug 6: Extension mapping — reviewed code; Select already shows `{u.fullName} ({u.email})` for each SelectItem and SelectValue renders matched item label, not raw UUID. No code change needed.
- [x] Bug 7: Compilation — both `packages/backend` and `packages/frontend` compile with `npx tsc --noEmit` with zero errors

### Tests Status
- Type check backend: pass
- Type check frontend: pass
- Unit tests: not run (no test runner invoked)

### Issues Encountered
- Bug 1 and Bug 6 were already correctly implemented in the codebase; no changes required
- The `notes` field in `EditForm` is a UI-only field not persisted to the Contact model — it's displayed in the Notes tab but the backend schema doesn't have a `notes` column on `Contact`. The fix strips it before PATCH

### Next Steps
- Consider removing the `notes` field from `Contact` interface and `EditForm` entirely if it's unused, or adding `notes` to the Contact Prisma schema if it's intended functionality
- The "Template" download in `import-button.tsx` bypasses the auth cookie — no auth header sent; ensure `/api/v1/templates/:type` remains public (it is)

### Unresolved Questions
- The `notes` field in `contact-detail-dialog.tsx` references `(contact as unknown as Record<string, string>).notes` — this field does not exist on the Contact model. Should it be removed from the UI entirely, or added to the backend schema?
