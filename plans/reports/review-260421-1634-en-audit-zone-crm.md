## Zone CRM — English leaks

### packages/frontend/src/pages/campaigns/campaign-agents-tab.tsx:100
- **Issue**: Raw English column header "Ext" in agents table
- **Evidence**: `<th className="text-left px-3 py-2 font-medium">Ext</th>`
- **Suggested VN**: `<th ...>Máy lẻ</th>`

### packages/frontend/src/pages/contacts/contact-detail.tsx:62
- **Issue**: Raw English nav label "Ticket" in left panel mini-nav
- **Evidence**: `{ key: 'tickets', label: 'Ticket' },`
- **Suggested VN**: `{ key: 'tickets', label: VI.contact.tabs.tickets }` (renders "Phiếu ghi")

### packages/frontend/src/pages/contacts/contact-detail.tsx:262
- **Issue**: Raw disposition string rendered directly (likely English/code value from backend without mapping)
- **Evidence**: `{c.disposition && <Badge variant="outline">{c.disposition}</Badge>}`
- **Suggested VN**: Map via disposition-code lookup, e.g. `{dispoLabelVi(c.disposition) ?? c.disposition}`; or reuse `call-history-tab` pattern which uses `dispositionCode.label` instead of raw enum.

### packages/frontend/src/pages/contacts/contact-import-step-assign.tsx:77
- **Issue**: English column header "Action" in manual-assignment table
- **Evidence**: `<th className="px-2 py-1 text-left w-24">Action</th>`
- **Suggested VN**: `<th ...>Hành động</th>` (consistent with `contact-import-step-dedup.tsx:197`)

### packages/frontend/src/pages/contacts/contact-import-step-assign.tsx:88
- **Issue**: Raw English action enum rendered in Badge without VN mapping (`create`, `merge`, `overwrite`, `keep`)
- **Evidence**: `<Badge variant="secondary" className="text-xs">{action}</Badge>`
- **Suggested VN**: Import `ACTION_LABELS` from `contact-import-step-dedup.tsx` (or hoist to shared const) and render `{ACTION_LABELS[action]}`.

### packages/frontend/src/pages/contacts/contact-import-step-assign.tsx:49
- **Issue**: Raw English role value in Badge (e.g. `super_admin`, `admin`, `leader`)
- **Evidence**: `<Badge variant="outline" className="text-xs">{a.role}</Badge>`
- **Suggested VN**: `{VI.roles[a.role as keyof typeof VI.roles] ?? a.role}`

### packages/frontend/src/pages/contacts/contact-import-step-assign.tsx:74
- **Issue**: "STT" is acceptable VN, but verify — it's an abbreviation and already commonly used. (Skip — not a leak.)
- **Evidence**: `<th className="px-2 py-1 text-left w-10">STT</th>`
- **Suggested VN**: (keep)

### packages/frontend/src/pages/contacts/contact-import-step-assign.tsx:183
- **Issue**: Mixed English labels in mode-switch buttons ("Random", "Manual")
- **Evidence**: `{m === 'random' ? 'Random (chia đều)' : 'Manual (chọn thủ công)'}`
- **Suggested VN**: `{m === 'random' ? 'Chia đều' : 'Thủ công'}` (drop English prefix; parenthetical is already VN)

### packages/frontend/src/pages/contacts/contact-import-step-assign.tsx:43
- **Issue**: Parenthetical technical English "(round-robin)" in instruction text shown to non-technical agents
- **Evidence**: `<p className="text-sm text-muted-foreground">Chọn nhân viên để chia đều bản ghi (round-robin):</p>`
- **Suggested VN**: `Chọn nhân viên để chia đều bản ghi:` (drop `(round-robin)`) or replace with `(luân phiên)`.

### packages/frontend/src/pages/contacts/call-history-tab.tsx:63
- **Issue**: English table header "Agent"
- **Evidence**: `<th ...>Agent</th>`
- **Suggested VN**: `<th ...>Nhân viên</th>` (matches `VI.callLog.agent`)

### packages/frontend/src/pages/leads/lead-detail.tsx:75
- **Issue**: Hardcoded English fallback label "Lead"
- **Evidence**: `label={lead.contact?.fullName || 'Lead'}`
- **Suggested VN**: `label={lead.contact?.fullName || VI.lead.title}` (yields "Nhóm khách hàng") — or a more specific `'Khách hàng tiềm năng'`.

### packages/frontend/src/pages/leads/lead-detail.tsx:93
- **Issue**: Header contains English term "Lead" in Vietnamese string
- **Evidence**: `<DottedCard header="Thông tin Lead">`
- **Suggested VN**: `<DottedCard header="Thông tin khách hàng tiềm năng">` (or keep "Lead" if it is a term used widely in the product — confirm with product owner).

### packages/frontend/src/pages/campaigns/campaign-info-form.tsx:121
- **Issue**: Placeholder "Nhập callback URL" mixes VN verb with English noun
- **Evidence**: `placeholder="Nhập callback URL"`
- **Suggested VN**: `placeholder="Nhập URL callback"` (minor; the label itself is `VI.campaign.callbackUrl = 'Callback URL'` which is technical and acceptable)

### packages/frontend/src/pages/contacts/contact-list.tsx:257
- **Issue**: Placeholder shows English example value "website, zalo"
- **Evidence**: `placeholder="VD: website, zalo"`
- **Suggested VN**: `placeholder="VD: Website, Zalo"` (capitalize; these are brand names, keep as-is but casing improves)

---

### Notes (NOT flagged — verified OK)

- `<SelectValue />` empty-prop usages in `lead-form.tsx:97` and `contact-import-step-dedup.tsx:62,209`: OK — the wrapping `<Select>` binds to enum values that are rendered via VN-mapped `<SelectItem>{VI.xxx}</SelectItem>` children, so the displayed value is Vietnamese.
- `contact-form.tsx` placeholders like `"Nguyễn Văn A"`, `"0901234567"`, `"email@example.com"`: sample data, not UI strings — keep.
- `campaign-detail.tsx:70`: `VI.campaign.types[campaign.type]` mapping is correct with safe fallback.
- All `toast.*` calls are in Vietnamese.
- `title={VI.actions.refresh}` and `title="Gọi"` attributes are VN.
- All list/detail pages map status + type enums through `VI.*.statuses` / `VI.*.types` before rendering in `<Badge>`.

### Unresolved questions

1. **Disposition mapping (contact-detail.tsx:262)**: Is `c.disposition` a raw code (English) or a resolved label? The call-history-tab uses `log.dispositionCode.label` which suggests backend provides a joined object — should contact-detail.tsx be upgraded to the same shape rather than rendering the raw code?
2. **"Lead" vs "Khách hàng tiềm năng"**: Product-level decision — `VI.nav.leads = 'Nhóm khách hàng'` but lead-detail uses bare `'Lead'`. Confirm preferred VN term for consistency across all surfaces.
3. **Action enum labels in contact-import-step-assign.tsx:88**: `ACTION_LABELS` already exists in `contact-import-step-dedup.tsx` but is not exported. Extract to a shared module (e.g., `contact-import-wizard-types.ts`) to avoid duplication.
