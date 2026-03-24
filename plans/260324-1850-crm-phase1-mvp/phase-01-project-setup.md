---
phase: 01
title: "Project Setup & Infrastructure"
status: completed
priority: P1
effort: 3d
---

# Phase 01 — Project Setup & Infrastructure

## Context Links
- [PRD](../../Guildline/PRD.md) — Section 5 Tech Stack
- [Plan Overview](./plan.md)

## Overview
Bootstrap monorepo, Docker Compose environment (PostgreSQL, Redis), Prisma schema with all 18 tables, backend/frontend scaffolding.

## Key Insights
<!-- Updated: Validation Session 2 - Error code contract in shared, GitHub Issues setup -->
- Monorepo with shared types avoids duplication between FE/BE
- Prisma handles migrations; schema mirrors PRD section 6 exactly
- Docker Compose for local dev: postgres, redis, app
- ESL connection to FusionPBX is external — not in Docker (FusionPBX runs on separate server, connected via private network)
- Shared package must define API error code constants + response format (backend returns English codes, frontend maps to Vietnamese)
- Set up GitHub repo with Issues for task tracking (3+ dev team, split by layer: backend/frontend/infra)

## Requirements
**Functional:** Monorepo builds and runs. DB migrations apply. Dev server starts.
**Non-functional:** Hot reload for FE+BE. TypeScript strict mode. Consistent code formatting.

## Architecture

```
crm/
├── packages/
│   ├── frontend/          # React + Vite + Tailwind + shadcn/ui
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── hooks/
│   │   │   ├── services/   # API client
│   │   │   ├── stores/     # Zustand state
│   │   │   ├── types/
│   │   │   └── lib/
│   │   ├── package.json
│   │   └── vite.config.ts
│   ├── backend/           # Express.js + TypeScript
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── middleware/
│   │   │   ├── lib/        # ESL, Redis, Socket.IO setup
│   │   │   ├── types/
│   │   │   └── index.ts
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── package.json
│   └── shared/            # Shared types, constants, validation
│       ├── src/
│       │   ├── types/
│       │   ├── constants/
│       │   └── validation/
│       └── package.json
├── docker-compose.yml
├── .env.example
├── package.json           # Workspace root
└── tsconfig.base.json
```

## Related Code Files
**Create:**
- `package.json` (workspace root with npm workspaces)
- `tsconfig.base.json`
- `docker-compose.yml` (postgres:15, redis:7)
- `.env.example`
- `.gitignore`
- `.eslintrc.json`, `.prettierrc`
- `packages/backend/package.json`, `tsconfig.json`, `src/index.ts`
- `packages/backend/prisma/schema.prisma` (all 18 tables)
- `packages/frontend/package.json`, `vite.config.ts`, `tailwind.config.ts`
- `packages/shared/package.json`, `tsconfig.json`

## Implementation Steps

### 1. Root workspace setup
1. `npm init` at root, configure npm workspaces: `["packages/*"]`
2. Create `tsconfig.base.json` with strict TS, path aliases
3. Create `.gitignore` (node_modules, dist, .env, .prisma)
4. Create `.env.example` with all required env vars:
   <!-- Updated: Validation Session 1 - FusionPBX env vars confirmed -->
   - DB: `DATABASE_URL`, `REDIS_URL`
   - Auth: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
   - FusionPBX: `ESL_HOST`, `ESL_PORT`, `ESL_PASSWORD`, `FUSIONPBX_DOMAIN`, `SIP_GATEWAY`, `FUSIONPBX_RECORDING_URL`
   - App: `NODE_ENV`, `PORT`, `FRONTEND_URL` (for CORS), `WEBHOOK_BASIC_AUTH_USER`, `WEBHOOK_BASIC_AUTH_PASS`, `FUSIONPBX_IP` (for webhook IP whitelist)

### 2. Backend package
1. Init `packages/backend` — Express, TypeScript, ts-node-dev
2. Dependencies: `express`, `cors`, `helmet`, `compression`, `morgan`, `winston`, `dotenv`, `jsonwebtoken`, `bcryptjs`, `@prisma/client`, `socket.io`, `modesl`, `ioredis`, `multer`, `xlsx`, `uuid`, `zod`
3. Dev deps: `typescript`, `ts-node-dev`, `@types/*`, `prisma`, `eslint`, `prettier`
4. Create `src/index.ts` — basic Express server with health check
5. Create `src/lib/logger.ts` — Winston logger
6. Create `src/lib/prisma.ts` — Prisma client singleton
7. Create `src/lib/redis.ts` — Redis client singleton

### 3. Prisma schema (18 tables)
1. Create `prisma/schema.prisma` with PostgreSQL provider
2. Define all enums: Role, Gender, LeadStatus, DebtTier, DebtStatus, CampaignType, CampaignStatus, TicketStatus, TicketPriority, AgentStatus, CallDirection, RecordingStatus, DispositionCategory, NotificationType, WebhookStatus, RelationshipType, AuditAction
3. Define all 18 models matching PRD section 6 exactly:
   - users, contacts, leads, debt_cases, call_logs, disposition_codes
   - campaigns, teams, qa_annotations, tickets, ticket_categories, macros
   - contact_relationships, audit_logs, notifications, webhook_logs
   - agent_status_logs, campaign_disposition_codes
4. Add indexes: contacts.phone, call_logs.call_uuid, call_logs.start_time, audit_logs.entity_type+entity_id
5. Run `npx prisma migrate dev --name init`

### 4. Frontend package
1. `npm create vite@latest` — React + TypeScript template
2. Install: `tailwindcss`, `@tailwindcss/vite`, `shadcn/ui`, `@tanstack/react-query`, `react-router-dom`, `zustand`, `socket.io-client`, `axios`, `lucide-react`, `date-fns`
3. Configure Tailwind + shadcn/ui
4. Create basic App.tsx with router placeholder

### 5. Shared package
<!-- Updated: Validation Session 2 - API error codes contract for FE/BE alignment -->
<!-- Updated: Validation Session 3 - Direct TS imports, no build step -->
1. Create `packages/shared` with TypeScript. **No build step** — FE/BE import .ts files directly via npm workspace symlinks + TypeScript path aliases in tsconfig.base.json.
2. Define shared types: API response format, pagination, enums matching Prisma
3. Define Zod validation schemas for common entities
4. Define API error code constants (e.g., `INVALID_CREDENTIALS`, `FORBIDDEN`, `VALIDATION_ERROR`, `NOT_FOUND`) — backend uses these in responses, frontend maps to Vietnamese text

### 6. Docker Compose
1. `docker-compose.yml`: postgres:15-alpine (port 5432), redis:7-alpine (port 6379)
2. Volume mounts for data persistence
3. Healthchecks for both services

### 7. Dev scripts
1. Root `package.json` scripts: `dev` (concurrently run FE+BE), `build`, `lint`, `format`
2. Backend: `dev`, `build`, `start`, `db:migrate`, `db:seed`, `db:studio`
3. Frontend: `dev`, `build`, `preview`

## Todo List
- [x] Root workspace + tsconfig
- [x] Backend scaffolding + Express server
- [x] Prisma schema (18 tables + enums + indexes)
- [x] Run first migration
- [x] Frontend scaffolding + Tailwind + shadcn
- [x] Shared package with types
- [x] Docker Compose (postgres + redis)
- [x] Dev scripts + verify everything starts

## Success Criteria
- `docker compose up` starts postgres + redis
- `npm run dev` starts both FE (3000) and BE (4000) with hot reload
- `npx prisma studio` shows all 18 tables
- Health check `GET /api/v1/health` returns 200

## Risk Assessment
- npm workspaces path resolution quirks on Windows — use forward slashes in tsconfig paths
- Prisma client generation must run after migration — add to postinstall script

## Security Considerations
- `.env` excluded from git
- `.env.example` contains placeholder values only
- Database credentials not hardcoded
