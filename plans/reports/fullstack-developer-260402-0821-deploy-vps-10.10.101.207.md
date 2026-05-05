# Deploy Report — VPS 10.10.101.207

**Date:** 2026-04-02  
**Status:** Completed

## Steps Executed

1. **Git commit + push** — staged 136 changed/new files, committed, pushed to `origin master` (https://github.com/Raito-Kun/test03.git)
2. **Source sync to server** — used pscp to copy `packages/backend/src`, `packages/frontend/src`, `packages/frontend/public`, `packages/shared/src`, prisma schema, migrations, and package.json files to `/opt/crm/`
3. **Docker rebuild** — `docker compose -f docker-compose.prod.yml build --no-cache backend frontend` — both images built successfully
4. **Container restart** — `docker compose -f docker-compose.prod.yml up -d backend frontend` — both recreated and started
5. **Prisma migrate deploy** — no pending migrations (all 5 already applied)
6. **Health check** — backend `{"status":"ok","timestamp":"2026-04-02T01:29:40.380Z"}`

## Server State

| Container    | Status              | Ports                    |
|--------------|---------------------|--------------------------|
| crm-backend  | Up (healthy)        | 4000/tcp (internal)      |
| crm-frontend | Up                  | 0.0.0.0:80→80, 443→443   |
| crm-postgres | Up 4 days (healthy) | 5432/tcp (internal)      |
| crm-redis    | Up 4 days (healthy) | 6379/tcp (internal)      |

**CRM URL:** http://10.10.101.207 (nginx redirects to HTTPS)  
**API Health:** `http://10.10.101.207:4000/api/v1/health` → `{"status":"ok"}`

## Notes

- Server has no git repo — files were copied via pscp (deploy approach: local build → copy → docker rebuild)
- GitHub Actions CI/CD (`deploy.yml`) triggers on push to master and uses `secrets.VPS_SSH_KEY` — ensure that secret is set in GitHub repo settings if CI/CD automation is desired
- Large file warning: `Guildline/Docs/PLS_AI Contact Center_09.2025.pdf` (72.67 MB) — consider adding to `.gitignore` or using Git LFS
