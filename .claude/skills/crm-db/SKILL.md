---
name: crm-db
description: Inspect and repair the CRM PostgreSQL database safely via psql. Read-first defaults, transactional mutations, and prod writes gated by the same rule as deploys.
version: 1.0.0
argument-hint: "[inspect|count|backfill|fix] [table]"
---

# CRM DB Skill

Direct Postgres access for diagnosis, audit, and supervised data fixes. Use when Prisma abstractions get in the way of figuring out what happened.

## When to Use

- Counting or auditing records
- Hunting duplicates (canonical phones, merged contacts)
- Backfilling `cluster_id` on tenant-scoped tables after a schema change
- Investigating why a specific user sees or misses rows
- Confirming a CDR actually arrived before blaming the UI

## Connection Resolution

Use SSH credentials from memory (dev and prod memory files) rather than hardcoding any host. Connect through the `postgres` container with the app DB user. Always pass `-T` for non-interactive commands so shells don't hang.

## Default Posture

- Reads first, writes only with explicit user approval in the same turn
- Wrap mutations in `BEGIN; … COMMIT;` so a surprise can be rolled back
- Always show row count before and after on any bulk operation
- Never run `TRUNCATE`, `DROP`, or `ALTER` directly — use Prisma migrations via `crm-prisma`

## Prod Gate

Writes to the production DB follow the same gate as `crm-deploy`: refuse unless the user's message contains the explicit prod keyword from `feedback_prod_deployment_rule.md`. Reads on prod are fine; surprises come from writes.

## Common Inspections

- Per-table counts across the core entities
- Rows missing `cluster_id` (tenant backfill audit)
- Recent `CallLog` entries for CDR verification
- Duplicate phones grouped by canonicalized value
- Audit log for a given entity id

See `crm-backfill-examples.md` style notes inline in the DB session, not in this skill.

## Backup Before Risk

Before any destructive statement on a shared DB, take a `pg_dump` snapshot. Confirm the snapshot restores before proceeding.

## Reference

- Schema: `packages/backend/prisma/schema.prisma`
- Admin scripts (if present): `packages/backend/src/scripts/`
- Related skills: `crm-prisma` (schema migrations), `crm-deploy` (prod gate, same rule)
