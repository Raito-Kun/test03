# CRM Omnichannel — Deployment Guide

## Architecture

```
[Browser] ←HTTPS:443→ [Nginx (crm-frontend)]
                              ↓
                    [Express API (crm-backend:4000)]
                         ↓              ↓
              [PostgreSQL:5432]    [Redis:6379]
                         ↓
                  [FreeSWITCH:8021 (ESL)]
                         ↓
              [CDR Webhook ← mod_xml_cdr]
              [Recording rsync ← /var/lib/freeswitch/recordings/]
```

## Server Requirements

| Component | Specification |
|-----------|--------------|
| OS | Debian 12 / Ubuntu 22.04 |
| CPU | 2+ cores |
| RAM | 4GB+ |
| Disk | 50GB+ (recordings) |
| Docker | Docker CE + Docker Compose |
| Network | CRM server ↔ FreeSWITCH (private network) |

## Quick Deploy

```bash
# 1. Copy project to server
scp -r . root@SERVER:/opt/crm/

# 2. Run deploy script
ssh root@SERVER "cd /opt/crm && bash deploy.sh"

# 3. Access
# URL: https://SERVER
# Login: superadmin@crm.local / SuperAdmin@123
# Agent: agent.ts@crm.local / changeme123
```

## Docker Services

| Container | Image | Port | Health Check |
|-----------|-------|------|-------------|
| crm-postgres | postgres:15-alpine | 5432 | pg_isready |
| crm-redis | redis:7-alpine | 6379 | redis-cli ping |
| crm-backend | custom (Node.js 18) | 4000 | wget /api/v1/health |
| crm-frontend | custom (Nginx) | 80/443 | — |

## Environment Variables (.env)

```env
DATABASE_URL=postgresql://crm_user:PASSWORD@postgres:5432/crm_db
REDIS_URL=redis://redis:6379
JWT_ACCESS_SECRET=<random>
JWT_REFRESH_SECRET=<random>
PORT=4000
NODE_ENV=production
FRONTEND_URL=https://SERVER_IP

# FreeSWITCH
ESL_ENABLED=true
ESL_HOST=10.10.101.189
ESL_PORT=8021
ESL_PASSWORD=ClueCon
FUSIONPBX_DOMAIN=crm
FUSIONPBX_RECORDING_URL=http://FUSIONPBX_IP:8088/recordings
LOCAL_RECORDING_DIR=/opt/crm/recordings

# Webhook
WEBHOOK_ALLOWED_IPS=FUSIONPBX_IP,127.0.0.1
WEBHOOK_BASIC_USER=webhook
WEBHOOK_BASIC_PASS=<random>
```

## Recording Sync (Crontab)

```cron
* * * * * rsync -az --chmod=F755 -e ssh root@FUSIONPBX_IP:/var/lib/freeswitch/recordings/crm/archive/ /opt/crm/recordings/crm/archive/ 2>/dev/null
```

Setup SSH keys: `ssh-keygen && ssh-copy-id root@FUSIONPBX_IP`

## FusionPBX CDR Webhook Config

In FusionPBX → Advanced → Default Settings → CDR:
- **xml_cdr url**: `http://CRM_IP/api/v1/webhooks/cdr`
- **xml_cdr auth-scheme**: `basic`
- **xml_cdr cred**: `webhook:WEBHOOK_PASS`

## Common Operations

```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f backend

# Rebuild after code changes
scp -r packages/backend/src root@SERVER:/opt/crm/packages/backend/
scp -r packages/frontend/src root@SERVER:/opt/crm/packages/frontend/
ssh root@SERVER "cd /opt/crm && docker compose -f docker-compose.prod.yml up -d --build backend frontend"

# Database access
docker exec crm-postgres psql -U crm_user -d crm_db

# Run migrations
docker exec crm-backend npx prisma migrate deploy

# Seed data
docker exec -e NODE_ENV=development crm-backend npx prisma db seed
```

## Default Users

| Email | Password | Role | Extension |
|-------|----------|------|-----------|
| superadmin@crm.local | SuperAdmin@123 | super_admin | 1007 |
| admin@crm.local | changeme123 | admin | — |
| agent.ts@crm.local | changeme123 | agent_telesale | 1005 |
| agent.col@crm.local | changeme123 | agent_collection | 1006 |
