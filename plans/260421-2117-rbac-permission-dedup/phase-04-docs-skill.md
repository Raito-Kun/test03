# Phase 04 — Docs + skill update

**Stream D** · Priority: P1 · Status: Pending

## Files to modify

- `docs/codebase-summary.md` — update permission section with final 7-group inventory
- `docs/project-changelog.md` — add 2026-04-21 entry: "RBAC dedup + recording.delete + enforcement fixes"
- `docs/system-architecture.md` — update permission matrix diagram if present
- `.claude/skills/crm-permission/SKILL.md` — update "Model" section with 7 groups + full key list; update "Adding a New Permission" example to use modern naming; remove/update Ticket RBAC (2026-04-21) section to reflect that `ticket.delete` is now middleware-enforced (no longer hardcoded)

## Implementation steps

1. Read current docs + skill
2. Extract final permission inventory from updated seed.ts
3. Update codebase-summary.md table of permission groups
4. Append changelog entry with date, files, migration note
5. Rewrite skill "Model" section + remove stale hardcoded-delete note
6. Sync plan.md status fields when phases complete

## Todo

- [ ] Update codebase-summary.md
- [ ] Append changelog entry
- [ ] Update system-architecture.md
- [ ] Rewrite crm-permission skill
- [ ] Sync plan.md on completion

## Success criteria

- Docs reflect actual state (no mention of legacy keys except in migration note)
- Skill's anti-pattern section warns against re-introducing plural forms
- changelog captures migration SQL + cache-bust requirement

## Dependencies

- Blocked by: Phase 01 + Phase 02 (need final key list)
- Can run parallel with Phase 03
