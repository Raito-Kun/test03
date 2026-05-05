---
name: crm-session-boot
description: Boot a fresh CRM session — read Current status/status.md, verify git state matches, summarize what was done, what's next, and how to deploy. Use at the start of every new session or after /clear to sync context before touching code.
version: 1.0.0
argument-hint: "[--verbose|--deploy-only|--next]"
---

# CRM Session Boot Skill

Single entry point để sync context về project sau `/clear` hoặc session mới. Đọc source of truth (`Current status/status.md`), verify git/branch, highlight việc kế tiếp và deploy flow.

## When to Use

- Bắt đầu session mới (sau `/clear`, wake-up, hoặc mở terminal mới)
- User hỏi "hôm nay làm tiếp gì" / "current status" / "project đang ở đâu"
- Trước khi deploy — verify status matches git
- Trước khi bắt đầu plan mới — check plans đang mở

## Workflow

### 1. Read source of truth (bắt buộc)
```
Read: Current status/status.md          # trạng thái chính
Read: .claude/rules/pbx-incident-patterns.md  # tránh debug lặp
Read: C:/Users/Raito/.claude/projects/C--Users-Raito-OneDrive-TRAINNING-VIBE-CODING-02-CRM/memory/MEMORY.md
```

### 2. Verify git state khớp với status
```bash
git status --short | head -30
git log --oneline -10
git branch --show-current
```
So sánh:
- Branch hiện tại có khớp status.md không?
- Commit gần nhất có nằm trong "Đã làm" section không?
- Working tree có bẩn quá mức ghi trong status không?

### 3. Summarize cho user
Output format (ngắn gọn, ≤150 words):
```
**Branch:** <branch>
**Last commit:** <sha> <msg>
**Working tree:** <N> files modified

**Đã làm (from status):** <1-2 dòng top bullets>
**Plan đang mở:** <list plans>
**Việc kế tiếp (P0/P1):** <từ section 2 của status>

**Deploy dev?** dùng skill `crm-deploy` — nhớ DEL permissions:role:* sau migrate
**Deploy prod?** gated — cần user nói "Deploy to Server PROD"
```

### 4. Flag drift (nếu có)
Cảnh báo khi:
- `status.md` timestamp > 24h từ today
- Branch khác với ghi trong status
- Có commit mới chưa list trong "Đã làm"
- Working tree bẩn hơn số files ghi trong status

→ Offer update status.md (đừng auto-run).

## Arguments

| Flag | Behavior |
|---|---|
| (none) | Full boot — read + verify + summarize |
| `--verbose` | Bao gồm cả section "Rủi ro" và "Câu hỏi treo" |
| `--deploy-only` | Chỉ tóm tắt deploy cheatsheet section 3 |
| `--next` | Chỉ output "Việc kế tiếp" section 2 |

## Update Protocol (BẮT BUỘC khi thay đổi tính năng)

Mỗi lần thêm/sửa/xoá tính năng, fix bug lớn, deploy, đổi schema/env, phải update `Current status/status.md`. KHÔNG append history dài — **replace nội dung cũ**. Changelog history đã có ở `docs/project-changelog.md`.

### Flow chuẩn
1. **Identify scope** — tính năng nào đổi, liên quan section nào trong status.md
2. **Edit in place** — dùng `Edit` tool, replace bullet/row cũ bằng nội dung mới
3. **Bump header** — cập nhật `> **Updated:** YYYY-MM-DD HH:MM`, `> **Branch:**`, commit SHA nếu đổi
4. **Move between sections** nếu status đổi:
   - ⏳ Pending → ✅ Done: move từ "Việc cần làm tiếp" sang "Đã làm"
   - ✅ Done → ❌ Reverted: move về "Việc cần làm" + note lý do rollback
5. **Sync câu hỏi treo** — xoá dòng đã được user trả lời

### Matrix: đổi gì → update section nào

| Event | Section update | Extra action |
|---|---|---|
| Feature merged | §1 Đã làm (+ commit SHA) | Nếu UI → check visual regression flag ở §2 |
| Feature đang dở | §2 Việc cần làm tiếp | Đặt priority (P0-P3) |
| Deploy dev xong | §1 + §3 deploy cheatsheet | Bump "last deployed SHA" |
| Deploy prod xong | §1 + §3 | Verify gate phrase đã dùng |
| Rollback | §4 Rủi ro | Note SHA cũ + reason |
| Incident fix | §1 + link tới `pbx-incident-patterns.md` | Nếu PBX-related |
| Schema change | §1 + §4 (migration note) | List migration id |
| Env var new | §3 deploy cheatsheet | Update `.env.example` cùng lúc |
| Plan closed | §5 Plans đang mở (✅ hoặc xoá) | Archive plan folder nếu cần |
| Plan cancelled | §5 + note "cancelled: reason" | Không xoá folder |
| Câu hỏi trả lời | §6 xoá dòng | — |

### Replace rules (không phải append)
- ❌ KHÔNG: thêm "v1.3.11 — fix X" bên trên "v1.3.10 — fix X" (đó là changelog)
- ✅ NÊN: sửa bullet "fix X pending" → "fix X done · `<sha>`"
- ❌ KHÔNG: giữ lại bullet "TODO: migrate auth" sau khi đã migrate xong
- ✅ NÊN: xoá bullet TODO, thêm vào §1 với commit ref

### Khi nào KHÔNG update status.md
- Typo / formatting / rename biến nhỏ không ảnh hưởng user
- Refactor internal không đổi behavior
- Commit docs thuần (đã có `project-changelog.md`)
- Test mới cho code đã có (trừ khi đó là bước gate trước deploy)

## Anti-patterns

- ❌ Bắt đầu code ngay mà không đọc status.md → dễ làm lại việc đã done
- ❌ Auto-overwrite status.md không hỏi user
- ❌ Tạo file status khác ở `plans/` hay `docs/` → chỉ 1 nguồn `Current status/status.md`
- ❌ Ghi secrets (.env, token, password) vào status
- ❌ Deploy prod mà không check `feedback_prod_deployment_rule.md`

## Related

- Rule: `.claude/rules/session-boot.md` (bắt buộc đọc trước mọi task)
- Skill: `crm-deploy`, `crm-prisma`, `crm-pbx-cluster`, `crm-test`
- Memory: `MEMORY.md` index ở `~/.claude/projects/.../memory/`
