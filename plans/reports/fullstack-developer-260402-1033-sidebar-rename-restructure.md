# Sidebar Rename & Restructure — Implementation Report

**Date:** 2026-04-02  
**Status:** Completed + Deployed

---

## Summary

Renamed two sidebar items and restructured CRM navigation group. Campaigns extracted to own group. Contact detail dialog upgraded to full-screen single-view layout. Deployed to dev server 10.10.101.207.

---

## Changes

### Renames
- "Danh bạ" → "Danh sách khách hàng"
- "Khách hàng tiềm năng" → "Nhóm khách hàng"

### Sidebar Restructure
- CRM group: Danh sách khách hàng, Nhóm khách hàng, Công nợ
- New group "Chiến dịch": Danh sách chiến dịch (extracted from CRM group)
- Other groups unchanged

### Files Modified
| File | Change |
|------|--------|
| `packages/frontend/src/components/layout/sidebar.tsx` | Restructured groups, applied renames |
| `packages/frontend/src/lib/vi-text.ts` | Updated Vietnamese label constants |
| `packages/frontend/src/pages/dashboard.tsx` | Updated references to renamed items |
| `packages/frontend/src/pages/settings/permission-manager.tsx` | Updated label references |
| `packages/frontend/src/components/permission-matrix-table.tsx` | Updated label references |
| `packages/frontend/src/components/ui/dialog.tsx` | Increased base max-width |
| `packages/frontend/src/pages/contacts/contact-detail-dialog.tsx` | Full-screen dialog, all sections in single view |

---

## Deployment Status

- Build: success
- Deploy method: SFTP + Docker container restart
- Target: `10.10.101.207` (dev server)
- Status: Live
