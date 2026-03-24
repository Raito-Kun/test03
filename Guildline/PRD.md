# PRD — CRM Omnichannel cho Telesale & Collection

**Phiên bản:** 2.0
**Ngày:** 2026-03-24
**Trạng thái:** Draft

---

## 1. Tổng quan sản phẩm

### 1.1 Mô tả
CRM chuyên biệt cho doanh nghiệp tài chính quy mô vừa (20–100 agents), tập trung 2 nghiệp vụ cốt lõi:
- **Telesale**: Quản lý lead, gọi ra tư vấn, theo dõi chuyển đổi, chiến dịch outbound
- **Collection**: Phân loại nợ, nhắc nhở thanh toán, theo dõi thu hồi

Tích hợp sâu với **FusionPBX/FreeSWITCH 1.10.x** để Click-to-Call, ghi âm, giám sát real-time. Mở rộng Omnichannel với AI Chatbot, AI Callbot, Zalo/SMS automation.

### 1.2 Bài toán cần giải quyết
| Vấn đề | Giải pháp |
|---|---|
| Dữ liệu KH phân tán nhiều hệ thống | 1 nơi quản lý lead Telesale + hồ sơ nợ Collection |
| Agent phải login tổng đài riêng để nghe ghi âm | Nghe/tải ghi âm ngay trong CRM |
| Không đo lường KPI agent real-time | Dashboard KPI thời gian thực |
| Quy trình gọi điện thủ công, không chuẩn hóa | Script gọi điện, disposition codes, campaign management |
| Thiếu kênh giao tiếp tự động | AI Chatbot, Callbot, Zalo/SMS nhắc nợ |

### 1.3 Mục tiêu sản phẩm
- Tập trung hóa dữ liệu KH — 1 nơi quản lý lead + hồ sơ nợ
- Chuẩn hóa quy trình — script gọi điện, trạng thái, disposition codes
- Dashboard KPI real-time — tỷ lệ tiếp cận, tỷ lệ chốt, số nợ thu được
- Click-to-Call trực tiếp trong CRM — WebRTC in-browser + softphone
- Nghe lại & tải ghi âm ngay trong CRM
- AI gợi ý script cá nhân hóa theo từng KH

---

## 2. Người dùng & Vai trò

### 2.1 Các vai trò (RBAC — 6 Roles)

| Vai trò | Mô tả |
|---|---|
| **Admin** | Quản trị hệ thống, phân quyền, cấu hình tổng đài |
| **Manager** | Quản lý team, xem báo cáo toàn bộ, giám sát cuộc gọi |
| **QA** | Chấm điểm ghi âm, đánh giá chất lượng cuộc gọi, báo cáo QA |
| **Team Leader** | Quản lý nhóm agents, giám sát KPI nhóm |
| **Agent Telesale** | Gọi ra tư vấn, quản lý lead pipeline |
| **Agent Collection** | Nhắc nợ, theo dõi thu hồi, phân loại nợ |

### 2.2 RBAC Matrix

| Chức năng | Admin | Manager | QA | Leader | Agent TS | Agent COL |
|---|---|---|---|---|---|---|
| Quản lý users | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Xem tất cả contacts | ✅ | ✅ | ✅ | 👥 | 👤 | 👤 |
| Tạo/sửa contacts | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Xóa contacts | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Quản lý campaigns | ✅ | ✅ | ❌ | 👀 xem | ❌ | ❌ |
| Click-to-Call | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Nghe ghi âm | ✅ all | ✅ all | ✅ all | 👥 đội | 👤 mình | 👤 mình |
| Download ghi âm | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Giám sát cuộc gọi live | ✅ | ✅ | ❌ | 👥 đội | ❌ | ❌ |
| Can thiệp cuộc gọi | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Dashboard KPI | ✅ all | ✅ all | ✅ all | 👥 đội | 👤 mình | 👤 mình |
| QA Annotation | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Cấu hình AI/Automation | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Export báo cáo | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

**Ký hiệu:** ✅ Có quyền · ❌ Không · 👤 Chỉ data của mình · 👥 Cả đội · 👀 Chỉ xem

---

## 3. Use Cases

### 3.1 Telesale (TS)
- **TS-01**: Agent nhận lead mới từ campaign → xem thông tin KH → click-to-call → ghi disposition
- **TS-02**: Agent follow-up lead theo lịch hẹn callback → gọi lại → cập nhật trạng thái lead
- **TS-03**: Leader xem dashboard KPI nhóm → nghe ghi âm cuộc gọi → đánh giá QA
- **TS-04**: Manager tạo campaign mới → import danh sách lead → phân bổ cho agents
- **TS-05**: Agent nhận popup cuộc gọi đến → xem lịch sử tương tác → tư vấn → ghi phiếu

### 3.2 Collection (COL)
- **COL-01**: Agent nhận danh sách nợ → gọi nhắc nợ → ghi disposition → lên lịch gọi lại
- **COL-02**: System tự động gửi SMS/Zalo nhắc nợ theo rule → escalate nếu không phản hồi
- **COL-03**: Leader xem báo cáo tỷ lệ thu hồi theo agent/nhóm/thời gian
- **COL-04**: Manager import file nợ mới từ core banking → phân bổ cho team collection
- **COL-05**: Agent ghi nhận KH hứa trả → hệ thống nhắc nhở ngày hẹn trả

### 3.3 Omnichannel
- **OM-01**: KH nhắn tin qua Zalo OA → AI Chatbot trả lời tự động → chuyển agent nếu cần
- **OM-02**: AI Callbot gọi sàng lọc lead → chuyển lead qualified cho agent telesale
- **OM-03**: Hệ thống gửi ZNS nhắc nợ tự động theo lịch → ghi log vào hồ sơ KH

---

## 4. Tính năng chi tiết

### 4.1 Core CRM

#### 4.1.1 Quản lý Contacts
- CRUD contacts (KH dùng cho cả Telesale lẫn Collection)
- Tìm kiếm nâng cao: SĐT, tên, CMND/CCCD, mã KH, nhóm
- Import/Export danh sách KH qua file Excel/CSV
- Merge contacts trùng lặp (deduplication theo SĐT)
- Lịch sử tương tác toàn bộ: cuộc gọi, chat, SMS, email
- Custom fields — bổ sung trường dữ liệu theo nghiệp vụ
- Phân nhóm KH (tags, segments)
- Quan hệ gia đình giữa các contacts (người thân, người bảo lãnh)

#### 4.1.2 Phiếu ghi (Tickets/Interaction Notes)
- Mỗi tương tác với KH → agent tạo phiếu ghi (ticket)
- Phiếu ghi gắn với contact + cuộc gọi (nếu có)
- Danh mục phiếu ghi — phân loại theo nghiệp vụ (tư vấn, khiếu nại, hỗ trợ...)
- Kết quả phản hồi — agent chọn kết quả từ danh mục chuẩn hóa
- Macro/Quick Reply — mẫu trả lời nhanh, agent chọn template thay vì gõ tay
- Lịch sử phiếu ghi hiển thị trong timeline contact

#### 4.1.3 Quản lý Leads (Telesale Pipeline)
- Trạng thái lead: New → Contacted → Qualified → Proposal → Won/Lost
- Lead scoring — chấm điểm lead theo tiêu chí tùy chỉnh
- Lead assignment — phân bổ lead cho agent (manual / round-robin / rule-based)
- Follow-up scheduler — lên lịch gọi lại, nhắc nhở tự động
- Lead source tracking — nguồn lead (campaign, website, referral)

#### 4.1.4 Quản lý Nợ (Collection)
- Import hồ sơ nợ từ file (core banking export)
- Phân loại nợ: current, DPD 1-30, DPD 31-60, DPD 61-90, DPD 90+
- Trạng thái nợ: Active → In Progress → Promise to Pay → Paid → Written Off
- Escalation rules — tự động chuyển tier khi quá hạn
- Ghi nhận cam kết trả (Promise to Pay) + nhắc nhở ngày hẹn

#### 4.1.5 Campaigns
- Tạo chiến dịch Telesale / Collection
- Import danh sách KH vào campaign
- Phân bổ KH cho agents (auto/manual)
- Tracking tiến độ campaign real-time
- Script gọi điện theo campaign — hiển thị script khi agent gọi
- Disposition codes — danh mục kết quả gọi chuẩn hóa theo campaign

### 4.2 Click-to-Call & Tích hợp VoIP

#### 4.2.1 Kiến trúc tích hợp FusionPBX

```
┌─────────────────────────────────────────────────────────┐
│                    CRM Frontend (React)                  │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────────┐ │
│  │Click-to- │  │Call      │  │WebRTC Softphone        │ │
│  │Call UI   │  │Controls  │  │(SIP.js / JsSIP)        │ │
│  └────┬─────┘  └────┬─────┘  └──────────┬─────────────┘ │
│       │              │                    │               │
│       └──────────────┴────────────────────┘               │
│                       │ WebSocket                         │
├───────────────────────┼───────────────────────────────────┤
│                 CRM Backend (Express.js)                  │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────────┐ │
│  │Call API  │  │CDR       │  │Recording Proxy         │ │
│  │Controller│  │Webhook   │  │(RBAC + Stream)         │ │
│  └────┬─────┘  └────┬─────┘  └──────────┬─────────────┘ │
│       │              │                    │               │
├───────┼──────────────┼────────────────────┼───────────────┤
│       │              │                    │               │
│  ┌────▼─────┐  ┌─────▼────┐  ┌───────────▼────────────┐ │
│  │ESL       │  │xml_cdr   │  │Nginx on FusionPBX      │ │
│  │Daemon    │  │HTTP POST │  │:8088/recordings/       │ │
│  │(Node.js) │  │receiver  │  │(internal network only) │ │
│  └────┬─────┘  └──────────┘  └─────────────────────────┘ │
│       │                                                   │
├───────┼───────────────────────────────────────────────────┤
│       │        FusionPBX / FreeSWITCH 1.10.x              │
│  ┌────▼─────┐  ┌──────────┐  ┌─────────────────────────┐ │
│  │ESL       │  │xml_cdr   │  │Recordings               │ │
│  │:8021     │  │module    │  │/var/lib/freeswitch/     │ │
│  │          │  │          │  │recordings/{domain}/     │ │
│  └──────────┘  └──────────┘  └─────────────────────────┘ │
│  ┌──────────┐  ┌──────────┐                               │
│  │SIP/WSS   │  │PostgreSQL│                               │
│  │:7443     │  │(CDR DB)  │                               │
│  └──────────┘  └──────────┘                               │
└─────────────────────────────────────────────────────────┘
```

#### 4.2.2 Click-to-Call — 2 chế độ

**Chế độ 1: External Softphone (Phase 1 — MVP)**
- Agent đăng nhập softphone riêng (Pitel, MicroSIP, Ooh...)
- Click-to-Call: CRM gọi ESL `bgapi originate` → ring softphone → bridge to destination
- Flow: CRM API → ESL Daemon → FreeSWITCH originate → Softphone rings → Agent picks up → Bridge to KH

**Chế độ 2: WebRTC In-Browser (Phase 2 — Growth)**
- Agent đăng ký SIP extension trực tiếp trong browser qua WebRTC (WSS port 7443)
- Thư viện: **SIP.js** (recommended — better FreeSWITCH compat, actively maintained by OnSIP)
- Click-to-Call: Backend ESL Daemon vẫn gọi `bgapi originate` → ring agent's WebRTC UA (SIP.js) → bridge to KH
- **Lưu ý:** Flow backend ESL originate giống Softphone mode — chỉ khác endpoint (WebRTC UA thay vì softphone IP). Giữ audit trail + server-side validation cho cả 2 mode.
- Không cần cài softphone bên ngoài
- Yêu cầu: SSL cert hợp lệ (CA-signed), TURN/STUN server (coturn)
- Fallback: Nếu WSS 7443 bị chặn (corporate firewall), hỗ trợ WSS qua Nginx reverse proxy port 443

**Agent chọn chế độ** trong Settings cá nhân (khi cả 2 mode available từ Phase 2).

#### 4.2.3 Luồng Click-to-Call

```
Agent click SĐT trong CRM
       │
       ▼
CRM Frontend gửi POST /api/v1/calls/originate
       │
       ▼
CRM Backend kiểm tra:
  ✓ Agent đã đăng nhập?
  ✓ Agent ở trạng thái Sẵn sàng?
  ✓ SĐT hợp lệ?
       │
       ├─── WebRTC mode ──→ ESL Daemon gửi bgapi originate
       │                     → Ring agent's WebRTC UA (SIP.js in browser)
       │                     → Agent pick up in browser → FreeSWITCH bridge to KH
       │
       └─── Softphone mode ──→ ESL Daemon gửi bgapi originate
                                → Softphone rings → Agent pick up
                                → FreeSWITCH bridge to KH
       │
       ▼
(Cả 2 mode dùng chung backend ESL originate — chỉ khác agent endpoint)
       │
       ▼
FreeSWITCH events (ESL):
  CHANNEL_CREATE → CRM log "call initiated"
  CHANNEL_ANSWER → CRM start timer, update UI "Đàm thoại"
  CHANNEL_BRIDGE → CRM confirm connected
  CHANNEL_HOLD / CHANNEL_UNHOLD → CRM update UI "Giữ máy"
  CHANNEL_EXECUTE_COMPLETE → CRM detect transfer completion
  CHANNEL_HANGUP_COMPLETE → CRM log CDR, update disposition
  CUSTOM sofia::register → CRM track WebRTC agent registration status
  DTMF → CRM log IVR interaction (optional)
       │
       ▼
xml_cdr HTTP POST → CRM webhook receiver
  → Parse XML → Save call_logs → Match contact by SĐT
  → Link recording file path
```

#### 4.2.4 Thao tác trong cuộc gọi
- **Giữ máy (Hold)**: Agent hold cuộc gọi, KH nghe nhạc chờ
- **Chuyển máy (Transfer)**: Blind transfer / Attended transfer đến agent khác
- **Mute/Unmute**: Tắt/bật mic
- **DTMF**: Gửi tone phím bấm (cho IVR)
- **Kết thúc cuộc gọi**: Hangup

#### 4.2.5 Popup cuộc gọi đến (Inbound)
- ESL event `CHANNEL_CREATE` direction=inbound → CRM WebSocket push đến agent
- Frontend hiển thị popup: SĐT, tên KH (nếu match contact), lịch sử gọi gần nhất
- Agent click "Nghe máy" → accept call (WebRTC) hoặc accept trên softphone
- Auto-popup chi tiết contact nếu match SĐT

#### 4.2.6 Trạng thái Agent
| Trạng thái | Mô tả |
|---|---|
| **Offline** | Chưa đăng nhập |
| **Sẵn sàng** | Sẵn sàng nhận/gọi cuộc gọi |
| **Tạm nghỉ** | Không nhận cuộc gọi (break, lunch) |
| **Đổ chuông** | Cuộc gọi đang đổ chuông |
| **Đàm thoại** | Đang trong cuộc gọi |
| **Giữ máy** | Đang hold cuộc gọi |
| **Xử lý sau cuộc gọi** | Wrap-up time (10s mặc định, configurable) |
| **Chuyển máy** | Đang transfer cuộc gọi |

### 4.3 Quản lý Ghi âm

#### 4.3.1 Tính năng
- Audio player nhúng trong hồ sơ KH — waveform, Play/Pause, tua 15s, chọn tốc độ (0.5x–2x)
- Download đơn lẻ — tên file: `[ngày]_[agent]_[SĐT]_[call_id].mp3`
- Bulk download theo filter (Manager/QA)
- Tra cứu ghi âm theo: KH / agent / ngày / disposition / campaign
- QA Annotation — chấm điểm, gắn nhận xét tại timestamp cụ thể

#### 4.3.2 Flow phát ghi âm
```
Agent click Play ▶
  → GET /api/v1/call-logs/:id/recording
  → Backend kiểm tra RBAC (agent chỉ nghe mình, leader nghe đội, manager nghe tất cả)
  → Backend fetch file từ http://FUSIONPBX_IP:8088/recordings/...
  → Stream về client
  → Agent nghe trực tiếp trong browser
```

#### 4.3.3 Bảo mật ghi âm
- Signed URL TTL 1 giờ — không expose URL thật của tổng đài
- Log audit toàn bộ: ai nghe, khi nào, file nào
- Phân quyền: Agent chỉ nghe của mình | Leader nghe cả đội | Manager/QA nghe tất cả
- Nginx trên FusionPBX chỉ accept request từ CRM backend IP (internal network)

### 4.4 Giám sát & Monitoring

#### 4.4.1 Giám sát real-time
- Dashboard tổng quan: số agent online, đang gọi, sẵn sàng, nghỉ
- Danh sách cuộc gọi đang diễn ra: agent, KH, thời lượng, trạng thái
- Thống kê cuộc gọi live: inbound/outbound, answered/missed, tổng/trung bình thời lượng

#### 4.4.2 Can thiệp cuộc gọi (Manager/Admin)
- **Listen (Nghe lén)**: Manager nghe cuộc gọi mà agent + KH không biết
- **Whisper (Thì thầm)**: Manager nói cho agent nghe, KH không nghe
- **Barge (Tham gia)**: Manager tham gia cuộc gọi 3 bên

#### 4.4.3 Dashboard KPI

**KPI Telesale:**
| Metric | Mô tả |
|---|---|
| Tổng cuộc gọi | Số cuộc gọi ra trong ngày/tuần/tháng |
| Tỷ lệ tiếp cận | % cuộc gọi KH nghe máy |
| Tỷ lệ chốt | % lead chuyển Won |
| Thời gian đàm thoại TB | Trung bình thời lượng cuộc gọi |
| Thời gian xử lý sau cuộc gọi TB | Wrap-up time trung bình |
| Leads contacted/ngày | Số lead đã liên hệ trong ngày |

**KPI Collection:**
| Metric | Mô tả |
|---|---|
| Tỷ lệ thu hồi | % nợ đã thu / tổng nợ phân bổ |
| Số tiền thu được | Tổng số tiền thu hồi |
| PTP rate | % cam kết trả / tổng cuộc gọi |
| Right Party Contact | % gọi đúng người nợ |
| Cuộc gọi/ngày | Số cuộc gọi collection trong ngày |

### 4.5 AI & Automation

#### 4.5.1 AI Chatbot
- Chatbot trả lời tự động 24/7 trên Zalo OA, Facebook Messenger, Website
- Đào tạo AI theo knowledge base riêng (sản phẩm, chính sách, FAQ)
- Tự thu thập thông tin KH theo kịch bản → điền vào CRM
- Chuyển tiếp cho agent khi cần tư vấn sâu
- Gợi ý sản phẩm (upsell/cross-sell)

#### 4.5.2 AI Callbot
- Gọi sàng lọc lead quy mô lớn — tự động hàng nghìn cuộc gọi
- No-code kéo thả thiết kế kịch bản gọi
- NLP nhận diện giọng nói, phản hồi tự nhiên
- Nhắc lịch hẹn, thanh toán, tái khám tự động
- Chuyển lead qualified cho agent telesale

#### 4.5.3 AI Call Analysis
- **Speech-to-Text**: Transcribe ghi âm cuộc gọi
- **Call Summary**: AI tóm tắt nội dung cuộc gọi tự động
- **Script Compliance**: Phát hiện vi phạm kịch bản gọi điện
- **Sentiment Analysis**: Phân tích cảm xúc KH trong cuộc gọi
- **AI Agent Scoring**: Chấm điểm agent tự động dựa trên cuộc gọi
- **AI Script Suggestion**: Gợi ý script cá nhân hóa theo profile KH

#### 4.5.4 Automation Workflows
- Zalo ZNS / SMS nhắc nợ tự động theo schedule
- Auto-assign lead cho agent theo rule (round-robin, skill-based)
- Auto-escalation nợ quá hạn → chuyển tier
- Trigger notification khi KH hứa trả đến hạn
- No-code workflow builder — kéo thả thiết kế quy trình

### 4.6 Omnichannel

#### 4.6.1 Kênh hỗ trợ
| Kênh | Phase |
|---|---|
| Voice (FusionPBX) | Phase 1 |
| Zalo OA | Phase 2 |
| Facebook Messenger | Phase 3 |
| SMS | Phase 2 |
| Website Live Chat | Phase 3 |
| Email | Phase 3 |

#### 4.6.2 Hợp nhất đa kênh
- 1 hồ sơ KH = tất cả tương tác từ mọi kênh
- Timeline lịch sử tương tác xuyên kênh
- Agent xem unified inbox — tất cả chat/call/message 1 màn hình
- ACD — chia việc thông minh: định tuyến call/chat đến agent phù hợp

### 4.7 Báo cáo & Export

- Báo cáo cuộc gọi: theo ngày/tuần/tháng, theo agent/team/campaign
- Báo cáo Telesale: conversion funnel, lead source, win/loss analysis
- Báo cáo Collection: tỷ lệ thu hồi, aging report, PTP tracking
- Báo cáo SLA: thời gian phản hồi, tỷ lệ missed call
- Export Excel/CSV
- Scheduled report — gửi email báo cáo định kỳ

---

## 5. Tech Stack

| Layer | Công nghệ |
|---|---|
| **Frontend** | React (Vite), TypeScript, Tailwind CSS, shadcn/ui |
| **Backend** | Express.js, TypeScript, Node.js |
| **Database** | PostgreSQL 15+ |
| **ORM** | Prisma |
| **Auth** | JWT (access + refresh tokens) |
| **Realtime** | Socket.IO (CRM ↔ Frontend), ESL (CRM ↔ FreeSWITCH) |
| **WebRTC** | SIP.js + FreeSWITCH WSS (:7443), Nginx WSS proxy (:443 fallback) |
| **ESL Client** | `modesl` (Node.js, EventEmitter-based, connection pooling) |
| **Queue/Cache** | Redis (pub/sub cho ESL events, session cache) |
| **File Storage** | FusionPBX server (recordings), local/S3 (imports/exports) |
| **AI/ML** | OpenAI API / Claude API (transcription, summary, scoring) |
| **SMS/Zalo** | Zalo OA API, SMS gateway (Twilio/local provider) |
| **Deployment** | Docker Compose, self-hosted VPS |
| **Reverse Proxy** | Nginx |
| **TURN/STUN** | coturn (Phase 2, cho WebRTC qua NAT/firewall). REST API credential rotation (TTL 12h) |
| **Monitoring** | PM2, Winston (logging) |

### 5.1 Security Specs
- **CORS**: Whitelist CRM frontend domain only
- **Rate Limiting**: 60 req/min per user (API), 10 req/min per user (Click-to-Call — chống flood FreeSWITCH)
- **Webhook Security**: IP whitelist FusionPBX IP + Basic Auth cho `/webhooks/cdr`
- **Input Sanitization**: Validate + sanitize tất cả input (XSS, SQL injection protection via Prisma parameterized queries)
- **HTTPS**: Bắt buộc production. TLS 1.2+
- **JWT**: Access token TTL 15min, Refresh token TTL 7d, rotation on refresh
- **Password**: bcrypt, min 8 chars, complexity rules

---

## 6. DB Schema — Bảng cốt lõi

### 6.1 users
| Cột | Kiểu | Mô tả |
|---|---|---|
| id | UUID PK | |
| email | VARCHAR UNIQUE | |
| password_hash | VARCHAR | bcrypt |
| full_name | VARCHAR | |
| role | ENUM | admin, manager, qa, leader, agent_telesale, agent_collection |
| team_id | UUID FK | Thuộc team nào |
| sip_extension | VARCHAR | Số máy nhánh FusionPBX |
| call_mode | ENUM | webrtc / softphone |
| status | ENUM | active / inactive |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### 6.2 contacts
| Cột | Kiểu | Mô tả |
|---|---|---|
| id | UUID PK | |
| full_name | VARCHAR | |
| phone | VARCHAR INDEX | SĐT chính (không UNIQUE — KH có thể trùng SĐT) |
| phone_alt | VARCHAR | SĐT phụ |
| email | VARCHAR | |
| id_number | VARCHAR | CMND/CCCD |
| address | TEXT | |
| date_of_birth | DATE | |
| gender | ENUM | male / female / other |
| source | VARCHAR | Nguồn KH |
| tags | JSONB | Nhóm/tags |
| custom_fields | JSONB | Trường mở rộng |
| assigned_to | UUID FK → users | Agent phụ trách |
| created_by | UUID FK → users | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### 6.3 leads
| Cột | Kiểu | Mô tả |
|---|---|---|
| id | UUID PK | |
| contact_id | UUID FK → contacts | |
| campaign_id | UUID FK → campaigns | |
| status | ENUM | new, contacted, qualified, proposal, won, lost |
| score | INT | Lead score (0-100) |
| assigned_to | UUID FK → users | |
| next_follow_up | TIMESTAMP | Lịch gọi lại |
| notes | TEXT | |
| lost_reason | VARCHAR | Lý do mất lead |
| won_amount | DECIMAL | Giá trị chốt |
| ai_summary | TEXT | [AI SLOT] |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### 6.4 debt_cases
| Cột | Kiểu | Mô tả |
|---|---|---|
| id | UUID PK | |
| contact_id | UUID FK → contacts | |
| campaign_id | UUID FK → campaigns | |
| original_amount | DECIMAL | Số nợ gốc |
| outstanding_amount | DECIMAL | Số nợ còn lại |
| dpd | INT | Days Past Due |
| tier | ENUM | current, dpd_1_30, dpd_31_60, dpd_61_90, dpd_90_plus |
| status | ENUM | active, in_progress, promise_to_pay, paid, written_off |
| assigned_to | UUID FK → users | |
| promise_date | DATE | Ngày hẹn trả |
| promise_amount | DECIMAL | Số tiền hứa trả |
| ai_summary | TEXT | [AI SLOT] |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### 6.5 call_logs
| Cột | Kiểu | Mô tả |
|---|---|---|
| id | UUID PK | |
| call_uuid | VARCHAR UNIQUE | FreeSWITCH call UUID |
| contact_id | UUID FK → contacts | NULL nếu chưa match |
| user_id | UUID FK → users | Agent |
| campaign_id | UUID FK → campaigns | |
| direction | ENUM | inbound / outbound |
| caller_number | VARCHAR | |
| destination_number | VARCHAR | |
| start_time | TIMESTAMP | |
| answer_time | TIMESTAMP | NULL nếu missed |
| end_time | TIMESTAMP | |
| duration | INT | Giây |
| billsec | INT | Giây tính cước |
| hangup_cause | VARCHAR | |
| disposition_code_id | UUID FK → disposition_codes.id | |
| recording_path | VARCHAR | Path file ghi âm |
| recording_status | ENUM | available, failed, none |
| notes | TEXT | Ghi chú agent |
| ai_transcript | TEXT | [AI SLOT] |
| ai_summary | TEXT | [AI SLOT] |
| ai_score | JSONB | [AI SLOT] |
| created_at | TIMESTAMP | |

### 6.6 disposition_codes
| Cột | Kiểu | Mô tả |
|---|---|---|
| id | UUID PK | |
| code | VARCHAR UNIQUE | Mã kết quả |
| label | VARCHAR | Tên hiển thị |
| category | ENUM | telesale / collection / both |
| is_final | BOOLEAN | Có phải kết quả cuối? |
| requires_callback | BOOLEAN | Yêu cầu gọi lại? |
| is_active | BOOLEAN | |
| sort_order | INT | |

### 6.7 campaigns
| Cột | Kiểu | Mô tả |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR | |
| type | ENUM | telesale / collection |
| status | ENUM | draft, active, paused, completed |
| start_date | DATE | |
| end_date | DATE | |
| script | TEXT | Script gọi điện |
| created_by | UUID FK → users | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### 6.8 teams (bổ sung)
| Cột | Kiểu | Mô tả |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR | |
| leader_id | UUID FK → users | |
| type | ENUM | telesale / collection |
| is_active | BOOLEAN | |

### 6.9 qa_annotations (bổ sung)
| Cột | Kiểu | Mô tả |
|---|---|---|
| id | UUID PK | |
| call_log_id | UUID FK → call_logs | |
| reviewer_id | UUID FK → users | |
| score | INT | Điểm (0-100) |
| criteria_scores | JSONB | Điểm theo tiêu chí |
| comment | TEXT | Nhận xét |
| timestamp_note | JSONB | Ghi chú tại timestamp cụ thể |
| created_at | TIMESTAMP | |

### 6.10 tickets (Phiếu ghi)
| Cột | Kiểu | Mô tả |
|---|---|---|
| id | UUID PK | |
| contact_id | UUID FK → contacts | |
| call_log_id | UUID FK → call_logs | NULL nếu không liên quan cuộc gọi |
| user_id | UUID FK → users | Agent tạo phiếu |
| category_id | UUID FK → ticket_categories | Danh mục phiếu ghi |
| subject | VARCHAR | Tiêu đề |
| content | TEXT | Nội dung |
| result_code | VARCHAR | Kết quả phản hồi |
| status | ENUM | open, in_progress, resolved, closed |
| priority | ENUM | low, medium, high, urgent |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### 6.11 ticket_categories
| Cột | Kiểu | Mô tả |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR | Tên danh mục (tư vấn, khiếu nại, hỗ trợ...) |
| parent_id | UUID FK → ticket_categories | Danh mục cha (cây phân cấp) |
| is_active | BOOLEAN | |
| sort_order | INT | |

### 6.12 macros (Mẫu trả lời nhanh)
| Cột | Kiểu | Mô tả |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR | Tên macro |
| content | TEXT | Nội dung mẫu |
| category | VARCHAR | Nhóm macro |
| shortcut | VARCHAR | Phím tắt (optional) |
| created_by | UUID FK → users | |
| is_global | BOOLEAN | TRUE = tất cả agent dùng, FALSE = cá nhân |
| is_active | BOOLEAN | |

### 6.13 contact_relationships
| Cột | Kiểu | Mô tả |
|---|---|---|
| id | UUID PK | |
| contact_id | UUID FK → contacts | Contact chính |
| related_contact_id | UUID FK → contacts | Contact liên quan |
| relationship_type | ENUM | spouse, parent, child, sibling, guarantor, colleague, other |
| notes | VARCHAR | |
| created_at | TIMESTAMP | |

### 6.14 audit_logs
| Cột | Kiểu | Mô tả |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users | Ai thực hiện |
| action | VARCHAR | create, update, delete, view, play_recording, download, login, logout |
| entity_type | VARCHAR | contacts, leads, call_logs, recordings... |
| entity_id | UUID | ID đối tượng |
| changes | JSONB | Dữ liệu thay đổi (old/new values) |
| ip_address | VARCHAR | |
| user_agent | VARCHAR | |
| created_at | TIMESTAMP | |

### 6.15 notifications
| Cột | Kiểu | Mô tả |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users | Người nhận |
| type | ENUM | follow_up_reminder, ptp_due, system_alert, campaign_assigned, recording_failed |
| title | VARCHAR | |
| message | TEXT | |
| reference_type | VARCHAR | leads, debt_cases, call_logs... |
| reference_id | UUID | |
| is_read | BOOLEAN | Default FALSE |
| read_at | TIMESTAMP | |
| created_at | TIMESTAMP | |

### 6.16 webhook_logs
| Cột | Kiểu | Mô tả |
|---|---|---|
| id | UUID PK | |
| source | VARCHAR | fusionpbx_cdr, zalo, sms... |
| call_uuid | VARCHAR | FreeSWITCH UUID (nếu có) |
| raw_payload | TEXT | Raw XML/JSON payload |
| status | ENUM | received, processed, failed, unmatched |
| error_message | TEXT | Lỗi nếu processing thất bại |
| processed_at | TIMESTAMP | |
| created_at | TIMESTAMP | |

### 6.17 agent_status_logs
| Cột | Kiểu | Mô tả |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users | |
| status | ENUM | offline, ready, break, ringing, on_call, hold, wrap_up, transfer |
| reason | VARCHAR | Lý do break (lunch, meeting, personal...) |
| started_at | TIMESTAMP | |
| ended_at | TIMESTAMP | NULL nếu đang active |
| duration | INT | Giây (tính khi ended_at set) |

### 6.18 campaign_disposition_codes (bổ sung — disposition per campaign)
| Cột | Kiểu | Mô tả |
|---|---|---|
| campaign_id | UUID FK → campaigns | PK composite |
| disposition_code_id | UUID FK → disposition_codes | PK composite |
| is_active | BOOLEAN | Bật/tắt per campaign |
| sort_order | INT | Thứ tự hiển thị trong campaign |

---

## 7. UI Wireframe — Agent Workspace

```
┌──────────────────────────────────────────────────────────────────────┐
│  🔵 CRM Telesale    [🔍 Search]              Agent: Nguyễn Văn A    │
│  ─────────────────────────────────────────────  ● Sẵn sàng  ▼       │
├────────────┬─────────────────────────────────────────────────────────┤
│            │  ┌─ Contact Info ──────────────────────────────────┐    │
│  SIDEBAR   │  │ Nguyễn Thị B    📞 0901234567   [📞 Gọi]      │    │
│            │  │ CMND: 0123xxx   Email: b@mail.com              │    │
│  📋 Dashboard│  │ Tags: VIP, Telesale   Source: Facebook Ads    │    │
│  👤 Contacts │  └──────────────────────────────────────────────────┘  │
│  📊 Leads   │                                                        │
│  💰 Debt    │  ┌─ Tabs ────────────────────────────────────────┐    │
│  📞 Call Log │  │ [Chi tiết] [Phiếu ghi] [Cuộc gọi] [Timeline]│    │
│  🎯 Campaign│  ├──────────────────────────────────────────────────┤  │
│  📈 Reports │  │                                                │    │
│  ⚙️ Settings│  │  (Tab content hiển thị tại đây)               │    │
│            │  │                                                │    │
│            │  │  - Chi tiết: Thông tin KH đầy đủ               │    │
│            │  │  - Phiếu ghi: Danh sách tickets + tạo mới      │    │
│            │  │  - Cuộc gọi: Lịch sử gọi + player ghi âm      │    │
│            │  │  - Timeline: Toàn bộ tương tác xuyên kênh      │    │
│            │  │                                                │    │
│            │  └──────────────────────────────────────────────────┘  │
│            │                                                        │
├────────────┴─────────────────────────────────────────────────────────┤
│  ┌─ Call Bar (fixed bottom) ───────────────────────────────────────┐ │
│  │ 📞 Đàm thoại: 0901234567 (Nguyễn Thị B)  ⏱ 02:35             │ │
│  │ [⏸ Hold] [🔇 Mute] [↗️ Transfer] [📝 Note] [🔴 Hangup]        │ │
│  │                                                                 │ │
│  │ Script: "Chào anh/chị [Tên], em là [Agent] từ..."             │ │
│  │ Disposition: [▼ Chọn kết quả]  [💾 Lưu]                       │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘

┌─ Inbound Popup (overlay khi có cuộc gọi đến) ─┐
│  📞 Cuộc gọi đến: 0907654321                   │
│  KH: Trần Văn C (nếu match contact)            │
│  Cuộc gọi gần nhất: 20/03/2026 - Hẹn gọi lại  │
│  [✅ Nghe máy]  [❌ Từ chối]                    │
└─────────────────────────────────────────────────┘
```

**Layout principles:**
- Agent workspace = 1 màn hình, không chuyển trang khi gọi
- Call Bar fixed bottom — luôn hiển thị khi đang gọi, ẩn khi không gọi
- Script hiển thị ngay trong Call Bar — agent đọc khi đang nói
- Disposition chọn TRƯỚC khi hangup hoặc trong wrap-up time
- Inbound popup overlay — không che contact info đang xem

---

## 8. API Contract — Endpoints cốt lõi

**Base URL:** `/api/v1` · **Auth:** Bearer JWT · **Format:** JSON

### 7.1 Auth
| Method | Endpoint | Mô tả |
|---|---|---|
| POST | /auth/login | Đăng nhập, trả JWT |
| POST | /auth/refresh | Refresh token |
| POST | /auth/logout | Đăng xuất |
| GET | /auth/me | Thông tin user hiện tại |

### 7.2 Users
| Method | Endpoint | Mô tả |
|---|---|---|
| GET | /users | Danh sách users (Admin) |
| POST | /users | Tạo user mới (Admin) |
| PATCH | /users/:id | Cập nhật user |
| DELETE | /users/:id | Xóa user (Admin) |

### 7.3 Teams
| Method | Endpoint | Mô tả |
|---|---|---|
| GET | /teams | Danh sách teams |
| POST | /teams | Tạo team (Admin) |
| PATCH | /teams/:id | Cập nhật team |
| DELETE | /teams/:id | Xóa team (Admin) |
| GET | /teams/:id/members | Danh sách members |

### 7.4 Contacts
| Method | Endpoint | Mô tả |
|---|---|---|
| GET | /contacts | Danh sách + tìm kiếm |
| POST | /contacts | Tạo contact |
| GET | /contacts/:id | Chi tiết contact |
| PATCH | /contacts/:id | Cập nhật |
| DELETE | /contacts/:id | Xóa (Manager+) |
| POST | /contacts/import | Import Excel/CSV |
| GET | /contacts/export | Export Excel/CSV |
| GET | /contacts/:id/timeline | Lịch sử tương tác |

### 7.5 Leads
| Method | Endpoint | Mô tả |
|---|---|---|
| GET | /leads | Danh sách leads (pagination, filter, sort) |
| POST | /leads | Tạo lead |
| PATCH | /leads/:id | Cập nhật status/score |
| POST | /leads/:id/follow-up | Lên lịch follow-up |

### 7.6 Debt Cases
| Method | Endpoint | Mô tả |
|---|---|---|
| GET | /debt-cases | Danh sách nợ |
| POST | /debt-cases | Tạo/import hồ sơ nợ |
| PATCH | /debt-cases/:id | Cập nhật status |
| POST | /debt-cases/:id/promise | Ghi nhận PTP |

### 7.7 Calls
| Method | Endpoint | Mô tả |
|---|---|---|
| POST | /calls/originate | Click-to-Call (tạo cuộc gọi) |
| POST | /calls/hangup | Kết thúc cuộc gọi |
| POST | /calls/hold | Giữ máy |
| POST | /calls/transfer | Chuyển máy |
| GET | /call-logs | Lịch sử cuộc gọi (pagination, filter) |
| GET | /call-logs/:id | Chi tiết cuộc gọi |
| GET | /call-logs/:id/recording | Stream ghi âm (RBAC) |
| POST | /call-logs/:id/disposition | Ghi disposition |

### 7.8 Agent Status
| Method | Endpoint | Mô tả |
|---|---|---|
| PUT | /agents/status | Đổi trạng thái (ready, break, offline) |
| GET | /agents/status | Trạng thái hiện tại của agent đang login |
| GET | /agents/statuses | Trạng thái tất cả agents (Manager+) |

### 7.9 Tickets (Phiếu ghi)
| Method | Endpoint | Mô tả |
|---|---|---|
| GET | /tickets | Danh sách phiếu ghi |
| POST | /tickets | Tạo phiếu ghi |
| PATCH | /tickets/:id | Cập nhật |
| GET | /contacts/:id/tickets | Phiếu ghi theo contact |

### 7.10 Disposition Codes
| Method | Endpoint | Mô tả |
|---|---|---|
| GET | /disposition-codes | Danh sách (filter by category/campaign) |
| POST | /disposition-codes | Tạo mới (Admin/Manager) |
| PATCH | /disposition-codes/:id | Cập nhật |
| DELETE | /disposition-codes/:id | Xóa |

### 7.11 QA Annotations
| Method | Endpoint | Mô tả |
|---|---|---|
| POST | /call-logs/:id/qa | Tạo QA annotation |
| PATCH | /qa-annotations/:id | Cập nhật |
| GET | /qa-annotations | Danh sách (filter by agent/campaign/score) |

### 7.12 Notifications
| Method | Endpoint | Mô tả |
|---|---|---|
| GET | /notifications | Danh sách notifications |
| PATCH | /notifications/:id/read | Đánh dấu đã đọc |
| PATCH | /notifications/read-all | Đánh dấu tất cả đã đọc |

### 7.13 Macros
| Method | Endpoint | Mô tả |
|---|---|---|
| GET | /macros | Danh sách mẫu trả lời nhanh |
| POST | /macros | Tạo macro |
| PATCH | /macros/:id | Cập nhật |
| DELETE | /macros/:id | Xóa |

### 7.14 Campaigns
| Method | Endpoint | Mô tả |
|---|---|---|
| GET | /campaigns | Danh sách campaigns |
| POST | /campaigns | Tạo campaign |
| PATCH | /campaigns/:id | Cập nhật |
| POST | /campaigns/:id/assign | Phân bổ KH cho agents |

### 7.15 Dashboard & Reports
| Method | Endpoint | Mô tả |
|---|---|---|
| GET | /dashboard/overview | Tổng quan real-time |
| GET | /dashboard/agents | Trạng thái agents |
| GET | /reports/calls | Báo cáo cuộc gọi |
| GET | /reports/telesale | Báo cáo Telesale |
| GET | /reports/collection | Báo cáo Collection |

### 7.16 Webhook (FusionPBX → CRM)
| Method | Endpoint | Mô tả |
|---|---|---|
| POST | /webhooks/cdr | Nhận xml_cdr từ FusionPBX (IP whitelist + Basic Auth) |

### 7.17 Pagination Convention
Tất cả list endpoints hỗ trợ:
- `?page=1&limit=20` — pagination
- `?sort=created_at&order=desc` — sorting
- `?search=keyword` — full-text search
- `?filter[field]=value` — field-level filtering
- Response format: `{ data: [...], meta: { total, page, limit, totalPages } }`

---

## 8. VoIP Event Flow — FusionPBX

### 8.1 Cấu hình xml_cdr HTTP POST
File: `/etc/freeswitch/autoload_configs/xml_cdr.conf.xml`
```xml
<param name="url" value="http://CRM_IP:PORT/api/v1/webhooks/cdr"/>
<param name="encode" value="true"/>
<param name="retries" value="2"/>
<param name="delay" value="5000"/>
<param name="log-http-and-disk" value="true"/>
<param name="auth-scheme" value="basic"/>
<param name="cred" value="crm_user:crm_secret"/>
```

### 8.2 Cấu hình ESL
File: `/etc/freeswitch/autoload_configs/event_socket.conf.xml`
```xml
<param name="listen-ip" value="CRM_SERVER_IP"/>
<param name="listen-port" value="8021"/>
<param name="password" value="strong-esl-password"/>
```

### 8.3 Cấu hình WebRTC (SIP Profile)
File: `/etc/freeswitch/sip_profiles/internal.xml`
```xml
<param name="ws-binding" value=":5066"/>
<param name="wss-binding" value=":7443"/>
```
**Yêu cầu:** SSL cert hợp lệ (Let's Encrypt hoặc CA-signed).

### 8.3.1 Nginx WSS Reverse Proxy (Fallback khi port 7443 bị chặn)
```nginx
# Proxy WSS qua port 443 cho corporate firewall
location /wss {
    proxy_pass https://FUSIONPBX_IP:7443;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400;
}
```

### 8.4 Nginx serve recordings (FusionPBX server)
```nginx
server {
    listen 8088;
    allow CRM_SERVER_IP;
    deny all;
    location /recordings/ {
        alias /var/lib/freeswitch/recordings/;
        add_header X-Content-Type-Options nosniff;
    }
}
```

### 8.5 Error Handling
| Tình huống | Xử lý |
|---|---|
| xml_cdr POST thất bại | CRM fallback query PostgreSQL FusionPBX |
| Map phone → contact thất bại | Tạo `unmatched_calls` log, KHÔNG drop |
| recording_path rỗng | Set `recording_status = 'failed'`, alert Manager |
| Basic Auth sai | Return 401, log security warning, alert Admin |
| Nginx không truy cập được | Fallback fetch qua PostgreSQL record_path |
| ESL disconnect | Auto-reconnect exponential backoff (1s → 2s → 4s → 30s max) |
| WebRTC getUserMedia bị chặn | Hiển thị hướng dẫn cấp quyền mic, chặn click-to-call |
| WebRTC call fail mid-call | Notify agent, log error, KHÔNG auto-fallback softphone (tránh duplicate call) |
| WSS 7443 bị chặn (firewall) | Fallback WSS qua Nginx reverse proxy port 443 |
| coturn TURN credential hết hạn | REST API refresh credential mỗi 12h, SIP.js auto-refresh |

### 8.6 Fallback — Query PostgreSQL FusionPBX
```
postgresql://fusionpbx:password@FUSIONPBX_IP:5432/fusionpbx
```
Table: `v_xml_cdr` — dùng khi xml_cdr HTTP POST thất bại hoặc sync CDR cũ.

---

## 9. Phân kỳ phát triển

### Phase 1 — MVP (6–8 tuần) 🔴 Must-have
- [ ] Auth & RBAC (6 roles)
- [ ] CRUD Contacts, Leads, Debt Cases
- [ ] Click-to-Call — **Softphone mode only** (ESL originate)
- [ ] ESL integration — real-time call events
- [ ] xml_cdr webhook — nhận CDR tự động
- [ ] Call logs & Recording playback (audio player + RBAC)
- [ ] Disposition codes (global)
- [ ] Agent status management
- [ ] Phiếu ghi (Tickets) — CRUD + liên kết contact/call
- [ ] Basic dashboard (cuộc gọi, trạng thái agent)
- [ ] Import/Export contacts qua Excel
- [ ] Notifications (follow-up reminders, system alerts)
- [ ] Audit logging

**Definition of Done:** Agent click-to-call (softphone) thành công, CDR tự động vào CRM, nghe ghi âm OK, phiếu ghi hoạt động.

### Phase 2 — Growth (6–8 tuần) 🟡 Should-have
- [ ] **WebRTC in-browser calling** (SIP.js + TURN/STUN)
- [ ] Campaign management đầy đủ (+ campaign-level dispositions)
- [ ] Lead scoring
- [ ] Follow-up scheduler + reminders
- [ ] Manager dashboard đầy đủ (KPI charts)
- [ ] Giám sát cuộc gọi live (Listen/Whisper/Barge)
- [ ] QA Annotation — chấm điểm ghi âm
- [ ] Macros/Quick Reply templates
- [ ] Báo cáo Telesale + Collection chi tiết
- [ ] Export Excel báo cáo
- [ ] Zalo OA integration + ZNS nhắc nợ
- [ ] SMS automation

**Definition of Done:** WebRTC calling ổn định, Manager dashboard live, QA workflow, Zalo/SMS gửi OK, report export chạy ổn.

### Phase 3 — AI & Automation (8–12 tuần) 🟢 Nice-to-have
- [ ] AI Speech-to-Text (transcribe ghi âm)
- [ ] AI Call Summary tự động
- [ ] AI Script Suggestion cá nhân hóa
- [ ] AI Agent Scoring
- [ ] AI Script Compliance detection
- [ ] AI Chatbot (Zalo, Facebook, Website)
- [ ] AI Callbot — gọi sàng lọc tự động
- [ ] No-code Automation Workflow Builder
- [ ] Facebook Messenger integration
- [ ] Website Live Chat
- [ ] Scheduled reports (email định kỳ)

**Definition of Done:** AI transcribe + summary chạy, Chatbot/Callbot hoạt động, automation workflow builder MVP.

---

## 10. Yêu cầu phi chức năng

| Yêu cầu | Tiêu chí |
|---|---|
| **Performance** | API response < 200ms (p95), WebSocket latency < 100ms |
| **Scalability** | Hỗ trợ 100 agents đồng thời, 10,000 contacts, 50,000 call logs |
| **Availability** | 99.5% uptime |
| **Security** | HTTPS, JWT rotation, RBAC, audit logging, input validation |
| **Data Protection** | Ghi âm mã hóa at-rest, signed URL, audit trail |
| **Browser Support** | Chrome 90+, Firefox 88+, Edge 90+ (WebRTC) |
| **Mobile** | Responsive web (không native app) |
| **Backup** | PostgreSQL daily backup, recordings weekly backup |
| **Recording Retention** | Tối thiểu 2 năm (yêu cầu ngành tài chính), archive to S3 sau 6 tháng |

---

## 11. Ngoài phạm vi (Out of Scope)

- ❌ Tự build tổng đài VoIP (tích hợp FusionPBX có sẵn)
- ❌ Auto-dialer / Power dialer / Predictive dialer
- ❌ App mobile native (iOS/Android)
- ❌ Tích hợp trực tiếp core banking (import thủ công qua file)
- ❌ Multi-tenant (1 instance = 1 doanh nghiệp)
- ❌ Video call
- ❌ IVR builder (dùng IVR có sẵn của FusionPBX)

---

## 12. Rủi ro & Giảm thiểu

| Rủi ro | Mức độ | Giảm thiểu |
|---|---|---|
| WebRTC không ổn định qua NAT/firewall | Cao | Hỗ trợ fallback softphone mode; TURN server |
| FusionPBX version không tương thích | Trung bình | Lock version FreeSWITCH 1.10.x, test kỹ |
| AI API costs cao khi scale | Trung bình | Batch processing, cache results, set quotas |
| ESL disconnect mất events | Cao | Auto-reconnect + xml_cdr fallback + DB sync |
| SSL cert hết hạn → WebRTC chết | Cao | Auto-renew Let's Encrypt, monitoring alert |
| Ghi âm dung lượng lớn | Trung bình | Compress MP3, retention 2 năm, archive to S3 sau 6 tháng |
| WSS 7443 bị corporate firewall chặn | Cao | Nginx reverse proxy WSS qua port 443 fallback |
| Browser chặn mic (getUserMedia) | Trung bình | Detect + hiển thị hướng dẫn, chặn click-to-call nếu chưa cấp quyền |

---

## 13. Success Metrics

| Metric | Target Phase 1 | Target Phase 2 |
|---|---|---|
| Agent adoption rate | 80% agents dùng CRM daily | 95% |
| Click-to-Call success rate | > 95% | > 98% |
| Thời gian trung bình xử lý 1 lead | Giảm 30% vs manual | Giảm 50% |
| Tỷ lệ thu hồi nợ | Tăng 10% | Tăng 20% |
| Manager time on reporting | Giảm 50% | Giảm 70% |
| Call recording access time | < 3 click | < 2 click |

---

*— Hết PRD · CRM Omnichannel Telesale & Collection · v2.0 —*
