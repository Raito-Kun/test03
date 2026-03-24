# PRD Visual Diagrams — CRM Omnichannel Telesale & Collection

> Auto-generated from PRD v2.0 · Mermaid format

---

## 1. System Architecture Overview

```mermaid
graph TB
    subgraph Frontend["CRM Frontend (React + Vite + TypeScript)"]
        UI[Agent Workspace UI]
        CTC[Click-to-Call UI]
        CC[Call Controls]
        WR[WebRTC Softphone<br/>SIP.js / JsSIP]
        DASH[Dashboard / KPI]
    end

    subgraph Backend["CRM Backend (Express.js + TypeScript)"]
        API[REST API<br/>/api/v1/*]
        CDR_WH[CDR Webhook<br/>Receiver]
        REC_PROXY[Recording Proxy<br/>RBAC + Stream]
        ESL_D[ESL Daemon<br/>Node.js]
        WS[Socket.IO<br/>WebSocket Server]
    end

    subgraph Storage["Data Layer"]
        PG[(PostgreSQL 15+<br/>Prisma ORM)]
        REDIS[(Redis<br/>Pub/Sub + Cache)]
    end

    subgraph PBX["FusionPBX / FreeSWITCH 1.10.x"]
        ESL_S[ESL Server<br/>:8021]
        SIP[SIP/WSS<br/>:7443]
        CDR_M[xml_cdr Module]
        REC_S[Recordings<br/>/var/lib/freeswitch/recordings/]
        PG_PBX[(PostgreSQL<br/>v_xml_cdr)]
        NGINX_PBX[Nginx :8088<br/>Recording Server]
    end

    subgraph External["External Services"]
        TURN[coTURN<br/>STUN/TURN]
        ZALO[Zalo OA API]
        SMS[SMS Gateway]
        AI[AI API<br/>OpenAI / Claude]
    end

    UI -->|HTTP/REST| API
    UI -->|WebSocket| WS
    WR -->|WSS :7443| SIP
    WR -->|STUN/TURN| TURN

    API --> PG
    API --> REDIS
    WS --> REDIS

    ESL_D -->|TCP :8021| ESL_S
    CDR_M -->|HTTP POST| CDR_WH
    REC_PROXY -->|HTTP :8088| NGINX_PBX
    NGINX_PBX --> REC_S

    API -->|Fallback CDR query| PG_PBX

    API --> ZALO
    API --> SMS
    API --> AI

    style Frontend fill:#e1f5fe,stroke:#0288d1
    style Backend fill:#fff3e0,stroke:#f57c00
    style Storage fill:#e8f5e9,stroke:#388e3c
    style PBX fill:#fce4ec,stroke:#c62828
    style External fill:#f3e5f5,stroke:#7b1fa2
```

---

## 2. Click-to-Call Flow

```mermaid
sequenceDiagram
    participant A as Agent Browser
    participant FE as CRM Frontend
    participant BE as CRM Backend
    participant ESL as ESL Daemon
    participant FS as FreeSWITCH
    participant SP as Softphone/WebRTC
    participant KH as Customer Phone

    A->>FE: Click phone number
    FE->>BE: POST /api/v1/calls/originate
    BE->>BE: Validate: logged in? ready? valid phone?

    alt Softphone Mode
        BE->>ESL: bgapi originate
        ESL->>FS: originate command
        FS->>SP: SIP INVITE → Softphone rings
        SP->>FS: Agent picks up
        FS->>KH: Bridge call to customer
    else WebRTC Mode
        BE->>ESL: bgapi originate
        ESL->>FS: originate command
        FS->>A: SIP INVITE via WSS → Browser rings
        A->>FS: Agent picks up in browser
        FS->>KH: Bridge call to customer
    end

    Note over FS,BE: FreeSWITCH emits ESL events

    FS-->>ESL: CHANNEL_CREATE
    ESL-->>BE: Event: call initiated
    BE-->>FE: WebSocket: call started
    FE-->>A: UI → "Đổ chuông"

    FS-->>ESL: CHANNEL_ANSWER
    ESL-->>BE: Event: answered
    BE-->>FE: WebSocket: start timer
    FE-->>A: UI → "Đàm thoại ⏱"

    FS-->>ESL: CHANNEL_HANGUP_COMPLETE
    ESL-->>BE: Event: call ended
    BE-->>FE: WebSocket: show disposition form
    FE-->>A: UI → "Wrap-up"

    FS->>BE: xml_cdr HTTP POST (CDR data)
    BE->>BE: Parse XML → Save call_log → Link recording
```

---

## 3. Inbound Call Flow

```mermaid
sequenceDiagram
    participant KH as Customer
    participant FS as FreeSWITCH
    participant ESL as ESL Daemon
    participant BE as CRM Backend
    participant WS as Socket.IO
    participant FE as Agent Browser

    KH->>FS: Inbound call
    FS-->>ESL: CHANNEL_CREATE (direction=inbound)
    ESL-->>BE: Inbound call event
    BE->>BE: Match phone → contact
    BE->>WS: Push to assigned agent

    WS->>FE: Popup notification

    Note over FE: Popup shows:<br/>Phone, Name, Last interaction

    alt Agent accepts
        FE->>FS: Accept (WebRTC) or pickup (Softphone)
        FS-->>ESL: CHANNEL_ANSWER
        ESL-->>BE: Call answered
        BE-->>FE: Auto-open contact detail
    else Agent rejects/misses
        FS-->>ESL: CHANNEL_HANGUP (missed)
        ESL-->>BE: Missed call
        BE->>BE: Log missed call
    end
```

---

## 4. Agent State Machine

```mermaid
stateDiagram-v2
    [*] --> Offline: Login

    Offline --> Ready: Go online
    Ready --> Break: Take break
    Break --> Ready: Resume

    Ready --> Ringing: Inbound/Outbound call
    Ringing --> OnCall: Answer
    Ringing --> Ready: Missed/Rejected

    OnCall --> Hold: Hold
    Hold --> OnCall: Unhold
    OnCall --> Transfer: Transfer initiated
    Transfer --> Ready: Transfer complete
    OnCall --> WrapUp: Hangup

    WrapUp --> Ready: Disposition saved<br/>(or timeout)

    Ready --> Offline: Logout
    Break --> Offline: Logout
```

---

## 5. Database ER Diagram

```mermaid
erDiagram
    teams ||--o{ users : "has members"
    teams {
        uuid id PK
        varchar name
        uuid leader_id FK
        enum type "telesale | collection"
        boolean is_active
    }

    users ||--o{ contacts : "assigned_to"
    users ||--o{ leads : "assigned_to"
    users ||--o{ debt_cases : "assigned_to"
    users ||--o{ call_logs : "makes calls"
    users ||--o{ tickets : "creates"
    users ||--o{ qa_annotations : "reviews"
    users ||--o{ agent_status_logs : "tracks status"
    users ||--o{ audit_logs : "performs actions"
    users ||--o{ notifications : "receives"
    users {
        uuid id PK
        varchar email UK
        varchar password_hash
        varchar full_name
        enum role "admin|manager|qa|leader|agent_ts|agent_col"
        uuid team_id FK
        varchar sip_extension
        enum call_mode "webrtc | softphone"
        enum status "active | inactive"
    }

    contacts ||--o{ leads : "has leads"
    contacts ||--o{ debt_cases : "has debts"
    contacts ||--o{ call_logs : "call history"
    contacts ||--o{ tickets : "has tickets"
    contacts ||--o{ contact_relationships : "related to"
    contacts {
        uuid id PK
        varchar full_name
        varchar phone
        varchar phone_alt
        varchar email
        varchar id_number
        date date_of_birth
        enum gender
        varchar source
        jsonb tags
        jsonb custom_fields
        uuid assigned_to FK
        uuid created_by FK
    }

    campaigns ||--o{ leads : "contains"
    campaigns ||--o{ debt_cases : "contains"
    campaigns ||--o{ call_logs : "tracks"
    campaigns ||--o{ campaign_disposition_codes : "uses"
    campaigns {
        uuid id PK
        varchar name
        enum type "telesale | collection"
        enum status "draft|active|paused|completed"
        date start_date
        date end_date
        text script
        uuid created_by FK
    }

    leads {
        uuid id PK
        uuid contact_id FK
        uuid campaign_id FK
        enum status "new|contacted|qualified|proposal|won|lost"
        int score
        uuid assigned_to FK
        timestamp next_follow_up
        text notes
        varchar lost_reason
        decimal won_amount
        text ai_summary
    }

    debt_cases {
        uuid id PK
        uuid contact_id FK
        uuid campaign_id FK
        decimal original_amount
        decimal outstanding_amount
        int dpd
        enum tier "current|dpd_1_30|dpd_31_60|dpd_61_90|dpd_90_plus"
        enum status "active|in_progress|promise_to_pay|paid|written_off"
        uuid assigned_to FK
        date promise_date
        decimal promise_amount
        text ai_summary
    }

    call_logs ||--o{ qa_annotations : "reviewed by"
    call_logs ||--o{ tickets : "linked to"
    call_logs {
        uuid id PK
        varchar call_uuid UK
        uuid contact_id FK
        uuid user_id FK
        uuid campaign_id FK
        enum direction "inbound | outbound"
        varchar caller_number
        varchar destination_number
        timestamp start_time
        timestamp answer_time
        timestamp end_time
        int duration
        int billsec
        varchar hangup_cause
        uuid disposition_code_id FK
        varchar recording_path
        enum recording_status "available|failed|none"
        text ai_transcript
        text ai_summary
        jsonb ai_score
    }

    disposition_codes ||--o{ call_logs : "categorizes"
    disposition_codes ||--o{ campaign_disposition_codes : "used in"
    disposition_codes {
        uuid id PK
        varchar code UK
        varchar label
        enum category "telesale|collection|both"
        boolean is_final
        boolean requires_callback
        boolean is_active
        int sort_order
    }

    tickets {
        uuid id PK
        uuid contact_id FK
        uuid call_log_id FK
        uuid user_id FK
        uuid category_id FK
        varchar subject
        text content
        varchar result_code
        enum status "open|in_progress|resolved|closed"
        enum priority "low|medium|high|urgent"
    }

    ticket_categories ||--o{ tickets : "categorizes"
    ticket_categories {
        uuid id PK
        varchar name
        uuid parent_id FK
        boolean is_active
        int sort_order
    }

    qa_annotations {
        uuid id PK
        uuid call_log_id FK
        uuid reviewer_id FK
        int score
        jsonb criteria_scores
        text comment
        jsonb timestamp_note
    }

    macros {
        uuid id PK
        varchar name
        text content
        varchar category
        varchar shortcut
        uuid created_by FK
        boolean is_global
        boolean is_active
    }

    contact_relationships {
        uuid id PK
        uuid contact_id FK
        uuid related_contact_id FK
        enum relationship_type
        varchar notes
    }

    notifications {
        uuid id PK
        uuid user_id FK
        enum type
        varchar title
        text message
        varchar reference_type
        uuid reference_id
        boolean is_read
    }

    audit_logs {
        uuid id PK
        uuid user_id FK
        varchar action
        varchar entity_type
        uuid entity_id
        jsonb changes
        varchar ip_address
    }

    agent_status_logs {
        uuid id PK
        uuid user_id FK
        enum status "offline|ready|break|ringing|on_call|hold|wrap_up|transfer"
        varchar reason
        timestamp started_at
        timestamp ended_at
        int duration
    }

    webhook_logs {
        uuid id PK
        varchar source
        varchar call_uuid
        text raw_payload
        enum status "received|processed|failed|unmatched"
        text error_message
    }

    campaign_disposition_codes {
        uuid campaign_id PK
        uuid disposition_code_id PK
        boolean is_active
        int sort_order
    }
```

---

## 6. Telesale Lead Pipeline

```mermaid
graph LR
    NEW[New<br/>Lead imported] --> CONTACTED[Contacted<br/>Agent called]
    CONTACTED --> QUALIFIED[Qualified<br/>Interested]
    CONTACTED --> LOST1[Lost<br/>No interest]
    QUALIFIED --> PROPOSAL[Proposal<br/>Sent offer]
    QUALIFIED --> LOST2[Lost<br/>Not qualified]
    PROPOSAL --> WON[Won ✅<br/>Deal closed]
    PROPOSAL --> LOST3[Lost<br/>Rejected]

    style NEW fill:#e3f2fd,stroke:#1565c0
    style CONTACTED fill:#fff9c4,stroke:#f9a825
    style QUALIFIED fill:#fff3e0,stroke:#ef6c00
    style PROPOSAL fill:#e8f5e9,stroke:#2e7d32
    style WON fill:#c8e6c9,stroke:#1b5e20,stroke-width:3px
    style LOST1 fill:#ffcdd2,stroke:#c62828
    style LOST2 fill:#ffcdd2,stroke:#c62828
    style LOST3 fill:#ffcdd2,stroke:#c62828
```

---

## 7. Collection Debt Lifecycle

```mermaid
graph TD
    IMPORT[Import from<br/>Core Banking] --> ACTIVE[Active<br/>New debt case]

    ACTIVE --> IP[In Progress<br/>Agent working]
    IP --> PTP[Promise to Pay<br/>Customer committed]
    IP --> WO1[Written Off ❌]

    PTP -->|Paid on time| PAID[Paid ✅]
    PTP -->|Missed promise| IP

    subgraph Escalation["Auto-Escalation by DPD"]
        direction LR
        T1[Current] --> T2[DPD 1-30]
        T2 --> T3[DPD 31-60]
        T3 --> T4[DPD 61-90]
        T4 --> T5[DPD 90+]
    end

    ACTIVE -.->|DPD tracking| Escalation

    style PAID fill:#c8e6c9,stroke:#1b5e20,stroke-width:3px
    style WO1 fill:#ffcdd2,stroke:#c62828
    style PTP fill:#fff9c4,stroke:#f9a825
```

---

## 8. RBAC Access Matrix

```mermaid
graph TB
    subgraph Roles
        ADMIN[Admin<br/>Full access]
        MGR[Manager<br/>All data + reports]
        QA_R[QA<br/>All recordings + scoring]
        LEAD[Team Leader<br/>Team data only]
        ATS[Agent Telesale<br/>Own data only]
        ACOL[Agent Collection<br/>Own data only]
    end

    subgraph Permissions
        USERS[Manage Users]
        CONTACTS[View All Contacts]
        CAMPAIGNS[Manage Campaigns]
        CALLS[Click-to-Call]
        REC_ALL[Recordings: ALL]
        REC_TEAM[Recordings: Team]
        REC_SELF[Recordings: Self]
        MONITOR[Live Monitoring]
        BARGE[Barge/Whisper]
        QA_ANN[QA Annotation]
        EXPORT[Export Reports]
        AI_CFG[AI/Automation Config]
    end

    ADMIN --> USERS
    ADMIN --> CONTACTS
    ADMIN --> CAMPAIGNS
    ADMIN --> CALLS
    ADMIN --> REC_ALL
    ADMIN --> MONITOR
    ADMIN --> BARGE
    ADMIN --> QA_ANN
    ADMIN --> EXPORT
    ADMIN --> AI_CFG

    MGR --> CONTACTS
    MGR --> CAMPAIGNS
    MGR --> CALLS
    MGR --> REC_ALL
    MGR --> MONITOR
    MGR --> BARGE
    MGR --> QA_ANN
    MGR --> EXPORT
    MGR --> AI_CFG

    QA_R --> CONTACTS
    QA_R --> REC_ALL
    QA_R --> QA_ANN
    QA_R --> EXPORT

    LEAD --> REC_TEAM
    LEAD --> CALLS
    LEAD --> QA_ANN
    LEAD --> EXPORT

    ATS --> REC_SELF
    ATS --> CALLS

    ACOL --> REC_SELF
    ACOL --> CALLS
```

---

## 9. Phased Delivery Roadmap

```mermaid
gantt
    title CRM Omnichannel — Phased Development
    dateFormat YYYY-MM-DD
    axisFormat %b %d

    section Phase 1 — MVP (6-8w)
    Auth & RBAC               :p1a, 2026-04-01, 1w
    CRUD Contacts/Leads/Debt  :p1b, after p1a, 2w
    Click-to-Call Softphone   :p1c, after p1a, 2w
    ESL Integration           :p1d, after p1c, 1w
    xml_cdr Webhook + CDR     :p1e, after p1d, 1w
    Call Logs & Recording     :p1f, after p1e, 1w
    Tickets & Disposition     :p1g, after p1b, 1w
    Agent Status & Dashboard  :p1h, after p1f, 1w
    Import/Export + Notif     :p1i, after p1g, 1w
    Audit Logging + QA        :p1j, after p1h, 1w

    section Phase 2 — Growth (6-8w)
    WebRTC In-Browser         :p2a, after p1j, 2w
    Campaign Management       :p2b, after p1j, 2w
    Lead Scoring & Follow-up  :p2c, after p2b, 1w
    Manager Dashboard + KPI   :p2d, after p2a, 2w
    Listen/Whisper/Barge      :p2e, after p2a, 1w
    QA Annotation System      :p2f, after p2e, 1w
    Macros + Reports Export   :p2g, after p2c, 1w
    Zalo OA + SMS Automation  :p2h, after p2d, 2w

    section Phase 3 — AI (8-12w)
    AI Speech-to-Text         :p3a, after p2h, 2w
    AI Call Summary + Score   :p3b, after p3a, 2w
    AI Script Suggestion      :p3c, after p3b, 2w
    AI Chatbot                :p3d, after p3a, 3w
    AI Callbot                :p3e, after p3d, 3w
    Workflow Builder          :p3f, after p3c, 2w
    FB Messenger + Live Chat  :p3g, after p3e, 2w
```

---

## 10. CDR Data Flow (Recommended)

```mermaid
flowchart LR
    FS[FreeSWITCH] -->|ESL Events<br/>Real-time| ESL[ESL Daemon<br/>Node.js]
    FS -->|xml_cdr POST<br/>After hangup| WH[Webhook<br/>Receiver]
    FS -->|Stores CDR| PG_FS[(FusionPBX<br/>PostgreSQL<br/>v_xml_cdr)]

    ESL -->|Publish| REDIS[(Redis<br/>Pub/Sub)]
    REDIS -->|Subscribe| WS[Socket.IO]
    WS -->|Push| FE[Agent Browser]

    WH -->|Parse + Save| PG_CRM[(CRM<br/>PostgreSQL<br/>call_logs)]

    PG_FS -.->|Fallback<br/>query| PG_CRM

    subgraph Primary["Real-time Path"]
        ESL
        REDIS
        WS
    end

    subgraph Secondary["CDR Persistence"]
        WH
        PG_CRM
    end

    subgraph Fallback["Fallback Path"]
        PG_FS
    end

    style Primary fill:#e8f5e9,stroke:#2e7d32
    style Secondary fill:#fff3e0,stroke:#f57c00
    style Fallback fill:#ffebee,stroke:#c62828
```

---

## 11. Recording Access Flow

```mermaid
sequenceDiagram
    participant A as Agent
    participant FE as Frontend
    participant BE as Backend
    participant NG as Nginx<br/>(FusionPBX :8088)
    participant FS as FusionPBX<br/>File System

    A->>FE: Click Play ▶
    FE->>BE: GET /api/v1/call-logs/:id/recording

    BE->>BE: Check RBAC<br/>Agent=own, Leader=team, Manager=all

    alt Authorized
        BE->>NG: GET http://FUSIONPBX_IP:8088/recordings/...
        NG->>NG: Check: request from CRM IP?
        NG->>FS: Read file
        FS-->>NG: Audio bytes
        NG-->>BE: Stream response
        BE-->>FE: Stream audio
        FE-->>A: Waveform player
        BE->>BE: Audit log: who, when, which file
    else Unauthorized
        BE-->>FE: 403 Forbidden
    end
```

---

## 12. Omnichannel Integration (Phase 2-3)

```mermaid
graph TB
    subgraph Channels["Customer Channels"]
        VOICE[📞 Voice<br/>FusionPBX]
        ZALO[💬 Zalo OA<br/>Phase 2]
        SMS_CH[📱 SMS<br/>Phase 2]
        FB[💬 Facebook<br/>Phase 3]
        WEB[🌐 Website Chat<br/>Phase 3]
        EMAIL[📧 Email<br/>Phase 3]
    end

    subgraph CRM["CRM Unified Layer"]
        ROUTER[Channel Router<br/>ACD]
        INBOX[Unified Inbox]
        TIMELINE[Contact Timeline<br/>Cross-channel]
        CONTACT[Contact Profile<br/>Single view]
    end

    subgraph Agents["Agent Workspace"]
        AW[Agent UI<br/>All channels in 1 screen]
    end

    VOICE --> ROUTER
    ZALO --> ROUTER
    SMS_CH --> ROUTER
    FB --> ROUTER
    WEB --> ROUTER
    EMAIL --> ROUTER

    ROUTER --> INBOX
    INBOX --> AW
    ROUTER --> TIMELINE
    TIMELINE --> CONTACT
    CONTACT --> AW

    style Channels fill:#e3f2fd,stroke:#1565c0
    style CRM fill:#fff3e0,stroke:#ef6c00
    style Agents fill:#e8f5e9,stroke:#2e7d32
```

---

## 13. Listen / Whisper / Barge (Monitoring)

```mermaid
sequenceDiagram
    participant MGR as Manager
    participant BE as CRM Backend
    participant ESL as ESL Daemon
    participant FS as FreeSWITCH
    participant AGT as Agent
    participant KH as Customer

    Note over AGT,KH: Active call in progress

    MGR->>BE: Select call to monitor
    BE->>BE: Check role: Manager/Admin only

    alt Listen (Spy)
        BE->>ESL: eavesdrop <call_uuid>
        ESL->>FS: Eavesdrop channel
        FS-->>MGR: Audio stream (listen only)
        Note over MGR: Agent & KH don't know
    else Whisper
        BE->>ESL: eavesdrop <call_uuid> + whisper
        ESL->>FS: Whisper channel
        FS-->>MGR: Audio stream
        FS-->>AGT: Manager audio (KH can't hear)
    else Barge
        BE->>ESL: three_way <call_uuid>
        ESL->>FS: 3-way conference
        FS-->>MGR: Full audio
        FS-->>AGT: Full audio
        FS-->>KH: Full audio
        Note over MGR,KH: 3-way conversation
    end
```

---

*Generated from PRD v2.0 — CRM Omnichannel Telesale & Collection*
