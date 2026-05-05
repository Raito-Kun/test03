# CRM — Current Status

> **Updated:** 2026-05-05 19:36 (Asia/Saigon)
> **Branch:** `feat/ui-ops-console-redesign` (working tree dirty) · next: cut `feat/autocall-engine-kamailio-fs` from `master`
> **Dev:** `10.10.101.207` · **Prod:** `10.10.101.208` (gated)
> **Read first:** `.claude/rules/development-rules.md`, `.claude/rules/pbx-incident-patterns.md`

---

## 1. Đã làm (state summary)

### UI Ops Console Redesign (`plans/260420-1147-ui-ops-console-redesign/`)
| Phase | Trạng thái | Commit anchor |
|---|---|---|
| 01 design tokens + primitives | ✅ Done | `8bb6af2` |
| 02 layout shell (sidebar/topbar/status bar) | ✅ Done | `44d2696` |
| 03 dashboard redesign | ✅ Done | `44d2696` |
| 04a settings/reports/tickets | ✅ Done | `44d2696` |
| 04b contacts/debt/leads/campaigns/call-logs/monitoring | ✅ Done | `4443f3a` |
| 05 test & staged deploy | ⏳ **Pending — việc kế tiếp** | — |

Backup rollback tag: `backup/pre-ui-redesign-260420`.

### Emerald Operations theme + UI polishing pass (2026-05-04, **deployed dev, uncommitted**)
Plan addendum to UI Ops Console redesign — palette migration + page-level UX fixes.
- **Palette switch:** M3 lavender → Emerald Operations in `packages/frontend/src/app.css`. `--background #f8f9ff`, `--card #ffffff`, `--primary #10B981`, `--accent #d1fae5`, `--ring #10B981`, `--radius 0.5rem`. Charts emerald-led (`#10b981, #059669, #f59e0b, #ba1a1a, #6ee7b7`). Sidebar light surface w/ emerald primary + emerald-100 active accent. Legacy `--pls-blue` aliased to emerald-300 → no component break.
- **Typography:** `--font-sans` Inter Variable + Geist fallback; `--font-data` Space Grotesk Variable cho IDs/data labels.
- **Bulk-migrated** 8 page files: `bg-[#5434ae]→bg-primary`, `text-[#5434ae]→text-primary`, `bg-[#e8deff]→bg-accent`, `border-[#cdbdff]→border-accent`, `border-[#cac4d5]→border-border`. CSS-var-driven components adapt tự động.
- **Monitoring** (`pages/monitoring/{live-dashboard,agent-status-grid}.tsx`): Tabs thành `<Link>` + `useLocation` matching → click được. Base UI Select label inline-render `<span>{LABELS[value]}</span>` thay vì raw "all". Filter `'active'` (ẩn OFFLINE) tách khỏi `'all'`; default boot = `'active'`.
- **Debt cases KPI** (`pages/debt-cases/debt-case-list.tsx`): bỏ mock `2.45 tỷ`, reduce từ `data.items` (totalDebt/overdueDebt/collected/recoveryRate). Fallback `—` khi rỗng.
- **Reports page** (`pages/reports/reports-page.tsx` + backend `services/report-chart-service.ts`): 2×2 KPI grid + real `%delta` badge từ previous-period query; backend thêm `callsByHour` (24 buckets, hour-of-day) → chart hourly có "sóng", `interval={2}`, tooltip `formatHourTick(h) → formatHourTick(h+1)`. PIE_COLORS `['#10B981', '#6ee7b7', '#9ca3af', '#d1d5db']`. HANGUP_CAUSE_VI map cho disposition labels. Donut center % overlay absolute-positioned.
- **Inline audio popover** (`pages/call-logs/call-log-list.tsx` + `components/audio-player.tsx`): click Mic → Popover mở `AudioPlayer` ngay (không mở detail dialog), URL `/api/v1/call-logs/${id}/recording?token=`. Direction-aware extraction: header luôn `{externalNum} {arrow} Ext {agentExt}` bất kể inbound/outbound. Player vertical stack: progress bar + custom thumb, time row tabular, controls row rounded-full filled-primary play + speed selector mono "TỐC ĐỘ".
- **Login** (`pages/login.tsx`): logo Raito (`raito.png` `h-20 w-20` trong card dashed border + `h-10 w-10` trong sidebar header). Disable autofill: `autoComplete="off"` + `name="email-no-fill"` / `name="password-no-fill"`.
- **Encoding gotcha (recovered):** PowerShell `Set-Content -Encoding UTF8` add BOM + corrupt UTF-8 Vietnamese ("Thành công" → "ThÃ nh cÃ´ng"). Fix pattern: `[System.IO.File]::ReadAllText/WriteAllText` + `[System.Text.UTF8Encoding]::new($false)`. Đã pull file đúng từ dev qua pscp + re-run.
- **Verify dev:** `tsc -b` clean cả backend + frontend. Playwright screenshot `login-emerald.png` xác nhận: gray-blue background, pure white card, emerald button + top stripe + focus ring + Active Cluster pill dot.
- **Changelog:** `docs/project-changelog.md` v1.3.14.
- **Roadmap:** Phase 21 sub-table updated.

### RBAC Permission Dedup (`plans/260421-2117-rbac-permission-dedup/`)
- ✅ Phases 1-4 complete — commits `4afc578` → `24e1e32`
- Collapse 16 legacy keys → modern `resource.action`
- New `recording.delete` permission + middleware enforcement (`ticket.delete`, `crm.contacts.delete`)
- Migration `20260421211700_rbac_dedup` idempotent, zero grant loss
- **Post-deploy action:** `DEL permissions:role:*` on Redis sau khi migrate deploy

### super_admin Opt-In on `recording.delete` (2026-05-04, **deployed dev + prod, uncommitted**)
- Mục tiêu: super_admin không mặc định xoá được ghi âm — phải bật thủ công per-cluster trong matrix.
- Shared constant `SUPER_ADMIN_OPT_IN_PERMISSIONS = ['recording.delete']` ở `packages/{backend,frontend}/src/lib/permission-constants.ts`.
- Backend: `requirePermission` không bypass super_admin cho key opt-in; `getPermissionsForRole(super_admin, clusterId)` chỉ gồm auto-keys ∪ explicit per-cluster grants cho opt-in keys; `permission-controller.updateRolePermissions` accept payload super_admin nhưng filter chỉ opt-in keys.
- Frontend: `hasPermission` không auto-true opt-in cho super_admin; `permission-matrix-table.tsx` unlock cột super_admin từng dòng cho opt-in keys; `role-tab-panel.tsx` đếm tổng quyền theo cùng rule.
- Seed: cả `seed.ts` + `seed-role-permissions.ts` lọc `recording.delete` khỏi super_admin defaults.
- Migration `20260504095800_super_admin_recording_delete_optin` — idempotent DELETE rows super_admin × recording.delete.
- Test: `permission-dedup.test.ts` — assertion đổi sang admin only + thêm test super_admin bị 403 khi không có grant.
- **Deployed:**
  - Dev `10.10.101.207` — 2026-05-04 10:27 (rebuild backend+frontend, migrate, bust Redis). Smoke: super_admin `/auth/me` perms=48 (không có `recording.delete`); DELETE `/api/v1/call-logs/.../recording` = 403. ✅
  - Prod `10.10.101.208` — 2026-05-04 10:33. Backup DB tại `/root/db-backup/crm_db-pre-superadmin-optin-20260504-1028.sql.gz` (53 MB) trước migrate. Smoke: identical kết quả với dev. ✅
- **Working tree vẫn dirty** — chưa commit (P0 sau deploy theo §2).

### CDR webhook drop tại deploy window (2026-05-04 10:32:28, recovered)
- 4 CDR POST từ FreeSWITCH 10.10.101.206 → prod 10.10.101.208 nhận `502 Connection refused` đúng lúc backend prod restart cho deploy super_admin opt-in (10:33).
- Affected calls (mất hoàn toàn ở prod, còn ở dev nhờ nginx mirror):
  - `d41de308` blueva ext 101 → 0774819467 (1:59 talk, NORMAL_CLEARING) ✅ recovered
  - `b8e1e0cd` (leg b cùng call) — orphan, dev cũng skip, không cần row
  - `c2743cdb`/`dba9d3ab` hoangthienfinance.vn ext 120 → 0862999257 (11s) — dev không có cluster, vẫn miss; user nói skip
- Recovery method: `COPY (...) TO STDOUT` từ dev call_logs → staging table → `INSERT ON CONFLICT DO NOTHING` trên prod. cluster_id và user_id giống nhau hai server.
- Recording mp3 vẫn ở PBX `/var/lib/freeswitch/recordings/blueva/archive/2026/May/04/d41de308-...mp3` (1.08 MB), proxy stream qua prod sau khi row tồn tại.
- **Root cause underlying:** FusionPBX cron `xml_cdr_import.php` xoá file XML khỏi `/var/log/freeswitch/xml_cdr/` sau khi parse vào v_xml_cdr → FS retry mechanism mất file trước khi POST lại được.

### CDR retry queue (2026-05-04 12:15, deployed PBX 206)
- Tách `err-log-dir` của `mod_xml_cdr` ra dir riêng `/var/spool/fs-cdr-retry/` (không bị FusionPBX cron `xml_cdr_import.php` đụng tới). Khi POST CDR fail, FS giờ park nguyên payload XML ở đây.
- Cron `* * * * * www-data /usr/local/bin/fs-cdr-retry.sh` (`/etc/cron.d/fs-cdr-retry`) replay từng file qua nginx fan-out `127.0.0.1:9080` → prod + mirror dev. Basic Auth đọc trực tiếp từ `xml_cdr.conf.xml` `<param name="cred">` để DRY (không hardcode).
- Idempotent qua webhook `call_uuid` UNIQUE; thành công xoá file, fail giữ lại retry tick sau. Lock file `.lock` trong cùng dir tránh overlap khi backlog lớn.
- Backup conf trước edit: `/etc/freeswitch/autoload_configs/xml_cdr.conf.xml.bak-20260504-1209`. `fs_cli reload mod_xml_cdr` không dứt cuộc gọi, 0 active call lúc reload.
- Smoke test end-to-end: drop XML thật từ webhook_logs prod vào dir → script POST 200 (idempotent) → file biến mất, log `processed=1 ok=1 retain=0`.
- **Tác dụng:** lần deploy backend kế (tới ~10:32:28-style window) FS sẽ tự lưu CDR rớt vào retry dir, cron tick kế đẩy lên prod. Không cần manual recover từ dev.

### Còn open
- Bug merge billsec call 58278890 (CRM 48s vs PBX 32s): cross-leg pollution trong `cdr-merge.ts` nghi ghi đè `end_time` từ orphan b leg call kế. Cần plan riêng đào sâu, KHÔNG do deploy hôm nay.

### Repo cleanup pass (2026-05-05 19:30, **uncommitted**)
- Recover ~260 MB: xoá 81 root PNG dev-screenshots (giữ `login-emerald.png`), 5 root meta cũ Mar 24-25 (`COMPLETION_CHECKLIST`/`DOCUMENTATION_SUMMARY`/`SYNC_BACK_SUMMARY`/`docs-update-report`/`Note.txt`), 4 mockup leftover trong `docs/` (extract-mockup.py / inspect-mockup.py / CRM-Ops-Console-standalone.html / mockup-src/), `Guildline/Final Docs/` + `Guildline/Guildline/` + 2 logos, `MOCKUP/` (lavender obsolete), 15 plan dirs đã ship hoặc one-shot ops (~234 MB chủ yếu từ `260418-1157-prod-deploy-from-dev/{dev-snapshot,prod-backup}`), `.gemini/`, `playwright-report/` + `test-results/` + `.playwright-mcp/`, `release-manifest.json` + `test-results.json`.
- Giữ: `AGENTS.md`, `1.Build Skill/`, `.opencode/`, `Guildline/Docs/` (vendor PDFs), `Guildline/PRD.md`, 4 plans OPEN.
- Fix: `docs/INDEX.md` dangling link → trỏ về `project-changelog.md`.
- New skill: `.claude/skills/crm-cleanup/SKILL.md` — auto-trigger sau ship/deploy/plan-close, 4-agent inventory + 3-bucket classify (SAFE_DELETE/ASK_USER/KEEP), luôn hỏi user trước khi xoá.

### Ticket Kanban + Detail (`plans/260421-1244-ticket-kanban-detail/`)
- ✅ Workers 1-4 reports đã có tại `reports/worker-*-done.md`
- Frontend files đã tồn tại: `ticket-kanban.tsx`, `ticket-card.tsx`, `ticket-detail-dialog.tsx`, `ticket-resolution-dialog.tsx`, `ticket-audit-timeline.tsx`, `wave-audio-player.tsx`, `use-ticket-kanban.ts`
- Dependencies: `@dnd-kit/core`, `@dnd-kit/sortable`, `wavesurfer.js` đã cài
- RBAC `ticket.delete` admin-only đã wire qua middleware (xem RBAC dedup ở trên)
- **Chưa deploy** — đang chờ gộp cùng phase-05 UI redesign

### Call-logs UX + CDR fixes (2026-04-21 → 04-22)
- ✅ `e9a572c` hoist ticket dialog state (hooks rule)
- ✅ `6ccf1de` agent có thể tạo ticket từ cuộc gọi answered
- ✅ `eaff562` SIP 430 → Voicemail, ext-only agent filter
- ✅ CDR `billsec` invariant fix: `billsec=0` khi `answerTime=null` (file `packages/backend/src/lib/cdr-merge.ts`)
  - Backfilled 61 dev rows: `UPDATE call_logs SET billsec=0 WHERE answer_time IS NULL AND billsec > 0`
- ✅ Disposition audit trail: `disposition_set_by_user_id` + `disposition_set_at` (migration `20260421183000_add_disposition_set_by`)
- ✅ `8a005a2` (2026-04-22) call-logs list UX: bỏ search frame mặc định, thêm input **Số nhận** riêng, disposition column đổi từ auto-save → buffer + nút **Lưu** (emerald icon) khi dirty. **Deployed dev + prod 2026-04-22 12:23** (rebuild frontend container cả 2 server, smoke HTTP 200).
- ✅ `29200b6` (2026-04-22) call-logs filter explicit submit: tất cả dropdown/input thành draft, không auto-fetch khi đổi. Nút **Tìm kiếm** (Search icon) apply toàn bộ draft → applied cùng lúc, disabled khi chưa có thay đổi; Enter trong toolbar = click nút. **Deployed dev + prod 2026-04-22 12:40**.

### Cluster extension-sync lifecycle (2026-04-22 15:45, **uncommitted working tree**)
- Migration `20260422150000_add_cluster_ext_sync_status` — thêm `ext_sync_status/error/count/finished_at` vào `pbx_clusters`. Applied cả dev + prod.
- Backend: `autoSyncExtensions` (create/update cluster) + `syncExtensions` controller ghi state machine `syncing → done(count) | failed(error)`. Nếu SSH password trống → `idle` im lặng.
- Frontend `cluster-management.tsx`: `ClusterSummary` + badge (spinner/done count/đỏ tooltip error); `useQuery.refetchInterval = 2000` chỉ khi có cluster đang `syncing`. `cluster-detail-form.tsx`: prop `syncInfo` riêng (không nhét vào `ClusterFormData`) hiện status + error dưới nút Sync; invalidate `['clusters']` sau mutation.
- **Deploy:** rsync code + rebuild backend/frontend container, `prisma migrate deploy --schema=prisma/schema.prisma` (phải dùng explicit schema flag vì container có 2 schema.prisma khác nhau — xem gotcha dưới). Cả 2 server healthy. Chưa commit — working tree dirty.
- **Gotcha deploy:** image backend có đồng thời `/app/packages/backend/schema.prisma` (cũ) và `.../prisma/schema.prisma` (mới, có 19 migrations). `prisma migrate deploy` không có `--schema=` sẽ đọc schema cũ và báo "No pending migrations" mặc dù DB thiếu migration. Luôn thêm `--schema=prisma/schema.prisma` khi migrate trong container. Đã note vào skill `crm-deploy` + memory `feedback_prisma_migrate_schema_flag.md`.
- **Verify prod:** `PBX-101.206_HoangThien` sync 27 ext ✅ sau khi điền SSH password; agent page vẫn trống vì chưa tạo user role=agent cho cluster (autoCreateClusterAccounts chỉ seed admin/manager, không tạo agent) — xem skill `crm-pbx-cluster` → "Extension-sync status" section.

### Recording download friendly filename (2026-04-22 17:15, **uncommitted**)
- `packages/backend/src/services/recording-service.ts` — backend giờ build filename `{direction}_{caller}_{dest}_{dd-mm-yyyy_HH-MM-SS}.{ext}` trong `Content-Disposition` (RFC 5987 encoded). Trước đó server trả `<UUID>.mp3` nên context-menu "Save audio as..." hoặc VLC download đều ra UUID, bất chấp `<a download>` attribute của frontend.
- Áp dụng cho cả `proxyRecording` (single play/download) và `bulkDownloadRecordings` (từng entry trong zip).
- `proxyRecording` select thêm `direction/callerNumber/destinationNumber/startTime`. `bulkDownloadRecordings` tương tự. Sanitize tên file để chỉ còn `[A-Za-z0-9_+-]`.
- **Deploy:** scp file → rebuild backend container cả dev + prod, health `200 OK`. Không cần migration.

### Primary CTA color darken (2026-04-22 16:05, **uncommitted**)
- `app.css` — `--primary: #b8a5f5` (lavender nhạt) → `#6d4fc8` (tím đậm saturated); `--ring` cùng update. Sidebar token `--sidebar #5a4b8a` giữ nguyên, không xung đột.
- Tác động: tất cả 85 `<Button>` variant `default` toàn app (bao gồm "Lưu thay đổi" các form cluster/permission/team/account) đổi màu tự động. Outline/ghost/destructive không ảnh hưởng.
- **Deploy:** rsync `app.css` → rebuild container frontend cả dev + prod, containers healthy.

### Dual-write CDR + prod backfill (2026-04-22)
- ✅ Nginx fan-out trên PBX `10.10.101.206` (`/etc/nginx/conf.d/cdr-fanout.conf`): listen `127.0.0.1:9080`, primary=prod `10.10.101.208`, mirror=dev `10.10.101.207`. FusionPBX xml_cdr URL đã đổi sang `http://127.0.0.1:9080/api/v1/webhooks/cdr`, backup gốc tại `/root/xml_cdr.conf.xml.bak-20260422-1035`.
- ✅ Live CDR đồng thời đổ cả 2 DB (delta +14–16ms). Prod retry qua FS `err-log-dir` nếu primary fail; dev fire-and-forget.
- ✅ Backfill 1564 blueva CDR từ gap `2026-04-18 05:14 → 2026-04-22 03:37` — script `/root/replay-blueva.py` chạy **trên PBX 206** (source IP 206 để match `pbx_clusters.pbx_ip`), 0 fail.
  - Prod blueva call_logs: 85 → 881 (ext 101/103/104/105/106 đủ phân phối sát dev 855).
  - **Root cause kẹt sync 4 ngày:** xml_cdr URL chỉ trỏ 207 (dev). Prod starved.
  - **Bug trong replay script (đã vá):** Bash `-d` strip newline / PostgreSQL `encode(base64)` wrap 76 char làm Python line-iter cắt payload / GLOBAL_RATE_LIMIT 120/min burst bị 429 / source IP phải = 206 để prod match domain cluster.

### Incident fixes gần đây
- ✅ `956ec71` webhook treat `destination=sip_domain` as orphan leg (MicroSIP ext profile dup)
- ✅ `1a484ef` + `e2b570e` SIP presence query cả hai sofia profiles (internal + external)
- ✅ `8d34b1f` remove fake agent placeholder leak trong monitoring live-calls
- ✅ `3b5853e` remove mock/fake dashboard data leaking to tenants

### Autocall Engine — Kamailio + FS (plan scaffolded 2026-04-23, chưa implement)
Plan: `plans/260423-1636-autocall-engine-kamailio-fs/` (10 phases, P2, XL)
- **Scope chốt:** FusionPBX giữ click-to-call, autocall chạy cluster riêng Kamailio + 2× FreeSWITCH active-active, progressive pacing 100–300 CCU, predictive+AMD bồi sau.
- **Architecture:** MicroSIP → Kamailio `10.10.101.210` → FS `.211`/`.212` → carrier trunk. Engine = PM2 app riêng `crm-autocall-engine`, talk CRM backend qua Redis pub/sub (`autocall:agent:status`, `autocall:call:event`, `autocall:campaign:control`, `autocall:dnc:invalidate`).
- **6 quyết định locked:** SIP auto-sync `kamailio.subscriber`; recording stereo (L=agent / R=customer); bỏ holiday calendar (daily window per-campaign); callback bypass cooldown; shared subnet `10.10.101.x`; ESL tách PM2 app (không nhét vào `crm-backend`).
- **RBAC keys mới (chưa wire):** `autocall.{campaigns,leads,agent,monitor,dnc,disposition}.*`
- **Feature flag:** `FEATURE_AUTOCALL_ENABLED` cluster-scoped, default OFF.
- **Research xong:** kamailio-architecture / freeswitch-progressive-cdr / compliance-scheduler (tại `research/`).
- **Reports:** trống — chưa ai start phase nào.

---

## 2. Việc cần làm tiếp (priority order)

### P0 — Dọn working tree + cut branch autocall (mai bắt đầu ở đây)
- **545+ files dirty** trên `feat/ui-ops-console-redesign` — bao gồm:
  - 2026-04-22: cluster ext-sync / recording filename / primary color darken — deployed, chưa commit
  - 2026-05-04: Emerald Operations theme + page-level UI fixes (monitoring/debt/reports/call-logs/login) — deployed dev, chưa commit
  - skills mới (`crm-deploy`, `crm-prisma`, `crm-pbx-cluster`, `crm-session-boot`...) + playwright artifacts
- **Hành động (thứ tự):**
  1. Split commits theo scope (skill `git`, conventional-commit): `feat(cluster-sync)`, `feat(recording-filename)`, `style(ui-primary)`, `style(theme): emerald operations palette`, `feat(monitoring): clickable tabs + status filter`, `feat(reports): hourly chart + delta badge`, `feat(call-logs): inline audio popover`, `feat(login): raito logo + autofill off`, `chore(skills)`, `chore(playwright-snapshots)` — verify không commit `.env`/creds
  2. Push `feat/ui-ops-console-redesign` lên remote
  3. `git checkout master && git pull && git checkout -b feat/autocall-engine-kamailio-fs`
- **Gotcha:** working tree bẩn > 500 file dễ sót → dùng `git status --short | grep -v "^\\?\\?"` để check tracked changes riêng, stage theo glob

### P1 — Autocall Track B (code, không block bởi infra)
Start được ngay sau P0. 3 phase độc lập với hạ tầng Kamailio/FS:
1. **Phase 02 — DB schema** (`phase-02-database-schema.md`): 6 `autocall_*` tables + `PbxCluster.type` enum + Prisma migration. Deploy dev-only.
2. **Phase 06 — CDR webhook routing** (`phase-06-cdr-webhook-routing.md`): branch theo `cluster.type` trong webhook handler, test bằng fixture XML cả fusionpbx + kamailio-fs shape.
3. **Phase 07 — Frontend campaign mgmt** (`phase-07-frontend-campaign-management.md`): UI CRUD campaigns + lead upload CSV + SIP creds panel. Không cần engine chạy.

### P1b — Autocall Track A (infra, BLOCKED chờ user cung cấp)
Phase 01 cần 3 thứ **ngoài code** trước khi start:
1. **3 VM Ubuntu 22.04** tại `10.10.101.210/.211/.212` — verify IP chưa dùng
2. **Carrier SIP trunk:** gateway name, user/pass, digest realm, yêu cầu whitelist `.211/.212`
3. **Firewall:** UDP 5060, UDP 30000–40000 (rtpengine), TCP 8021 loopback

Khi có đủ 3 cái trên → start phase 01 (Kamailio + FS setup). Phase 03/04/05/08/09 phụ thuộc engine → chờ cả Track A + B xong.

### P2 — UI Redesign Phase 05 (test + staged deploy)
File: `plans/260420-1147-ui-ops-console-redesign/phase-05-test-and-deploy.md`

1. Chạy `tsc -b` + `npm run build` (backend + frontend)
2. E2E Playwright: `crud`, `crud-full`, `c2c`, `rbac-ui`, `navigation`, `logo-branding`
3. Visual regression baseline (Playwright `toHaveScreenshot`) cho dashboard, contacts, campaigns list/detail
4. **Deploy dev** `10.10.101.207` qua skill `crm-deploy`:
   - Backend: rebuild + `prisma migrate deploy` → chạy migration RBAC dedup
   - Frontend: rebuild container
   - Redis: `DEL permissions:role:*` bust cache
5. Smoke test: login 4 roles (super_admin, admin, leader, agent) → sidebar nav → click-to-call → xem recording
6. Rollback drill: `git reset --hard backup/pre-ui-redesign-260420` + redeploy (verify)

### P3 — Prod deploy
**CHỈ khi user nói đúng phrase "Deploy to Server PROD"** (memory `feedback_prod_deployment_rule.md`).

### P4 — Follow-up (backend endpoints UI redesign flagged)
- `GET /dashboard/call-volume-24h` cho 24h heatmap
- `GET /dashboard/overview?compare=yesterday` cho KPI deltas

---

## 3. Deploy cheatsheet

### Dev (10.10.101.207)
```bash
# From repo root, after commits pushed to branch
# Use crm-deploy skill for full flow. Manual fallback:
rsync -avz --delete --exclude node_modules --exclude .env --exclude dist --exclude .git \
  ./ root@10.10.101.207:/opt/crm/
ssh root@10.10.101.207 'cd /opt/crm && docker compose -f docker-compose.prod.yml up -d --build'
ssh root@10.10.101.207 'cd /opt/crm && docker compose -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy'
ssh root@10.10.101.207 'cd /opt/crm && docker compose -f docker-compose.prod.yml exec -T redis redis-cli --scan --pattern "permissions:role:*" | xargs -r docker compose -f docker-compose.prod.yml exec -T redis redis-cli DEL'
# Verify
ssh root@10.10.101.207 'curl -sf http://localhost/api/health'
ssh root@10.10.101.207 'cd /opt/crm && docker compose -f docker-compose.prod.yml logs --tail=100 backend'
```
Credentials: memory `reference_ssh_server.md`.

### Prod (10.10.101.208) — GATED
1. User phải nói đúng: **"Deploy to Server PROD"** (literal)
2. Otherwise refuse + suggest dev
3. Credentials: memory `reference_ssh_prod_server.md`
4. Skill `crm-deploy` handles gate automatically

### Rollback
```bash
git reset --hard backup/pre-ui-redesign-260420
# redeploy via same flow
```

---

## 4. Rủi ro / cần check

- **Working tree bẩn 545+ files** — verify không có file confidential (`.env`, credentials) sẽ bị commit nhầm
- **Migration `rbac_dedup` idempotent** — re-run safe; nhưng cache Redis BẮT BUỘC bust sau deploy
- **FusionPBX `xml_cdr` disk-logging permission trap** — nếu rsync backfill CDR vào PBX phải `chown www-data:www-data` (xem `pbx-incident-patterns.md` 2026-04-20)
- **SIP presence multi-tenant** — nếu thêm cluster/domain mới, verify `sip_realm` filter đã đúng (xem incident 2026-04-21)
- Tag `backup/pre-ui-redesign-260420` tồn tại → rollback nhanh

---

## 5. Plans đang mở

| Plan | Status |
|---|---|
| `260420-1147-ui-ops-console-redesign` | Phase 5 pending — Emerald theme + page polishing pass deployed dev (2026-05-04) |
| `260421-2117-rbac-permission-dedup` | ✅ Complete (chưa deploy) |
| `260421-1244-ticket-kanban-detail` | ✅ Workers done (chưa deploy) |
| `260423-1636-autocall-engine-kamailio-fs` | 🆕 Scaffolded — 10 phases pending, research done, chưa cut branch |

---

## 6. Câu hỏi treo
- Phase 05 UI redesign có cần visual regression không (plan nói recommended, không bắt buộc)?
- Có muốn gộp 3 plans UI/RBAC/ticket vào 1 đợt deploy dev hay tách từng cái?
- **Autocall infra timeline:** bao giờ provision được 3 VM `.210/.211/.212`?
- **Autocall carrier:** dùng carrier nào, trunk credentials ở đâu, whitelist bao lâu duyệt?
- Autocall branch cut từ `master` — có cần rebase các commit UI redesign (đang pending deploy Phase 5) vào trước để không conflict sau này không?

---

## 7. Cập nhật file này khi nào — BẮT BUỘC

**Trigger replace-in-place** (không append history):
- Thêm / sửa / xoá **bất kỳ tính năng nào** → update §1 hoặc §2
- Fix bug user-facing → §1 + link incident nếu có
- Deploy dev/prod → §1 + §3 (bump commit SHA + timestamp)
- Đổi schema DB / migration / env var → §1 + §3
- Đóng / huỷ plan → §5
- Resolve câu hỏi treo → xoá khỏi §6
- User nói "update status" / "wrap up"

**Quy tắc:**
- status.md là **snapshot hiện tại**, KHÔNG phải changelog → replace nội dung cũ, đừng append
- Changelog history đầy đủ ở `docs/project-changelog.md`
- Luôn bump header: `> **Updated:** YYYY-MM-DD HH:MM (Asia/Saigon)` + `> **Branch:**` nếu đổi
- Dùng skill `crm-session-boot` để áp flow chuẩn

**Không cần update khi:** typo, rename biến nhỏ, refactor internal không đổi behavior, test-only commits.
