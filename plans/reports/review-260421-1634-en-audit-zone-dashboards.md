## Zone Dashboard + Reports + Monitoring — English leaks

### packages/frontend/src/pages/dashboard/dashboard-header.tsx:83
- **Issue**: LIVE/OFFLINE indicator rendered in raw English.
- **Evidence**: `{live ? "LIVE" : "OFFLINE"}`
- **Suggested VN**: `{live ? "TRỰC TIẾP" : "MẤT KẾT NỐI"}`

### packages/frontend/src/pages/dashboard/dashboard-header.tsx:94
- **Issue**: Action button label in English.
- **Evidence**: `REFRESH`
- **Suggested VN**: `LÀM MỚI`

### packages/frontend/src/pages/dashboard/dashboard-header.tsx:104
- **Issue**: Action button label in English.
- **Evidence**: `EXPORT`
- **Suggested VN**: `XUẤT`

### packages/frontend/src/pages/dashboard/call-volume-heatmap.tsx:23
- **Issue**: "COMING SOON" placeholder badge in English.
- **Evidence**: `COMING SOON`
- **Suggested VN**: `SẮP RA MẮT` (or `CHƯA SẴN SÀNG`)

### packages/frontend/src/pages/dashboard/kpi-strip.tsx:66
- **Issue**: KPI unit label "live" in English.
- **Evidence**: `unit="live"`
- **Suggested VN**: `unit="trực tiếp"`

### packages/frontend/src/pages/dashboard/activity-log-panel.tsx:31
- **Issue**: SectionHeader hint in English ("tail -f events.log · auto-scroll") — user-visible hint text, not a code comment.
- **Evidence**: `hint="tail -f events.log · auto-scroll"`
- **Suggested VN**: `hint="Nhật ký sự kiện · tự cuộn"` (keep shell-style if desired: `hint="sự kiện · tự cuộn"`)

### packages/frontend/src/pages/dashboard/inline-dialer-panel.tsx:60
- **Issue**: SectionHeader label contains English parenthetical "(eyebeam)".
- **Evidence**: `label="Gọi nhanh (eyebeam)"`
- **Suggested VN**: `label="Gọi nhanh"` (drop the technical app name, or replace with `"(bộ quay số)"`)

### packages/frontend/src/pages/monitoring/live-dashboard.tsx:228
- **Issue**: "Whisper" button label raw English — table action column.
- **Evidence**: `<Headphones className="mr-1 h-4 w-4" /> Whisper`
- **Suggested VN**: `Nghe thầm`

### packages/frontend/src/components/monitoring/agent-card.tsx:122
- **Issue**: Whisper button label in English (used by live-dashboard + agent-status-grid).
- **Evidence**: `<Headphones className="mr-1 h-3 w-3" /> Whisper`
- **Suggested VN**: `Nghe thầm`

### packages/frontend/src/pages/monitoring/live-calls.tsx:55
- **Issue**: Table header "Agent" in English.
- **Evidence**: `['Agent', 'Khách hàng', 'Số điện thoại', 'Hướng', 'Thời lượng', 'Trạng thái']`
- **Suggested VN**: `'Nhân viên'`

### packages/frontend/src/pages/monitoring/live-calls.tsx:81
- **Issue**: Status cell falls back to raw enum value (e.g. `ringing`, `held`) when not `active`.
- **Evidence**: `{c.status === 'active' ? 'Đang gọi' : c.status}`
- **Suggested VN**: Add a VN map (hoặc dùng `VI.agentStatus`): `{STATUS_VI[c.status] ?? c.status}` with `{ active: 'Đang gọi', ringing: 'Đang đổ chuông', held: 'Giữ máy', ended: 'Kết thúc' }`.

### packages/frontend/src/pages/monitoring/team-stats.tsx:129
- **Issue**: StatCard label "Online" in English (only in the unassigned block; rest of file uses VN).
- **Evidence**: `<StatCard label="Online" value={unassigned.filter((a) => a.status === 'online').length} />`
- **Suggested VN**: `label="Đang online"` (match the per-team tile on line 112, or use `"Sẵn sàng"`).

### packages/frontend/src/pages/reports/report-summary-tab.tsx:44,55,123,162
- **Issue**: "Team" column header + export key in English.
- **Evidence**: `{ key: 'teamName', label: 'Team' }` and `<TableHead>Team</TableHead>`
- **Suggested VN**: `label: 'Nhóm'` / `<TableHead>Nhóm</TableHead>` (match `report-filters.tsx:85` which also says "Team" — see below).

### packages/frontend/src/pages/reports/report-filters.tsx:85
- **Issue**: Filter label "Team" in English.
- **Evidence**: `<Label className="text-xs">Team</Label>`
- **Suggested VN**: `Nhóm`

### packages/frontend/src/pages/reports/report-tickets-tab.tsx:31,72
- **Issue**: "Team" column header + export key in English.
- **Evidence**: `{ key: 'teamName', label: 'Team' }` and `<TableHead>Team</TableHead>`
- **Suggested VN**: `Nhóm`

### packages/frontend/src/pages/reports/report-detail-tab.tsx:61,143,216
- **Issue**: "SIP Code" label in English (column header + filter label + export key).
- **Evidence**: `{ key: 'sipCode', label: 'SIP Code' }`, `<TableHead>SIP Code</TableHead>`, `<Label className="text-xs">SIP Code</Label>`
- **Suggested VN**: `Mã SIP`

### packages/frontend/src/pages/reports/report-detail-tab.tsx:218
- **Issue**: Placeholder "VD: 200" is mostly VN but mixed acceptable; verify intent — `VD` means "ví dụ" (OK). No action needed unless style wants full form.
- **Evidence**: `placeholder="VD: 200"`
- **Suggested VN**: `placeholder="Ví dụ: 200"` (optional — minor)

### packages/frontend/src/pages/reports/report-charts-tab.tsx:126
- **Issue**: Pie-chart label uses raw `hangupCause` value (e.g. `NORMAL_CLEARING`, `NO_ANSWER`) — uppercase SIP/FS codes leak into user-facing chart labels.
- **Evidence**: `label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}` where `name` comes from `nameKey="hangupCause"`
- **Suggested VN**: Pre-transform data, or map in label: use the same `HANGUP_VI` dictionary from `report-detail-tab.tsx` (should be extracted to shared module): ``label={({ name, percent }) => `${HANGUP_VI[name] ?? name}: ${...}`}``. Also apply to `<Tooltip />` via a custom formatter.

### packages/frontend/src/pages/reports/report-charts-tab.tsx:132
- **Issue**: Pie `<Tooltip />` default renders raw `hangupCause` key.
- **Evidence**: `<Tooltip />` (no formatter) in pie chart with `nameKey="hangupCause"`
- **Suggested VN**: `<Tooltip formatter={(v, n) => [v, HANGUP_VI[n as string] ?? n]} />`

### packages/frontend/src/pages/reports/report-charts-tab.tsx:74,90,105
- **Issue**: `<XAxis dataKey="date|agentName|week" />` — `date` and `week` axis tick values rely on API returning Vietnamese-friendly formats (e.g. `2026-04-21`, `W17`). Confirm backend emits VN-friendly week format (e.g. `Tuần 17`) or add a tick formatter.
- **Evidence**: `<XAxis dataKey="week" tick={{ fontSize: 11 }} />` — no formatter.
- **Suggested VN**: `tickFormatter={(v) => \`Tuần ${v}\`}` if backend returns bare week numbers; check API shape.

### packages/frontend/src/pages/reports/report-charts-tab.tsx:70,86,101,116
- **Issue** (low): DottedCard headers are VN, but verify `<Legend />` default renders `name` prop values you set — these are all VN ("Tổng", "Đã nghe", "Nhỡ"). OK as-is.
- **Evidence**: `<Bar dataKey="total" name="Tổng" ... />`
- **Suggested VN**: No change.

### packages/frontend/src/pages/reports/report-detail-tab.tsx (HANGUP_VI coverage)
- **Issue**: `HANGUP_VI` dictionary only covers 5 causes (`NORMAL_CLEARING`, `ORIGINATOR_CANCEL`, `NO_ANSWER`, `USER_BUSY`, `CALL_REJECTED`). All other FS hangup causes (e.g. `NORMAL_TEMPORARY_FAILURE`, `DESTINATION_OUT_OF_ORDER`, `RECOVERY_ON_TIMER_EXPIRE`, `MANAGER_REQUEST`, `LOSE_RACE`, `UNALLOCATED_NUMBER`) fall through to raw English enum via `HANGUP_VI[r.hangupCause] ?? r.hangupCause`.
- **Evidence**: lines 45-51 + 158 fallback
- **Suggested VN**: Extend dictionary to cover the common 15-20 FS causes seen in production CDR. Move to `@/lib/vi-text` under `VI.hangupCause`. List to add: `NORMAL_TEMPORARY_FAILURE: 'Lỗi tạm thời'`, `DESTINATION_OUT_OF_ORDER: 'Số không hoạt động'`, `UNALLOCATED_NUMBER: 'Số không tồn tại'`, `RECOVERY_ON_TIMER_EXPIRE: 'Hết thời gian'`, `MANAGER_REQUEST: 'Kết thúc bởi hệ thống'`, `LOSE_RACE: 'Thua tranh chấp cuộc gọi'`, `ALLOTTED_TIMEOUT: 'Hết thời gian cho phép'`, `SUBSCRIBER_ABSENT: 'Thuê bao vắng mặt'`.

### packages/frontend/src/pages/dashboard/inline-dialer-panel.tsx:138
- **Issue** (medium): Keyboard shortcut hints use VN action labels but the key names are English/generic (Enter, Esc, Del) — acceptable as these are physical key names, but "→" is VN context. OK.
- **Evidence**: `["Enter → Gọi", "Esc → Xóa", "Del → Sửa"]`
- **Suggested VN**: No change (physical key names are universal).

### packages/frontend/src/pages/monitoring/team-stats.tsx:100
- **Issue** (low): Self-reference "Quản lý team" uses mixed — acceptable, but "team" is commonly translated. Check consistency with `VI.nav` which uses "nhóm".
- **Evidence**: `Chưa có team nào. Tạo team trong Quản lý team.`
- **Suggested VN**: `Chưa có nhóm nào. Tạo nhóm trong Quản lý nhóm.` (or keep "team" if product decision — at minimum make it consistent across all Team/Nhóm usages).

---

## Severity summary

**Critical (user-facing raw English in primary UI):**
- dashboard-header.tsx:83,94,104 (LIVE/OFFLINE/REFRESH/EXPORT — top of every Dashboard view)
- call-volume-heatmap.tsx:23 (COMING SOON badge)
- live-calls.tsx:55 ("Agent" header), :81 (raw status fallback)
- live-dashboard.tsx:228 + agent-card.tsx:122 (Whisper button)
- report-charts-tab.tsx:126,132 (raw SIP cause in pie chart + tooltip)
- report-detail-tab.tsx HANGUP_VI coverage (most CDR rows will show raw English enum)

**High (table headers / filter labels):**
- All "Team" headers in reports (summary, tickets, filters)
- "SIP Code" header/filter/export key in report-detail-tab
- "Online" label in team-stats.tsx:129

**Medium:**
- kpi-strip.tsx:66 (`unit="live"`)
- activity-log-panel.tsx:31 (section hint)
- inline-dialer-panel.tsx:60 ("(eyebeam)")

**Low:**
- report-detail-tab.tsx:218 ("VD:" abbreviation style)
- team-stats.tsx:100 ("team" vs "nhóm" consistency)

## Cross-cutting recommendations

1. **Extract `HANGUP_VI` to `@/lib/vi-text`** as `VI.hangupCause` — currently duplicated-risk (detail tab has it, charts tab doesn't use it). Centralize + expand coverage.
2. **Add `VI.direction` map** to `vi-text.ts` (`inbound: 'Gọi vào'`, `outbound: 'Gọi ra'`) — currently inlined ternaries in live-dashboard (line 215) and live-calls (line 75, also truncated to "Vào"/"Ra"), inconsistent.
3. **Recharts `<Tooltip />` / `<Legend />` need formatters** when data keys hold raw enums — currently 4 charts rely on `name` prop being VN, but the pie chart's `nameKey="hangupCause"` bypasses this.
4. **Dashboard header buttons** use UPPERCASE — if preserving uppercase style, just translate: `LÀM MỚI`, `XUẤT`, `TRỰC TIẾP`, `MẤT KẾT NỐI`.

## Unresolved questions

- Is "Team" intentionally left in English as a brand/product choice, or should it be "Nhóm" (matching `VI.nav.leads = 'Nhóm khách hàng'` convention)? Decision affects ~7 locations.
- "Whisper" — keep as telephony jargon (like `Ext.`, `SIP`), or translate to "Nghe thầm"? `title` attr already uses "Nghe thầm" but visible button text says "Whisper" — inconsistent.
- Does `/reports/calls/charts` backend return `week` as `"W17"` or `"Tuần 17"` or `"2026-W17"`? Need to verify before adding tickFormatter.
- `ReportSummaryTab` header abbreviations `TL TB` / `Nói TB` (line 128-129) — is this product-approved shorthand or should full labels be used on wider screens?
