## Zone Calls + Tickets — English leaks

### packages/frontend/src/pages/tickets/ticket-detail.tsx:112
- **Issue**: Status `<SelectValue />` is self-closing (no child), so trigger falls back to raw enum value (`open` / `in_progress` / `resolved` / `closed`).
- **Evidence**: `<SelectTrigger className="w-44"><SelectValue /></SelectTrigger>`
- **Suggested VN**: `<SelectValue>{VI.ticket.statuses[ticket.status]}</SelectValue>`

### packages/frontend/src/pages/tickets/ticket-form.tsx:131
- **Issue**: Priority `<SelectValue />` is self-closing; trigger will render raw enum (`low` / `medium` / `high` / `urgent`) until user picks.
- **Evidence**: `<SelectTrigger><SelectValue /></SelectTrigger>`
- **Suggested VN**: `<SelectValue>{VI.ticket.priorities[form.priority]}</SelectValue>`

### packages/frontend/src/components/audio-player.tsx:65
- **Issue**: Speed `<SelectValue />` self-closing. Minor (raw value is `1`/`1.5`/etc. — numeric, not enum), but inconsistent with the VN "Xx" items. Renders bare number without the "x" suffix used in dropdown items.
- **Evidence**: `<SelectTrigger className="h-7 w-16 text-xs"><SelectValue /></SelectTrigger>`
- **Suggested VN**: `<SelectValue>{speed}x</SelectValue>`

### packages/frontend/src/pages/call-logs/call-log-list.tsx:220-237 (SIP Reason column)
- **Issue**: Entire column renders hardcoded English SIP phrases shown to end users: `Answer`, `Voicemail`, `Busy`, `Request Terminated`, `No Answer`, `Not Found`, `Forbidden`, `Request Timeout`, `Internal Server Error`, `Service Unavailable`.
- **Evidence**: `if (code === 200) return 'Answer';` … `if (code === 500) return 'Internal Server Error';`
- **Suggested VN**: Drop this column (duplicates "Kết quả") OR map to VN: `Answer→Trả lời`, `Voicemail→Hộp thư`, `Busy→Máy bận`, `Request Terminated→Hủy`, `No Answer→Không trả lời`, `Not Found→Không tồn tại`, `Forbidden→Từ chối`, `Request Timeout→Hết thời gian`, `Internal Server Error→Lỗi máy chủ`, `Service Unavailable→Dịch vụ không khả dụng`. Also gate by column label — currently labeled `SIP Reason` (English) at line 216.

### packages/frontend/src/pages/call-logs/call-log-list.tsx:216
- **Issue**: Column header `SIP Reason` is English.
- **Evidence**: `{ key: 'sipReason', label: 'SIP Reason', …`
- **Suggested VN**: `'Lý do SIP'` or remove the column (redundant with "Kết quả" column 196).

### packages/frontend/src/pages/call-logs/call-log-list.tsx:214, call-log-detail.tsx:195, ticket-detail-customer-panel.tsx:140
- **Issue**: Label `SIP Code` — technical field, acceptable as-is, but inconsistent with the rest of the VN UI. Low severity.
- **Evidence**: `{ key: 'sipCode', label: 'SIP Code', …` / `<p …>SIP Code</p>`
- **Suggested VN**: `'Mã SIP'` (or keep if intentionally technical; flag only).

### packages/frontend/src/pages/call-logs/call-log-list.tsx:336
- **Issue**: Placeholder has VN prefix `VD:` but the label above is still `SIP Code` (English). Verify the whole pair.
- **Evidence**: `<Input placeholder="VD: 200, 486" …` with `<Label>SIP Code</Label>` at line 335.
- **Suggested VN**: Change label to `Mã SIP` if aligned with point above.

### packages/frontend/src/components/layout/call-bar.tsx:195
- **Issue**: Transfer target select uses a plain string instead of VI key — minor, but should route through `VI`.
- **Evidence**: `<SelectValue placeholder="Chọn nhân viên" />`
- **Suggested VN**: Already VN; flag only to add to VI dictionary for reuse (`VI.callBar.selectAgent` etc.). Skip if not extending dict.

### packages/frontend/src/pages/tickets/ticket-detail-customer-panel.tsx:158
- **Issue**: Inline literal `ext.` (English abbreviation) rendered in user-facing text.
- **Evidence**: `` `${agent.fullName}${agent.extension ? ` (ext. ${agent.extension})` : ''}…` ``
- **Suggested VN**: `` `${agent.fullName}${agent.extension ? ` (máy lẻ ${agent.extension})` : ''}…` ``

### packages/frontend/src/pages/call-logs/call-log-list.tsx:246, 272
- **Issue**: Disposition/phân loại labels `C2C` and `Auto Call` — partial English. `Thủ công` is VN, but the first two are raw English technical terms shown to end users.
- **Evidence**: `const CALL_SOURCE_VI: Record<string, string> = { c2c: 'C2C', autocall: 'Auto Call', manual: 'Thủ công' };` (both at line 246 and 272).
- **Suggested VN**: Keep `C2C` as acronym (no good VN equivalent); change `Auto Call` → `Tự động` or `Gọi tự động`.

### packages/frontend/src/components/click-to-call-button.tsx:42
- **Issue**: Mixed-language error — `(SIP extension)` parenthetical is English.
- **Evidence**: `toast.error('Tài khoản chưa được cấu hình số máy lẻ (SIP extension)');`
- **Suggested VN**: `toast.error('Tài khoản chưa được cấu hình số máy lẻ');` (drop the English parenthetical — the VN already covers it).

### packages/frontend/src/components/click-to-call-button.tsx:42, 59
- **Issue**: Toast text uses `Extension ${...}` and `Extension chưa đăng ký` — partial English.
- **Evidence**: `Extension ${user.sipExtension} chưa đăng ký trên tổng đài…` / `'Extension chưa đăng ký trên tổng đài. Vui lòng mở softphone và đăng nhập.'`
- **Suggested VN**: `Số máy lẻ ${user.sipExtension} chưa đăng ký trên tổng đài…` / `'Số máy lẻ chưa đăng ký trên tổng đài. Vui lòng mở softphone và đăng nhập.'`. Note: `softphone` is a proper product term — keep.

### packages/frontend/src/pages/tickets/ticket-detail-actions-panel.tsx (hoisted reminder)
- **Issue**: Status + Priority selects already use `{VI.ticket.statuses[pendingStatus]}` / `{VI.ticket.priorities[pendingPriority]}` inside `<SelectValue>` — looks correct. Audit confirms fix is in place at lines 136 and 153. No action.
- **Evidence**: `<SelectValue>{VI.ticket.statuses[pendingStatus]}</SelectValue>` / `<SelectValue>{VI.ticket.priorities[pendingPriority]}</SelectValue>`
- **Suggested VN**: none.

### packages/frontend/src/pages/tickets/ticket-audit-timeline.tsx (hoisted reminder)
- **Issue**: Confirmed fix — `update` actions no longer render raw `changes` object key; `FIELD_LABELS` maps each field name to VN (`status→trạng thái`, `priority→độ ưu tiên`, etc.). Unknown action / unknown field falls back to raw key (line 33, 47) — acceptable but could add a VN fallback.
- **Evidence**: `const base = ACTION_LABELS[entry.action] ?? entry.action;` and `const labels = keys.map((k) => FIELD_LABELS[k] ?? k);`
- **Suggested VN**: Low priority — consider fallback `'thao tác khác'` / `'trường khác'` if unknown keys actually surface to users.

### packages/frontend/src/pages/tickets/ticket-card.tsx:83
- **Issue**: `aria-label="Có ghi âm"` — already VN. No action. (Included to confirm.)
- **Evidence**: `<Mic className="h-3 w-3 text-violet-400" aria-label="Có ghi âm" />`
- **Suggested VN**: none.

### packages/frontend/src/components/wave-audio-player.tsx:116
- **Issue**: `title="Tải về"` — already VN. No action.
- **Evidence**: `<Button … title="Tải về"><Download … /></Button>`
- **Suggested VN**: none.

### packages/frontend/src/pages/call-logs/call-log-list.tsx:184, 185, 188, 196, 214, 216, 240, 255
- **Issue**: Column headers are individually VN literals (`'Số gọi'`, `'Số nhận'`, `'Thời gian nói'`, `'Kết quả'`, `'Phân loại'`, `'Kết thúc'`). No English leaks. `'SIP Code'` and `'SIP Reason'` covered above.
- **Evidence**: varied `label: '…'` entries.
- **Suggested VN**: none (except SIP Reason/Code noted above).

### packages/frontend/src/pages/tickets/ticket-detail.tsx:107
- **Issue**: `SLA Vi phạm` — acronym `SLA` is acceptable; VN wording is fine. Flag only: inconsistency with ticket-detail-dialog.tsx:101 which uses identical wording (consistent).
- **Evidence**: `<Badge …>SLA Vi phạm</Badge>`
- **Suggested VN**: none. (If preferred, `SLA quá hạn` or `Vi phạm SLA` for natural word order.)

### packages/frontend/src/pages/call-logs/call-log-detail.tsx:298
- **Issue**: Fallback text mixes VN with `AI` (`'AI đang phân tích... (sẽ hiển thị khi hoàn tất)'`) — acronym acceptable.
- **Evidence**: `<p className="text-sm text-muted-foreground">AI đang phân tích... (sẽ hiển thị khi hoàn tất)</p>`
- **Suggested VN**: none.

### Unresolved questions
- Should `SIP Reason` column stay? It duplicates the `Kết quả` column (call-log-list.tsx:196) and is the single biggest source of English text in the zone.
- `SIP Code` / `SIP Reason` — keep as technical labels, or VN-ize to `Mã SIP` / `Lý do SIP`? Convention elsewhere in the project uses English for protocol codes.
- `C2C` acronym — keep, or spell out as `Gọi trực tiếp`/`Gọi từ hệ thống`? Affects 3 call-bar-adjacent places.
- `Auto Call` label — user-facing copy needs product-owner decision between `Gọi tự động` vs `Tự động`.
