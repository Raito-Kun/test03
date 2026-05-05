---
name: crm-deploy
description: Deploy the CRM monorepo stack (backend, frontend, migrations) to dev or prod servers via SSH + rsync + docker-compose. Use for shipping changes, rolling out migrations, smoke-checking builds. Prod gated by explicit user keyword.
version: 1.0.0
argument-hint: "[dev|prod] [--backend|--frontend|--migrations]"
---

# CRM Deploy Skill

Ship the CRM stack to remote servers with a predictable build → transfer → restart → verify loop.

## When to Use

- Rolling out backend, frontend, or schema changes
- Restarting individual containers after a hotfix
- Running pending Prisma migrations on a server
- Smoke-checking a deployed service after release
- Rolling back to a prior commit

## Environment Resolution

Read server credentials and hostnames from user memory, not this skill body:
- Dev: `reference_ssh_server.md`
- Prod: `reference_ssh_prod_server.md`
- Prod gate rule: `feedback_prod_deployment_rule.md`

Never hardcode hosts, users, or passwords in prompts or scripts. If memory is missing, ask the user.

## Workflow

1. **Pre-flight** — `git status`, `git log -1`, note pending migrations, warn on dirty tree
2. **Build** — `npm run build` locally for fast dev loops, or rebuild inside container for reproducibility
3. **Transfer** — `rsync -avz --delete` excluding `node_modules`, `.env`, `dist`, `.git`
4. **Restart** — `docker compose -f docker-compose.prod.yml up -d --build`
5. **Migrate** (if needed) — `docker compose exec -T backend npx prisma migrate deploy --schema=prisma/schema.prisma` (the explicit `--schema=` flag is **mandatory** — see gotcha below)
6. **Verify** — health endpoint + tail last 100 lines of backend logs

## Gotcha: two schema.prisma files inside the backend container

The CRM backend Docker image ships with two Prisma schemas:
- `/app/packages/backend/schema.prisma` — stale copy from an earlier layer, referenced by the default CLI lookup
- `/app/packages/backend/prisma/schema.prisma` — the real one, used by `RUN npx prisma generate --schema=prisma/schema.prisma` in the Dockerfile

Running `prisma migrate <cmd>` **without** `--schema=` picks the stale root copy. Symptom on 2026-04-22: `migrate deploy` reported "5 migrations found · No pending migrations to apply" even though 14 migration folders lived on disk and DB was missing the latest. **Always pass** `--schema=prisma/schema.prisma` when executing Prisma commands inside the container (deploy / status / resolve / db seed).

## Decision Table

| Situation | Action |
|---|---|
| Tiny backend tweak | `restart backend` only |
| Frontend-only change | rebuild frontend container |
| Schema change | ship code → `migrate deploy` → restart backend |
| Urgent rollback | `git checkout <sha>` on server → rebuild |
| Unknown breakage | tail logs first, don't restart blindly |

## Prod Safety

Production deploys require the user's message to contain the literal phrase from `feedback_prod_deployment_rule.md`. If absent, refuse and suggest dev. Never push, force-restart, or bypass hooks on prod without that explicit gate.

## Reporting

After deploy, report: commit SHA shipped, migrations run, health check result, any error lines from tail.

## Reference

- `deploy.sh` — project bootstrap script for fresh VPS provisioning
- `docker-compose.prod.yml` — production compose stack
- Related skills: `crm-prisma` (migrations), `crm-test` (smoke)
