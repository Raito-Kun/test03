# Session Boot Rule

**IMPORTANT — ĐỌC TRƯỚC KHI CHẠY BẤT KỲ TASK NÀO TRONG SESSION MỚI.**

Mỗi khi bắt đầu session (sau `/clear`, sau `SessionStart:clear hook`, hoặc phiên mới), agent PHẢI:

## 1. Đọc file trạng thái project
- **File bắt buộc:** `Current status/status.md` (tại project root)
- File này tổng hợp:
  - Những gì đã làm (state summary theo plan)
  - Việc kế tiếp (priority order P0 → P3)
  - Quy trình deploy dev/prod + rollback
  - Rủi ro / check-list
  - Plans đang mở + câu hỏi treo

## 2. Đọc memory & rules liên quan
- `C:/Users/Raito/.claude/projects/C--Users-Raito-OneDrive-TRAINNING-VIBE-CODING-02-CRM/memory/MEMORY.md`
- `.claude/rules/development-rules.md`
- `.claude/rules/pbx-incident-patterns.md` — tránh debug lặp các lỗi đã từng cháy giờ
- `.claude/rules/primary-workflow.md`

## 3. Xác nhận branch + git state
- `git status --short | head -30` — xem working tree có bẩn không
- `git log --oneline -10` — commit gần nhất
- Nếu branch lệch với status.md → hỏi user xác nhận trước khi làm việc

## 4. Activate skills cần thiết
- Dùng `crm-session-boot` skill nếu tồn tại để tóm tắt nhanh
- Dùng `crm-deploy` cho deploy, `crm-pbx-cluster` cho PBX, `crm-prisma` cho migration
- Skill catalog: chạy `.claude/scripts/generate_catalogs.py --skills` nếu cần

## 5. Nếu status.md outdated
Nếu status.md có timestamp > 24h so với today, hoặc commit log gần nhất không khớp với "Đã làm" section:
1. Cảnh báo user
2. Offer update status.md dựa trên `git log` + `git status` mới nhất
3. KHÔNG auto-overwrite — chờ user xác nhận

## 6. Cập nhật status.md — BẮT BUỘC
Agent PHẢI update `Current status/status.md` mỗi khi:
- **Thêm / sửa / xóa tính năng** (feat, refactor, chore lớn)
- **Fix bug** ảnh hưởng tới behavior user-facing
- Kết thúc 1 phase / plan
- Deploy xong dev hoặc prod (cập nhật commit SHA + timestamp deploy)
- Fix 1 incident nghiêm trọng (link vào `pbx-incident-patterns.md` nếu là PBX)
- Đổi schema DB / migration
- Đổi env var / deploy flow
- User yêu cầu "update status" / "wrap up"

### Quy tắc update (replace-old-content)
- **Thay thế chứ không append history dài vô tận.** status.md là snapshot hiện tại, KHÔNG phải changelog (changelog ở `docs/project-changelog.md`).
- Nếu tính năng cũ bị thay thế → xoá bullet cũ, viết bullet mới vào section "Đã làm" hoặc "Việc cần làm".
- Nếu phase/plan done → move từ "Việc cần làm tiếp" sang "Đã làm" (replace status từ ⏳ → ✅).
- Nếu plan bị huỷ/scope đổi → update status + link lý do, không xoá plan hoàn toàn.
- Luôn cập nhật timestamp dòng đầu: `> **Updated:** YYYY-MM-DD HH:MM (Asia/Saigon)`.
- Luôn cập nhật branch/commit nếu đổi: `> **Branch:** ...`

### Sections phải đồng bộ
| Khi thay đổi... | Update section nào |
|---|---|
| Feature mới merged | `1. Đã làm` (thêm bullet + commit SHA) |
| Feature đang dở | `2. Việc cần làm tiếp` (di chuyển priority) |
| Deploy xong | `1. Đã làm` + timestamp + bump commit anchor |
| Rollback | `4. Rủi ro` + note rollback reason |
| Incident fix | `1. Đã làm` + reference `pbx-incident-patterns.md` |
| Plan đóng | `5. Plans đang mở` đổi status thành ✅ hoặc xoá khỏi danh sách |
| Câu hỏi đã trả lời | `6. Câu hỏi treo` xoá bỏ dòng đó |

## Không làm
- Không tạo file status mới ở chỗ khác — chỉ dùng `Current status/status.md`
- Không append thay vì replace — status.md không phải changelog
- Không xóa câu hỏi treo trừ khi đã resolved
- Không ghi confidential (.env, credentials, JWT secrets) vào status
- Không update xong mà quên đổi timestamp + branch ở header
