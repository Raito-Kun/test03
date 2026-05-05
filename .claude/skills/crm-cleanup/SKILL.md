---
name: crm-cleanup
description: Auto-prune stale CRM project artifacts — dev screenshots, old logs, closed plans, obsolete mockups, superseded meta files. Use after a feature ships, after a phase closes, after a deploy, or when user says "dọn dẹp" / "cleanup" / "xoá file cũ". Always inventory first, classify into 3 buckets (SAFE_DELETE / ASK_USER / KEEP), ask user about uncertain items, then execute.
version: 1.0.0
argument-hint: "[--dry-run|--scope=<images|plans|docs|all>|--auto]"
---

# CRM Cleanup Skill

Dọn artifacts đã hết tác dụng để repo gọn, plans/docs phản ánh đúng state hiện tại. KHÔNG xoá thứ gì còn được reference, KHÔNG xoá khi không chắc — luôn hỏi user.

## When to Use

**Auto-trigger** (claude tự gọi):
- Sau khi 1 feature merge + ship dev (đã có commit + smoke pass)
- Sau khi 1 phase trong plan đóng (✅ tất cả task)
- Sau khi 1 plan close hoàn toàn (move khỏi `plans/đang mở`)
- Sau khi UI palette / theme đổi (mockup cũ obsolete)
- Khi `Current status/status.md` được update và status đổi từ ⏳ → ✅

**Manual trigger** (user nói):
- "dọn dẹp", "cleanup", "xoá file cũ", "prune", "clean repo"

**KHÔNG trigger khi:**
- Working tree đang dirty với thay đổi chưa commit của feature đang dở
- Đang giữa deploy (rollback có thể cần snapshot/log gần đây)
- User nói "tạm chưa xoá" / "để đó"

## Workflow (4 bước)

### Bước 1 — Inventory (read-only, parallel agents)

Chia scope thành 4 mảng, spawn 4 agent song song (`general-purpose` background):

| Agent | Scope |
|---|---|
| 1 | Root images/PNG/JPG, `playwright-report/`, `test-results/`, `.playwright-mcp/`, root JSON ephemeral |
| 2 | Root meta files (`*.md`/`*.txt` không phải README/CLAUDE), tool configs (`.gemini/`, `.opencode/`), 1-off scripts |
| 3 | Reference materials (`Guildline/`, `MOCKUP/`, `docs/mockup-src/`, vendor PDFs/docs) |
| 4 | `plans/archive/`, plans cũ (closed/superseded), `plans/reports/` orphans, hooks logs |

Agent prompt template — đọc tại §"Agent prompt template" bên dưới.

Mỗi agent trả 3 bucket:
- 🟢 **SAFE_DELETE** — clearly disposable (rationale 1 dòng)
- 🟡 **ASK_USER** — uncertain (câu hỏi cụ thể)
- 🔴 **KEEP** — referenced (path + ref location)

### Bước 2 — Tổng hợp + verify

1. Aggregate 4 báo cáo thành 1 bảng duy nhất.
2. **Verify SAFE_DELETE bucket** trước khi gộp:
   - Grep tên file trong `docs/`, `plans/`, `Current status/status.md`, `*.md`
   - Nếu có match → demote sang ASK_USER (không tự ý xoá)
3. Liệt kê ASK_USER thành danh sách ngắn 5-10 câu, mỗi câu 1 dòng.

### Bước 3 — Ask user (nếu có ASK_USER)

Output cho user:
```
## SAFE_DELETE (sẽ xoá nếu OK): N files, ~X MB
[bullet list grouped by category]

## ASK_USER (cần quyết)
1. [item] — [câu hỏi cụ thể]
2. ...

## KEEP
[short list — chỉ tên + lý do, không cần verbose]

OK chạy? Trả lời các câu trên để tao biết thêm cái nào xoá / giữ.
```

**Đợi user xác nhận.** KHÔNG xoá gì trước khi user OK.

### Bước 4 — Execute + verify + report

1. Chạy `rm` theo từng batch song song (root images, plans cũ, mockup, etc.)
2. Verify: `ls` lại từng dir để confirm còn đúng những gì cần keep
3. Fix dangling references trong các file MD còn lại (vd: link tới file vừa xoá trong `docs/INDEX.md`)
4. **Update `Current status/status.md`** — note cleanup ở §1 với timestamp
5. **Suggest commit** — `chore(cleanup): prune stale <scope>` — không tự commit, để user duyệt

## Bucket criteria (chi tiết)

### 🟢 SAFE_DELETE — auto-classify nếu thoả TẤT CẢ

| Loại | Điều kiện |
|---|---|
| Root PNG/JPG | KHÔNG được grep trong `docs/`, `plans/`, `Current status/`, code; tên có pattern dev (`dev-*`, `test-*`, `*-after-fix`, `*-deployed`, `*-loaded`, `dialog-*`, `theme-*`, `spring-*`) |
| `playwright-report/`, `test-results/`, `.playwright-mcp/` | Disposable artifacts (regen được mỗi lần test) |
| Root JSON | `release-manifest.json`, `test-results.json` không có code đọc |
| Root meta `.md`/`.txt` | Mod-date > 1 tháng, content nói về phase đã closed (Phase 1/2/3 MVP cũ), không có file nào reference |
| Plans cũ | `status: completed/done/closed` trong frontmatter, work đã có trong `docs/project-changelog.md` |
| Plans với chỉ ssh-script `*.js` không có `plan.md` | One-shot ops scripts, đã chạy xong |
| Plan snapshots binary (`dev-snapshot/`, `prod-backup/`) | Không phải source-of-truth, regen được từ git/server |
| Mockup outputs (`MOCKUP/`, `docs/mockup-src/`) | Khi palette/theme dự án đã chuyển sang thứ khác (vd: lavender → emerald) |
| Old changelog/roadmap snapshots | Mod-date << `docs/project-changelog.md` mod-date, content stale (vd: "Phase 15" trong khi code đã Phase 21) |

### 🟡 ASK_USER — luôn hỏi nếu

| Loại | Lý do hỏi |
|---|---|
| Vendor PDFs/docs | User reference material |
| `.skill` ZIP bundles ngoài `.claude/skills/` | Có thể là source-of-truth user publish |
| Tool configs khác (`.gemini/`, `.opencode/`, `.zed/`...) | User có thể dùng AI harness song song |
| `AGENTS.md`/`AGENT.md` ở root | Có thể được tool khác đọc |
| Plans genesis (`*-mvp`, `*-research` đầu tiên) | History value vs disk space |
| Plans có overlap với plan đang OPEN | Risk: nội dung migration/schema vẫn cần |
| Tài liệu PRD/spec dù cũ | Anchor lịch sử |
| Mockup cũ khi UI redesign chưa Phase test+deploy đóng | Có thể cần cho visual regression baseline |
| Generated end-user training docs (`.docx`) | Có thể đang distribute |

### 🔴 KEEP — không bao giờ xoá

| Loại | Vì sao |
|---|---|
| Code source (`packages/`, `apps/`) | Hiển nhiên |
| `.env*`, credentials, certs | Không bao giờ động vào |
| `prisma/migrations/` | Audit trail bắt buộc |
| Plans đang OPEN (theo `Current status/status.md` §5) | Active WIP |
| Files được grep ra trong code/docs/plans/status | Bằng chứng đang dùng |
| `docs/` core files (codebase-summary, code-standards, project-changelog, system-architecture, development-roadmap, README, INDEX) | Documentation canonical |
| `plans/templates/` | Template scaffolding |
| Git history (đừng `rm -rf .git/*` ever) | Hiển nhiên |
| Hooks logs < 10 MB | Healthy size, không cần rotate |

## Agent prompt template

```
You are doing READ-ONLY cleanup inventory. DO NOT DELETE anything.

Work context: <project root>
Branch: <branch>
Status doc: Current status/status.md (consult for context)

Your scope (file ownership):
<list của agent>

For each file/dir, classify:
- 🟢 SAFE_DELETE — clearly disposable (1-line reason)
- 🟡 ASK_USER — uncertain (1-line question)
- 🔴 KEEP — referenced (path + grep proof)

Cross-reference checks:
- Grep filenames in docs/, plans/, Current status/, *.md
- Compare mod-dates with canonical files (changelog, status)
- Check git log for recent references

Output format: markdown 3-bucket sections, ≤500 words.
**Status:** DONE at end with one-line summary.
```

## Guardrails (BẮT BUỘC tuân thủ)

1. **Read-only first** — bước 1 luôn là inventory, KHÔNG xoá
2. **Verify SAFE_DELETE bằng grep** trước khi confirm với user
3. **Hỏi user khi nghi ngờ** — over-ask better than over-delete
4. **Không xoá file > 100 MB mà không hỏi** (kể cả binary snapshot)
5. **Không động vào** `.env*`, `.git/`, `node_modules/`, `prisma/migrations/`, `packages/*/src/`
6. **Update `status.md` sau cleanup** — note ở §1 ngắn gọn (≤2 dòng)
7. **Suggest commit, đừng tự commit** — user review diff trước
8. **Nếu git working tree đã dirty với feature WIP** — defer cleanup, hỏi user trước

## Arguments

| Flag | Behavior |
|---|---|
| (none) | Full flow — inventory 4 mảng + ask + execute |
| `--dry-run` | Inventory only, không thực thi xoá kể cả khi user OK |
| `--scope=images` | Chỉ root images + ephemeral artifacts |
| `--scope=plans` | Chỉ `plans/archive/` + plans cũ |
| `--scope=docs` | Chỉ `docs/` mockup leftovers + old reports |
| `--scope=all` | Default — full sweep |
| `--auto` | Skip ASK_USER bucket (chỉ xoá SAFE_DELETE), DANGER — chỉ dùng khi user explicit say "auto" |

## Auto-trigger patterns

Khi nào claude TỰ động chạy skill này (không cần user gọi):

| Trigger event | Scope mặc định |
|---|---|
| Feature commit + status.md update từ ⏳ → ✅ | `--scope=images` (nhiều screenshot dev tích lại trong quá trình verify) |
| Plan đóng (move khỏi §5 status.md) | `--scope=plans` (plan đó + reports liên quan) |
| Deploy dev pass smoke + commit SHA bumped | `--scope=images` |
| UI palette/theme migration | full sweep + đặc biệt `MOCKUP/` |
| Sau `/clear` thấy >50 files dirty mà nhiều file là PNG ephemeral | suggest cleanup, không tự chạy |

## Anti-patterns

- ❌ Xoá file mà không grep references trước
- ❌ Xoá `MOCKUP/` khi UI redesign chưa hoàn tất visual regression
- ❌ Xoá plans đang OPEN (theo §5 status.md)
- ❌ Auto-mode mà không có user confirm
- ❌ Tự commit cleanup không cho user review diff
- ❌ Xoá hidden dirs (`.gemini`, `.opencode`, `.vscode`, `.idea`) không hỏi — user có thể dùng harness khác
- ❌ Xoá vendor PDFs / training docs không hỏi
- ❌ Append vào status.md `## Cleanup history` (status là snapshot, không phải history) — chỉ ghi 1 dòng ở §1

## Related

- Skill: `crm-session-boot` (status.md update protocol)
- Rule: `.claude/rules/session-boot.md`
- Memory: `feedback_docs_truth_source.md` (đâu là canonical doc)
- Doc: `docs/project-changelog.md` (canonical changelog — tham chiếu khi cleanup plans)
