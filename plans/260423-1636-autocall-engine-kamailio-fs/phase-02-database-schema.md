---
phase: 02
title: "Database schema — autocall_* tables + PbxCluster.type"
size: M
status: pending
---

# Phase 02 — Database Schema

## Context
- Research: [researcher-03](research/researcher-03-compliance-scheduler.md) (KPI schema)
- Rules: `.claude/skills/crm-prisma/SKILL.md`, `.claude/skills/crm-db/SKILL.md`

## Overview
- Priority: P2 (blocks service + webhook routing)
- Status: pending
- Add 6 new `autocall_*` tables + `PbxCluster.type` enum field. Generate Prisma migration. Seed initial permissions + feature flag key.

## Key Insights
- All tables cluster-scoped (`cluster_id` FK + index). Multi-tenancy via existing `PbxCluster`.
- `autocall_calls` mirrors shape of `call_logs` enough that frontend list components can share formatters, but stays a separate table (isolation, future divergence).
- `PbxCluster.type` enum with `fusionpbx` default — backfill existing rows to `fusionpbx`; new autocall cluster inserted as `kamailio-fs`.
- **No holiday/calendar table** (decision #3). Campaign enforces only daily `window_start`/`window_end` in `timezone`. Keep schema minimal.
- **`kamailio.subscriber` = external DB** (on Kamailio host, Postgres created in phase-01). NOT mapped in Prisma. Sync service in phase-03 writes to it via a second connection string (`KAMAILIO_DB_URL`). Schema provided by Kamailio distro (`username`, `domain`, `password`, `ha1`, `ha1b`).

## Requirements
**Functional**
- Prisma migration creates tables + indexes atomically.
- Seed idempotent.

**Non-functional**
- Phone lookup on `autocall_dnc` sub-ms at 300 CCU (unique index `(cluster_id, phone_e164)`).
- `autocall_leads` supports `ORDER BY priority DESC, last_attempt_at ASC NULLS FIRST` scan — composite index.
- `autocall_calls` retention partition-ready (created_at monthly, but MVP = single table).

## Architecture

### Tables
1. `autocall_campaigns` — config
2. `autocall_leads` — targets + state
3. `autocall_calls` — per-attempt record
4. `autocall_dispositions` — outcome catalog per campaign
5. `autocall_dnc` — blocked phones
6. `autocall_agent_sessions` — productivity

### Enum additions
- `PbxClusterType { fusionpbx, kamailio_fs }` — added to schema, `PbxCluster.type` field default `fusionpbx`.
- `AutocallDialerMode { progressive, predictive }` — default `progressive`.
- `AutocallLeadStatus { new, queued, dialing, attempted, callback, completed, exhausted, dnc_blocked }`
- `AutocallCallResult { answered, no_answer, busy, cancel, congestion, failed, amd_machine }`
- `AutocallDncSource { manual, request, regulatory, bounce }`

## Related Code Files
**Modify**
- `packages/backend/prisma/schema.prisma` — add enums + 6 models + `PbxCluster.type` field + relations
- `packages/backend/prisma/seed.ts` — add autocall permissions + feature flag key
- `packages/backend/prisma/seed-role-permissions.ts` — map new keys to roles
- `packages/backend/src/services/feature-flag-service.ts` — register `FEATURE_AUTOCALL_ENABLED` key
- `.env.example` — add `KAMAILIO_DB_URL` (separate Postgres for Kamailio subscriber sync, used by phase-03 sync service) + `REDIS_URL` (reuse existing if already defined for RBAC cache)

**Create**
- `packages/backend/prisma/migrations/<timestamp>_autocall_init/migration.sql` (generated, reviewed)

## Prisma Schema Sketch

```prisma
enum PbxClusterType {
  fusionpbx
  kamailio_fs  @map("kamailio-fs")
}

enum AutocallDialerMode { progressive predictive }
enum AutocallLeadStatus { new queued dialing attempted callback completed exhausted dnc_blocked }
enum AutocallCallResult { answered no_answer busy cancel congestion failed amd_machine }
enum AutocallDncSource  { manual request regulatory bounce }

// add to PbxCluster:
//   type PbxClusterType @default(fusionpbx)
//   autocallCampaigns AutocallCampaign[]
//   autocallLeads     AutocallLead[]
//   autocallCalls     AutocallCall[]
//   autocallDnc       AutocallDnc[]

model AutocallCampaign {
  id                 String   @id @default(uuid()) @db.Uuid
  clusterId          String   @map("cluster_id") @db.Uuid
  name               String
  dialerMode         AutocallDialerMode @default(progressive) @map("dialer_mode")
  timezone           String   @default("Asia/Ho_Chi_Minh")
  windowStart        Int      @default(8)  @map("window_start")   // 0-23 local-time per `timezone`
  windowEnd          Int      @default(20) @map("window_end")     // exclusive end hour; no holiday table (decision #3)
  maxAttempts        Int      @default(3)  @map("max_attempts")
  retryCooldownMin   Int      @default(60) @map("retry_cooldown_min")  // bypassed by agent-scheduled callback (decision #4)
  pacingMultiplier   Float    @default(1.0) @map("pacing_multiplier")
  trunkGateway       String   @map("trunk_gateway")
  callerId           String   @map("caller_id")
  retentionDays      Int      @default(90) @map("retention_days")
  isActive           Boolean  @default(false) @map("is_active")
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt       @map("updated_at")

  cluster      PbxCluster             @relation(fields: [clusterId], references: [id], onDelete: Cascade)
  leads        AutocallLead[]
  calls        AutocallCall[]
  dispositions AutocallDisposition[]
  sessions     AutocallAgentSession[]

  @@index([clusterId, isActive])
  @@map("autocall_campaigns")
}

model AutocallLead {
  id             String               @id @default(uuid()) @db.Uuid
  clusterId      String               @map("cluster_id") @db.Uuid
  campaignId     String               @map("campaign_id") @db.Uuid
  contactId      String?              @map("contact_id") @db.Uuid
  phoneE164      String               @map("phone_e164") @db.VarChar(32)
  fullName       String?              @map("full_name")
  priority       Int                  @default(0)
  status         AutocallLeadStatus   @default(new)
  attemptCount   Int                  @default(0) @map("attempt_count")
  lastAttemptAt  DateTime?            @map("last_attempt_at")
  nextEligibleAt DateTime?            @map("next_eligible_at")  // normally last_attempt_at + retry_cooldown_min; agent callback sets absolute time, BYPASSES cooldown (decision #4)
  metadata       Json?
  createdAt      DateTime             @default(now()) @map("created_at")
  updatedAt      DateTime             @updatedAt       @map("updated_at")

  cluster  PbxCluster       @relation(fields: [clusterId], references: [id], onDelete: Cascade)
  campaign AutocallCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  calls    AutocallCall[]

  @@index([campaignId, status, priority, lastAttemptAt])
  @@index([clusterId, phoneE164])
  @@map("autocall_leads")
}

model AutocallCall {
  id             String                  @id @default(uuid()) @db.Uuid
  clusterId      String                  @map("cluster_id") @db.Uuid
  campaignId     String                  @map("campaign_id") @db.Uuid
  leadId         String                  @map("lead_id") @db.Uuid
  agentId        String?                 @map("agent_id") @db.Uuid
  fsUuid         String?                 @unique @map("fs_uuid")
  startedAt      DateTime?               @map("started_at")
  answeredAt     DateTime?               @map("answered_at")
  endedAt        DateTime?               @map("ended_at")
  duration       Int?
  billsec        Int?
  wrapSeconds    Int?                    @map("wrap_seconds")
  wasBridged     Boolean                 @default(false) @map("was_bridged")
  hangupCause    String?                 @map("hangup_cause") @db.VarChar(64)
  result         AutocallCallResult?
  disposition    String?                 @db.VarChar(64)
  amdResult      String?                 @map("amd_result") @db.VarChar(32)
  recordingPath  String?                 @map("recording_path")  // stereo file: `-stereo.mp3` suffix; agent=L, customer=R (decision #2)
  skipReason     String?                 @map("skip_reason") @db.VarChar(64)   // when blocked pre-originate
  createdAt      DateTime                @default(now()) @map("created_at")

  cluster  PbxCluster       @relation(fields: [clusterId], references: [id], onDelete: Cascade)
  campaign AutocallCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  lead     AutocallLead     @relation(fields: [leadId], references: [id], onDelete: Cascade)

  @@index([campaignId, createdAt])
  @@index([agentId, createdAt])
  @@index([clusterId, startedAt])
  @@map("autocall_calls")
}

model AutocallDisposition {
  id         String @id @default(uuid()) @db.Uuid
  campaignId String @map("campaign_id") @db.Uuid
  code       String @db.VarChar(64)
  label      String
  isSuccess  Boolean @default(false) @map("is_success")
  orderIndex Int     @default(0) @map("order_index")

  campaign AutocallCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  @@unique([campaignId, code])
  @@map("autocall_dispositions")
}

model AutocallDnc {
  id         String            @id @default(uuid()) @db.Uuid
  clusterId  String            @map("cluster_id") @db.Uuid
  phoneE164  String            @map("phone_e164") @db.VarChar(32)
  source     AutocallDncSource @default(manual)
  notes      String?
  createdBy  String?           @map("created_by") @db.Uuid
  createdAt  DateTime          @default(now()) @map("created_at")

  cluster PbxCluster @relation(fields: [clusterId], references: [id], onDelete: Cascade)

  @@unique([clusterId, phoneE164])
  @@map("autocall_dnc")
}

model AutocallAgentSession {
  id               String   @id @default(uuid()) @db.Uuid
  clusterId        String   @map("cluster_id") @db.Uuid
  campaignId       String   @map("campaign_id") @db.Uuid
  agentId          String   @map("agent_id") @db.Uuid
  loginAt          DateTime @map("login_at")
  logoutAt         DateTime? @map("logout_at")
  totalReadyMs     BigInt   @default(0) @map("total_ready_ms")
  totalOnCallMs    BigInt   @default(0) @map("total_on_call_ms")
  totalWrapMs      BigInt   @default(0) @map("total_wrap_ms")
  totalPauseMs     BigInt   @default(0) @map("total_pause_ms")
  callsHandled     Int      @default(0) @map("calls_handled")
  callsAnswered    Int      @default(0) @map("calls_answered")

  campaign AutocallCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  @@index([campaignId, loginAt])
  @@index([agentId, loginAt])
  @@map("autocall_agent_sessions")
}
```

## Implementation Steps
1. Edit `schema.prisma`: add enums, `PbxCluster.type` + reverse relations, 6 models above.
2. Run `npm run prisma:migrate -- --name autocall_init --schema=prisma/schema.prisma` inside backend container (per `feedback_prisma_migrate_schema_flag`).
3. Review generated `migration.sql` — check indexes + `ON DELETE CASCADE`.
4. Backfill existing `PbxCluster` rows: migration auto-defaults to `fusionpbx`.
5. Seed: add `FEATURE_AUTOCALL_ENABLED` flag key to feature-flag service registry; register 7 autocall permission keys in `seed.ts`.
6. Map perms to roles in `seed-role-permissions.ts`:
   - `super_admin, admin`: all autocall.*
   - `manager`: read/monitor + disposition.configure
   - `leader`: read/monitor
   - `agent_telesale, agent_collection`: `autocall.agent.work` only
   - `qa`: read + monitor
7. Run `npm run db:seed`. Verify in `psql` that perms + flag present.

## Todo List
- [ ] Edit schema.prisma (enums, PbxCluster.type, 6 models)
- [ ] Generate migration
- [ ] Review migration SQL
- [ ] Update feature-flag registry
- [ ] Add permissions to seed
- [ ] Map role grants
- [ ] Re-seed dev
- [ ] Verify psql + prisma studio

## Success Criteria
- `npx prisma migrate status` shows clean.
- `SELECT COUNT(*) FROM autocall_campaigns` = 0; schema present.
- `SELECT key FROM permissions WHERE key LIKE 'autocall.%'` returns 7 rows.
- Feature flag `FEATURE_AUTOCALL_ENABLED` retrievable via admin UI.

## Risk Assessment
- Migration fails on production because of PbxCluster FK volume: low (add DEFAULT handles backfill). Dry-run on dev snapshot first.
- Enum name collision with existing: grep confirmed none (`AutocallDialerMode` etc. are new prefixes).

## Security
- No PII column added beyond phone + name (already handled elsewhere).
- Audit logging wired in service layer (phase 03).

## Next Steps
Unblocks phases 03 (service), 04 (compliance needs DNC table), 05 (scheduler needs lead+campaign), 06 (webhook routing writes to `autocall_calls`).
