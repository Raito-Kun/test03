---
title: "Test cases — Emerald Operations theme + UI polishing pass"
date: 2026-05-04
plan: 260420-1147-ui-ops-console-redesign
scope: dev (10.10.101.207)
type: manual smoke + targeted regression
---

# Test cases — Emerald Operations + UI polishing (2026-05-04)

Manual verification matrix for the v1.3.14 changes deployed to dev. Run after Ctrl+F5 to bypass cached bundle.

## Preconditions

- Browser logged in as roles: `super_admin`, `admin`, `leader`, `agent` (separate sessions).
- Dev server `https://10.10.101.207` responsive, `curl -sf .../api/health` returns 200.
- Test cluster has at least: 1 OFFLINE agent, 1 ONLINE agent, 1 ON_CALL agent, 1 BREAK agent (for monitoring filter test).
- Reports test data covers ≥ 1 day with a hangup_cause distribution (NORMAL_CLEARING, USER_BUSY, NO_ANSWER, ORIGINATOR_CANCEL).
- Call logs test data has at least 1 row with recording (`hasRecording=true`) for inline audio test.
- Debt cases test data has at least 1 case with `dpd > 0` and `paidAmount > 0`.

---

## TC-01 Theme — Emerald palette renders globally

| Step | Expected |
|---|---|
| 1. Open `/dashboard` after Ctrl+F5 | Background gray-blue (`#f8f9ff`), cards pure white, sidebar light surface with emerald active-row pill (`#d1fae5` bg, `#065f46` text) |
| 2. Hover any default `<Button>` | Solid emerald `#10B981` background, white text, no lavender bleed |
| 3. Focus an `<Input>` | Ring color emerald `#10B981`, 2px, no violet halo |
| 4. Inspect any chart bar/donut slice | Primary slice emerald `#10B981`, secondary slices use chart-2..5 emerald-led |
| 5. Switch dark mode (if exposed) | M3 dark tokens render coherently — primary `#cdbdff` for contrast (legacy retained for embedded preview panels) |

**Pass criteria:** No visible violet/lavender hex anywhere. Logo + sidebar + topbar + cards + buttons all emerald.

---

## TC-02 Monitoring — Tabs clickable

| Step | Expected |
|---|---|
| 1. Visit `/monitoring/live-calls` | Tab "Live Calls" active (emerald underline/bg), other tabs muted |
| 2. Click "Trạng thái Agent" | URL switches to `/monitoring/agent-status`, tab becomes active |
| 3. Click "Thống kê team" | URL switches to `/monitoring/team-stats`, tab active |
| 4. Click back button | Browser history navigates correctly |

**Pass criteria:** All 3 tabs route via `<Link>` not `<button>`. URL changes. No "non-clickable" state.

**Regression:** Before fix, tabs rendered as buttons without onClick → no navigation.

---

## TC-03 Monitoring — Select labels render

| Step | Expected |
|---|---|
| 1. Open Team filter Select | Trigger shows "Tất cả Team" (not raw "all") |
| 2. Pick a team name | Trigger updates to selected team name |
| 3. Open Status filter Select | Trigger shows current label like "Đang hoạt động" (not "active") |
| 4. Pick "AVAIL" | Trigger updates to "AVAIL" |

**Pass criteria:** SelectTrigger always shows human-readable Vietnamese label, never raw value key.

**Regression:** Base UI Select doesn't auto-resolve labels — original code rendered raw `{value}`.

---

## TC-04 Monitoring — Status filter "active" hides OFFLINE

| Step | Expected |
|---|---|
| 1. Visit `/monitoring/agent-status` (default boot) | Status filter = "Đang hoạt động", NO offline agents in grid |
| 2. Switch to "Tất cả" | Offline agents now visible alongside online |
| 3. Switch to "Offline" | ONLY offline agents visible |
| 4. Switch back to "Đang hoạt động" | Offline agents hidden again |

**Pass criteria:** "Đang hoạt động" excludes status `offline`. "Tất cả" includes all statuses. No data leak between filters.

**Regression:** Before fix, "Đang hoạt động" was aliased to `'all'` value → showed offline agents.

---

## TC-05 Debt Cases — KPI live calculation

| Step | Expected |
|---|---|
| 1. Visit `/debt-cases` with seeded data | Top KPIs reflect `data.items` aggregations, NOT `2.45 tỷ` mock |
| 2. Filter cases | KPIs recompute against filtered set (or scope to current page if intended) |
| 3. Empty result set | KPIs show `—` placeholder, no NaN |
| 4. Cross-check `Tổng dư nợ` | Equals `sum(item.totalAmount)` formatted vi-VN |
| 5. Cross-check `Tỷ lệ thu hồi` | Equals `(collected / totalDebt) * 100`, rounded display |

**Pass criteria:** KPIs are derived live, fallback safe, formatted in Vietnamese locale.

---

## TC-06 Reports — 2×2 KPI grid + delta badge

| Step | Expected |
|---|---|
| 1. Visit `/reports` with date range last 7 days | 4 KPI cards in 2×2 grid (mobile) / row (desktop) |
| 2. Each KPI card | Has %delta badge with arrow + color (emerald up / red down) |
| 3. Pick a range with no previous-period data | Badge shows `—` or `+∞%`, no NaN crash |
| 4. Refresh page | Both queries (current + previous) fire, badge updates |

**Pass criteria:** Delta is real (not hardcoded), based on previous-period query of same length ending day before `from`.

---

## TC-07 Reports — Hourly chart waves

| Step | Expected |
|---|---|
| 1. Reports page with multi-day range | BarChart x-axis = hour of day (0–23), 24 buckets visible (interval={2}) |
| 2. Hover a bar | Tooltip shows `formatHourTick(h) → formatHourTick(h+1)` like "08:00 → 09:00" |
| 3. Bars represent total/answered/missed across whole range | Heights vary by hour-of-day → visible "wave" pattern, not single flat bar |
| 4. Pick narrow range (1 day) | Still 24 buckets, only hours with data have height |

**Pass criteria:** Backend `callsByHour` returns sorted 24-bucket array. Chart shows wave pattern.

**Regression:** Before fix, daily aggregation with 4-day range showed only 1 bar (flat) when only 1 day had data.

---

## TC-08 Reports — Vietnamese disposition labels

| Step | Expected |
|---|---|
| 1. Hover PieChart slices | Tooltip shows Vietnamese labels via HANGUP_CAUSE_VI map (e.g. "NORMAL_CLEARING" → "Hoàn thành") |
| 2. Donut center | Shows `%` of dominant slice as overlay (absolute-positioned div) |
| 3. PIE_COLORS | First slice emerald `#10B981`, others `#6ee7b7, #9ca3af, #d1d5db` |

---

## TC-09 Call Logs — Inline audio popover

| Step | Expected |
|---|---|
| 1. Visit `/call-logs`, find row with mic icon | Mic icon visible (emerald or muted depending on hover) |
| 2. Click Mic | Popover opens inline (NOT detail dialog), 360px wide |
| 3. Header shows | `{customerNumber} {arrow} Ext {agentExt}` regardless of inbound/outbound — for outbound, customer is on left |
| 4. Header time + duration + RECORDING badge visible |
| 5. Click ▶ button | Audio plays from `/api/v1/call-logs/{id}/recording?token=...` |
| 6. Speed selector | Pick 1.5x → playback speeds up; "TỐC ĐỘ" label in mono font |
| 7. Click outside popover | Popover closes, audio pauses |
| 8. Click Mic on different row | Previous popover closes, new opens |

**Pass criteria:** Inline play, no dialog. Direction-aware header. Token URL works.

**Regression bug fix:** Outbound rows previously showed agent number on left (`104 → 0912265040`); fix swaps so customer is always on left.

---

## TC-10 Login — Logo + autofill disabled

| Step | Expected |
|---|---|
| 1. Open `/login` private window | Raito logo visible in card (rounded-2xl, dashed border, h-20 w-20) + sidebar header (h-10 w-10) |
| 2. Click email field | Browser autofill suggestions DO NOT appear (no saved-username dropdown) |
| 3. Click password field | Same — no autofill suggestion |
| 4. Submit valid creds | Logs in normally (autoComplete="off" doesn't break submit) |
| 5. View saved passwords (browser settings) | No new entry added for this domain (fields named `email-no-fill` / `password-no-fill`) |

**Pass criteria:** Logo replaces Database icon. No autofill UI. Login still works.

---

## TC-11 Encoding — Vietnamese diacritics intact

| Step | Expected |
|---|---|
| 1. View any page with Vietnamese label | "Thành công", "Đăng nhập", "Trực tuyến", "Đang gọi" render correctly |
| 2. Inspect HTML source | UTF-8, no mojibake like "ThÃ nh cÃ´ng" |
| 3. View call-log row with Vietnamese disposition | Renders correctly |

**Pass criteria:** No encoding corruption from prior PowerShell bulk-replace incident.

---

## TC-12 TypeScript compile

| Step | Expected |
|---|---|
| 1. `npx tsc -b` in `packages/frontend` | 0 errors |
| 2. Same in `packages/backend` | 0 errors |

---

## Out of scope (defer to phase-05)

- Visual regression with `toHaveScreenshot`.
- Full Playwright E2E across CRUD + RBAC + navigation.
- Rollback drill via `backup/pre-ui-redesign-260420`.

## Reporter

Mark each TC `PASS` / `FAIL` / `BLOCKED`. File issues against `feat/ui-ops-console-redesign` if FAIL.
