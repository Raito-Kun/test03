---
name: crm-prisma
description: Run Prisma operations (migrate dev, migrate deploy, db seed, generate, studio) safely against the CRM PostgreSQL database. Handles cluster-aware multi-tenancy and warns on destructive operations.
version: 1.0.0
argument-hint: "[migrate|seed|generate|status|reset]"
---

# CRM Prisma Skill

Manage schema evolution and seed data for the CRM Postgres database without footguns.

## When to Use

- Editing `schema.prisma` and producing a migration
- Applying migrations on a server
- Re-seeding reference data after a schema change
- Regenerating the Prisma client after pulling new schema
- Inspecting migration status or opening Prisma Studio

## Command Map

| Intent | Command |
|---|---|
| New dev migration | `npm run db:migrate -- --name <slug>` |
| Apply on server | `npx prisma migrate deploy` |
| Regenerate client | `npx prisma generate` |
| Seed | `npm run db:seed` |
| Migration state | `npx prisma migrate status` |
| Visual browser | `npm run db:studio` |
| Mark rolled back | `npx prisma migrate resolve --rolled-back <name>` |

All commands run from `packages/backend/`.

## Multi-tenant Rule

Tenant-scoped tables (contact, lead, debt case, call log, campaign, ticket, user) carry an optional `clusterId` foreign key. When adding new tenant-scoped tables, include the same field + index. Backfill existing rows against the active cluster before enforcing the column.

## Zero-Downtime Migration Discipline

For column renames or drops:
1. Add new column, dual-write in code
2. Backfill and migrate readers
3. Drop old column in a later migration

Never combine "add" + "drop" + "rename" in a single migration on populated tables.

## Safety

- `migrate dev` is local-only; never run on dev or prod servers
- `db push` is forbidden on shared environments
- Back up before destructive migrations (`pg_dump`)
- Never hand-edit existing migration files in `prisma/migrations/` — write a follow-up migration instead

## Reference

- Schema: `packages/backend/prisma/schema.prisma`
- Migrations history: `packages/backend/prisma/migrations/`
- Seed: `packages/backend/prisma/seed.ts`
- Related skills: `crm-db` (raw SQL), `crm-deploy` (server-side apply)
