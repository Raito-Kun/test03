# CRM Omnichannel — Workflow Diagrams

## 1. Overall System Architecture

```mermaid
graph TB
    subgraph Client["🖥️ Client Layer"]
        Browser["Browser (React SPA)"]
        SIPClient["SIP Client / Eyebeam"]
    end

    subgraph Frontend["Frontend Container (Nginx)"]
        Nginx["Nginx :443"]
        ReactApp["React + Vite + Tailwind"]
    end

    subgraph Backend["Backend Container (Node.js)"]
        Express["Express.js :4000"]
        SocketIO["Socket.IO (WebSocket)"]
        ESLDaemon["ESL Daemon"]
        Jobs["Background Jobs"]
    end

    subgraph Data["Data Layer"]
        Postgres[("PostgreSQL 15\n17 Tables")]
        Redis[("Redis\nCache + Sessions")]
    end

    subgraph VoIP["VoIP (Private Network)"]
        FusionPBX["FusionPBX 5.5.7\n10.10.101.189"]
        FreeSWITCH["FreeSWITCH 1.10.x"]
        Recordings[("Recording Storage\n:8088")]
    end

    Browser -->|HTTPS| Nginx
    Nginx -->|Proxy /api/v1/*| Express
    Nginx -->|Static Assets| ReactApp
    Browser <-->|WebSocket| SocketIO

    Express --> Postgres
    Express --> Redis
    ESLDaemon <-->|ESL :8021| FreeSWITCH
    Jobs --> Postgres

    SIPClient <-->|SIP/RTP| FreeSWITCH
    FreeSWITCH -->|CDR Webhook POST| Express
    FreeSWITCH --> Recordings
    Express -->|Recording Proxy| Recordings

    SocketIO -.->|Real-time Events| Browser
    Jobs -.->|Notifications| SocketIO
```

## 2. User Role Hierarchy & Data Access

```mermaid
graph TD
    SA["🔑 Super Admin\nFull system access\nAll data, all settings"]
    AD["⚙️ Admin\nSystem configuration\nAll data"]
    MG["📊 Manager\nTeam management\nAll data"]
    QA["🔍 QA\nQuality assurance\nAll call logs & reports"]
    LD["👥 Leader\nTeam oversight\nTeam data only"]
    AT["📞 Agent Telesale\nSales operations\nOwn data only"]
    AC["💰 Agent Collection\nDebt recovery\nOwn data only"]

    SA --> AD
    AD --> MG
    MG --> QA
    MG --> LD
    LD --> AT
    LD --> AC

    subgraph DataScope["Data Scope Rules"]
        ALL["All Data\n(no filter)"]
        TEAM["Team Data\n(filter by teamId)"]
        OWN["Own Data\n(filter by userId)"]
    end

    SA -.-> ALL
    AD -.-> ALL
    MG -.-> ALL
    QA -.-> ALL
    LD -.-> TEAM
    AT -.-> OWN
    AC -.-> OWN

    subgraph Pages["Page Access"]
        P1["Dashboard ✅ All"]
        P2["Contacts ✅ All"]
        P3["Monitoring 🔒 Admin+Manager+Leader"]
        P4["Reports 🔒 Admin+Manager+Leader+QA"]
        P5["Permissions 🔒 Super Admin+Admin"]
        P6["Extensions 🔒 Super Admin+Admin"]
    end
```

## 3. Data Import & Assignment Flow

```mermaid
flowchart LR
    subgraph Import["📥 Import"]
        CSV["CSV / XLSX\nFile Upload"]
        Parse["Parse Rows\nValidate Fields"]
        Resolve["Resolve Contact\nFind or Create"]
    end

    subgraph Store["💾 Store"]
        Contact[("Contact\nphone, name, email")]
        Lead[("Lead\nscore, status, product")]
        Debt[("Debt Case\namount, dpd, tier")]
        Campaign[("Campaign\ntype, status, dates")]
    end

    subgraph Assign["📋 Auto-Assign"]
        RR["Round-Robin\nlead[i] → agent[i % N]"]
        WL["Workload-Based\n→ agent with fewest active"]
        SK["Skill-Based\n→ agent with best win rate"]
    end

    subgraph Agents["👥 Agent Team"]
        A1["Agent 1"]
        A2["Agent 2"]
        A3["Agent 3"]
    end

    CSV --> Parse --> Resolve
    Resolve --> Contact
    Resolve --> Lead
    Resolve --> Debt
    Lead --> Campaign

    Campaign -->|"POST /assignments/auto-assign"| RR
    Campaign -->|"mode=workload"| WL
    Campaign -->|"mode=skill"| SK

    RR --> A1
    RR --> A2
    RR --> A3
    WL --> A1
    SK --> A2
```

## 4. Call Flow End-to-End

```mermaid
sequenceDiagram
    participant Agent as 👤 Agent (Browser)
    participant CRM as 🖥️ CRM Backend
    participant ESL as 📡 ESL Daemon
    participant FS as 🔊 FreeSWITCH
    participant Phone as 📱 Agent SIP Phone
    participant Customer as 📞 Customer

    Note over Agent,Customer: ── Click-to-Call (C2C) ──

    Agent->>CRM: POST /calls/originate {phone}
    CRM->>CRM: Validate: agent status ≠ break/offline
    CRM->>CRM: Sanitize phone [0-9+*#] max 30
    CRM->>ESL: bgapi originate user/{ext}@{domain}
    ESL->>FS: Originate command
    FS->>Phone: SIP INVITE (agent rings)

    Note over CRM,Agent: Agent status → 'ringing'
    CRM-->>Agent: Socket.IO: agent:status_change

    Phone->>FS: 200 OK (agent answers)
    FS->>Customer: Bridge → loopback/{dest}/{domain}
    Note over CRM,Agent: Agent status → 'on_call'

    Customer->>FS: 200 OK (customer answers)
    Note over Phone,Customer: ═══ Active Call ═══

    alt Hold
        Agent->>CRM: POST /calls/hold
        CRM->>ESL: uuid_hold {uuid}
    end
    alt Transfer
        Agent->>CRM: POST /calls/transfer {target}
        CRM->>ESL: uuid_transfer {uuid} {target}
    end

    Phone->>FS: BYE (call ends)
    Note over CRM,Agent: Agent status → 'wrap_up' (30s timer)

    Note over Agent,Customer: ── CDR Processing ──

    FS->>CRM: POST /webhooks/cdr (XML)
    CRM->>CRM: IP whitelist + Basic Auth
    CRM->>CRM: Parse XML, extract variables
    CRM->>CRM: Dedup legs (canonical UUID)
    CRM->>CRM: Normalize phone numbers
    CRM->>CRM: Match contact by phone
    CRM->>CRM: Map extension → userId
    CRM->>CRM: Upsert CallLog record

    Note over CRM,Agent: After 30s wrap-up → status 'ready'
```

## 5. Lead Management Flow

```mermaid
flowchart TB
    subgraph Entry["📥 Lead Entry"]
        Manual["Manual Create\nPOST /leads"]
        Import["CSV Import\nPOST /leads/import"]
        Web["Website Form\n(future)"]
    end

    subgraph Score["📊 Lead Scoring (0-100)"]
        Base["Base: 30 pts"]
        Src["Source Bonus\nreferral +10, web +5\nzalo/fb +4, email +3"]
        Contact["Contact Info\nphone +5, email +5"]
        History["History\nper interaction +2 (max +10)"]
        Decay["Recency Decay\n≤3d: 0, ≤7d: -2\n≤14d: -5, >30d: -15"]
    end

    subgraph Pipeline["🔄 Lead Pipeline"]
        New["🟡 New"]
        Contacted["🔵 Contacted"]
        Qualified["🟢 Qualified"]
        Proposal["🟣 Proposal"]
        Won["✅ Won"]
        Lost["❌ Lost"]
    end

    subgraph Actions["📞 Agent Actions"]
        Call["Click-to-Call"]
        Note["Add Notes"]
        Disp["Set Disposition"]
        Follow["Schedule Follow-up"]
        Ticket["Create Ticket"]
    end

    subgraph Output["📈 Reporting"]
        Dash["Dashboard KPIs\nconversion rate, calls/day"]
        Report["Telesale Report\nby agent, by campaign"]
        Campaign["Campaign Progress\ncontacted %, won %"]
    end

    Entry --> Score
    Base --> Src --> Contact --> History --> Decay
    Score -->|"Computed score"| New

    New -->|"Agent calls"| Contacted
    Contacted -->|"Shows interest"| Qualified
    Qualified -->|"Sends offer"| Proposal
    Proposal -->|"Deal closed"| Won
    Proposal -->|"Rejected"| Lost
    Contacted -->|"Not interested"| Lost

    Pipeline --> Actions
    Call --> Note --> Disp --> Follow

    Pipeline --> Output
```

## 6. Debt Collection Flow

```mermaid
flowchart TB
    subgraph Import["📥 Debt Import"]
        CSV["CSV Import\ncontract, amount, dpd"]
        Create["Manual Create\nPOST /debt-cases"]
    end

    subgraph Tier["📊 Tier Classification (by DPD)"]
        T0["🟢 Current\nDPD ≤ 0"]
        T1["🟡 Tier 1\nDPD 1-30"]
        T2["🟠 Tier 2\nDPD 31-60"]
        T3["🔴 Tier 3\nDPD 61-90"]
        T4["⛔ Tier 4\nDPD 90+"]
    end

    subgraph Status["🔄 Debt Status Pipeline"]
        Active["Active"]
        InProgress["In Progress"]
        PTP["Promise to Pay\n(promiseDate + amount)"]
        Paid["✅ Paid"]
        WrittenOff["❌ Written Off"]
    end

    subgraph AgentWork["📞 Collection Agent"]
        Assign["Auto-assign to agent"]
        Call["Click-to-Call debtor"]
        RPC["Right Party Contact?\nmark RPC"]
        Negotiate["Negotiate payment"]
        Guarantor["Contact Guarantor\n(người bảo lãnh)"]
    end

    subgraph Automation["⚙️ Daily Cron Jobs"]
        Escalation["Debt Escalation Job\n(every 24h)"]
        Reminder["PTP Reminder Job\n(promiseDate check)"]
        Notify["Agent Notification\n'Debt escalated to Tier X'"]
    end

    subgraph KPIs["📈 Collection KPIs"]
        PTRate["PTP Rate %"]
        Recovery["Recovery Rate %"]
        RPCRate["RPC Rate %"]
        WrapUp["Avg Wrap-up Time"]
        SLA["SLA Compliance %"]
    end

    Import --> T0
    T0 -->|"DPD increases"| T1 -->|"DPD increases"| T2 -->|"DPD increases"| T3 -->|"DPD increases"| T4

    T1 --> Assign --> Call --> RPC
    RPC -->|"Yes"| Negotiate
    RPC -->|"No / Wrong number"| Guarantor --> Call
    Negotiate -->|"Agrees to pay"| PTP
    Negotiate -->|"Refuses"| Active
    PTP -->|"Payment received"| Paid
    PTP -->|"Missed promise"| Active

    Escalation -->|"Recalculate DPD → Tier"| Tier
    Escalation --> Notify
    Reminder -->|"Check promiseDate"| Notify

    Status --> KPIs
```

## 7. Campaign Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Draft: Create Campaign
    Draft --> Active: Start Campaign
    Active --> Paused: Pause
    Paused --> Active: Resume
    Active --> Completed: All leads processed
    Completed --> [*]

    state Active {
        [*] --> ImportLeads: Upload CSV
        ImportLeads --> AssignAgents: Auto-assign\n(round-robin/workload/skill)
        AssignAgents --> AgentsCalling: Agents start calling
        AgentsCalling --> TrackProgress: Real-time progress bar

        state TrackProgress {
            [*] --> Monitoring
            Monitoring: Total leads: N\nContacted: X%\nWon: Y%\nLost: Z%
        }
    }

    state AgentsCalling {
        CallLead: Agent calls lead
        SetDisposition: Set disposition code
        ScheduleFollowUp: Schedule follow-up
        NextLead: Move to next lead

        CallLead --> SetDisposition
        SetDisposition --> ScheduleFollowUp
        ScheduleFollowUp --> NextLead
        NextLead --> CallLead
    }
```

## 8. CDR Deduplication Logic

```mermaid
flowchart TB
    subgraph Input["CDR Webhook Receives"]
        Leg1["Leg 1: Originate\n(agent SIP phone)"]
        Leg2["Leg 2: Loopback\n(bridge internal)"]
        Leg3["Leg 3: External\n(trunk to customer)"]
    end

    subgraph Filter["Filter & Skip"]
        F1{"sofia/internal/* ?"}
        F2{"Internal ext→ext ?"}
        F3{"Orphan leg ?\n(no dest, no match)"}
    end

    subgraph Dedup["Canonical UUID Resolution"]
        D1["Check: other_loopback_leg_uuid"]
        D2["Fallback: time-window search\n±60s, same caller/dest"]
        D3["Last resort: own UUID"]
    end

    subgraph Merge["Merge & Upsert"]
        Norm["Normalize phones\nstrip domain, add 0 for VN"]
        Match["Match contact by phone\ninbound→caller, outbound→dest"]
        Map["Map extension → userId"]
        Upsert["Upsert CallLog\nkeep MAX(billsec, duration)"]
    end

    Leg1 --> F1
    Leg2 --> F1
    Leg3 --> F1

    F1 -->|Yes| Skip1["Skip"]
    F1 -->|No| F2
    F2 -->|Yes| Skip2["Skip"]
    F2 -->|No| F3
    F3 -->|Yes| Skip3["Skip"]
    F3 -->|No| D1

    D1 -->|Found| Merge
    D1 -->|Not found| D2
    D2 -->|Found| Merge
    D2 -->|Not found| D3
    D3 --> Merge

    Norm --> Match --> Map --> Upsert
```

## 9. Real-Time Monitoring Flow

```mermaid
flowchart LR
    subgraph Sources["Data Sources"]
        ESL["ESL Events\ncall:ringing\ncall:answered\ncall:ended"]
        Sofia["Sofia Registrations\nextension status"]
        RedisCache["Redis Cache\nagent status TTL 24h"]
    end

    subgraph Processing["Backend Processing"]
        StatusSvc["Agent Status Service\nset/get/timer"]
        MonitorSvc["Monitoring Service\nactive calls + agent grid"]
        WrapTimer["Wrap-up Timer\n30s auto-complete"]
    end

    subgraph Delivery["Real-Time Delivery"]
        SIO["Socket.IO\nagent:status_change\ncall:state"]
        API["REST API\nGET /monitoring/*"]
    end

    subgraph UI["Live Dashboard"]
        Grid["Agent Grid\nname, status, extension\nregistered/unregistered"]
        Calls["Active Calls\ncaller, dest, duration\nagent, direction"]
        Stats["Call Stats\ntotal, inbound, outbound\navg duration"]
    end

    ESL --> StatusSvc
    Sofia --> MonitorSvc
    RedisCache --> StatusSvc
    StatusSvc --> WrapTimer
    StatusSvc --> SIO
    MonitorSvc --> API

    SIO --> Grid
    SIO --> Calls
    API --> Stats
```

## 10. Database Entity Relationships

```mermaid
erDiagram
    User ||--o{ Lead : "assigned to"
    User ||--o{ DebtCase : "assigned to"
    User ||--o{ CallLog : "made by"
    User ||--o{ Ticket : "created by"
    User ||--o{ QaAnnotation : "reviewed by"
    User }o--|| Team : "belongs to"

    Team ||--o{ User : "has members"

    Contact ||--o{ Lead : "has"
    Contact ||--o{ DebtCase : "has"
    Contact ||--o{ CallLog : "has"
    Contact ||--o{ Ticket : "has"
    Contact ||--o{ ContactRelationship : "related to"

    Campaign ||--o{ Lead : "contains"
    Campaign ||--o{ DebtCase : "contains"
    Campaign ||--o{ CallLog : "tracks"

    CallLog ||--o{ QaAnnotation : "has"
    CallLog }o--o| DispositionCode : "coded with"

    Ticket }o--o| CallLog : "linked to"
    Ticket }o--o| TicketCategory : "categorized by"

    User {
        uuid id PK
        string email UK
        string fullName
        enum role
        string sipExtension
        uuid teamId FK
    }

    Contact {
        uuid id PK
        string phone
        string fullName
        string email
        json tags
        json customFields
    }

    Lead {
        uuid id PK
        uuid contactId FK
        uuid campaignId FK
        enum status
        int score
        string product
        uuid assignedTo FK
    }

    DebtCase {
        uuid id PK
        uuid contactId FK
        decimal originalAmount
        int dpd
        enum tier
        enum status
        decimal promiseAmount
        date promiseDate
    }

    CallLog {
        uuid id PK
        string callUuid UK
        uuid contactId FK
        uuid userId FK
        enum direction
        int duration
        int billsec
        string recordingPath
    }

    Campaign {
        uuid id PK
        string name
        enum type
        enum status
        date startDate
        date endDate
    }
```
