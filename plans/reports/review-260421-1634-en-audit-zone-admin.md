## Zone Settings + Admin + Auth + Layout — English leaks

### packages/frontend/src/pages/settings/account-management.tsx:22-28
- **Issue**: Role filter dropdown labels are raw English for super_admin / admin / manager / qa / leader / agent.
- **Evidence**: `{ value: 'super_admin', label: 'Super Admin' }, { value: 'admin', label: 'Admin' }, { value: 'manager', label: 'Manager' }, ... { value: 'leader', label: 'Leader' }, { value: 'agent', label: 'Agent' }`
- **Suggested VN**: `'Super Admin' → 'Quản trị viên cao cấp'`, `'Admin' → 'Quản trị viên'`, `'Manager' → 'Quản lý'`, `'Leader' → 'Trưởng nhóm'`, `'Agent' → 'Nhân viên'`. Reuse the existing `ROLE_VI_NAMES` map from `role-tab-panel.tsx`.

### packages/frontend/src/pages/settings/account-management.tsx:53-61
- **Issue**: `ROLE_LABELS` constant is a second copy of English role names; rendered verbatim in the role group header row (line 92).
- **Evidence**: `const ROLE_LABELS: Record<string, string> = { super_admin: 'Super Admin', admin: 'Admin', manager: 'Manager', supervisor: 'Supervisor', qa: 'QA', leader: 'Leader', agent: 'Agent' };`
- **Suggested VN**: Remove this local copy and import from a single shared Vietnamese map (e.g. `VI.roles`). Add missing keys `super_admin: 'Quản trị cao cấp'`, `supervisor: 'Giám sát viên'` to `VI.roles` first.

### packages/frontend/src/pages/settings/account-management.tsx:239, 243
- **Issue**: Action button labels "Export ext" and "Import CSV" are English.
- **Evidence**: `<Button ...>Export ext</Button>` and `<Button ...>Import CSV</Button>`
- **Suggested VN**: `'Xuất extension'` and `'Nhập CSV'`.

### packages/frontend/src/pages/settings/account-management.tsx:321-322
- **Issue**: Table column headers "Email" and "Extension" are English tokens shown to the user (not internal identifiers; the adjacent columns are already VN "Họ tên / Trạng thái / Ngày tạo").
- **Evidence**: `<th ...>Email</th>`, `<th ...>Extension</th>`
- **Suggested VN**: Keep `'Email'` (VN-accepted loanword, already in `VI.email`) but translate `'Extension' → 'Máy nhánh'` for consistency with the sidebar item and `settings-page.tsx` line 88.

### packages/frontend/src/pages/settings/account-create-dialog.tsx:25-31
- **Issue**: Role dropdown options use raw English labels identical to role IDs.
- **Evidence**: `const ROLES = [{ value: 'admin', label: 'Admin' }, { value: 'manager', label: 'Manager' }, { value: 'qa', label: 'QA' }, { value: 'leader', label: 'Leader' }, { value: 'agent', label: 'Agent' }];`
- **Suggested VN**: Use VN labels: `'Quản trị viên', 'Quản lý', 'QA', 'Trưởng nhóm', 'Nhân viên'` (drive from `VI.roles`).

### packages/frontend/src/pages/settings/account-create-dialog.tsx:91
- **Issue**: Form field label "Role" in English.
- **Evidence**: `<Label>Role <span className="text-destructive">*</span></Label>`
- **Suggested VN**: `<Label>Vai trò <span ...>*</span></Label>`

### packages/frontend/src/pages/settings/account-create-dialog.tsx:101
- **Issue**: Form field label "Extension" in English.
- **Evidence**: `<Label>Extension</Label>`
- **Suggested VN**: `<Label>Máy nhánh</Label>`

### packages/frontend/src/pages/settings/account-edit-dialog.tsx:19-25
- **Issue**: Duplicate of the English `ROLES` array from account-create-dialog — same English labels `'Admin' / 'Manager' / 'QA' / 'Leader' / 'Agent'`.
- **Evidence**: `const ROLES = [{ value: 'admin', label: 'Admin' }, ...];`
- **Suggested VN**: Same fix — VN labels, ideally extracted into `vi-text.ts` to kill the duplication.

### packages/frontend/src/pages/settings/account-edit-dialog.tsx:77, 87
- **Issue**: Form labels "Role" and "Extension" in English.
- **Evidence**: `<Label>Role</Label>`, `<Label>Extension</Label>`
- **Suggested VN**: `'Vai trò'`, `'Máy nhánh'`.

### packages/frontend/src/pages/settings/account-import-dialog.tsx:102
- **Issue**: Button label "Template" shown to the user (not a technical identifier in context).
- **Evidence**: `<Button ... onClick={downloadTemplate} ...><Download ... />Template</Button>`
- **Suggested VN**: `'Tải mẫu'` or `'Mẫu CSV'` (title attribute already says "Tải template").

### packages/frontend/src/pages/settings/account-import-dialog.tsx:116-118
- **Issue**: Table headers `"Email"`, `"Role"`, `"Ext"` in CSV preview table. Row `"Họ tên"` is VN → inconsistent.
- **Evidence**: `<th ...>Họ tên</th> <th ...>Email</th> <th ...>Role</th> <th ...>Ext</th>`
- **Suggested VN**: `'Email'` (keep), `'Vai trò'`, `'Máy nhánh'`.

### packages/frontend/src/pages/settings/account-import-dialog.tsx:85
- **Issue**: Dialog title starts with English verb "Import".
- **Evidence**: `<DialogTitle>Import tài khoản từ CSV</DialogTitle>`
- **Suggested VN**: `'Nhập tài khoản từ CSV'`.

### packages/frontend/src/pages/settings/account-import-dialog.tsx:144
- **Issue**: Submit button label starts with English verb "Import".
- **Evidence**: `Import {preview.length > 0 ? \`${preview.length} tài khoản\` : ''}`
- **Suggested VN**: `Nhập {preview.length > 0 ? \`${preview.length} tài khoản\` : ''}`

### packages/frontend/src/pages/settings/cluster-management.tsx:78, 82
- **Issue**: Badge labels "Active" / "Inactive" rendered raw to the user on each cluster card.
- **Evidence**: `<Badge ...><CheckCircle2 ... />Active</Badge>` and `<Badge variant="outline" ...>Inactive</Badge>`
- **Suggested VN**: `'Đang dùng'` / `'Không dùng'` (or `'Hoạt động'` / `'Ngừng'` — match whichever convention the project already uses; `account-management.tsx` uses `'Hoạt động' / 'Vô hiệu'`).

### packages/frontend/src/pages/settings/cluster-detail-form.tsx:239-240
- **Issue**: Tab labels "SSH & Ext" and ambiguous English abbreviation "Ext".
- **Evidence**: `<TabsTrigger value="ssh">SSH & Ext</TabsTrigger>`
- **Suggested VN**: `'SSH & Máy nhánh'`.

### packages/frontend/src/pages/settings/cluster-detail-form.tsx:261, 265, 268, 271, 274, 277
- **Issue**: Form field labels use raw English technical names ("ESL Port", "ESL Password", "PBX IP", "SIP Domain", "SIP WebSocket URL", "Gateway/Trunk name") mixed with VN labels on the same tab. Medium priority — these are technical terms familiar to PBX admins; some VN speakers accept them as loanwords. But consistency should be enforced.
- **Evidence**: `<Field label="ESL Port" ...>`, `<Field label="ESL Password" ...>`, `<Field label="PBX IP" ...>`, `<Field label="SIP Domain" ...>`, `<Field label="SIP WebSocket URL" ...>`, `<Field label="Gateway/Trunk name" ...>`
- **Suggested VN**: Keep the English tokens (ESL/SIP/PBX are technical acronyms) but translate surrounding words: `'Cổng ESL'`, `'Mật khẩu ESL'`, `'IP PBX'`, `'Tên miền SIP'`, `'URL WebSocket SIP'`, `'Tên gateway/trunk'`. Alternatively leave as-is but document this as a deliberate exception (PBX config terms). Flag for decision.

### packages/frontend/src/pages/settings/cluster-detail-form.tsx:318-322, 332-346
- **Issue**: SSH and FusionPBX Postgres form fields use raw English labels "SSH User", "SSH Password", "PG Host", "PG Port", "PG User", "PG Password", "PG Database".
- **Evidence**: `<Field label="SSH User">`, `<Field label="PG Host">`, etc.
- **Suggested VN**: `'Tài khoản SSH'`, `'Mật khẩu SSH'`, `'Host PG'`, `'Port PG'`, `'Tài khoản PG'`, `'Mật khẩu PG'`, `'Database PG'` (or fully translate "PG" → "Postgres").

### packages/frontend/src/pages/settings/cluster-detail-form.tsx:413-432
- **Issue**: Form field labels "AI API Endpoint", "AI API Key", "SMTP Host", "SMTP Port", "SMTP User", "SMTP Password" in English.
- **Evidence**: `<Field label="AI API Endpoint">`, `<Field label="AI API Key">`, `<Field label="SMTP Host">`, etc.
- **Suggested VN**: `'API endpoint AI'`, `'API key AI'`, `'SMTP Host'` → at minimum `'Máy chủ SMTP'`, `'Cổng SMTP'`, `'Tài khoản SMTP'`, `'Mật khẩu SMTP'`.

### packages/frontend/src/pages/settings/cluster-detail-form.tsx:292
- **Issue**: Button label "Test kết nối" — "Test" is English verb mixed with VN. Low priority (common loanword) but could be fully VN.
- **Evidence**: `Test kết nối`
- **Suggested VN**: `'Kiểm tra kết nối'`.

### packages/frontend/src/pages/settings/cluster-detail-form.tsx:371
- **Issue**: Button label "Sync extensions" — full English.
- **Evidence**: `Sync extensions`
- **Suggested VN**: `'Đồng bộ máy nhánh'`.

### packages/frontend/src/pages/settings/cluster-detail-form.tsx:381
- **Issue**: Table header "Accountcode" is an English technical token exposed to the user.
- **Evidence**: `<th ...>Accountcode</th>`
- **Suggested VN**: Keep `'Accountcode'` (FusionPBX term, admin-facing) OR `'Mã tài khoản'`. Flag for decision.

### packages/frontend/src/pages/settings/cluster-detail-form.tsx:379
- **Issue**: Table header "Extension" (inside the SSH tab, non-admin users still see this table).
- **Evidence**: `<th ...>Extension</th>`
- **Suggested VN**: `'Máy nhánh'`.

### packages/frontend/src/pages/settings/cluster-feature-flags-tab.tsx:137
- **Issue**: Button label simply reads "Domain" — vague English label for "add domain" action.
- **Evidence**: `<Button ...><Plus ... />Domain</Button>`
- **Suggested VN**: `'Thêm domain'` or `'Thêm miền'`.

### packages/frontend/src/pages/settings/cluster-feature-flags-tab.tsx:144
- **Issue**: Placeholder "domain_name" in English.
- **Evidence**: `placeholder="domain_name"`
- **Suggested VN**: `placeholder="VD: bayer-cct"` (or any real example already present in the project).

### packages/frontend/src/pages/settings/cluster-feature-flags-tab.tsx:77
- **Issue**: Toast message starts with English loan word "Domain".
- **Evidence**: `toast.error('Domain đã tồn tại');`
- **Suggested VN**: `'Miền này đã tồn tại'` or keep but prefix: `'Tên miền đã tồn tại'`.

### packages/frontend/src/pages/settings/cluster-discover-result.tsx:121, 149
- **Issue**: Section headings "Outbound Routes" and "Inbound Routes" in English; the adjacent page UI is VN.
- **Evidence**: `Outbound Routes` and `Inbound Routes`
- **Suggested VN**: `'Route gọi ra'` / `'Route gọi vào'` (or `'Luồng gọi ra' / 'Luồng gọi vào'`).

### packages/frontend/src/pages/settings/cluster-dialplan-picker.tsx:91
- **Issue**: Empty-state text includes English "enable".
- **Evidence**: `Domain này không có dialplan rule nào đang enable.`
- **Suggested VN**: `'Domain này chưa có dialplan rule nào được bật.'`

### packages/frontend/src/pages/settings/extension-config.tsx:82
- **Issue**: Column header "Email" — see global note in account-management; keep `'Email'` (loanword) but flagged for consistency.
- **Evidence**: `<th ...>Email</th>`
- **Suggested VN**: Keep.

### packages/frontend/src/pages/settings/settings-page.tsx:16
- **Issue**: `ADMIN_ROLES` hardcodes `'super_admin'` role ID — not a UI string but referenced in permission check. **Skipped** (technical identifier).

### packages/frontend/src/pages/settings/permission-manager.tsx:183-184
- **Issue**: Tab trigger labels "Ma trận quyền" / "Vai trò" are VN (good), but the permissions page also relies on `ROLE_LABELS` from `permission-matrix-table.tsx` which are English — see next finding.

### packages/frontend/src/components/permission-matrix-table.tsx:44-52
- **Issue**: `ROLE_LABELS` is the authoritative English role map rendered as the column header of the big permission matrix and re-exported elsewhere. This is the highest-visibility English leak in the admin zone.
- **Evidence**: `export const ROLE_LABELS: Record<string, string> = { super_admin: 'Super Admin', admin: 'Admin', manager: 'Manager', supervisor: 'Supervisor', qa: 'QA', leader: 'Leader', agent: 'Agent' };`
- **Suggested VN**: Replace with VN names (reusing `ROLE_VI_NAMES` from `role-tab-panel.tsx` which already has them). Consolidate into `VI.roles` in `vi-text.ts`, adding missing keys `super_admin` and `supervisor`. Then remove the duplicates in this file, `role-tab-panel.tsx`, and `account-management.tsx`.

### packages/frontend/src/components/role-tab-panel.tsx:80, 83
- **Issue**: Card subtitle and badge show the English role label ("Admin", "Super Admin", etc.) from `ROLE_LABELS` under the VN title. Duplicated label noise.
- **Evidence**: `<p ...>{ROLE_LABELS[role]}</p>` and `<span ...>{ROLE_LABELS[role]}</span>`
- **Suggested VN**: If `ROLE_LABELS` is updated to VN (prior finding), this becomes redundant with `ROLE_VI_NAMES` → remove the subtitle. Alternatively keep `ROLE_LABELS` as the internal role ID tag and show it in `font-mono` to signal "this is a key, not a user label".

### packages/frontend/src/components/cluster-select.tsx:27
- **Issue**: Badge suffix "● Active" shown on every cluster option.
- **Evidence**: `{c.name}{c.isActive ? ' ● Active' : ''}`
- **Suggested VN**: `' ● Đang dùng'` (or `' ● Hoạt động'` — match the cluster-management.tsx convention).

### packages/frontend/src/components/cluster-switcher.tsx:89, 92
- **Issue**: Badge labels "Active" and "Inactive" in the cluster dropdown.
- **Evidence**: `<CheckCircle2 ... /> Active` and `<span ...>Inactive</span>`
- **Suggested VN**: `'Đang dùng'` / `'Không dùng'` (consistent with cluster-management.tsx fix).

### packages/frontend/src/components/cluster-switcher.tsx:110
- **Issue**: Button label typo: "Huỷ" uses old-orthography `ỷ` — inconsistent with rest of codebase (`VI.actions.cancel = 'Hủy'`). Low priority.
- **Evidence**: `<Button ...>Huỷ</Button>`
- **Suggested VN**: `{VI.actions.cancel}` or `'Hủy'`.

### packages/frontend/src/components/layout/topbar-actions.tsx:45
- **Issue**: Button label "AI Assist" — English phrase on top-level UI chrome.
- **Evidence**: `<span ...>AI Assist</span>`
- **Suggested VN**: `'Trợ lý AI'`.

### packages/frontend/src/components/layout/breadcrumbs.tsx (via route-labels.ts:38, 44)
- **Issue**: Breadcrumb segment "Ops" hardcoded on every page.
- **Evidence**: `segments.push({ label: 'Ops', path: '/' });` (appears twice in route-labels.ts)
- **Suggested VN**: `'Vận hành'` or drop the extra segment entirely (currently `'CRM PLS' / 'Ops' / 'Tổng quan'` — middle one has no target route).

### packages/frontend/src/components/layout/ops-status-bar.tsx:75-86
- **Issue**: StatusBar cell labels `'SYS' / 'CPU' / 'LAT' / 'QUEUE' / 'RX/TX' / 'PBX' / 'PAGE' / 'BUILD' / '#' / 'TZ' / 'UTC'` plus values `'ONLINE' / 'OFFLINE'` — these are technical-operator labels in a DOS/htop-style status bar. **Skipped** per rules (technical identifiers). Only ONLINE/OFFLINE could arguably be VN: `'TRỰC TUYẾN'` / `'OFFLINE'`, but given the aesthetic is intentionally English-terminal, leaving as-is is acceptable. Flag for product decision.

### packages/frontend/src/components/feature-disabled-guard.tsx
- **Issue**: No English leaks — messages VN. Good.

### packages/frontend/src/components/protected-route.tsx
- **Issue**: Loading state has only a spinner, no text. Fine.

### packages/frontend/src/components/ui/dialog.tsx:73 and sheet.tsx:75
- **Issue**: `sr-only` close button label "Close" — exposed to screen readers.
- **Evidence**: `<span className="sr-only">Close</span>`
- **Suggested VN**: `'Đóng'` (use `VI.actions.close`). Low priority but affects accessibility users with VN screen reader.

### Skipped / not issues
- `cluster-discover-result.tsx:80,111`, `cluster-feature-flags-tab.tsx:130,149-150`, `cluster-preflight-tab.tsx:73,96,98`, `cluster-detail-form.tsx:492-493,522`, `settings-page.tsx`, `team-management.tsx`, `permission-manager.tsx`: all buttons/toasts/empty-states already VN.
- `cluster-field-help.tsx` body text: technical hints quoting FusionPBX menu paths (English) — appropriate, skipped.
- `extension-config.tsx` StatusBadge "Registered/Unregistered": the prop type is English but the rendered labels `'Đã đăng ký'/'Chưa đăng ký'/'Không rõ'` are VN. Good.
- `login.tsx`: entirely VN (uses `VI.*`). Good.
- `sidebar.tsx`: all nav labels VN; role strings `super_admin` etc. are comparison keys, not rendered. Good.
- `notification-bell.tsx`: uses `VI.*`. Good.

### Summary by severity

**Critical (high visibility, touches every admin user every session)**
1. `permission-matrix-table.tsx:44-52` — English `ROLE_LABELS` renders as column headers in the permission matrix.
2. `account-management.tsx:22-28, 53-61` — role filter and row grouping both show raw English role names.
3. `account-create-dialog.tsx:25-31, 91, 101` and `account-edit-dialog.tsx:19-25, 77, 87` — form labels + role dropdowns in English.

**High**
4. `cluster-management.tsx:78,82` and `cluster-switcher.tsx:89,92` and `cluster-select.tsx:27` — Active/Inactive badges.
5. `account-import-dialog.tsx:85, 116-118, 144` — Import dialog title / headers / action.
6. `account-management.tsx:239,243` — Export/Import action buttons.
7. `topbar-actions.tsx:45` — "AI Assist" button.

**Medium**
8. `cluster-detail-form.tsx` form labels (ESL/SSH/PG/SMTP/AI sections) — mixed EN/VN; 20+ labels.
9. `cluster-detail-form.tsx:371` Sync extensions button.
10. `cluster-discover-result.tsx:121,149` Outbound/Inbound Routes headings.
11. `cluster-feature-flags-tab.tsx:137,144` Domain button + placeholder.
12. `route-labels.ts:38,44` breadcrumb "Ops".

**Low**
13. `cluster-switcher.tsx:110` "Huỷ" orthography inconsistency.
14. `dialog.tsx:73`, `sheet.tsx:75` sr-only "Close".
15. `ops-status-bar.tsx` ONLINE/OFFLINE (terminal aesthetic — likely intentional).

### Unresolved questions
- Are "ESL / SIP / PBX / SMTP / API / SSH / gateway / dialplan / accountcode" considered loan words acceptable in VN admin UI, or must they all be translated? This affects ~30 labels in `cluster-detail-form.tsx`, `cluster-field-help.tsx`, and `cluster-dialplan-picker.tsx`. Recommend: keep the acronyms (ESL, SIP, PBX, SMTP, API, SSH) as loanwords but translate the surrounding qualifiers (Host → Máy chủ, Port → Cổng, Password → Mật khẩu, User → Tài khoản).
- Should the ops status bar keep its English "DOS/htop terminal" aesthetic (SYS/CPU/LAT/QUEUE/ONLINE/OFFLINE) or be fully VN? Current design looks intentional; product call.
- Is there a canonical VN for "Active/Inactive" across the admin zone? Current code uses three variants: `'Hoạt động'/'Vô hiệu'` (account-management), `'Active'/'Inactive'` (cluster-management, cluster-switcher, cluster-select). Pick one and enforce.
- Should `super_admin` ever be displayed to non-super_admin users, or is the label moot because only super_admins see super_admin rows/columns? If the former, add `super_admin: 'Quản trị cao cấp'` to `VI.roles`; if the latter, can keep "Super Admin" as an internal admin-to-admin label. Recommend adding VN anyway for consistency.
